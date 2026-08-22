"""
Disponibilidade da Frota (projeção) e Análise Prospectiva de Manutenção
("e se eu adiar esta inspeção?") - módulos descritos no documento de
referência como funcionalidades estratégicas ainda não integradas em
sistemas de manutenção convencionais.

Ambos os cálculos aqui são simulações determinísticas e transparentes
sobre os dados já cadastrados (sem modelos de machine learning) - o valor
de custo por dia de indisponibilidade é um parâmetro de referência
configurável para a fase piloto, não um dado financeiro real da FAB/ITA/
Embraer. Ver docs/04-protocolos-e-conformidade.md.
"""
from __future__ import annotations

import datetime as dt

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from . import compute, models, schemas

# Valor de referência ilustrativo (BRL) usado apenas para dimensionar a
# ordem de grandeza do impacto financeiro no simulador. Ajuste para a
# realidade orçamentária real antes de usar este número em qualquer decisão.
REFERENCE_COST_PER_DAY_GROUNDED_BRL = 45_000.0

_BLOCKING_STATUSES = (
    models.AircraftStatus.EM_MANUTENCAO,
    models.AircraftStatus.EM_INSPECAO,
    models.AircraftStatus.INDISPONIVEL,
    models.AircraftStatus.EM_MODERNIZACAO,
)
_OPEN_ORDER_STATUSES = (
    models.OrderStatus.ABERTA, models.OrderStatus.EM_ANDAMENTO, models.OrderStatus.AGUARDANDO_PECA,
)
_PRIORITY_WEIGHT = {
    models.Criticality.CRITICA: 4, models.Criticality.ALTA: 3,
    models.Criticality.MEDIA: 2, models.Criticality.BAIXA: 1,
}


def compute_fleet_availability_forecast(db: Session, horizon_days: int = 14) -> schemas.FleetAvailabilityForecast:
    fleet = db.query(models.Aircraft).options(selectinload(models.Aircraft.maintenance_orders)).all()
    total = len(fleet)
    today = dt.date.today()
    days: list[schemas.FleetAvailabilityDay] = []

    for offset in range(horizon_days):
        day = today + dt.timedelta(days=offset)
        at_risk: list[str] = []
        for aircraft in fleet:
            blocked = aircraft.status in _BLOCKING_STATUSES
            if not blocked:
                for order in aircraft.maintenance_orders:
                    # Só considera a OS como bloqueadora de disponibilidade se a
                    # prioridade for Alta/Crítica - uma OS de baixa prioridade
                    # em aberto (ex.: boletim de software) não deveria, por si
                    # só, indicar a aeronave como indisponível.
                    is_relevant_priority = order.priority in (models.Criticality.ALTA, models.Criticality.CRITICA)
                    if (
                        is_relevant_priority and order.status in _OPEN_ORDER_STATUSES and order.due_at
                        and order.opened_at.date() <= day <= order.due_at.date()
                    ):
                        blocked = True
                        break
            if blocked:
                at_risk.append(aircraft.tail_number)
        days.append(schemas.FleetAvailabilityDay(
            date=day, available_count=total - len(at_risk), unavailable_count=len(at_risk),
            at_risk_tail_numbers=at_risk,
        ))

    candidates = [(o, a) for a in fleet for o in a.maintenance_orders if o.status in _OPEN_ORDER_STATUSES]
    highest_order_number = None
    highest_note = None
    if candidates:
        def score(pair: tuple[models.MaintenanceOrder, models.Aircraft]) -> float:
            order, aircraft = pair
            bonus = 1.5 if aircraft.status == models.AircraftStatus.OPERACIONAL else 1.0
            return _PRIORITY_WEIGHT.get(order.priority, 1) * bonus
        best_order, best_aircraft = max(candidates, key=score)
        highest_order_number = best_order.order_number
        highest_note = (
            f'"{best_order.title}" ({best_order.order_number}) na aeronave {best_aircraft.tail_number} é a '
            f"ordem de serviço em aberto que mais compromete a disponibilidade da frota se atrasar."
        )

    return schemas.FleetAvailabilityForecast(
        horizon_days=horizon_days, total_aircraft=total, days=days,
        highest_impact_order=highest_order_number, highest_impact_note=highest_note,
    )


