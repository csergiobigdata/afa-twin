"""
Diagnóstico Inteligente (heurístico) - módulo do documento de referência em
que o mecânico digita um sintoma (ex.: "a luz FUEL PRESS permanece acesa")
e o sistema retorna ocorrências semelhantes na frota e a ação mais comum
usada para resolvê-las.

Implementação desta fase: busca por similaridade textual sobre o histórico
de ordens de serviço (título + descrição + constatações), usando a
biblioteca padrão do Python (`difflib`) com reforço por sobreposição de
palavras-chave. **Não é um modelo de linguagem/IA treinado** - é uma
fundação determinística e auditável para o módulo de PLN descrito na
evolução planejada do projeto (ver docs/02-arquitetura-da-solucao.md).
"""
from __future__ import annotations

import difflib
from collections import Counter

from sqlalchemy.orm import Session, joinedload

from . import models, schemas

MIN_SIMILARITY = 0.22


def _text(o: models.MaintenanceOrder) -> str:
    return " ".join(filter(None, [o.title, o.description, o.findings])).lower()


def search_similar_occurrences(
    db: Session, symptom: str, aircraft_model: str | None = None, limit: int = 8
) -> schemas.DiagnosticResult:
    query = symptom.lower().strip()
    q = db.query(models.MaintenanceOrder).join(models.Aircraft).options(joinedload(models.MaintenanceOrder.aircraft))
    if aircraft_model:
        q = q.filter(models.Aircraft.model == aircraft_model)

    query_words = {w for w in query.split() if len(w) >= 4}
    scored: list[tuple[float, models.MaintenanceOrder]] = []
    for o in q.all():
        text = _text(o)
        if not text.strip():
            continue
        ratio = difflib.SequenceMatcher(None, query, text).ratio()
        overlap = len(query_words & set(text.split()))
        keyword_boost = min(0.35, overlap * 0.09)
        similarity = min(1.0, ratio + keyword_boost)
        if similarity >= MIN_SIMILARITY:
            scored.append((similarity, o))

    scored.sort(key=lambda item: item[0], reverse=True)
    top = scored[:limit]

    matches = [
        schemas.DiagnosticMatch(
            order_number=o.order_number,
            aircraft_tail_number=o.aircraft.tail_number,
            title=o.title,
            description=o.description,
            actions_taken=o.actions_taken,
            parts_used=o.parts_used,
            similarity_pct=round(sim * 100, 1),
        )
        for sim, o in top
    ]

    resolved_actions = [m.actions_taken.strip() for m in matches if m.actions_taken]
    most_common_action = None
    most_common_pct = None
    if resolved_actions:
        action, count = Counter(resolved_actions).most_common(1)[0]
        most_common_action = action
        most_common_pct = round(count / len(resolved_actions) * 100, 1)

    total = len(scored)
    if total == 0:
        summary = "Nenhuma ocorrência semelhante encontrada no histórico de manutenção da frota para este sintoma."
    elif most_common_action:
        summary = (
            f"Nas últimas {total} ocorrência(s) semelhante(s) na frota, {most_common_pct}% foram "
            f'resolvidas com: "{most_common_action}".'
        )
    else:
        summary = f"{total} ocorrência(s) semelhante(s) encontrada(s) no histórico da frota, sem uma ação predominante clara."

    return schemas.DiagnosticResult(
        symptom=symptom,
        total_similar_occurrences=total,
        matches=matches,
        most_common_action=most_common_action,
        most_common_action_pct=most_common_pct,
        summary_text=summary,
    )
