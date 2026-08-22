"""
Envio e histórico de notificações (e-mail / SMS / WhatsApp) para os
responsáveis vinculados a uma aeronave - usado em dois cenários pedidos
pelo usuário:

1. Mudança de status da aeronave (ex.: "Em Inspeção" → "Operacional") -
   disparado automaticamente em `routers/aircraft.py` ao atualizar o status.
2. Peça se aproximando (ou já vencida) do período de manutenção preventiva
   (por horas ou por vigência de calendário) - disparado manualmente pelo
   usuário a partir do Painel, com base em `check_pending_part_alerts`.

Transparência sobre o que é real e o que é simulado nesta fase piloto:

- **E-mail**: se as variáveis de ambiente `AFA_TWIN_SMTP_HOST`,
  `AFA_TWIN_SMTP_USER` e `AFA_TWIN_SMTP_PASSWORD` estiverem configuradas
  (ex.: usando uma conta de e-mail já existente, sem custo adicional), o
  envio é **real** via SMTP (`smtplib`, biblioteca padrão do Python - sem
  dependência paga). Sem essa configuração, a notificação fica registrada
  no histórico como "Simulada".
- **SMS e WhatsApp**: exigem contratação de um gateway de terceiros (ex.:
  Twilio, Zenvia, API oficial do WhatsApp Business) - fora do escopo de
  custo zero deste piloto. Ficam registrados como "Simulada", deixando a
  estrutura pronta para plugar um provedor real depois (ver
  `_send_sms_stub` / `_send_whatsapp_stub`).

Toda tentativa de notificação é sempre registrada em `Notification`
(histórico), independentemente de ter sido enviada de verdade ou simulada.
"""
from __future__ import annotations

import os
import smtplib
import ssl
from email.message import EmailMessage

from sqlalchemy.orm import Session, selectinload

from . import compute, models, schemas

