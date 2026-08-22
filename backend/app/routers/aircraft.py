import mimetypes
import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session, selectinload

from .. import audit, models, schemas, compute, security, reliability
from .. import notifications as notifications_service
from ..database import get_db

router = APIRouter(
    prefix="/api/aircraft", tags=["aeronaves"],
    dependencies=[Depends(security.get_current_user)],
)

ALLOWED_STATIC_EXT = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_ANIMATED_EXT = {".gif", ".webp"}
MAX_UPLOAD_BYTES = 6 * 1024 * 1024  # 6MB


def _to_out(a: models.Aircraft) -> schemas.AircraftOut:
    health, risk = compute.compute_aircraft_health(a)
    out = schemas.AircraftOut.model_validate(a)
    out.health_index = health
    out.risk_level = risk
    out.availability_pct = compute.simple_availability_pct(a)
    metrics = reliability.compute_reliability_metrics(a)
    out.reliability_pct = (
        metrics.reliability_pct_next_100h
        if metrics.reliability_pct_next_100h is not None
        else compute.simple_reliability_pct(a)
    )
    return out


def _save_upload(db: Session, file: UploadFile, allowed_ext: set[str]) -> int:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(400, f"Formato não suportado. Use um dos formatos: {', '.join(sorted(allowed_ext))}")
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "Arquivo excede o limite de 6MB.")
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    asset = models.MediaAsset(content_type=content_type, data=content)
    db.add(asset)
    db.flush()
    return asset.id


def _delete_asset_if_exists(db: Session, asset_id: int | None) -> None:
    if not asset_id:
        return
    asset = db.get(models.MediaAsset, asset_id)
    if asset:
        db.delete(asset)


def _get_or_404(db: Session, aircraft_id: int) -> models.Aircraft:
    a = db.get(models.Aircraft, aircraft_id)
    if not a:
        raise HTTPException(404, "Aeronave não encontrada")
    return a


@router.get("", response_model=list[schemas.AircraftOut])
def list_aircraft(db: Session = Depends(get_db)):
    items = db.query(models.Aircraft).options(
        selectinload(models.Aircraft.components),
        selectinload(models.Aircraft.maintenance_orders),
    ).order_by(models.Aircraft.tail_number).all()
    return [_to_out(a) for a in items]


@router.get("/{aircraft_id}", response_model=schemas.AircraftOut)
def get_aircraft(aircraft_id: int, db: Session = Depends(get_db)):
    return _to_out(_get_or_404(db, aircraft_id))


@router.post("", response_model=schemas.AircraftOut, status_code=201)
def create_aircraft(
    payload: schemas.AircraftCreate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    exists = db.query(models.Aircraft).filter(models.Aircraft.tail_number == payload.tail_number).first()
    if exists:
        raise HTTPException(400, "Já existe uma aeronave cadastrada com esta matrícula")
    a = models.Aircraft(**payload.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    audit.log_action(db, actor, "Aeronave", a.id, models.AuditAction.CRIACAO,
                      f"Aeronave {a.tail_number} ({a.manufacturer} {a.model}) cadastrada.", entity_label=a.tail_number)
    return _to_out(a)


@router.put("/{aircraft_id}", response_model=schemas.AircraftOut)
def update_aircraft(
    aircraft_id: int, payload: schemas.AircraftUpdate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    a = _get_or_404(db, aircraft_id)
    old_status = a.status
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(a, key, value)
    db.commit()
    db.refresh(a)

    if payload.status is not None and payload.status != old_status:
        # Notifica automaticamente os responsáveis vinculados à aeronave.
        # Falha no envio (ex.: SMTP indisponível) não deve travar o cadastro.
        try:
            notifications_service.notify_status_change(db, a, old_status, a.status)
        except Exception:
            pass

    if changes:
        audit.log_action(db, actor, "Aeronave", a.id, models.AuditAction.ALTERACAO,
                          f"Aeronave {a.tail_number} alterada: {', '.join(changes.keys())}.", entity_label=a.tail_number)

    return _to_out(a)


@router.delete("/{aircraft_id}", status_code=204, dependencies=[Depends(security.require_roles(
    models.PersonRole.GESTOR.value, models.PersonRole.ENGENHEIRO.value))])
def delete_aircraft(aircraft_id: int, db: Session = Depends(get_db)):
    a = _get_or_404(db, aircraft_id)
    _delete_asset_if_exists(db, a.photo_asset_id)
    _delete_asset_if_exists(db, a.photo_animated_asset_id)
    db.delete(a)
    db.commit()
    return None


# ---------------- Foto real da aeronave (estática + animada) ----------------

@router.post("/{aircraft_id}/photo", response_model=schemas.AircraftOut)
def upload_photo(aircraft_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    a = _get_or_404(db, aircraft_id)
    old_asset_id = a.photo_asset_id
    a.photo_asset_id = _save_upload(db, file, ALLOWED_STATIC_EXT)
    _delete_asset_if_exists(db, old_asset_id)
    db.commit()
    db.refresh(a)
    return _to_out(a)


@router.post("/{aircraft_id}/photo-animated", response_model=schemas.AircraftOut)
def upload_photo_animated(aircraft_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    a = _get_or_404(db, aircraft_id)
    old_asset_id = a.photo_animated_asset_id
    a.photo_animated_asset_id = _save_upload(db, file, ALLOWED_ANIMATED_EXT)
    _delete_asset_if_exists(db, old_asset_id)
    db.commit()
    db.refresh(a)
    return _to_out(a)


@router.delete("/{aircraft_id}/photo", response_model=schemas.AircraftOut)
def delete_photo(aircraft_id: int, db: Session = Depends(get_db)):
    a = _get_or_404(db, aircraft_id)
    _delete_asset_if_exists(db, a.photo_asset_id)
    a.photo_asset_id = None
    db.commit()
    db.refresh(a)
    return _to_out(a)


@router.delete("/{aircraft_id}/photo-animated", response_model=schemas.AircraftOut)
def delete_photo_animated(aircraft_id: int, db: Session = Depends(get_db)):
    a = _get_or_404(db, aircraft_id)
    _delete_asset_if_exists(db, a.photo_animated_asset_id)
    a.photo_animated_asset_id = None
    db.commit()
    db.refresh(a)
    return _to_out(a)


# ---------------- Confiabilidade e Risco Operacional ponderado ----------------

@router.get("/{aircraft_id}/reliability", response_model=schemas.ReliabilityMetrics)
def get_reliability(aircraft_id: int, db: Session = Depends(get_db)):
    a = db.get(models.Aircraft, aircraft_id, options=[selectinload(models.Aircraft.maintenance_orders)])
    if not a:
        raise HTTPException(404, "Aeronave não encontrada")
    return reliability.compute_reliability_metrics(a)


@router.get("/{aircraft_id}/operational-risk", response_model=schemas.OperationalRiskBreakdown)
def get_operational_risk(aircraft_id: int, db: Session = Depends(get_db)):
    a = db.get(models.Aircraft, aircraft_id, options=[
        selectinload(models.Aircraft.components), selectinload(models.Aircraft.maintenance_orders),
    ])
    if not a:
        raise HTTPException(404, "Aeronave não encontrada")
    return compute.compute_operational_risk(a)
