import mimetypes
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/inspections", tags=["inspeção fotográfica"],
    dependencies=[Depends(security.get_current_user)],
)

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_UPLOAD_BYTES = 6 * 1024 * 1024


def _to_out(f: models.InspectionFinding) -> schemas.InspectionFindingOut:
    return schemas.InspectionFindingOut.model_validate(f)


@router.get("", response_model=list[schemas.InspectionFindingOut])
def list_findings(
    aircraft_id: int | None = None, component_id: int | None = None, db: Session = Depends(get_db),
):
    q = db.query(models.InspectionFinding)
    if aircraft_id:
        q = q.filter(models.InspectionFinding.aircraft_id == aircraft_id)
    if component_id:
        q = q.filter(models.InspectionFinding.component_id == component_id)
    items = q.order_by(models.InspectionFinding.recorded_at.desc()).all()
    return [_to_out(f) for f in items]


@router.post("", response_model=schemas.InspectionFindingOut, status_code=201)
def create_finding(
    aircraft_id: int = Form(...),
    component_id: int | None = Form(None),
    defect_type: models.DefectType = Form(...),
    location: str | None = Form(None),
    severity: models.Criticality = Form(models.Criticality.MEDIA),
    extent: str | None = Form(None),
    probable_cause: str | None = Form(None),
    amm_reference: str | None = Form(None),
    notes: str | None = Form(None),
    recorded_by_id: int | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not db.get(models.Aircraft, aircraft_id):
        raise HTTPException(400, "Aeronave informada não existe")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Formato não suportado. Use: {', '.join(sorted(ALLOWED_EXT))}")
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "Arquivo excede o limite de 6MB.")
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    asset = models.MediaAsset(content_type=content_type, data=content)
    db.add(asset)
    db.flush()

    finding = models.InspectionFinding(
        aircraft_id=aircraft_id, component_id=component_id, defect_type=defect_type,
        location=location, severity=severity, extent=extent, probable_cause=probable_cause,
        amm_reference=amm_reference, notes=notes, recorded_by_id=recorded_by_id,
        photo_asset_id=asset.id,
    )
    db.add(finding)
    db.commit()
    db.refresh(finding)
    return _to_out(finding)


@router.delete("/{finding_id}", status_code=204)
def delete_finding(finding_id: int, db: Session = Depends(get_db)):
    f = db.get(models.InspectionFinding, finding_id)
    if not f:
        raise HTTPException(404, "Registro de inspeção não encontrado")
    asset = db.get(models.MediaAsset, f.photo_asset_id)
    db.delete(f)
    if asset:
        db.delete(asset)
    db.commit()
    return None
