import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/audit-log", tags=["auditoria"],
    dependencies=[Depends(security.get_current_user)],
)

# Coluna (ou expressão) usada para cada chave de ordenação aceita da tela -
# "actor" combina as duas colunas de responsável (pessoa vinculada à conta,
# com o username como retaguarda) no mesmo critério exibido na coluna
# "Responsável" do frontend (ver AuditPage.tsx::actorName).
_ACTOR_EXPR = func.coalesce(models.AuditLog.actor_person_name, models.AuditLog.actor_username)
_SORT_COLUMNS = {
    "created_at": models.AuditLog.created_at,
    "action": models.AuditLog.action,
    "entity_type": models.AuditLog.entity_type,
    "entity_label": models.AuditLog.entity_label,
    "summary": models.AuditLog.summary,
    "actor": _ACTOR_EXPR,
}


@router.get("/filter-options", response_model=schemas.AuditLogFilterOptions)
def audit_log_filter_options(db: Session = Depends(get_db)):
    """Valores distintos hoje presentes no histórico, para os 3 seletores de
    filtro - consulta leve (poucas dezenas de valores únicos), independente
    do volume total de registros."""
    entity_types = sorted({
        row[0] for row in db.query(models.AuditLog.entity_type).distinct().all()
    })
    actions = sorted({
        (row[0].value if hasattr(row[0], "value") else row[0])
        for row in db.query(models.AuditLog.action).distinct().all()
    })
    actors = sorted({
        row[0] for row in db.query(_ACTOR_EXPR).distinct().all() if row[0]
    })
    return schemas.AuditLogFilterOptions(entity_types=entity_types, actions=actions, actors=actors)


@router.get("", response_model=schemas.AuditLogPage)
def list_audit_log(
    entity_type: str | None = None,
    action: str | None = None,
    actor: str | None = None,
    search: str | None = None,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    sort_key: str = "created_at",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
):
    """Página filtrada/ordenada do histórico de auditoria - filtro,
    ordenação e recorte acontecem no banco (não no navegador), para a tela
    continuar rápida conforme o histórico cresce com o tempo (ver pedido do
    usuário de paginação por performance)."""
    q = db.query(models.AuditLog)
    if entity_type:
        q = q.filter(models.AuditLog.entity_type == entity_type)
    if action:
        q = q.filter(models.AuditLog.action == action)
    if actor:
        q = q.filter(_ACTOR_EXPR == actor)
    if date_from:
        q = q.filter(models.AuditLog.created_at >= dt.datetime.combine(date_from, dt.time.min))
    if date_to:
        q = q.filter(models.AuditLog.created_at <= dt.datetime.combine(date_to, dt.time.max))
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(or_(
            models.AuditLog.summary.ilike(like),
            models.AuditLog.entity_label.ilike(like),
            models.AuditLog.entity_type.ilike(like),
        ))

    total = q.count()

    column = _SORT_COLUMNS.get(sort_key, models.AuditLog.created_at)
    order = column.asc() if sort_dir == "asc" else column.desc()
    page = max(page, 1)
    page_size = max(1, min(page_size, 200))
    items = q.order_by(order).offset((page - 1) * page_size).limit(page_size).all()

    return schemas.AuditLogPage(items=items, total=total)
