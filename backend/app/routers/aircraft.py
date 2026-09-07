import mimetypes
import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

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


@router.get("/{aircraft_id}/detail", response_model=schemas.AircraftDetailBundle)
def get_aircraft_detail(aircraft_id: int, db: Session = Depends(get_db)):
    """Agrega, numa única resposta, tudo que a tela de detalhe de uma
    aeronave (AircraftDetailPage) precisa: cadastro + componentes + ordens
    de serviço + vínculos de pessoal (com a pessoa já embutida) + livro de
    bordo. Antes eram 6 requisições HTTP independentes disparadas em
    paralelo pelo front (aircraft, components, maintenance-orders,
    assignments, people, flight-logs); em hospedagem "serverless" (backend
    no Vercel - ver docs/06-implantacao-nuvem.md), requisições concorrentes
    a uma função pouco usada podem cada uma pagar seu próprio "cold start" -
    tornando 6 chamadas paralelas bem mais lentas na prática do que uma
    única chamada equivalente, além do custo fixo (rede + autenticação) de
    cada requisição HTTP se repetir 6 vezes. `GET /people` continua
    separado (não é específico de uma aeronave; já fica com cache de
    leitura de 15s reaproveitado entre navegações - ver frontend/src/api/
    client.ts)."""
    a = db.query(models.Aircraft).options(
        selectinload(models.Aircraft.components),
        selectinload(models.Aircraft.maintenance_orders),
        selectinload(models.Aircraft.assignments).joinedload(models.Assignment.person),
        selectinload(models.Aircraft.flight_logs),
    ).filter(models.Aircraft.id == aircraft_id).first()
    if not a:
        raise HTTPException(404, "Aeronave não encontrada")

    return schemas.AircraftDetailBundle(
        aircraft=_to_out(a),
        components=sorted(a.components, key=lambda c: c.name),
        maintenance_orders=sorted(a.maintenance_orders, key=lambda o: o.opened_at, reverse=True),
        assignments=a.assignments,
        flight_logs=sorted(a.flight_logs, key=lambda f: f.date, reverse=True),
    )


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

    # Notification.aircraft_id/component_id não têm cascade a partir de
    # Aircraft (é um histórico de comunicação independente, não uma coleção
    # "pertencente" à aeronave como components/maintenance_orders/etc.) - em
    # Postgres (produção), a FK bloqueia a exclusão da aeronave enquanto
    # existir uma notificação antiga apontando para ela ou para um de seus
    # componentes (SQLite não aplica a FK por padrão, então isso não
    # aparecia em desenvolvimento local). Preserva a notificação (valor
    # histórico) e só desvincula a referência, em vez de apagá-la.
    component_ids = [c.id for c in a.components]
    conditions = [models.Notification.aircraft_id == aircraft_id]
    if component_ids:
        conditions.append(models.Notification.component_id.in_(component_ids))
    for n in db.query(models.Notification).filter(or_(*conditions)).all():
        if n.aircraft_id == aircraft_id:
            n.aircraft_id = None
        if n.component_id in component_ids:
            n.component_id = None

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
