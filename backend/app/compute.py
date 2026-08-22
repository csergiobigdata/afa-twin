"""
Cálculos do "gêmeo digital" simplificado (fase piloto).

Implementa uma versão didática/determinística do índice de saúde e do
risco operacional descritos no documento de referência (seção "Integração
com o Risco Operacional"). Isso NÃO substitui os modelos estatísticos e de
IA propostos no TCC (Weibull, MTBF/MTTR, predição de falhas por ML,
visão computacional) - serve como placeholder auditável para o piloto,
com espaço reservado para plugar tais modelos futuramente
(ver docs/02-arquitetura-da-solucao.md, seção "Evolução para IA").
"""
from __future__ import annotations

import datetime as dt

from . import models, schemas


def _as_naive(value: dt.datetime) -> dt.datetime:
    """Remove o fuso horário de um datetime, se presente. Necessário porque o
    SQLite não preserva tzinfo ao ler de volta colunas DateTime(timezone=True)
    (retornam "naive"), enquanto valores recém-criados em Python com
    `datetime.now(timezone.utc)` são "aware" - comparar os dois diretamente
    levanta TypeError. Em bancos que preservam tzinfo (ex.: Postgres), esta
    função também normaliza para naive de forma segura."""
    return value.replace(tzinfo=None) if value.tzinfo is not None else value


CRITICALITY_WEIGHT = {
    models.Criticality.BAIXA: 0.5,
    models.Criticality.MEDIA: 1.0,
    models.Criticality.ALTA: 1.6,
    models.Criticality.CRITICA: 2.4,
}

PRIORITY_ORDER_PENALTY = {
    models.Criticality.BAIXA: 2,
    models.Criticality.MEDIA: 5,
    models.Criticality.ALTA: 10,
    models.Criticality.CRITICA: 18,
}


def component_penalty(component: models.Component) -> float:
    wear = component.wear_pct
    weight = CRITICALITY_WEIGHT.get(component.criticality, 1.0)
    if wear is None:
        return 0.0
    # penaliza progressivamente a partir de 60% da vida consumida
    if wear <= 60:
        return 0.0
    over = wear - 60
    return over * 0.35 * weight


def compute_aircraft_health(aircraft: models.Aircraft) -> tuple[float, str]:
    penalty = 0.0

    for component in aircraft.components:
        penalty += component_penalty(component)

    for order in aircraft.maintenance_orders:
        if order.status in (models.OrderStatus.ABERTA, models.OrderStatus.EM_ANDAMENTO, models.OrderStatus.AGUARDANDO_PECA):
            penalty += PRIORITY_ORDER_PENALTY.get(order.priority, 5)

    if aircraft.status == models.AircraftStatus.INDISPONIVEL:
        penalty += 20
    elif aircraft.status in (models.AircraftStatus.EM_MANUTENCAO, models.AircraftStatus.EM_INSPECAO):
        penalty += 8

    health = max(0.0, min(100.0, 100.0 - penalty))

    if health >= 90:
        risk = "Baixo"
    elif health >= 75:
        risk = "Médio"
    elif health >= 55:
        risk = "Alto"
    else:
        risk = "Crítico"

    return round(health, 1), risk


