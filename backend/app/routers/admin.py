from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, security
from ..database import (
    Base, engine, get_db, sync_missing_columns, sync_missing_indexes, sync_postgres_enum_types,
    reformat_order_numbers, migrate_availability_code_column, cap_max_speed_values,
)
from ..seed import ADMIN_PASSWORD_DEFAULT, ADMIN_USERS

router = APIRouter(prefix="/api/admin", tags=["administração"])

TEST_USER_PASSWORD_DEFAULT = "AfaTwin@2026"


@router.post(
    "/sync-schema",
    dependencies=[Depends(security.require_roles(models.PersonRole.GESTOR.value))],
)
def sync_schema():
    """Aplica manualmente as sincronizações de esquema (`sync_postgres_enum_types`
    + `sync_missing_indexes` + `sync_missing_columns`, ver database.py) que em
    Postgres NÃO rodam mais sozinhas no startup (`main.py::on_startup`) -
    motivo duplo: (1) confirmado na prática que o hook de startup do FastAPI
    não era confiável no runtime serverless do Vercel para esse fim (tabelas/
    índices/enums novos não apareciam em produção até essa rotina ser chamada
    manualmente); (2) as três juntas fazem dezenas de round-trips de
    introspecção ao banco, o que medido custava ~43s de cold start no Vercel
    (cada round-trip paga a latência do Neon, gratuito, ainda acordando de
    uma suspensão por inatividade) - ver nota em main.py::on_startup. Por
    isso, chame esta rotina manualmente (autenticado como Gestor) depois de
    todo deploy que altera `models.py`; seguro de rodar quantas vezes forem
    necessárias (todas as operações internas são aditivas e idempotentes)."""
    Base.metadata.create_all(bind=engine)
    sync_postgres_enum_types()
    sync_missing_indexes()
    sync_missing_columns()
    # Já rodam automaticamente no startup (baratas) - chamadas aqui também
    # para permitir forçar sem esperar um redeploy/reinício.
    reformat_order_numbers()
    migrate_availability_code_column()
    cap_max_speed_values()
    return {"status": "ok", "detail": "Tabelas, tipos enum, índices e colunas sincronizados."}


@router.post(
    "/reset-password/{username}",
    dependencies=[Depends(security.require_roles(models.PersonRole.GESTOR.value))],
)
def reset_password(username: str, db: Session = Depends(get_db)):
    """Ação do administrador em resposta ao aviso de "Esqueci minha Senha"
    (ver routers/auth.py::forgot_password) - este piloto não tem redefinição
    self-service pelo próprio usuário, então um Gestor chama esta rotina para
    devolver a conta ao valor padrão: senha de usuário de teste
    (AfaTwin@2026) para qualquer username normal, ou a senha padrão de
    administrador (Afatwin@2026#) se o próprio username for um dos 2
    administradores (seed.ADMIN_USERS)."""
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise HTTPException(404, "Usuário não encontrado")
    is_admin = any(username == admin_username for admin_username, _, _ in ADMIN_USERS)
    new_password = ADMIN_PASSWORD_DEFAULT if is_admin else TEST_USER_PASSWORD_DEFAULT
    user.password_hash, user.password_salt = security.hash_password(new_password)
    db.commit()
    return {"status": "ok", "detail": f"Senha de \"{username}\" redefinida para o padrão."}
