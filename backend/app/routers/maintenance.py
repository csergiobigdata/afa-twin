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
    # Formato "AAAA/NNNN" (ex.: "2026/0002") - só o número da OS, sem a
    # sigla "OS-" (removida a pedido do usuário; o próprio módulo já se
    # chama "Ordem de Serviço", a sigla no número era redundante).
    #
    # Usa o MAIOR sufixo numérico já usado no ano + 1, não a CONTAGEM de OS
    # do ano - com qualquer lacuna na numeração (ex.: "2026/0001" nunca
    # existiu, mas "2026/0002" e "2026/0003" sim), contar géra um número já
    # usado (count=2 -> "2026/0003", que já existe) e a criação falha com
    # violação de chave única (`ix_maintenance_orders_order_number`),
    # confirmado em produção.
    year = dt.datetime.now().year
    prefix = f"{year}/"
    numbers = db.query(models.MaintenanceOrder.order_number).filter(
        models.MaintenanceOrder.order_number.like(f"{prefix}%")
    ).all()
    max_seq = 0
    for (number,) in numbers:
        try:
            max_seq = max(max_seq, int(number.split("/", 1)[1]))
        except (IndexError, ValueError):
            continue
    return f"{prefix}{max_seq + 1:04d}"


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
    aircraft = db.get(models.Aircraft, payload.aircraft_id)
    if not aircraft:
        raise HTTPException(400, "Aeronave informada não existe")
    data = payload.model_dump()
    order = models.MaintenanceOrder(order_number=_next_order_number(db), **data)
    db.add(order)

    # Prática da aeronáutica (ver docs/04): abrir uma OS é o que formaliza a
    # indução da aeronave à manutenção - o status não é trocado "a seco" por
    # quem está no hangar, ele é CONSEQUÊNCIA da OS existir. Só induz
    # automaticamente a partir de "Operacional"; se já estiver em outro
    # status de indisponibilidade (Em Inspeção, Em Modernização,
    # Indisponível), não sobrescreve - esses já têm motivo próprio.
    old_status = aircraft.status
    if aircraft.status == models.AircraftStatus.OPERACIONAL:
        aircraft.status = models.AircraftStatus.EM_MANUTENCAO

    db.commit()
    db.refresh(order)
    audit.log_action(db, actor, "Ordem de Serviço", order.id, models.AuditAction.CRIACAO,
                      f"OS {order.order_number} criada: \"{order.title}\" ({order.type.value}).",
                      entity_label=order.order_number)

    if aircraft.status != old_status:
        audit.log_action(
            db, actor, "Aeronave", aircraft.id, models.AuditAction.ALTERACAO,
            f"Aeronave {aircraft.tail_number} induzida à manutenção automaticamente (OS {order.order_number} "
            f"aberta): status \"{old_status.value}\" → \"{aircraft.status.value}\".",
            entity_label=aircraft.tail_number,
        )
        try:
            notifications_service.notify_status_change(db, aircraft, old_status, aircraft.status)
        except Exception:
            pass

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

    # Prática da aeronáutica (ver docs/04): a aeronave só volta a
    # "Operacional" quando a ÚLTIMA OS aberta é encerrada (concluída ou
    # cancelada) - retorno ao serviço, não o fechamento isolado de uma OS
    # entre várias. Só reverte se o status ainda for o induzido
    # automaticamente ("Em Manutenção"); se foi trocado manualmente para Em
    # Inspeção/Em Modernização/Indisponível nesse meio tempo, não mexe -
    # esse status tem motivo próprio, não cabe a esta OS decidir por ele.
    if (is_concluding or is_cancelling) and aircraft and aircraft.status == models.AircraftStatus.EM_MANUTENCAO:
        still_open = db.query(models.MaintenanceOrder).filter(
            models.MaintenanceOrder.aircraft_id == aircraft.id,
            models.MaintenanceOrder.id != o.id,
            models.MaintenanceOrder.status.notin_(list(_TERMINAL_STATUSES)),
        ).count()
        if still_open == 0:
            old_status = aircraft.status
            aircraft.status = models.AircraftStatus.OPERACIONAL
            db.commit()
            audit.log_action(
                db, actor, "Aeronave", aircraft.id, models.AuditAction.ALTERACAO,
                f"Aeronave {aircraft.tail_number} retornou ao serviço automaticamente (última OS aberta "
                f"{'concluída' if is_concluding else 'cancelada'}: {o.order_number}): status "
                f"\"{old_status.value}\" → \"{aircraft.status.value}\".",
                entity_label=aircraft.tail_number,
            )
            try:
                notifications_service.notify_status_change(db, aircraft, old_status, aircraft.status)
            except Exception:
                pass

    if data and not is_concluding and not is_cancelling:
        audit.log_action(db, actor, "Ordem de Serviço", o.id, models.AuditAction.ALTERACAO,
                          f"OS {o.order_number} alterada: {', '.join(data.keys())}.", entity_label=o.order_number)

    return o


@router.delete("/{order_id}", status_code=405)
def delete_order(order_id: int):
    # Uma OS nunca é excluída (rastreabilidade obrigatória) - apenas cancelada
    # via PUT (status="Cancelada" + cancelled_by_id).
    raise HTTPException(405, "Ordens de serviço não podem ser excluídas, apenas canceladas (PUT com status=Cancelada e cancelled_by_id).")
