from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/flight-logs", tags=["livro de bordo"],
    dependencies=[Depends(security.get_current_user)],
)


@router.get("", response_model=list[schemas.FlightLogOut])
def list_logs(aircraft_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.FlightLog)
    if aircraft_id:
        q = q.filter(models.FlightLog.aircraft_id == aircraft_id)
    return q.order_by(models.FlightLog.date.desc()).all()


@router.post("", response_model=schemas.FlightLogOut, status_code=201)
def create_log(payload: schemas.FlightLogCreate, db: Session = Depends(get_db)):
    aircraft = db.get(models.Aircraft, payload.aircraft_id)
    if not aircraft:
        raise HTTPException(400, "Aeronave informada não existe")
    log = models.FlightLog(**payload.model_dump())
    aircraft.total_flight_hours += payload.duration_hours
    for component in aircraft.components:
        component.hours_since_new += payload.duration_hours
        component.hours_since_overhaul += payload.duration_hours
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
