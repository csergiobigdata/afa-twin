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
- **SMS**: se `AFA_TWIN_TWILIO_ACCOUNT_SID`, `AFA_TWIN_TWILIO_AUTH_TOKEN` e
  `AFA_TWIN_TWILIO_FROM_NUMBER` estiverem configuradas (conta Twilio - trial
  gratuito com crédito inicial, depois pago por mensagem, ver docs/06 seção
  4.2), o envio é **real** via a REST API do Twilio (chamada HTTP direta com
  `urllib.request`, biblioteca padrão - sem SDK adicional). Numa conta
  Twilio *trial* (não paga), só é possível enviar para números verificados
  manualmente no console do Twilio (Phone Numbers → Verified Caller IDs) -
  destino não verificado falha com detalhe explicativo no histórico. Sem
  as 3 variáveis configuradas, fica "Simulada".
- **WhatsApp**: exige a API oficial do WhatsApp Business (ou um gateway de
  terceiros) - fora do escopo desta fase. Fica registrado como "Simulada",
  deixando a estrutura pronta para plugar um provedor real depois (ver
  `_send_whatsapp_stub`).

Toda tentativa de notificação é sempre registrada em `Notification`
(histórico), independentemente de ter sido enviada de verdade ou simulada.
"""
from __future__ import annotations

import base64
import json
import os
import re
import smtplib
import ssl
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage

from sqlalchemy.orm import Session, selectinload

from . import compute, models, schemas

SMTP_HOST = os.environ.get("AFA_TWIN_SMTP_HOST")
SMTP_PORT = int(os.environ.get("AFA_TWIN_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("AFA_TWIN_SMTP_USER")
SMTP_PASSWORD = os.environ.get("AFA_TWIN_SMTP_PASSWORD")
SMTP_FROM = os.environ.get("AFA_TWIN_SMTP_FROM", SMTP_USER or "")

SMTP_CONFIGURED = bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)

TWILIO_ACCOUNT_SID = os.environ.get("AFA_TWIN_TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("AFA_TWIN_TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("AFA_TWIN_TWILIO_FROM_NUMBER")

TWILIO_CONFIGURED = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER)


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


def _to_e164_br(phone_full: str | None) -> str | None:
    """Converte o telefone cadastrado (ex.: "(11) 98649-3333") para o formato
    internacional E.164 exigido pela API do Twilio (ex.: "+5511986493333") -
    assume DDI +55 (Brasil), único país usado neste piloto."""
    if not phone_full:
        return None
    digits = re.sub(r"\D", "", phone_full)
    if not digits:
        return None
    return f"+55{digits}"


def _send_sms_real(to_e164: str, message: str) -> tuple[bool, str]:
    body = urllib.parse.urlencode({"To": to_e164, "From": TWILIO_FROM_NUMBER, "Body": message}).encode()
    auth = base64.b64encode(f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode()).decode()
    req = urllib.request.Request(
        f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
        data=body, method="POST",
        headers={"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode())
        return True, f"SMS enviado com sucesso para {to_e164} via Twilio (sid {payload.get('sid', '—')})."
    except urllib.error.HTTPError as exc:
        try:
            detail = json.loads(exc.read().decode()).get("message", str(exc))
        except Exception:  # noqa: BLE001
            detail = str(exc)
        # Erro 21608 é o caso mais comum em conta trial: destino não
        # verificado no console do Twilio (Phone Numbers → Verified Caller
        # IDs) - deixado explícito aqui para não parecer uma falha genérica.
        return False, f"Falha no envio via Twilio para {to_e164}: {detail}"
    except Exception as exc:  # noqa: BLE001
        return False, f"Falha no envio via Twilio para {to_e164}: {exc}"


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
        e164 = _to_e164_br(recipient.phone_full)
        if not e164:
            status, detail = models.NotificationStatus.FALHA, f"{recipient.full_name} não possui telefone cadastrado."
        elif TWILIO_CONFIGURED:
            ok, info = _send_sms_real(e164, message)
            status = models.NotificationStatus.ENVIADA if ok else models.NotificationStatus.FALHA
            detail = info
        else:
            status = models.NotificationStatus.SIMULADA
            detail = (
                "Envio real de SMS não configurado nesta instância (defina AFA_TWIN_TWILIO_ACCOUNT_SID/"
                "AFA_TWIN_TWILIO_AUTH_TOKEN/AFA_TWIN_TWILIO_FROM_NUMBER). Notificação registrada no histórico."
            )
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