def _estimate_daily_flight_hours(db: Session, aircraft_id: int) -> float:
    logs = (
        db.query(models.FlightLog)
        .filter(models.FlightLog.aircraft_id == aircraft_id)
        .order_by(models.FlightLog.date.desc())
        .limit(30)
        .all()
    )
    if len(logs) >= 2:
        span_days = max(1, (logs[0].date - logs[-1].date).days)
        return sum(l.duration_hours for l in logs) / span_days
    if len(logs) == 1:
        return logs[0].duration_hours
    return 1.0  # padrão conservador na ausência de livro de bordo


def simulate_postpone_maintenance(db: Session, req: schemas.ProspectiveAnalysisRequest) -> schemas.ProspectiveAnalysisResult:
    aircraft = db.get(
        models.Aircraft, req.aircraft_id,
        options=[selectinload(models.Aircraft.components), selectinload(models.Aircraft.maintenance_orders)],
    )
    if not aircraft:
        raise HTTPException(404, "Aeronave não encontrada")

    component = db.get(models.Component, req.component_id) if req.component_id else None
    if req.component_id and (component is None or component.aircraft_id != aircraft.id):
        raise HTTPException(400, "Componente informado não pertence a esta aeronave")

    current_health, current_risk = compute.compute_aircraft_health(aircraft)
    current_wear = component.wear_pct if component else None

    daily_hours = req.daily_flight_hours_estimate or _estimate_daily_flight_hours(db, aircraft.id)
    extra_hours = daily_hours * req.postpone_days

    # Recalcula saúde/risco projetando as horas extras "em memória" (sem
    # persistir no banco) sobre a aeronave e o componente afetado.
    original_total_hours = aircraft.total_flight_hours
    original_overhaul = component.hours_since_overhaul if component else None
    original_new = component.hours_since_new if component else None
    try:
        aircraft.total_flight_hours = original_total_hours + extra_hours
        if component:
            component.hours_since_overhaul = (original_overhaul or 0) + extra_hours
            component.hours_since_new = (original_new or 0) + extra_hours
        projected_health, projected_risk = compute.compute_aircraft_health(aircraft)
        projected_wear = component.wear_pct if component else None
    finally:
        aircraft.total_flight_hours = original_total_hours
        if component:
            component.hours_since_overhaul = original_overhaul
            component.hours_since_new = original_new

    health_drop = max(0.0, current_health - projected_health)
    availability_impact = round(health_drop * 0.6, 1)
    increased_failure_prob = round(min(95.0, health_drop * 1.3), 1)
    financial_impact = round((availability_impact / 100) * REFERENCE_COST_PER_DAY_GROUNDED_BRL * req.postpone_days, 2)

    risk_order = {"Baixo": 0, "Médio": 1, "Alto": 2, "Crítico": 3}
    if risk_order.get(projected_risk, 0) > risk_order.get(current_risk, 0):
        recommendation = (
            f"Adiar {req.postpone_days} dia(s) NÃO é recomendado: o risco operacional projetado sobe de "
            f"'{current_risk}' para '{projected_risk}'. Priorize a execução da manutenção conforme planejado."
        )
    elif health_drop >= 10:
        recommendation = (
            f"Impacto relevante estimado (-{health_drop:.1f} pontos no índice de saúde). Avalie antecipar "
            "peças/recursos antes de confirmar o adiamento."
        )
    else:
        recommendation = (
            f"Impacto estimado limitado para {req.postpone_days} dia(s) de adiamento, mas monitore o(s) "
            "componente(s) crítico(s) envolvidos."
        )

    return schemas.ProspectiveAnalysisResult(
        aircraft_tail_number=aircraft.tail_number,
        postpone_days=req.postpone_days,
        assumed_daily_flight_hours=round(daily_hours, 2),
        extra_flight_hours_estimated=round(extra_hours, 1),
        current_health_index=current_health,
        projected_health_index=projected_health,
        current_risk_level=current_risk,
        projected_risk_level=projected_risk,
        affected_component_name=component.name if component else None,
        current_component_wear_pct=current_wear,
        projected_component_wear_pct=projected_wear,
        availability_impact_pct=availability_impact,
        estimated_financial_impact_brl=financial_impact,
        increased_failure_probability_pct=increased_failure_prob,
        recommendation=recommendation,
    )
