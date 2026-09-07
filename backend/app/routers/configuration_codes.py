"""Códigos de Configuração - catálogo de combinações padronizadas de
equipamento por estação (5, 4, 3, 2, 1), como o esquadrão já nomeia com um
código curto (ex.: "12", "19", "21I"). Ver nota completa em
models.py::ConfigurationCode.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import audit, models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/configuration-codes", tags=["códigos de configuração"],
    dependencies=[Depends(security.get_current_user)],
)


@router.get("", response_model=list[schemas.ConfigurationCodeOut])
def list_codes(db: Session = Depends(get_db)):
    return db.query(models.ConfigurationCode).order_by(models.ConfigurationCode.id).all()


def _get_or_404(db: Session, code_id: int) -> models.ConfigurationCode:
    item = db.get(models.ConfigurationCode, code_id)
    if not item:
        raise HTTPException(404, "Código de configuração não encontrado")
    return item


@router.post("", response_model=schemas.ConfigurationCodeOut, status_code=201)
def create_code(
    payload: schemas.ConfigurationCodeCreate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    existing = db.query(models.ConfigurationCode).filter(
        func.lower(models.ConfigurationCode.code) == payload.code.strip().lower()
    ).first()
    if existing:
        raise HTTPException(400, f"Já existe um código de configuração '{existing.code}'.")
    item = models.ConfigurationCode(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    audit.log_action(
        db, actor, "Código de Configuração", item.id, models.AuditAction.CRIACAO,
        f"Código de configuração '{item.code}' criado.", entity_label=item.code,
    )
    return item


@router.put("/{code_id}", response_model=schemas.ConfigurationCodeOut)
def update_code(
    code_id: int, payload: schemas.ConfigurationCodeUpdate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    item = _get_or_404(db, code_id)
    if payload.code and payload.code.strip().lower() != item.code.strip().lower():
        existing = db.query(models.ConfigurationCode).filter(
            func.lower(models.ConfigurationCode.code) == payload.code.strip().lower()
        ).first()
        if existing:
            raise HTTPException(400, f"Já existe um código de configuração '{existing.code}'.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    audit.log_action(
        db, actor, "Código de Configuração", item.id, models.AuditAction.ALTERACAO,
        f"Código de configuração '{item.code}' alterado.", entity_label=item.code,
    )
    return item


@router.delete("/{code_id}", status_code=204)
def delete_code(
    code_id: int, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    item = _get_or_404(db, code_id)
    code = item.code
    db.delete(item)
    db.commit()
    audit.log_action(
        db, actor, "Código de Configuração", code_id, models.AuditAction.CANCELAMENTO,
        f"Código de configuração '{code}' removido.", entity_label=code,
    )
    return None
