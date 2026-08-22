from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/lookups", tags=["cadastros auxiliares"],
    dependencies=[Depends(security.get_current_user)],
)


@router.get("", response_model=list[schemas.LookupItemOut])
def list_lookups(category: models.LookupCategory | None = None, include_inactive: bool = False, db: Session = Depends(get_db)):
    q = db.query(models.LookupItem)
    if category:
        q = q.filter(models.LookupItem.category == category)
    if not include_inactive:
        q = q.filter(models.LookupItem.active.is_(True))
    return q.order_by(models.LookupItem.category, models.LookupItem.value).all()


@router.post("", response_model=schemas.LookupItemOut, status_code=201)
def create_lookup(payload: schemas.LookupItemCreate, db: Session = Depends(get_db)):
    existing = db.query(models.LookupItem).filter(
        models.LookupItem.category == payload.category, models.LookupItem.value == payload.value,
    ).first()
    if existing:
        raise HTTPException(400, "Este item já existe nesta categoria.")
    item = models.LookupItem(category=payload.category, value=payload.value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=schemas.LookupItemOut)
def update_lookup(item_id: int, payload: schemas.LookupItemUpdate, db: Session = Depends(get_db)):
    item = db.get(models.LookupItem, item_id)
    if not item:
        raise HTTPException(404, "Item não encontrado")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_lookup(item_id: int, db: Session = Depends(get_db)):
    item = db.get(models.LookupItem, item_id)
    if not item:
        raise HTTPException(404, "Item não encontrado")
    db.delete(item)
    db.commit()
    return None
