from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, notifications, schemas, security
from ..database import get_db
from ..seed import ADMIN_USERS

router = APIRouter(prefix="/api/auth", tags=["autenticação"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if user is None or not security.verify_password(payload.password, user.password_hash, user.password_salt):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário ou senha inválidos")
    if not user.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário desativado")
    token = security.create_token(user.id, user.username, user.role.value)
    return schemas.TokenResponse(
        access_token=token,
        username=user.username,
        role=user.role.value,
        person=schemas.PersonOut.model_validate(user.person) if user.person else None,
    )


@router.post("/forgot-password", response_model=schemas.ForgotPasswordResponse)
def forgot_password(payload: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Fluxo simplificado do piloto: não existe redefinição de senha pelo
    próprio usuário (sem provedor de e-mail transacional dedicado); em vez
    disso, avisa os 2 usuários administradores (sempre existentes - ver
    seed.ensure_admin_users) para que um deles redefina a senha manualmente.
    Responde com a mesma mensagem genérica mesmo se o usuário não existir,
    para não confirmar/negar quais usuários estão cadastrados; só dispara o
    e-mail quando o usuário de fato existe."""
    user = db.query(models.User).filter(models.User.username == payload.username).first()
    if user is not None:
        admin_emails = {email for _, email, _ in ADMIN_USERS}
        admins = db.query(models.Person).filter(models.Person.email.in_(admin_emails)).all()
        subject = f"[AFA-TWIN] Solicitação de redefinição de senha: usuário \"{payload.username}\""
        message = (
            f"O usuário \"{payload.username}\" solicitou a redefinição de senha pela tela de login do "
            f"AFA-TWIN e não conseguiu acessar o sistema.\n\n"
            f"Como administrador, acesse o banco/ambiente de produção e redefina a senha manualmente "
            f"para esse usuário."
        )
        for admin in admins:
            notifications.send_notification(
                db, models.NotificationChannel.EMAIL, admin, subject, message,
                reason=models.NotificationReason.SENHA_ESQUECIDA,
            )
    return schemas.ForgotPasswordResponse(
        detail="Se o usuário existir, os administradores do sistema foram notificados para redefinir a senha."
    )


@router.get("/me", response_model=schemas.TokenResponse)
def me(user: models.User = Depends(security.get_current_user)):
    token = security.create_token(user.id, user.username, user.role.value)
    return schemas.TokenResponse(
        access_token=token,
        username=user.username,
        role=user.role.value,
        person=schemas.PersonOut.model_validate(user.person) if user.person else None,
    )
