"""Códigos de Disponibilidade - cadastro editável dos códigos aceitos em
AvailabilityUpdate.code (DI/DO/IN/IS de fábrica, ver seed.py). Ver nota
completa em models.py::AvailabilityCodeCatalog.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import audit, models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/availability-codes", tags=["códigos de disponibilidade"],
    dependencies=[Depends(security.get_current_user)],
)


@router.get("", response_model=list[schemas.AvailabilityCodeCatalogOut])
def list_codes(db: Session = Depends(get_db)):
    return db.query(models.AvailabilityCodeCatalog).order_by(models.AvailabilityCodeCatalog.id).all()


def _get_or_404(db: Session, code_id: int) -> models.AvailabilityCodeCatalog:
    item = db.get(models.AvailabilityCodeCatalog, code_id)
    if not item:
        raise HTTPException(404, "Código de disponibilidade não encontrado")
    return item


@router.post("", response_model=schemas.AvailabilityCodeCatalogOut, status_code=201)
def create_code(
    payload: schemas.AvailabilityCodeCatalogCreate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    code = payload.code.strip().upper()
    existing = db.query(models.AvailabilityCodeCatalog).filter(
        func.upper(models.AvailabilityCodeCatalog.code) == code
    ).first()
    if existing:
        raise HTTPException(400, f"Já existe um código de disponibilidade '{existing.code}'.")
    item = models.AvailabilityCodeCatalog(code=code, description=payload.description.strip())
    db.add(item)
    db.commit()
    db.refresh(item)
    audit.log_action(
        db, actor, "Código de Disponibilidade", item.id, models.AuditAction.CRIACAO,
        f"Código de disponibilidade '{item.code}' criado ({item.description}).", entity_label=item.code,
    )
    return item


@router.put("/{code_id}", response_model=schemas.AvailabilityCodeCatalogOut)
def update_code(
    code_id: int, payload: schemas.AvailabilityCodeCatalogUpdate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    item = _get_or_404(db, code_id)
    if payload.code:
        new_code = payload.code.strip().upper()
        if new_code != item.code:
            existing = db.query(models.AvailabilityCodeCatalog).filter(
                func.upper(models.AvailabilityCodeCatalog.code) == new_code
            ).first()
            if existing:
                raise HTTPException(400, f"Já existe um código de disponibilidade '{existing.code}'.")
        item.code = new_code
    if payload.description is not None:
        item.description = payload.description.strip()
    db.commit()
    db.refresh(item)
    audit.log_action(
        db, actor, "Código de Disponibilidade", item.id, models.AuditAction.ALTERACAO,
        f"Código de disponibilidade '{item.code}' alterado ({item.description}).", entity_label=item.code,
    )
    return item


@router.delete("/{code_id}", status_code=204)
def delete_code(
    code_id: int, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    item = _get_or_404(db, code_id)
    in_use = db.query(models.AvailabilityUpdate).filter(models.AvailabilityUpdate.code == item.code).first()
    if in_use:
        raise HTTPException(400, f"Código '{item.code}' já usado em lançamentos de disponibilidade e não pode ser removido.")
    code = item.code
    db.delete(item)
    db.commit()
    audit.log_action(
        db, actor, "Código de Disponibilidade", code_id, models.AuditAction.CANCELAMENTO,
        f"Código de disponibilidade '{code}' removido.", entity_label=code,
    )
    return None
