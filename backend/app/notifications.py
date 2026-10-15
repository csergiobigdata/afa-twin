"""
Envio e histórico de notificações (e-mail / SMS / WhatsApp) para os
responsáveis vinculados a uma aeronave - usado em três cenários pedidos
pelo usuário:

1. Mudança de status da aeronave (ex.: "Em Inspeção" → "Operacional") -
   disparado automaticamente em `routers/aircraft.py` ao atualizar o status.
2. Peça se aproximando (ou já vencida) do período de manutenção preventiva
   (por horas ou por vigência de calendário) - disparado manualmente pelo
   usuário a partir do Painel, com base em `check_pending_part_alerts`.
3. O mesmo alerta de peça (2), reenviado automaticamente uma vez por dia
   (cron do Vercel, ver `backend/vercel.json` e `routers/admin.py`) para
   toda aeronave que ainda não estiver "Em Manutenção" - ver
   `send_daily_wear_alert_notifications`.

Transparência sobre o que é real e o que é simulado nesta fase piloto:

- **E-mail**: se `AFA_TWIN_RESEND_API_KEY` estiver configurada (conta
  Resend - gratuita até 100 e-mails/dia, sem precisar de senha de app numa
  conta de e-mail pessoal), o envio é **real** via a REST API do Resend
  (chamada HTTP direta com `urllib.request`, biblioteca padrão - sem SDK
  adicional). É o método preferido. Se não estiver configurada mas
  `AFA_TWIN_SMTP_HOST`/`AFA_TWIN_SMTP_USER`/`AFA_TWIN_SMTP_PASSWORD`
  estiverem (ex.: uma conta de e-mail já existente, com senha de app), o
  envio real cai para SMTP (`smtplib`, biblioteca padrão) como alternativa.
  Sem nenhuma das duas configuradas, a notificação fica registrada no
  histórico como "Simulada". Nota sobre o Resend: sem verificar um domínio
  próprio no painel Resend, o remetente fica restrito a
  `onboarding@resend.dev` e o envio só é aceito para o e-mail da própria
  conta Resend (modo sandbox/teste) - verificar um domínio (gratuito,
  requer só acesso ao DNS dele) libera o envio para qualquer destinatário.
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
import html as html_lib
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
from .seed import ADMIN_USERS

SMTP_HOST = os.environ.get("AFA_TWIN_SMTP_HOST")
SMTP_PORT = int(os.environ.get("AFA_TWIN_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("AFA_TWIN_SMTP_USER")
SMTP_PASSWORD = os.environ.get("AFA_TWIN_SMTP_PASSWORD")
SMTP_FROM = os.environ.get("AFA_TWIN_SMTP_FROM", SMTP_USER or "")

SMTP_CONFIGURED = bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)

RESEND_API_KEY = os.environ.get("AFA_TWIN_RESEND_API_KEY")
RESEND_FROM = os.environ.get("AFA_TWIN_RESEND_FROM", "AFA-TWIN <onboarding@resend.dev>")

RESEND_CONFIGURED = bool(RESEND_API_KEY)

TWILIO_ACCOUNT_SID = os.environ.get("AFA_TWIN_TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("AFA_TWIN_TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.environ.get("AFA_TWIN_TWILIO_FROM_NUMBER")

TWILIO_CONFIGURED = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER)

# Cloudflare (na frente da API do Resend, e possivelmente de outras) rejeita
# com HTTP 403 (erro Cloudflare 1010 - "banido por assinatura do
# navegador") requisições com o User-Agent padrão do urllib
# ("Python-urllib/3.x", reconhecido como assinatura de bot) - um
# User-Agent comum resolve, sem precisar de nenhuma biblioteca HTTP externa.
_HTTP_USER_AGENT = "afa-twin-backend/1.0"

# --------------------------------------------------------------------------
# Template de e-mail HTML - todo e-mail saía em texto puro, sem nenhuma
# formatação (ver print anexado pelo usuário). As mensagens já seguiam um
# padrão consistente, montado à mão em cada função deste módulo:
# "SEÇÃO EM MAIÚSCULAS" (ex.: "ORDEM DE SERVIÇO", "AERONAVE"), seguida de
# linhas "Rótulo: valor"; marcadores "• item"; ou parágrafos soltos. Em vez
# de reescrever cada chamador para montar HTML na mão, _render_message_html
# interpreta esse MESMO texto (reaproveitado tal qual para o campo "text",
# que continua existindo como alternativa e para o histórico de
# Notification.message) e gera uma versão em tabelas/HTML - qualidade
# profissional sem duplicar a lógica de conteúdo de cada notificação.
# --------------------------------------------------------------------------

_PRIORITY_BADGE_COLORS = {"Baixa": "#1a9d5b", "Média": "#d99a00", "Alta": "#e06b1f", "Crítica": "#c62828"}
_RISK_BADGE_COLORS = {"Baixo": "#1a9d5b", "Médio": "#d99a00", "Alto": "#e06b1f", "Crítico": "#c62828"}


def _is_section_header(line: str) -> bool:
    if not line or len(line) > 40 or ":" in line:
        return False
    return line == line.upper() and any(ch.isalpha() for ch in line)


def _email_value_html(label: str, value: str) -> str:
    """Rótulos conhecidos (Prioridade, Risco Operacional) ganham um badge
    colorido, igual ao padrão visual já usado nas telas do app - os demais
    valores saem como texto simples escapado."""
    color = None
    key = label.strip().lower()
    if key == "prioridade":
        color = _PRIORITY_BADGE_COLORS.get(value.strip())
    elif key == "risco operacional":
        color = _RISK_BADGE_COLORS.get(value.strip())
    escaped = html_lib.escape(value)
    if color:
        return (
            f'<span style="display:inline-block;padding:2px 10px;border-radius:999px;'
            f'background:{color}22;color:{color};font-weight:700;font-size:12.5px;">{escaped}</span>'
        )
    return escaped


def _render_message_html(message: str) -> str:
    parts: list[str] = []
    rows: list[tuple[str, str]] = []
    bullets: list[str] = []

    def flush_rows() -> None:
        nonlocal rows
        if rows:
            body = "".join(
                f'<tr><td style="padding:5px 14px 5px 0;color:#5b6577;font-size:13px;'
                f'font-weight:600;white-space:nowrap;vertical-align:top;">{html_lib.escape(k)}</td>'
                f'<td style="padding:5px 0;color:#101828;font-size:14px;vertical-align:top;">{_email_value_html(k, v)}</td></tr>'
                for k, v in rows
            )
            parts.append(f'<table role="presentation" style="width:100%;border-collapse:collapse;margin:2px 0 14px;">{body}</table>')
            rows = []

    def flush_bullets() -> None:
        nonlocal bullets
        if bullets:
            items = "".join(f'<li style="margin-bottom:4px;">{html_lib.escape(b)}</li>' for b in bullets)
            parts.append(f'<ul style="margin:0 0 14px;padding-left:20px;color:#101828;font-size:14px;line-height:1.5;">{items}</ul>')
            bullets = []

    for raw_line in message.split("\n"):
        line = raw_line.strip()
        if not line:
            flush_rows()
            flush_bullets()
            continue
        if _is_section_header(line):
            flush_rows()
            flush_bullets()
            parts.append(
                '<div style="margin:18px 0 6px;font-size:12px;font-weight:800;letter-spacing:.04em;'
                'color:#1c4f9c;text-transform:uppercase;border-bottom:2px solid #e3e8f0;padding-bottom:4px;">'
                f"{html_lib.escape(line)}</div>"
            )
            continue
        if line.startswith("• "):
            flush_rows()
            bullets.append(line[2:])
            continue
        kv = re.match(r"^([^:]{2,40}):\s(.+)$", line)
        if kv:
            flush_bullets()
            rows.append((kv.group(1), kv.group(2)))
            continue
        flush_rows()
        flush_bullets()
        parts.append(f'<p style="margin:0 0 12px;color:#101828;font-size:14px;line-height:1.6;">{html_lib.escape(line)}</p>')

    flush_rows()
    flush_bullets()
    return "".join(parts)


def _render_email_html(subject: str, message: str) -> str:
    body_html = _render_message_html(message)
    return f"""<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f3f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" style="background:#f3f5f9;padding:28px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(10,31,68,0.1);">
          <tr>
            <td style="background:#0a1f44;padding:20px 26px;">
              <div style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:.03em;">AFA-TWIN</div>
              <div style="color:#9fb3d9;font-size:11px;margin-top:3px;">Gêmeo Digital para Apoio à Decisão em Manutenção Aeronáutica</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 26px 4px;">
              <div style="font-size:16px;font-weight:700;color:#0a1f44;margin-bottom:14px;line-height:1.4;">{html_lib.escape(subject)}</div>
              {body_html}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 26px 22px;border-top:1px solid #eef1f6;">
              <div style="font-size:11px;color:#8a93a6;">Notificação automática gerada pelo AFA-TWIN.</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def _send_email_via_resend(to_email: str, subject: str, message: str) -> tuple[bool, str]:
    body = json.dumps({
        "from": RESEND_FROM, "to": [to_email], "subject": subject,
        "text": message, "html": _render_email_html(subject, message),
    }).encode()
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=body, method="POST",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json",
            "User-Agent": _HTTP_USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode())
        return True, f"E-mail enviado com sucesso para {to_email} via Resend (id {payload.get('id', '—')})."
    except urllib.error.HTTPError as exc:
        try:
            detail = json.loads(exc.read().decode()).get("message", str(exc))
        except Exception:  # noqa: BLE001
            detail = str(exc)
        # Erro comum sem domínio verificado no Resend: só é possível enviar
        # para o e-mail da própria conta Resend (modo sandbox) - deixado
        # explícito aqui para não parecer uma falha genérica.
        return False, f"Falha no envio via Resend para {to_email}: {detail}"
    except Exception as exc:  # noqa: BLE001
        return False, f"Falha no envio via Resend para {to_email}: {exc}"


