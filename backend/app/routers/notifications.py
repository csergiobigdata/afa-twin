from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas, security
from .. import notifications as notifications_service
from ..database import get_db

router = APIRouter(
    prefix="/api/notifications", tags=["notificações"],
    dependencies=[Depends(security.get_current_user)],
)


def _to_out(n: models.Notification) -> schemas.NotificationOut:
    return schemas.NotificationOut(
        id=n.id, channel=n.channel, reason=n.reason, status=n.status,
        subject=n.subject, message=n.message, detail=n.detail,
        recipient_person_id=n.recipient_person_id,
        recipient_name=n.recipient.full_name if n.recipient else None,
        aircraft_id=n.aircraft_id, aircraft_tail_number=n.aircraft.tail_number if n.aircraft else None,
        component_id=n.component_id, component_name=n.component.name if n.component else None,
        created_at=n.created_at,
    )


@router.get("", response_model=list[schemas.NotificationOut])
def list_notifications(
    aircraft_id: int | None = None, component_id: int | None = None, limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(models.Notification).options(
        joinedload(models.Notification.recipient), joinedload(models.Notification.aircraft),
        joinedload(models.Notification.component),
    )
    if aircraft_id:
        q = q.filter(models.Notification.aircraft_id == aircraft_id)
    if component_id:
        q = q.filter(models.Notification.component_id == component_id)
    items = q.order_by(models.Notification.created_at.desc()).limit(min(limit, 200)).all()
    return [_to_out(n) for n in items]


@router.get("/pending-alerts", response_model=list[schemas.PendingPartAlert])
def pending_alerts(aircraft_id: int | None = None, db: Session = Depends(get_db)):
    alerts = notifications_service.check_pending_part_alerts(db)
    if aircraft_id:
        alerts = [a for a in alerts if a.aircraft_id == aircraft_id]
    return alerts


@router.get("/recipients", response_model=list[schemas.PersonOut])
def preview_recipients(aircraft_id: int, db: Session = Depends(get_db)):
    """Pré-visualização de quem seria notificado por uma aeronave (individuais + membros de grupo)."""
    aircraft = db.get(models.Aircraft, aircraft_id)
    if not aircraft:
        raise HTTPException(404, "Aeronave não encontrada")
    return notifications_service.suggested_recipients_for_aircraft(db, aircraft)


@router.post("/send", response_model=list[schemas.NotificationOut], status_code=201)
def send(payload: schemas.NotificationSendRequest, db: Session = Depends(get_db)):
    aircraft = db.get(models.Aircraft, payload.aircraft_id) if payload.aircraft_id else None
    if payload.aircraft_id and not aircraft:
        raise HTTPException(404, "Aeronave não encontrada")
    component = db.get(models.Component, payload.component_id) if payload.component_id else None
    group = db.get(models.ResponsibleGroup, payload.group_id) if payload.group_id else None
    if payload.group_id and not group:
        raise HTTPException(404, "Grupo não encontrado")

    if payload.recipient_person_ids:
        recipients = [db.get(models.Person, pid) for pid in payload.recipient_person_ids]
        recipients = [r for r in recipients if r is not None]
    elif group:
        recipients = notifications_service.recipients_for_group(db, group)
    elif aircraft:
        recipients = notifications_service.suggested_recipients_for_aircraft(db, aircraft)
    else:
        recipients = []

    if not recipients:
        raise HTTPException(
            400,
            "Nenhum destinatário encontrado. Informe recipient_person_ids, um grupo ou uma aeronave com "
            "responsáveis vinculados (aba Pessoal do cadastro da aeronave).",
        )

    return [
        _to_out(notifications_service.send_notification(
            db, payload.channel, r, payload.subject, payload.message,
            aircraft=aircraft, component=component, reason=payload.reason,
        ))
        for r in recipients
    ]
