from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import audit, models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/components", tags=["componentes"],
    dependencies=[Depends(security.get_current_user)],
)


@router.get("", response_model=list[schemas.ComponentOut])
def list_components(aircraft_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Component)
    if aircraft_id:
        q = q.filter(models.Component.aircraft_id == aircraft_id)
    return q.order_by(models.Component.name).all()


@router.get("/{component_id}", response_model=schemas.ComponentOut)
def get_component(component_id: int, db: Session = Depends(get_db)):
    c = db.get(models.Component, component_id)
    if not c:
        raise HTTPException(404, "Componente não encontrado")
    return c


@router.post("", response_model=schemas.ComponentOut, status_code=201)
def create_component(
    payload: schemas.ComponentCreate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    if not db.get(models.Aircraft, payload.aircraft_id):
        raise HTTPException(400, "Aeronave informada não existe")
    c = models.Component(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    audit.log_action(db, actor, "Componente", c.id, models.AuditAction.CRIACAO,
                      f"Componente '{c.name}' cadastrado na aeronave #{c.aircraft_id}.", entity_label=c.name)
    return c


@router.put("/{component_id}", response_model=schemas.ComponentOut)
def update_component(
    component_id: int, payload: schemas.ComponentUpdate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    c = db.get(models.Component, component_id)
    if not c:
        raise HTTPException(404, "Componente não encontrado")
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(c, key, value)
    db.commit()
    db.refresh(c)
    if changes:
        audit.log_action(db, actor, "Componente", c.id, models.AuditAction.ALTERACAO,
                          f"Componente '{c.name}' alterado: {', '.join(changes.keys())}.", entity_label=c.name)
    return c


@router.delete("/{component_id}", status_code=204)
def delete_component(component_id: int, db: Session = Depends(get_db)):
    c = db.get(models.Component, component_id)
    if not c:
        raise HTTPException(404, "Componente não encontrado")
    db.delete(c)
    db.commit()
    return None
