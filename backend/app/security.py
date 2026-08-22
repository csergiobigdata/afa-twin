"""
Autenticação simplificada para o piloto de testes.

Sem dependências externas de criptografia (evita problemas de build de
bcrypt/passlib em versões novas do Python): hashing de senha com
PBKDF2-HMAC-SHA256 (stdlib `hashlib`) e token de sessão assinado com HMAC
(stdlib `hmac`), com expiração embutida.

Antes de qualquer uso além do piloto de testes, ver a recomendação de
evolução (OAuth2/JWT + MFA) em docs/02-arquitetura-da-solucao.md, seção
"Segurança".
"""
import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from . import models

SECRET_KEY = os.environ.get("AFA_TWIN_SECRET_KEY", "afa-twin-piloto-dev-secret-troque-em-producao")
TOKEN_TTL_SECONDS = 8 * 3600  # turno de 8h

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if salt is None:
        salt = base64.b64encode(os.urandom(16)).decode()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return base64.b64encode(digest).decode(), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    candidate, _ = hash_password(password, salt)
    return hmac.compare_digest(candidate, password_hash)


def _sign(payload: str) -> str:
    return hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: int, username: str, role: str) -> str:
    payload = {"uid": user_id, "sub": username, "role": role, "exp": time.time() + TOKEN_TTL_SECONDS}
    raw = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    signature = _sign(raw)
    return f"{raw}.{signature}"


def decode_token(token: str) -> dict:
    try:
        raw, signature = token.split(".")
        if not hmac.compare_digest(_sign(raw), signature):
            raise ValueError("assinatura inválida")
        payload = json.loads(base64.urlsafe_b64decode(raw.encode()))
        if payload["exp"] < time.time():
            raise ValueError("token expirado")
        return payload
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida ou expirada") from exc


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")
    payload = decode_token(credentials.credentials)
    user = db.get(models.User, payload["uid"])
    if user is None or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inválido")
    return user


def require_roles(*roles: str):
    def dependency(user: models.User = Depends(get_current_user)) -> models.User:
        if roles and user.role.value not in roles and user.role.name not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Perfil sem permissão para esta operação",
            )
        return user
    return dependency
