from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/audit-log", tags=["auditoria"],
    dependencies=[Depends(security.get_current_user)],
)


@router.get("", response_model=list[schemas.AuditLogOut])
def list_audit_log(entity_type: str | None = None, limit: int = 200, db: Session = Depends(get_db)):
    q = db.query(models.AuditLog)
    if entity_type:
        q = q.filter(models.AuditLog.entity_type == entity_type)
    return q.order_by(models.AuditLog.created_at.desc()).limit(min(limit, 500)).all()
