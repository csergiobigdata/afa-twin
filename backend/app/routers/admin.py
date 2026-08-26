from fastapi import APIRouter, Depends

from .. import models, security
from ..database import Base, engine, sync_missing_indexes, sync_postgres_enum_types

router = APIRouter(prefix="/api/admin", tags=["administração"])


@router.post(
    "/sync-schema",
    dependencies=[Depends(security.require_roles(models.PersonRole.GESTOR.value))],
)
def sync_schema():
    """Aplica manualmente as sincronizações de esquema que deveriam rodar
    sozinhas no startup (`Base.metadata.create_all` + `sync_postgres_enum_types`
    + `sync_missing_indexes`, ver database.py) - confirmado na prática que o
    hook de startup do FastAPI (`@app.on_event("startup")`) não é confiável no
    runtime serverless do Vercel (tabelas/índices/enums que deveriam ter sido
    criados/atualizados sozinhos a um novo deploy não apareciam no Postgres de
    produção até essa rotina ser chamada manualmente). Only o Gestor pode
    chamar; seguro de rodar quantas vezes forem necessárias (todas as
    operações internas são aditivas e idempotentes)."""
    Base.metadata.create_all(bind=engine)
    sync_postgres_enum_types()
    sync_missing_indexes()
    return {"status": "ok", "detail": "Tabelas, tipos enum e índices sincronizados."}
