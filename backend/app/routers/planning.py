from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas, security
from .. import planning as planning_service
from ..database import get_db

router = APIRouter(
    prefix="/api/planning", tags=["disponibilidade e análise prospectiva"],
    dependencies=[Depends(security.get_current_user)],
)


@router.get("/fleet-availability", response_model=schemas.FleetAvailabilityForecast)
def fleet_availability(horizon_days: int = 14, db: Session = Depends(get_db)):
    horizon_days = max(1, min(horizon_days, 60))
    return planning_service.compute_fleet_availability_forecast(db, horizon_days)


@router.post("/prospective-analysis", response_model=schemas.ProspectiveAnalysisResult)
def prospective_analysis(payload: schemas.ProspectiveAnalysisRequest, db: Session = Depends(get_db)):
    return planning_service.simulate_postpone_maintenance(db, payload)
