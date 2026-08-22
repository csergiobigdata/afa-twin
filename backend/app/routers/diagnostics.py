from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas, security
from .. import diagnostics as diagnostics_service
from ..database import get_db

router = APIRouter(
    prefix="/api/diagnostics", tags=["diagnóstico inteligente"],
    dependencies=[Depends(security.get_current_user)],
)


@router.post("/search", response_model=schemas.DiagnosticResult)
def search(payload: schemas.DiagnosticQuery, db: Session = Depends(get_db)):
    return diagnostics_service.search_similar_occurrences(db, payload.symptom, payload.aircraft_model)
