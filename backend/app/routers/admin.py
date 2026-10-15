import os

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .. import models, security
from .. import notifications as notifications_service
from ..database import (
    Base, engine, get_db, sync_missing_columns, sync_missing_indexes, sync_postgres_enum_types,
    reformat_order_numbers, migrate_availability_code_column, cap_max_speed_values,
)
from ..seed import ADMIN_PASSWORD_DEFAULT, ADMIN_USERS

router = APIRouter(prefix="/api/admin", tags=["administração"])

TEST_USER_PASSWORD_DEFAULT = "AfaTwin@2026"

# Autentica o cron diário (abaixo) sem exigir login de usuário: o Vercel
# Cron injeta automaticamente "Authorization: Bearer <CRON_SECRET>" na
# chamada quando a variável de ambiente CRON_SECRET está configurada no
# projeto (ver docs.vercel.com/cron-jobs/manage-cron-jobs#securing-cron-jobs)
# - sem essa variável configurada, o endpoint fica bloqueado para qualquer
# chamada (nunca fica aberto por engano).
CRON_SECRET = os.environ.get("CRON_SECRET", "")


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


@router.get("/notify-daily-alerts")
def notify_daily_alerts(authorization: str | None = Header(None), db: Session = Depends(get_db)):
    """Disparado automaticamente uma vez por dia pelo Vercel Cron (ver
    `backend/vercel.json`) - reenvia os alertas de desgaste/vencimento de
    peça (mesma regra de destinatários do botão manual no Painel) para toda
    aeronave que ainda não estiver "Em Manutenção", a pedido do usuário:
    o aviso deve continuar chegando todo dia até que um administrador ou
    mecânico responsável mude o status da aeronave (ver
    notifications.send_daily_wear_alert_notifications)."""
    if not CRON_SECRET or authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(401, "Não autorizado")
    return notifications_service.send_daily_wear_alert_notifications(db)