SMTP_HOST = os.environ.get("AFA_TWIN_SMTP_HOST")
SMTP_PORT = int(os.environ.get("AFA_TWIN_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("AFA_TWIN_SMTP_USER")
SMTP_PASSWORD = os.environ.get("AFA_TWIN_SMTP_PASSWORD")
SMTP_FROM = os.environ.get("AFA_TWIN_SMTP_FROM", SMTP_USER or "")

SMTP_CONFIGURED = bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def _send_email_real(to_email: str, subject: str, message: str) -> tuple[bool, str]:
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg.set_content(message)
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True, f"E-mail enviado com sucesso para {to_email} via SMTP."
    except Exception as exc:  # noqa: BLE001
        return False, f"Falha no envio SMTP: {exc}"


def _send_sms_stub(phone: str | None) -> tuple[bool, str]:
    return False, (
        "Envio real de SMS requer um gateway de terceiros (ex.: Twilio) - não incluído nesta fase "
        "piloto, sem custo. Notificação registrada apenas no histórico."
    )


def _send_whatsapp_stub(phone: str | None) -> tuple[bool, str]:
    return False, (
        "Envio real de WhatsApp requer a API oficial do WhatsApp Business (ou um gateway de terceiros) "
        "- não incluído nesta fase piloto, sem custo. Notificação registrada apenas no histórico."
    )


def send_notification(
    db: Session,
    channel: models.NotificationChannel,
    recipient: models.Person,
    subject: str,
    message: str,
    aircraft: models.Aircraft | None = None,
    component: models.Component | None = None,
    reason: models.NotificationReason = models.NotificationReason.MANUAL,
) -> models.Notification:
    status: models.NotificationStatus
    detail: str

    if channel == models.NotificationChannel.EMAIL:
        if not recipient.email:
            status, detail = models.NotificationStatus.FALHA, f"{recipient.full_name} não possui e-mail cadastrado."
        elif SMTP_CONFIGURED:
            ok, info = _send_email_real(recipient.email, subject, message)
            status = models.NotificationStatus.ENVIADA if ok else models.NotificationStatus.FALHA
            detail = info
        else:
            status = models.NotificationStatus.SIMULADA
            detail = (
                "Envio real de e-mail não configurado nesta instância (defina AFA_TWIN_SMTP_HOST/"
                "AFA_TWIN_SMTP_USER/AFA_TWIN_SMTP_PASSWORD). Notificação registrada no histórico."
            )
    elif channel == models.NotificationChannel.SMS:
        _ok, detail = _send_sms_stub(recipient.phone_full)
        status = models.NotificationStatus.SIMULADA
    else:  # WHATSAPP
        _ok, detail = _send_whatsapp_stub(recipient.phone_full)
        status = models.NotificationStatus.SIMULADA

    notif = models.Notification(
        channel=channel, reason=reason, status=status, subject=subject, message=message, detail=detail,
        recipient_person_id=recipient.id,
        aircraft_id=aircraft.id if aircraft else None,
        component_id=component.id if component else None,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    _prune_old_notifications(db)
    return notif


MAX_NOTIFICATIONS_KEPT = 20


def _prune_old_notifications(db: Session) -> None:
    """Mantém apenas as 20 notificações mais recentes no histórico (política
    de retenção do piloto - ver item 11 do escopo)."""
    total = db.query(models.Notification).count()
    if total <= MAX_NOTIFICATIONS_KEPT:
        return
    ids_to_keep = {
        row.id for row in db.query(models.Notification.id)
        .order_by(models.Notification.created_at.desc())
        .limit(MAX_NOTIFICATIONS_KEPT)
        .all()
    }
    old_rows = db.query(models.Notification).filter(models.Notification.id.notin_(ids_to_keep)).all()
    for row in old_rows:
        db.delete(row)
    db.commit()


def suggested_recipients_for_aircraft(db: Session, aircraft: models.Aircraft) -> list[models.Person]:
    """Responsáveis atualmente vinculados à aeronave: pessoas com vínculo
    individual direto (Assignment, sem data de término) OU membros de
    qualquer grupo/equipe responsável pela aeronave (AircraftGroupAssignment
    sem data de término) - a responsabilidade por uma aeronave, na prática
    aeronáutica, é coletiva (ver docs/04, seção 7), não de uma única pessoa."""
    individual = (
        db.query(models.Person)
        .join(models.Assignment, models.Assignment.person_id == models.Person.id)
        .filter(models.Assignment.aircraft_id == aircraft.id, models.Assignment.end_date.is_(None))
    )
    via_group = (
        db.query(models.Person)
        .join(models.GroupMembership, models.GroupMembership.person_id == models.Person.id)
        .join(models.AircraftGroupAssignment, models.AircraftGroupAssignment.group_id == models.GroupMembership.group_id)
        .filter(models.AircraftGroupAssignment.aircraft_id == aircraft.id, models.AircraftGroupAssignment.end_date.is_(None))
    )
    people_by_id = {p.id: p for p in individual.all()}
    for p in via_group.all():
        people_by_id[p.id] = p
    return list(people_by_id.values())


def recipients_for_group(db: Session, group: models.ResponsibleGroup) -> list[models.Person]:
    return [m.person for m in group.members]


def notify_status_change(
    db: Session, aircraft: models.Aircraft, old_status: models.AircraftStatus, new_status: models.AircraftStatus,
) -> list[models.Notification]:
    recipients = suggested_recipients_for_aircraft(db, aircraft)
    subject = f"[AFA-TWIN] {aircraft.tail_number} mudou de status: {old_status.value} → {new_status.value}"
    message = (
        f"A aeronave {aircraft.tail_number} ({aircraft.manufacturer} {aircraft.model}) mudou de status "
        f"de \"{old_status.value}\" para \"{new_status.value}\".\n\n"
        f"Notificação automática gerada pelo AFA-TWIN."
    )
    return [
        send_notification(db, models.NotificationChannel.EMAIL, r, subject, message,
                           aircraft=aircraft, reason=models.NotificationReason.MUDANCA_STATUS)
        for r in recipients
    ]


def check_pending_part_alerts(db: Session) -> list[schemas.PendingPartAlert]:
    """Componentes com vida útil (horas) ou vigência (calendário) próxima do
    vencimento/vencida, em toda a frota, com os responsáveis sugeridos para
    notificação. Reaproveita `compute.component_alerts` para não duplicar
    a lógica de limiares."""
    fleet = db.query(models.Aircraft).options(
        selectinload(models.Aircraft.components), selectinload(models.Aircraft.maintenance_orders),
    ).all()

    results: list[schemas.PendingPartAlert] = []
    for aircraft in fleet:
        part_alerts = [a for a in compute.component_alerts(aircraft) if a.get("component_id")]
        if not part_alerts:
            continue
        recipients = suggested_recipients_for_aircraft(db, aircraft)
        for alert in part_alerts:
            component = next((c for c in aircraft.components if c.id == alert["component_id"]), None)
            results.append(schemas.PendingPartAlert(
                aircraft_id=aircraft.id, aircraft_tail_number=aircraft.tail_number,
                component_id=alert["component_id"], component_name=component.name if component else "—",
                severity=alert["severity"], detail=alert["detail"],
                suggested_recipients=[schemas.PersonOut.model_validate(r) for r in recipients],
            ))
    severity_rank = {"critico": 0, "atencao": 1, "info": 2}
    results.sort(key=lambda r: severity_rank.get(r.severity, 3))
    return results