def component_alerts(aircraft: models.Aircraft) -> list[dict]:
    alerts = []
    for c in aircraft.components:
        wear = c.wear_pct
        if wear is not None and wear >= 100:
            alerts.append({
                "severity": "critico",
                "category": "Vida Limite Excedida",
                "title": f"Vida limite excedida: {c.name}",
                "detail": f"{c.name} ({aircraft.tail_number}) atingiu {wear}% da vida limite ({c.life_limit_hours}h). "
                          f"Substituição imediata requerida (hard-time).",
                "aircraft_id": aircraft.id,
                "aircraft_tail_number": aircraft.tail_number,
                "component_id": c.id,
            })
        elif wear is not None and wear >= 85:
            alerts.append({
                "severity": "atencao",
                "category": "Componente Próximo do Limite",
                "title": f"Componente próximo do limite: {c.name}",
                "detail": f"{c.name} ({aircraft.tail_number}) em {wear}% da vida limite. Planejar substituição.",
                "aircraft_id": aircraft.id,
                "aircraft_tail_number": aircraft.tail_number,
                "component_id": c.id,
            })

        if c.next_preventive_date is not None:
            days_left = (c.next_preventive_date - dt.date.today()).days
            if days_left < 0:
                alerts.append({
                    "severity": "critico",
                    "category": "Vigência Vencida",
                    "title": f"Vigência vencida: {c.name}",
                    "detail": f"{c.name} ({aircraft.tail_number}) com manutenção preventiva vencida há "
                              f"{abs(days_left)} dia(s) (vencimento em {c.next_preventive_date.strftime('%d/%m/%Y')}).",
                    "aircraft_id": aircraft.id,
                    "aircraft_tail_number": aircraft.tail_number,
                    "component_id": c.id,
                })
            elif days_left <= 15:
                alerts.append({
                    "severity": "atencao",
                    "category": "Vigência Próxima do Vencimento",
                    "title": f"Vigência próxima do vencimento: {c.name}",
                    "detail": f"{c.name} ({aircraft.tail_number}) vence em {days_left} dia(s) "
                              f"({c.next_preventive_date.strftime('%d/%m/%Y')}).",
                    "aircraft_id": aircraft.id,
                    "aircraft_tail_number": aircraft.tail_number,
                    "component_id": c.id,
                })
    for o in aircraft.maintenance_orders:
        if o.status in (models.OrderStatus.ABERTA, models.OrderStatus.EM_ANDAMENTO, models.OrderStatus.AGUARDANDO_PECA) and o.priority == models.Criticality.CRITICA:
            alerts.append({
                "severity": "critico",
                "category": "OS Crítica em Aberto",
                "title": f"OS crítica em aberto: {o.order_number}",
                "detail": f"{o.title} ({aircraft.tail_number}) - status {o.status.value}.",
                "aircraft_id": aircraft.id,
                "aircraft_tail_number": aircraft.tail_number,
                "order_id": o.id,
            })
    return alerts


# --------------------------------------------------------------------------
# Disponibilidade e Confiabilidade "de vitrine" (para listas/cards) - versões
# leves e sempre disponíveis, complementares às métricas aprofundadas de
# reliability.py (MTBF/MTTR), usadas quando não há amostra suficiente.
# --------------------------------------------------------------------------

_STATUS_AVAILABILITY = {
    models.AircraftStatus.OPERACIONAL: 100.0,
    models.AircraftStatus.EM_INSPECAO: 70.0,
    models.AircraftStatus.EM_MANUTENCAO: 50.0,
    models.AircraftStatus.EM_MODERNIZACAO: 30.0,
    models.AircraftStatus.INDISPONIVEL: 0.0,
}


def simple_availability_pct(aircraft: models.Aircraft) -> float:
    """Disponibilidade momentânea (ponto no tempo) baseada no status atual."""
    return _STATUS_AVAILABILITY.get(aircraft.status, 50.0)


def simple_reliability_pct(aircraft: models.Aircraft) -> float:
    """Proxy leve de confiabilidade quando não há amostra de falhas suficiente
    para o modelo estatístico de reliability.py: 100% menos o pior desgaste
    entre os componentes de criticidade alta/crítica."""
    worst_wear = 0.0
    for c in aircraft.components:
        if c.criticality in (models.Criticality.ALTA, models.Criticality.CRITICA):
            wear = c.wear_pct
            if wear is not None:
                worst_wear = max(worst_wear, wear)
    return round(max(0.0, 100.0 - worst_wear * 0.6), 1)


# --------------------------------------------------------------------------
# Risco Operacional ponderado - reproduz o modelo de fatores e pesos do
# documento de referência (seção "Integração com o Risco Operacional"):
# Histórico de falhas 25% · Missão prevista 20% · Condições meteorológicas 15%
# · Horas desde a última inspeção 15% · Componentes críticos próximos do
# limite 15% · Disponibilidade logística 10%.
# --------------------------------------------------------------------------

_MANUAL_RISK_SCORE = {
    models.RiskLevel.BAIXO: 20.0,
    models.RiskLevel.MEDIO: 55.0,
    models.RiskLevel.ALTO: 90.0,
}


def _factor_historico_falhas(aircraft: models.Aircraft) -> tuple[float, str]:
    # SQLite não preserva tzinfo ao ler de volta valores DateTime(timezone=True):
    # os `opened_at` recuperados do banco vêm "naive" (sem fuso), então o corte
    # de comparação também precisa ser naive (mas na mesma referência UTC usada
    # na gravação) para evitar TypeError ao comparar naive com aware.
    cutoff = dt.datetime.utcnow() - dt.timedelta(days=180)
    count = sum(
        1 for o in aircraft.maintenance_orders
        if o.type == models.MaintenanceType.CORRETIVA and o.opened_at and _as_naive(o.opened_at) >= cutoff
    )
    score = min(100.0, count * 25.0)
    basis = f"{count} manutenção(ões) corretiva(s) nos últimos 180 dias"
    return score, basis


