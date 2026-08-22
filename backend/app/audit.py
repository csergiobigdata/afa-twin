"""
Trilha de auditoria: registra quem incluiu, alterou, inativou/reativou ou
cancelou um registro, e quando. Consultável em `GET /api/audit-log`
(ver routers/audit.py) e na tela "Auditoria" do aplicativo.

Instrumentado nos fluxos mais sensíveis do piloto: cadastro de usuários
(criação/alteração/inativação - exigido explicitamente para Pessoa),
aeronaves, componentes, ordens de serviço (criação/cancelamento) e
grupos/equipes responsáveis.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from . import models


def log_action(
    db: Session,
    actor: models.User | None,
    entity_type: str,
    entity_id: int,
    action: models.AuditAction,
    summary: str,
    entity_label: str | None = None,
) -> models.AuditLog:
    entry = models.AuditLog(
        actor_username=actor.username if actor else None,
        actor_person_name=actor.person.full_name if actor and actor.person else None,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        action=action,
        summary=summary,
    )
    db.add(entry)
    db.commit()
    return entry
