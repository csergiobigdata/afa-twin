from fastapi import APIRouter, Depends

from .. import models, security
from ..database import (
    Base, engine, sync_missing_columns, sync_missing_indexes, sync_postgres_enum_types,
    reformat_order_numbers, migrate_availability_code_column,
)

router = APIRouter(prefix="/api/admin", tags=["administração"])


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
    return {"status": "ok", "detail": "Tabelas, tipos enum, índices e colunas sincronizados."}