def _factor_missao_prevista(aircraft: models.Aircraft) -> tuple[float, str]:
    score = _MANUAL_RISK_SCORE.get(aircraft.next_mission_risk, 55.0)
    return score, f"Risco de missão prevista informado como '{aircraft.next_mission_risk.value}'"


def _factor_meteorologia(aircraft: models.Aircraft) -> tuple[float, str]:
    score = _MANUAL_RISK_SCORE.get(aircraft.weather_risk, 55.0)
    return score, f"Condição meteorológica informada como '{aircraft.weather_risk.value}'"


def _factor_horas_desde_inspecao(aircraft: models.Aircraft) -> tuple[float, str]:
    remainders = [
        c.next_inspection_due_hours - aircraft.total_flight_hours
        for c in aircraft.components
        if c.next_inspection_due_hours is not None
    ]
    if not remainders:
        return 20.0, "Nenhum componente com próxima inspeção programada por horas cadastrado"
    worst_remaining = min(remainders)
    if worst_remaining <= 0:
        return 100.0, f"Inspeção programada já vencida há {abs(worst_remaining):.0f}h"
    if worst_remaining <= 50:
        return 70.0, f"Próxima inspeção programada em apenas {worst_remaining:.0f}h"
    if worst_remaining <= 150:
        return 40.0, f"Próxima inspeção programada em {worst_remaining:.0f}h"
    return 10.0, f"Próxima inspeção programada em {worst_remaining:.0f}h (folga confortável)"


def _factor_componentes_criticos(aircraft: models.Aircraft) -> tuple[float, str]:
    worst = None
    for c in aircraft.components:
        if c.criticality in (models.Criticality.ALTA, models.Criticality.CRITICA):
            wear = c.wear_pct
            if wear is not None and (worst is None or wear > worst[0]):
                worst = (wear, c.name)
    if worst is None:
        return 10.0, "Nenhum componente crítico/alto com vida limite próxima do fim"
    wear, name = worst
    return min(100.0, wear), f"Componente crítico '{name}' com {wear:.1f}% da vida limite consumida"


def _factor_disponibilidade_logistica(aircraft: models.Aircraft) -> tuple[float, str]:
    waiting = [
        o for o in aircraft.maintenance_orders
        if o.status == models.OrderStatus.AGUARDANDO_PECA
    ]
    if not waiting:
        return 15.0, "Nenhuma ordem de serviço aguardando peça no momento"
    has_critical = any(o.priority == models.Criticality.CRITICA for o in waiting)
    score = 95.0 if has_critical else 75.0
    return score, f"{len(waiting)} ordem(ns) de serviço aguardando peça"


_RISK_FACTORS = [
    ("Histórico de falhas", 25.0, _factor_historico_falhas),
    ("Missão prevista", 20.0, _factor_missao_prevista),
    ("Condições meteorológicas", 15.0, _factor_meteorologia),
    ("Horas desde a última inspeção", 15.0, _factor_horas_desde_inspecao),
    ("Componentes críticos próximos do limite", 15.0, _factor_componentes_criticos),
    ("Disponibilidade logística", 10.0, _factor_disponibilidade_logistica),
]


def compute_operational_risk(aircraft: models.Aircraft) -> "schemas.OperationalRiskBreakdown":
    factors: list[schemas.RiskFactorScore] = []
    total = 0.0
    for name, weight, fn in _RISK_FACTORS:
        score, basis = fn(aircraft)
        contribution = weight * score / 100.0
        total += contribution
        factors.append(schemas.RiskFactorScore(
            factor=name, weight_pct=weight, score_pct=round(score, 1),
            contribution_pct=round(contribution, 1), basis=basis,
        ))

    total = round(min(100.0, total), 1)
    if total < 20:
        level = "Baixo"
    elif total < 40:
        level = "Médio"
    elif total < 65:
        level = "Alto"
    else:
        level = "Crítico"

    return schemas.OperationalRiskBreakdown(
        aircraft_id=aircraft.id, aircraft_tail_number=aircraft.tail_number,
        factors=factors, risk_score_pct=total, risk_level=level,
    )
