import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import audit, models, schemas, security
from .. import availability as availability_service
from ..database import get_db

router = APIRouter(
    prefix="/api/availability-updates", tags=["atualização de disponibilidade"],
    dependencies=[Depends(security.get_current_user)],
)


def _get_aircraft_or_404(db: Session, aircraft_id: int) -> models.Aircraft:
    a = db.get(models.Aircraft, aircraft_id)
    if not a:
        raise HTTPException(404, f"Aeronave #{aircraft_id} não encontrada")
    return a


@router.get("/board", response_model=schemas.AvailabilityBoard)
def board(db: Session = Depends(get_db)):
    """Quadro de disponibilidade da frota (última atualização de cada
    aeronave + totais DI/DO/IN e de configuração), no formato do boletim de
    esquadrão."""
    return availability_service.compute_availability_board(db)


@router.get("", response_model=list[schemas.AvailabilityUpdateOut])
def list_updates(
    aircraft_id: int | None = None,
    report_date: dt.date | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    q = db.query(models.AvailabilityUpdate).options(joinedload(models.AvailabilityUpdate.aircraft))
    if aircraft_id:
        q = q.filter(models.AvailabilityUpdate.aircraft_id == aircraft_id)
    if report_date:
        q = q.filter(models.AvailabilityUpdate.report_date == report_date)
    items = q.order_by(
        models.AvailabilityUpdate.report_date.desc(), models.AvailabilityUpdate.created_at.desc()
    ).limit(min(limit, 500)).all()
    return [availability_service.to_out(u) for u in items]


@router.post("", response_model=schemas.AvailabilityUpdateOut, status_code=201)
def create_update(
    payload: schemas.AvailabilityUpdateCreate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    aircraft = _get_aircraft_or_404(db, payload.aircraft_id)
    u = models.AvailabilityUpdate(
        **payload.model_dump(),
        recorded_by_id=actor.person_id,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    audit.log_action(
        db, actor, "Atualização de Disponibilidade", u.id, models.AuditAction.CRIACAO,
        f"Lançamento de disponibilidade para {aircraft.tail_number} em {payload.report_date.strftime('%d/%m/%Y')}: "
        f"{payload.code.value}" + (f" ({payload.configuration})" if payload.configuration else "") + ".",
        entity_label=aircraft.tail_number,
    )
    return availability_service.to_out(u)


@router.post("/bulk", response_model=list[schemas.AvailabilityUpdateOut], status_code=201)
def create_bulk(
    payload: list[schemas.AvailabilityUpdateCreate], db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    """Lançamento em lote do boletim do dia (usado pela tela de colar/
    analisar o quadro no formato "5906 - DO (EEXD TREM DE POUSO)")."""
    if not payload:
        raise HTTPException(400, "Nenhum lançamento informado")

    created: list[models.AvailabilityUpdate] = []
    for item in payload:
        aircraft = _get_aircraft_or_404(db, item.aircraft_id)
        u = models.AvailabilityUpdate(
            **item.model_dump(),
            recorded_by_id=actor.person_id,
        )
        db.add(u)
        created.append(u)
    db.commit()
    for u in created:
        db.refresh(u)

    dates = sorted({u.report_date for u in created})
    date_label = dates[0].strftime("%d/%m/%Y") if len(dates) == 1 else f"{dates[0].strftime('%d/%m/%Y')}–{dates[-1].strftime('%d/%m/%Y')}"
    audit.log_action(
        db, actor, "Atualização de Disponibilidade", created[0].id, models.AuditAction.CRIACAO,
        f"Boletim de disponibilidade lançado em lote: {len(created)} aeronave(s), {date_label}.",
        entity_label=f"{len(created)} aeronave(s) - {date_label}",
    )
    return [availability_service.to_out(u) for u in created]


@router.delete("/{update_id}", status_code=204)
def delete_update(
    update_id: int, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    u = db.get(models.AvailabilityUpdate, update_id)
    if not u:
        raise HTTPException(404, "Lançamento não encontrado")
    tail = u.aircraft.tail_number
    report_date = u.report_date
    db.delete(u)
    db.commit()
    audit.log_action(
        db, actor, "Atualização de Disponibilidade", update_id, models.AuditAction.CANCELAMENTO,
        f"Lançamento de disponibilidade de {tail} em {report_date.strftime('%d/%m/%Y')} removido.",
        entity_label=tail,
    )
    return None
