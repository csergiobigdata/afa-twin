from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db

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


@router.get("/me", response_model=schemas.TokenResponse)
def me(user: models.User = Depends(security.get_current_user)):
    token = security.create_token(user.id, user.username, user.role.value)
    return schemas.TokenResponse(
        access_token=token,
        username=user.username,
        role=user.role.value,
        person=schemas.PersonOut.model_validate(user.person) if user.person else None,
    )
