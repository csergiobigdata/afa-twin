"""
Indicadores de Engenharia de Confiabilidade (MTBF, MTTR, Taxa de Falha,
Confiabilidade, Disponibilidade Intrínseca e Operacional) - módulo
"Integração com a Confiabilidade" do documento de referência.

Implementa fórmulas clássicas e amplamente publicadas de engenharia de
confiabilidade sobre os dados reais já cadastrados (ordens de serviço
corretivas concluídas e horas de voo acumuladas). Não é um ajuste
estatístico de Weibull completo (que exige um histórico de falhas maior
e ferramental estatístico dedicado) - é uma aproximação exponencial
(β≈1), transparente e auditável, adequada ao volume de dados de um piloto
de testes. Ver docs/04-protocolos-e-conformidade.md.
"""
from __future__ import annotations

import math

from . import models, schemas


def compute_reliability_metrics(aircraft: models.Aircraft) -> schemas.ReliabilityMetrics:
    failures = [
        o for o in aircraft.maintenance_orders
        if o.type == models.MaintenanceType.CORRETIVA
        and o.status == models.OrderStatus.CONCLUIDA
        and o.closed_at is not None
    ]
    sample_size = len(failures)
    operating_hours = aircraft.total_flight_hours or 0.0

    if sample_size == 0 or operating_hours <= 0:
        return schemas.ReliabilityMetrics(
            aircraft_id=aircraft.id,
            aircraft_tail_number=aircraft.tail_number,
            sample_size=sample_size,
            confidence_note=(
                "Sem histórico suficiente de manutenções corretivas concluídas (ou horas de voo "
                "registradas) para estimar MTBF/MTTR desta aeronave. Registre ordens de serviço "
                "corretivas e voos no livro de bordo para habilitar esta análise."
            ),
        )

    mtbf = operating_hours / sample_size

    repair_hours = [
        (o.closed_at - o.opened_at).total_seconds() / 3600
        for o in failures
        if o.closed_at and o.opened_at
    ]
    mttr = (sum(repair_hours) / len(repair_hours)) if repair_hours else None

    failure_rate = (1 / mtbf) if mtbf else None
    reliability_100h = math.exp(-failure_rate * 100) if failure_rate else None

    availability_intrinsic = (mtbf / (mtbf + mttr)) if (mtbf and mttr) else None

    # Atraso logístico médio (MDT) estimado a partir de ordens que passaram por
    # "Aguardando Peça" - aproximação simples: 20% de acréscimo sobre o MTTR
    # observado, sinalizada como estimativa (não há, nesta fase, um registro
    # granular do tempo exato em cada status da OS).
    logistic_delay = (mttr * 0.2) if mttr else 0.0
    availability_operational = (
        mtbf / (mtbf + mttr + logistic_delay) if (mtbf and mttr is not None) else None
    )

    confidence_note = (
        f"Estimativa baseada em apenas {sample_size} evento(s) de manutenção corretiva concluída - "
        "amostra pequena, trate como indicativo e não como valor estatisticamente robusto."
        if sample_size < 5 else
        f"Estimativa baseada em {sample_size} eventos de manutenção corretiva concluída, com modelo "
        "exponencial simplificado (β≈1). Um ajuste completo de Weibull (β variável) é recomendado "
        "como evolução futura, com mais dados históricos."
    )

    return schemas.ReliabilityMetrics(
        aircraft_id=aircraft.id,
        aircraft_tail_number=aircraft.tail_number,
        sample_size=sample_size,
        mtbf_hours=round(mtbf, 1) if mtbf else None,
        mttr_hours=round(mttr, 1) if mttr else None,
        failure_rate_per_hour=round(failure_rate, 6) if failure_rate else None,
        reliability_pct_next_100h=round(reliability_100h * 100, 1) if reliability_100h else None,
        availability_intrinsic_pct=round(availability_intrinsic * 100, 1) if availability_intrinsic else None,
        availability_operational_pct=round(availability_operational * 100, 1) if availability_operational else None,
        weibull_beta_estimate=1.0,
        confidence_note=confidence_note,
    )
