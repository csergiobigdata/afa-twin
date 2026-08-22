from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas, compute, security
from ..database import get_db

router = APIRouter(
    prefix="/api/dashboard", tags=["painel de apoio à decisão"],
    dependencies=[Depends(security.get_current_user)],
)


@router.get("/summary", response_model=schemas.DashboardSummary)
def summary(db: Session = Depends(get_db)):
    aircraft_list = db.query(models.Aircraft).options(
        selectinload(models.Aircraft.components),
        selectinload(models.Aircraft.maintenance_orders),
    ).all()

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
    for a in aircraft_list:
        h, _risk = compute.compute_aircraft_health(a)
        healths.append(h)
        alerts.extend(compute.component_alerts(a))

    avg_health = round(sum(healths) / len(healths), 1) if healths else 100.0
    avg_availability = round((operational / total) * 100, 1) if total else 0.0

    # ordena alertas críticos primeiro
    severity_rank = {"critico": 0, "atencao": 1, "info": 2}
    alerts.sort(key=lambda x: severity_rank.get(x["severity"], 3))

    return schemas.DashboardSummary(
        total_aircraft=total,
        operational_aircraft=operational,
        in_maintenance_aircraft=in_maintenance,
        open_orders=len(open_orders),
        critical_orders=len(critical_orders),
        average_health_index=avg_health,
        average_fleet_availability_pct=avg_availability,
        alerts=[schemas.AlertOut(**al) for al in alerts],
    )
