from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/assignments", tags=["vínculos pessoa-aeronave"],
    dependencies=[Depends(security.get_current_user)],
)


@router.get("", response_model=list[schemas.AssignmentOut])
def list_assignments(aircraft_id: int | None = None, person_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Assignment).options(
        joinedload(models.Assignment.person), joinedload(models.Assignment.aircraft)
    )
    if aircraft_id:
        q = q.filter(models.Assignment.aircraft_id == aircraft_id)
    if person_id:
        q = q.filter(models.Assignment.person_id == person_id)
    return q.all()


@router.post("", response_model=schemas.AssignmentOut, status_code=201)
def create_assignment(payload: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    if not db.get(models.Person, payload.person_id):
        raise HTTPException(400, "Pessoa informada não existe")
    if not db.get(models.Aircraft, payload.aircraft_id):
        raise HTTPException(400, "Aeronave informada não existe")
    a = models.Assignment(**payload.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    a = db.get(models.Assignment, assignment_id)
    if not a:
        raise HTTPException(404, "Vínculo não encontrado")
    db.delete(a)
    db.commit()
    return None
