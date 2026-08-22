import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import audit, models, schemas, security
from .. import notifications as notifications_service
from ..database import get_db

router = APIRouter(
    prefix="/api/maintenance-orders", tags=["ordens de serviço"],
    dependencies=[Depends(security.get_current_user)],
)

_TERMINAL_STATUSES = (models.OrderStatus.CONCLUIDA, models.OrderStatus.CANCELADA)


def _next_order_number(db: Session) -> str:
    year = dt.datetime.now().year
    count = db.query(models.MaintenanceOrder).filter(
        models.MaintenanceOrder.order_number.like(f"OS-{year}-%")
    ).count()
    return f"OS-{year}-{count + 1:04d}"


@router.get("", response_model=list[schemas.MaintenanceOrderOut])
def list_orders(
    aircraft_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.MaintenanceOrder)
    if aircraft_id:
        q = q.filter(models.MaintenanceOrder.aircraft_id == aircraft_id)
    if status:
        q = q.filter(models.MaintenanceOrder.status == status)
    if priority:
        q = q.filter(models.MaintenanceOrder.priority == priority)
    return q.order_by(models.MaintenanceOrder.opened_at.desc()).all()


@router.get("/{order_id}", response_model=schemas.MaintenanceOrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    o = db.get(models.MaintenanceOrder, order_id)
    if not o:
        raise HTTPException(404, "Ordem de serviço não encontrada")
    return o


@router.post("", response_model=schemas.MaintenanceOrderOut, status_code=201)
def create_order(
    payload: schemas.MaintenanceOrderCreate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    if not db.get(models.Aircraft, payload.aircraft_id):
        raise HTTPException(400, "Aeronave informada não existe")
    data = payload.model_dump()
    order = models.MaintenanceOrder(order_number=_next_order_number(db), **data)
    db.add(order)
    db.commit()
    db.refresh(order)
    audit.log_action(db, actor, "Ordem de Serviço", order.id, models.AuditAction.CRIACAO,
                      f"OS {order.order_number} criada: \"{order.title}\" ({order.type.value}).",
                      entity_label=order.order_number)
    return order


@router.put("/{order_id}", response_model=schemas.MaintenanceOrderOut)
def update_order(
    order_id: int, payload: schemas.MaintenanceOrderUpdate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    o = db.get(models.MaintenanceOrder, order_id)
    if not o:
        raise HTTPException(404, "Ordem de serviço não encontrada")

    if o.status in _TERMINAL_STATUSES:
        raise HTTPException(
            400,
            f"Esta OS já está '{o.status.value}' e não pode mais ser alterada "
            "(ordens de serviço concluídas/canceladas são imutáveis).",
        )

    data = payload.model_dump(exclude_unset=True)

    is_cancelling = data.get("status") == models.OrderStatus.CANCELADA.value or payload.status == models.OrderStatus.CANCELADA
    if is_cancelling and not (data.get("cancelled_by_id") or payload.cancelled_by_id):
        raise HTTPException(400, "Para cancelar uma OS, informe o responsável pelo cancelamento (cancelled_by_id).")

    is_concluding = data.get("status") == models.OrderStatus.CONCLUIDA.value or payload.status == models.OrderStatus.CONCLUIDA

    for key, value in data.items():
        setattr(o, key, value)

    if is_concluding:
        o.closed_at = dt.datetime.now(dt.timezone.utc)
    if is_cancelling:
        o.cancelled_at = dt.datetime.now(dt.timezone.utc)

    db.commit()
    db.refresh(o)

    component = db.get(models.Component, o.component_id) if o.component_id else None
    aircraft = db.get(models.Aircraft, o.aircraft_id)

    if is_concluding:
        # Ao concluir uma OS vinculada a um componente com vigência definida,
        # avança automaticamente a próxima data de manutenção preventiva -
        # e registra/notifica o histórico de manutenção da peça.
        if component and component.preventive_interval_days:
            component.next_preventive_date = dt.date.today() + dt.timedelta(days=component.preventive_interval_days)
            db.commit()
        if aircraft:
            try:
                recipients = notifications_service.suggested_recipients_for_aircraft(db, aircraft)
                subject = f"[AFA-TWIN] Manutenção concluída: {o.order_number} ({aircraft.tail_number})"
                message = (
                    f'A ordem de serviço {o.order_number} - "{o.title}" na aeronave {aircraft.tail_number} '
                    f"foi concluída."
                    + (f" Componente: {component.name}." if component else "")
                    + (f" Equipe envolvida: {o.team_members}." if o.team_members else "")
                )
                for r in recipients:
                    notifications_service.send_notification(
                        db, models.NotificationChannel.EMAIL, r, subject, message,
                        aircraft=aircraft, component=component, reason=models.NotificationReason.MANUTENCAO_REGISTRADA,
                    )
            except Exception:
                pass
        audit.log_action(db, actor, "Ordem de Serviço", o.id, models.AuditAction.ALTERACAO,
                          f"OS {o.order_number} concluída.", entity_label=o.order_number)

    if is_cancelling:
        canceller = db.get(models.Person, o.cancelled_by_id) if o.cancelled_by_id else None
        if aircraft:
            try:
                recipients = notifications_service.suggested_recipients_for_aircraft(db, aircraft)
                subject = f"[AFA-TWIN] OS cancelada: {o.order_number} ({aircraft.tail_number})"
                message = (
                    f'A ordem de serviço {o.order_number} - "{o.title}" na aeronave {aircraft.tail_number} '
                    f"foi CANCELADA por {canceller.full_name if canceller else 'usuário não identificado'} "
                    f"em {o.cancelled_at.strftime('%d/%m/%Y %H:%M')}."
                    + (f" Motivo: {o.cancellation_reason}." if o.cancellation_reason else "")
                )
                for r in recipients:
                    notifications_service.send_notification(
                        db, models.NotificationChannel.EMAIL, r, subject, message,
                        aircraft=aircraft, component=component, reason=models.NotificationReason.CANCELAMENTO_OS,
                    )
            except Exception:
                pass
        audit.log_action(
            db, actor, "Ordem de Serviço", o.id, models.AuditAction.CANCELAMENTO,
            f"OS {o.order_number} cancelada por {canceller.full_name if canceller else '—'}"
            f"{f' - motivo: {o.cancellation_reason}' if o.cancellation_reason else ''}.",
            entity_label=o.order_number,
        )
    elif data and not is_concluding:
        audit.log_action(db, actor, "Ordem de Serviço", o.id, models.AuditAction.ALTERACAO,
                          f"OS {o.order_number} alterada: {', '.join(data.keys())}.", entity_label=o.order_number)

    return o


@router.delete("/{order_id}", status_code=405)
def delete_order(order_id: int):
    # Uma OS nunca é excluída (rastreabilidade obrigatória) - apenas cancelada
    # via PUT (status="Cancelada" + cancelled_by_id).
    raise HTTPException(405, "Ordens de serviço não podem ser excluídas, apenas canceladas (PUT com status=Cancelada e cancelled_by_id).")
