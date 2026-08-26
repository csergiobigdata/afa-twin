from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas, compute, security
from ..database import get_db

router = APIRouter(
    prefix="/api/dashboard", tags=["painel de apoio à decisão"],
    dependencies=[Depends(security.get_current_user)],
)


def _notification_to_out(n: models.Notification) -> schemas.NotificationOut:
    return schemas.NotificationOut(
        id=n.id, channel=n.channel, reason=n.reason, status=n.status,
        subject=n.subject, message=n.message, detail=n.detail,
        recipient_person_id=n.recipient_person_id,
        recipient_name=n.recipient.full_name if n.recipient else None,
        aircraft_id=n.aircraft_id, aircraft_tail_number=n.aircraft.tail_number if n.aircraft else None,
        component_id=n.component_id, component_name=n.component.name if n.component else None,
        created_at=n.created_at,
    )


@router.get("/summary", response_model=schemas.DashboardSummary)
def summary(db: Session = Depends(get_db)):
    # Um único carregamento (aeronaves + componentes + OS) alimenta os
    # totais, a saúde/risco por aeronave e os alertas - e também a tabela de
    # frota do Painel, dispensando uma segunda chamada do front a GET
    # /aircraft (que recalcularia tudo de novo, incluindo confiabilidade/MTBF
    # que o Painel nem usa). As notificações recentes entram na mesma
    # resposta pelo mesmo motivo: uma única ida ao servidor para montar a
    # tela inteira, em vez de três chamadas em paralelo.
    aircraft_list = db.query(models.Aircraft).options(
        selectinload(models.Aircraft.components),
        selectinload(models.Aircraft.maintenance_orders),
    ).order_by(models.Aircraft.tail_number).all()

    total = len(aircraft_list)
    operational = sum(1 for a in aircraft_list if a.status == models.AircraftStatus.OPERACIONAL)
    in_maintenance = sum(1 for a in aircraft_list if a.status in (
        models.AircraftStatus.EM_MANUTENCAO, models.AircraftStatus.EM_INSPECAO, models.AircraftStatus.EM_MODERNIZACAO
    ))

    all_orders = [o for a in aircraft_list for o in a.maintenance_orders]
    open_statuses = (models.OrderStatus.ABERTA, models.OrderStatus.EM_ANDAMENTO, models.OrderStatus.AGUARDANDO_PECA)
    open_orders = [o for o in all_orders if o.status in open_statuses]
    critical_orders = [o for o in open_orders if o.priority == models.Criticality.CRITICA]

    healths = []
    alerts: list[dict] = []
    fleet: list[schemas.FleetSummaryItem] = []
    for a in aircraft_list:
        h, risk = compute.compute_aircraft_health(a)
        healths.append(h)
        alerts.extend(compute.component_alerts(a))
        fleet.append(schemas.FleetSummaryItem(
            id=a.id, tail_number=a.tail_number, manufacturer=a.manufacturer, model=a.model,
            silhouette_key=a.silhouette_key, photo_url=a.photo_url, status=a.status,
            health_index=h, risk_level=risk,
        ))

    avg_health = round(sum(healths) / len(healths), 1) if healths else 100.0
    avg_availability = round((operational / total) * 100, 1) if total else 0.0

    # ordena alertas críticos primeiro
    severity_rank = {"critico": 0, "atencao": 1, "info": 2}
    alerts.sort(key=lambda x: severity_rank.get(x["severity"], 3))

    recent_notifications = db.query(models.Notification).options(
        joinedload(models.Notification.recipient),
        joinedload(models.Notification.aircraft),
        joinedload(models.Notification.component),
    ).order_by(models.Notification.created_at.desc()).limit(8).all()

    return schemas.DashboardSummary(
        total_aircraft=total,
        operational_aircraft=operational,
        in_maintenance_aircraft=in_maintenance,
        open_orders=len(open_orders),
        critical_orders=len(critical_orders),
        average_health_index=avg_health,
        average_fleet_availability_pct=avg_availability,
        alerts=[schemas.AlertOut(**al) for al in alerts],
        fleet=fleet,
        recent_notifications=[_notification_to_out(n) for n in recent_notifications],
    )
