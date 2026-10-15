from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, notifications, schemas, security
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["autenticação"])


def _find_user_by_username_or_email(db: Session, identifier: str) -> models.User | None:
    """A tela de login só pede "Usuário", mas é natural o usuário digitar o
    e-mail cadastrado por engano (ou por hábito de outros sistemas) - aceita
    os dois para não travar o acesso por causa disso."""
    user = db.query(models.User).filter(models.User.username == identifier).first()
    if user is not None:
        return user
    person = db.query(models.Person).filter(models.Person.email == identifier).first()
    if person is not None:
        return db.query(models.User).filter(models.User.person_id == person.id).first()
    return None


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = _find_user_by_username_or_email(db, payload.username)
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
    user = _find_user_by_username_or_email(db, payload.username)
    if user is not None:
        admins = notifications.admin_recipients(db)
        subject = f"[AFA-TWIN] Solicitação de redefinição de senha: usuário \"{user.username}\""
        message = (
            f"O usuário \"{user.username}\" solicitou a redefinição de senha pela tela de login do "
            f"AFA-TWIN e não conseguiu acessar o sistema.\n\n"
            f"Como administrador, acesse o banco/ambiente de produção e redefina a senha manualmente "
            f"para esse usuário."
        )
        for admin in admins:
            notifications.send_notification(
                db, models.NotificationChannel.EMAIL, admin, subject, message,
                reason=models.NotificationReason.SENHA_ESQUECIDA,
            )
    return schemas.ForgotPasswordResponse(detail="Acesse seu e-mail para redefinir sua senha.")


@router.get("/me", response_model=schemas.TokenResponse)
def me(user: models.User = Depends(security.get_current_user)):
    token = security.create_token(user.id, user.username, user.role.value)
    return schemas.TokenResponse(
        access_token=token,
        username=user.username,
        role=user.role.value,
        person=schemas.PersonOut.model_validate(user.person) if user.person else None,
    )