def _send_email_real(to_email: str, subject: str, message: str) -> tuple[bool, str]:
    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg.set_content(message)
        msg.add_alternative(_render_email_html(subject, message), subtype="html")
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
        headers={
            "Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": _HTTP_USER_AGENT,
        },
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
        elif RESEND_CONFIGURED:
            ok, info = _send_email_via_resend(recipient.email, subject, message)
            status = models.NotificationStatus.ENVIADA if ok else models.NotificationStatus.FALHA
            detail = info
        elif SMTP_CONFIGURED:
            ok, info = _send_email_real(recipient.email, subject, message)
            status = models.NotificationStatus.ENVIADA if ok else models.NotificationStatus.FALHA
            detail = info
        else:
            status = models.NotificationStatus.SIMULADA
            detail = (
                "Envio real de e-mail não configurado nesta instância (defina AFA_TWIN_RESEND_API_KEY, "
                "ou AFA_TWIN_SMTP_HOST/AFA_TWIN_SMTP_USER/AFA_TWIN_SMTP_PASSWORD). Notificação registrada "
                "no histórico."
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


def admin_recipients(db: Session) -> list[models.Person]:
    """As 2 Pessoas vinculadas aos usuários administradores (seed.ADMIN_USERS,
    sempre existentes - ver seed.ensure_admin_users)."""
    admin_emails = {email for _, email, _ in ADMIN_USERS}
    return db.query(models.Person).filter(models.Person.email.in_(admin_emails)).all()


def notify_status_change(
    db: Session, aircraft: models.Aircraft, old_status: models.AircraftStatus, new_status: models.AircraftStatus,
) -> list[models.Notification]:
    recipients = suggested_recipients_for_aircraft(db, aircraft)
    subject = f"[AFA-TWIN] {aircraft.tail_number} mudou de status: {old_status.value} → {new_status.value}"
    message = (
        f"A aeronave {aircraft.tail_number} ({aircraft.manufacturer} {aircraft.model}) mudou de status "
        f"de \"{old_status.value}\" para \"{new_status.value}\"."
    )
    return [
        send_notification(db, models.NotificationChannel.EMAIL, r, subject, message,
                           aircraft=aircraft, reason=models.NotificationReason.MUDANCA_STATUS)
        for r in recipients
    ]


def notify_os_induction(
    db: Session, order: models.MaintenanceOrder, aircraft: models.Aircraft,
    old_status: models.AircraftStatus, opened_by: models.Person | None,
) -> list[models.Notification]:
    """Aviso formal aos 2 administradores quando abrir uma OS induz a
    aeronave à manutenção (ver routers/maintenance.py::create_order) -
    segue o padrão real de "boletim de indução à manutenção" usado na
    aeronáutica/companhias aéreas: um bloco com os dados da própria OS
    (número, tipo, prioridade, referência técnica, responsável) seguido de
    um retrato da aeronave NO MOMENTO da indução (status, índice de saúde,
    risco operacional, horas de voo, categoria) - dá ao administrador o
    impacto na frota sem precisar abrir o aplicativo. Complementa (não
    substitui) o aviso de mudança de status enviado aos responsáveis
    vinculados por `notify_status_change`."""
    health, risk = compute.compute_aircraft_health(aircraft)
    component = (
        next((c for c in aircraft.components if c.id == order.component_id), None)
        if order.component_id else None
    )

    subject = f"[AFA-TWIN] Aeronave induzida à manutenção — OS {order.order_number} ({aircraft.tail_number})"
    lines = [
        "ORDEM DE SERVIÇO",
        f"Número: {order.order_number}",
        f"Tipo: {order.type.value}",
        f"Prioridade: {order.priority.value}",
        f"Título: {order.title}",
    ]
    if order.description:
        lines.append(f"Descrição: {order.description}")
    if component:
        lines.append(f"Componente associado: {component.name}")
    elif order.checklist_template:
        lines.append(f"Protocolo/checklist aplicado: {order.checklist_template.name} (aeronave inteira)")
    if order.reference_doc:
        lines.append(f"Referência técnica: {order.reference_doc}")
    lines.append(f"Aberta por: {opened_by.full_name if opened_by else 'não identificado'}")
    lines.append(f"Aberta em: {order.opened_at.strftime('%d/%m/%Y %H:%M')}")

    lines += [
        "",
        "AERONAVE",
        f"Matrícula: {aircraft.tail_number}",
        f"Fabricante/Modelo: {aircraft.manufacturer} {aircraft.model}",
        f"Categoria: {aircraft.category.value}",
    ]
    if aircraft.squadron:
        lines.append(f"Esquadrão: {aircraft.squadron}")
    lines += [
        f"Status: {old_status.value} → {aircraft.status.value}",
        f"Índice de Saúde: {health:.0f}%",
        f"Risco Operacional: {risk}",
        f"Horas de voo acumuladas: {aircraft.total_flight_hours:.1f}h",
    ]
    message = "\n".join(lines)

    return [
        send_notification(db, models.NotificationChannel.EMAIL, admin, subject, message,
                           aircraft=aircraft, reason=models.NotificationReason.MUDANCA_STATUS)
        for admin in admin_recipients(db)
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


def send_daily_wear_alert_notifications(db: Session) -> dict:
    """Reenvia, uma vez por dia (chamado pelo cron do Vercel - ver
    backend/vercel.json e routers/admin.py::notify_daily_alerts), os
    alertas de desgaste/vencimento de peça de toda aeronave que AINDA não
    está "Em Manutenção" - a pedido do usuário, o e-mail deve continuar
    chegando todo dia até que um administrador ou mecânico responsável mude
    o status da aeronave para "Em Manutenção" (nesse momento ela some desta
    lista). Mesma regra de destinatários do envio manual (Painel → "Alertas
    de Desgaste e Manutenção"): responsáveis vinculados + os 2
    administradores sempre, com nota explicativa quando não há nenhum
    responsável vinculado."""
    fleet = db.query(models.Aircraft).filter(
        models.Aircraft.status != models.AircraftStatus.EM_MANUTENCAO,
    ).options(
        selectinload(models.Aircraft.components), selectinload(models.Aircraft.maintenance_orders),
    ).all()

    admins = admin_recipients(db)
    aircraft_notified = 0
    notifications_sent = 0
    for aircraft in fleet:
        part_alerts = [a for a in compute.component_alerts(aircraft) if a.get("component_id")]
        if not part_alerts:
            continue
        recipients = suggested_recipients_for_aircraft(db, aircraft)
        subject = f"[AFA-TWIN] Alerta diário: {len(part_alerts)} peça(s) próxima(s) do vencimento — {aircraft.tail_number}"
        message = "\n".join(f"• {a['title']}: {a['detail']}" for a in part_alerts)
        if not recipients:
            message = (
                f"Nenhum responsável está vinculado à aeronave {aircraft.tail_number} no momento "
                f"(cadastre em Aeronaves → aba Pessoal) - notificando diretamente os administradores "
                f"do sistema.\n\n" + message
            )
        recipients_by_id = {p.id: p for p in recipients}
        for a in admins:
            recipients_by_id.setdefault(a.id, a)
        for r in recipients_by_id.values():
            send_notification(db, models.NotificationChannel.EMAIL, r, subject, message,
                               aircraft=aircraft, reason=models.NotificationReason.VENCIMENTO_PECA)
            notifications_sent += 1
        aircraft_notified += 1
    return {"aircraft_notified": aircraft_notified, "notifications_sent": notifications_sent}
