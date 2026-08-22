import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  Aircraft, AircraftGroupAssignment, Assignment, AssignmentRole, Component, ComponentCategory,
  Criticality, DefectType, FlightLog, InspectionFinding, MaintenanceOrder, MonitoringType,
  Notification as AppNotification, NotificationChannel, OperationalRiskBreakdown, PendingPartAlert,
  Person, ReliabilityMetrics, ResponsibleGroup,
} from "../api/types";
import AircraftThumbnail from "../components/AircraftThumbnail";
import AircraftPhotoViewer from "../components/AircraftPhotoViewer";
import { CriticalityBadge, HealthBar, OrderStatusBadge, RiskBadge, StatusBadge } from "../components/Badges";
import { ROLE_PERMISSIONS, useAuth } from "../auth/AuthContext";

type Tab = "geral" | "componentes" | "manutencao" | "confiabilidade" | "inspecao" | "pessoal";

const COMPONENT_CATEGORIES: ComponentCategory[] = [
  "Motor / Grupo Motopropulsor", "Trem de Pouso", "Sistema Hidráulico", "Aviônicos",
  "Estrutura", "Armamento", "Sistema de Combustível", "Sistema Elétrico", "Oxigênio / Suporte à Vida", "Outro",
];
const MONITORING_TYPES: MonitoringType[] = ["Hard Time (vida limite)", "On Condition (sob condição)", "Condition Monitoring (monitorado)"];
const CRITICALITIES: Criticality[] = ["Baixa", "Média", "Alta", "Crítica"];
const ASSIGNMENT_ROLES: AssignmentRole[] = [
  "Piloto Titular", "Piloto Instrutor", "Mecânico Responsável", "Engenheiro de Confiabilidade",
  "Chefe de Manutenção", "Inspetor de Qualidade", "Cientista Responsável (P&D)",
];

export default function AircraftDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [tab, setTab] = useState<Tab>("geral");
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [flightLogs, setFlightLogs] = useState<FlightLog[]>([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    if (!id) return;
    Promise.all([
      api.get<Aircraft>(`/aircraft/${id}`),
      api.get<Component[]>(`/components?aircraft_id=${id}`),
      api.get<MaintenanceOrder[]>(`/maintenance-orders?aircraft_id=${id}`),
      api.get<Assignment[]>(`/assignments?aircraft_id=${id}`),
      api.get<Person[]>(`/people`),
      api.get<FlightLog[]>(`/flight-logs?aircraft_id=${id}`),
    ]).then(([a, c, o, asg, p, fl]) => {
      setAircraft(a); setComponents(c); setOrders(o); setAssignments(asg); setPeople(p); setFlightLogs(fl);
    }).finally(() => setLoading(false));
  }

  useEffect(reload, [id]);

  async function handleDeleteAircraft() {
    if (!aircraft || !confirm(`Confirma a exclusão do cadastro da aeronave ${aircraft.tail_number}? Esta ação não pode ser desfeita.`)) return;
    await api.del(`/aircraft/${aircraft.id}`);
    navigate("/aeronaves");
  }

  if (loading) return <p>Carregando dados da aeronave…</p>;
  if (!aircraft) return <p>Aeronave não encontrada.</p>;

  return (
    <div>
      <Link to="/aeronaves" style={{ fontSize: 13, textDecoration: "none" }}>← Voltar à frota</Link>

      <div className="card" style={{ padding: 22, marginTop: 12, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        <AircraftThumbnail aircraft={aircraft} width={130} height={84} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, margin: 0 }}>{aircraft.tail_number}</h1>
            {aircraft.nickname && <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>"{aircraft.nickname}"</span>}
          </div>
          <div style={{ fontSize: 14.5, marginTop: 4 }}>{aircraft.manufacturer} · {aircraft.model} · {aircraft.category}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{aircraft.squadron} — {aircraft.base}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <StatusBadge status={aircraft.status} />
            <RiskBadge level={aircraft.risk_level} />
            <AircraftPhotoViewer aircraft={aircraft} />
          </div>
        </div>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Saúde Geral (piloto)</div>
          <HealthBar value={aircraft.health_index} />
          <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
            <span>Disponibilidade: <strong style={{ color: "var(--text-primary)" }}>{aircraft.availability_pct?.toFixed(0)}%</strong></span>
            <span>Confiabilidade: <strong style={{ color: "var(--text-primary)" }}>{aircraft.reliability_pct?.toFixed(0)}%</strong></span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
            {aircraft.total_flight_hours.toLocaleString("pt-BR")} h de voo acumuladas
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link to={`/aeronaves/${aircraft.id}/editar`} className="btn btn-outline btn-sm">Editar cadastro</Link>
          {ROLE_PERMISSIONS.canDeleteAircraft(role) && (
            <button className="btn btn-danger btn-sm" onClick={handleDeleteAircraft}>Excluir</button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginTop: 20, borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
        {([
          ["geral", "Visão Geral"], ["componentes", `Componentes (${components.length})`],
          ["manutencao", `Manutenção (${orders.length})`], ["confiabilidade", "Confiabilidade & Risco"],
          ["inspecao", "Inspeção Fotográfica"], ["pessoal", `Pessoal (${assignments.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
                  className="btn btn-sm"
                  style={{
                    background: "transparent", border: "none", borderRadius: 0,
                    borderBottom: tab === key ? "3px solid var(--fab-navy-900)" : "3px solid transparent",
                    color: tab === key ? "var(--fab-navy-900)" : "var(--text-secondary)", fontWeight: 700,
                  }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 18 }}>
        {tab === "geral" && <GeneralTab aircraft={aircraft} flightLogs={flightLogs} people={people} onReload={reload} />}
        {tab === "componentes" && <ComponentsTab aircraftId={aircraft.id} components={components} orders={orders} people={people} onReload={reload} />}
        {tab === "manutencao" && <OrdersTab aircraftId={aircraft.id} orders={orders} components={components} />}
        {tab === "confiabilidade" && <ReliabilityRiskTab aircraftId={aircraft.id} />}
        {tab === "inspecao" && <InspectionsTab aircraftId={aircraft.id} components={components} people={people} />}
        {tab === "pessoal" && <PeopleTab aircraftId={aircraft.id} assignments={assignments} people={people} onReload={reload} />}
      </div>
    </div>
  );
}

// ---------------- Visão Geral ----------------
function GeneralTab({ aircraft, flightLogs, people, onReload }: { aircraft: Aircraft; flightLogs: FlightLog[]; people: Person[]; onReload: () => void }) {
  const pilots = people.filter((p) => p.role === "Piloto");
  const [showForm, setShowForm] = useState(false);
  const [pilotId, setPilotId] = useState<number | "">("");
  const [duration, setDuration] = useState(1);
  const [mission, setMission] = useState("");
  const [discrepancies, setDiscrepancies] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/flight-logs", {
        aircraft_id: aircraft.id, pilot_id: pilotId || null, date: new Date().toISOString().slice(0, 10),
        duration_hours: duration, mission_type: mission || null, discrepancies: discrepancies || null,
      });
      setShowForm(false); setMission(""); setDiscrepancies(""); setDuration(1);
      onReload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="detail-grid">
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14.5, margin: "0 0 12px" }}>Características e Configurações Mecânicas</h3>
        <SpecRow label="Motor" value={aircraft.engine_config} />
        <SpecRow label="Aviônicos" value={aircraft.avionics_config} />
        <SpecRow label="Armamento" value={aircraft.armament_config} />
        <SpecRow label="Velocidade máxima" value={aircraft.max_speed_kmh ? `${aircraft.max_speed_kmh} km/h` : undefined} />
        <SpecRow label="Teto de serviço" value={aircraft.service_ceiling_m ? `${aircraft.service_ceiling_m} m` : undefined} />
        <SpecRow label="Alcance máximo" value={aircraft.max_range_km ? `${aircraft.max_range_km} km` : undefined} />
        <SpecRow label="Tripulação" value={aircraft.crew_capacity?.toString()} />
        <SpecRow label="Ano de fabricação" value={aircraft.manufacture_year?.toString()} />
        {aircraft.notes && <SpecRow label="Observações" value={aircraft.notes} />}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14.5, margin: 0 }}>Livro de Bordo (registro de voos)</h3>
          <button className="btn btn-outline btn-sm" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancelar" : "+ Registrar voo"}</button>
        </div>
        {showForm && (
          <form onSubmit={submit} style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="field">
              <label>Piloto</label>
              <select value={pilotId} onChange={(e) => setPilotId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Selecione…</option>
                {pilots.map((p) => <option key={p.id} value={p.id}>{p.rank ? `${p.rank} - ` : ""}{p.full_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Duração (horas)</label>
              <input type="number" min={0.1} step={0.1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Tipo de missão</label>
              <input value={mission} onChange={(e) => setMission(e.target.value)} placeholder="Treinamento / Patrulha / Interceptação" />
            </div>
            <div className="field">
              <label>Discrepâncias reportadas</label>
              <textarea value={discrepancies} onChange={(e) => setDiscrepancies(e.target.value)} placeholder="Nenhuma / descrever anomalia observada" />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Salvando…" : "Registrar"}</button>
            <p style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
              As horas são somadas automaticamente à aeronave e a todos os componentes instalados.
            </p>
          </form>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
          {flightLogs.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Nenhum voo registrado ainda.</p>}
          {flightLogs.map((fl) => (
            <div key={fl.id} style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{new Date(fl.date).toLocaleDateString("pt-BR")} · {fl.duration_hours}h {fl.mission_type ? `· ${fl.mission_type}` : ""}</div>
              {fl.discrepancies && <div style={{ fontSize: 12, color: "var(--status-warn)" }}>⚠ {fl.discrepancies}</div>}
            </div>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ width: 140, flexShrink: 0, fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 13.5 }}>{value || "—"}</div>
    </div>
  );
}

// ---------------- Componentes / Peças (vida útil, vigência e histórico) ----------------
function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime();
  return Math.round(diff / 86400000);
}

function ValidityBadge({ date }: { date?: string | null }) {
  if (!date) return <span style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>Não definida</span>;
  const days = daysUntil(date);
  const formatted = new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
  if (days === null) return <span>{formatted}</span>;
  if (days < 0) return <span className="badge badge-critical">Vencida há {Math.abs(days)}d</span>;
  if (days <= 15) return <span className="badge badge-warn">Vence em {days}d ({formatted})</span>;
  return <span className="badge badge-ok">{formatted}</span>;
}

const NOTIFY_CHANNELS: NotificationChannel[] = ["E-mail", "SMS", "WhatsApp"];
const NOTIFY_CHANNEL_ICON: Record<NotificationChannel, string> = { "E-mail": "📧", "SMS": "💬", "WhatsApp": "🟢" };

/** Barra de resumo de peças desta aeronave próximas do vencimento (horas ou
 * vigência de calendário), com botão para notificar os responsáveis
 * (individuais e membros de grupos/equipes) - simulado nesta fase piloto,
 * exceto e-mail quando o servidor tem SMTP configurado. */
function AircraftPartAlertsBar({ aircraftId }: { aircraftId: number }) {
  const [alerts, setAlerts] = useState<PendingPartAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<NotificationChannel>("E-mail");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function reload() {
    api.get<PendingPartAlert[]>(`/notifications/pending-alerts?aircraft_id=${aircraftId}`)
      .then(setAlerts).finally(() => setLoading(false));
  }
  useEffect(reload, [aircraftId]);

  async function notifyAll() {
    setSending(true);
    setResult(null);
    try {
      const subject = `[AFA-TWIN] ${alerts.length} peça(s) próxima(s) do vencimento`;
      const message = alerts.map((a) => `• ${a.component_name}: ${a.detail}`).join("\n");
      const res = await api.post<AppNotification[]>("/notifications/send", {
        channel, reason: "Vencimento de Peça", subject, message, aircraft_id: aircraftId,
      });
      setResult(`${res.length} responsável(is) notificado(s) (${Array.from(new Set(res.map((n) => n.status))).join(", ")}).`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Erro ao notificar.");
    } finally {
      setSending(false);
    }
  }

  if (loading || alerts.length === 0) return null;

  return (
    <div className="card" style={{
      padding: 14, marginBottom: 16, borderLeft: "4px solid var(--status-warn)",
      display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>⚠ {alerts.length} peça(s) próxima(s) do vencimento nesta aeronave</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
          {alerts.map((a) => a.component_name).join(" · ")}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={channel} onChange={(e) => setChannel(e.target.value as NotificationChannel)} style={{ width: 130, minHeight: 34, padding: "4px 8px", fontSize: 12.5 }}>
          {NOTIFY_CHANNELS.map((c) => <option key={c} value={c}>{NOTIFY_CHANNEL_ICON[c]} {c}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={notifyAll} disabled={sending}>
          {sending ? "Enviando…" : "🔔 Notificar peças vencendo"}
        </button>
      </div>
      {result && <div style={{ fontSize: 11.5, color: "var(--text-secondary)", width: "100%" }}>{result}</div>}
    </div>
  );
}

function ComponentsTab({
  aircraftId, components, orders, people, onReload,
}: { aircraftId: number; components: Component[]; orders: MaintenanceOrder[]; people: Person[]; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", part_number: "", serial_number: "", category: "Motor / Grupo Motopropulsor" as ComponentCategory,
    monitoring_type: "On Condition (sob condição)" as MonitoringType, criticality: "Média" as Criticality,
    life_limit_hours: "", hours_since_new: 0, hours_since_overhaul: 0,
    preventive_interval_days: "", next_preventive_date: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ preventive_interval_days: "", next_preventive_date: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [historyId, setHistoryId] = useState<number | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/components", {
        aircraft_id: aircraftId, name: form.name, part_number: form.part_number || null,
        serial_number: form.serial_number || null, category: form.category, monitoring_type: form.monitoring_type,
        criticality: form.criticality, life_limit_hours: form.life_limit_hours ? Number(form.life_limit_hours) : null,
        hours_since_new: form.hours_since_new, hours_since_overhaul: form.hours_since_overhaul,
        preventive_interval_days: form.preventive_interval_days ? Number(form.preventive_interval_days) : null,
        next_preventive_date: form.next_preventive_date || null,
      });
      setShowForm(false);
      setForm({ ...form, name: "", part_number: "", serial_number: "", life_limit_hours: "", hours_since_new: 0, hours_since_overhaul: 0, preventive_interval_days: "", next_preventive_date: "" });
      onReload();
    } finally {
      setSaving(false);
    }
  }

  function startEditValidity(c: Component) {
    setEditingId(c.id);
    setEditForm({
      preventive_interval_days: c.preventive_interval_days != null ? String(c.preventive_interval_days) : "",
      next_preventive_date: c.next_preventive_date ?? "",
    });
  }

  async function saveValidity(id: number) {
    setSavingEdit(true);
    try {
      await api.put(`/components/${id}`, {
        preventive_interval_days: editForm.preventive_interval_days ? Number(editForm.preventive_interval_days) : null,
        next_preventive_date: editForm.next_preventive_date || null,
      });
      setEditingId(null);
      onReload();
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeComponent(id: number) {
    if (!confirm("Remover este componente do cadastro?")) return;
    await api.del(`/components/${id}`);
    onReload();
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
        Controle de vida útil (horas), vigência de uso (calendário) e histórico de manutenção por peça.
        Alertas de vencimento aparecem automaticamente no Painel, com opção de notificar a equipe responsável.
      </p>

      <AircraftPartAlertsBar aircraftId={aircraftId} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancelar" : "+ Novo Componente"}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div className="form-grid">
            <div className="field"><label>Nome do componente *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Motor / Trem de pouso / Radar…" /></div>
            <div className="field"><label>Part Number</label>
              <input value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} /></div>
            <div className="field"><label>Número de Série</label>
              <input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
            <div className="field"><label>Categoria</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ComponentCategory })}>
                {COMPONENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="field"><label>Tipo de monitoramento</label>
              <select value={form.monitoring_type} onChange={(e) => setForm({ ...form, monitoring_type: e.target.value as MonitoringType })}>
                {MONITORING_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="field"><label>Criticidade</label>
              <select value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value as Criticality })}>
                {CRITICALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="field"><label>Vida limite (horas, se hard-time)</label>
              <input type="number" value={form.life_limit_hours} onChange={(e) => setForm({ ...form, life_limit_hours: e.target.value })} /></div>
            <div className="field"><label>Horas desde novo</label>
              <input type="number" value={form.hours_since_new} onChange={(e) => setForm({ ...form, hours_since_new: Number(e.target.value) })} /></div>
            <div className="field"><label>Horas desde overhaul</label>
              <input type="number" value={form.hours_since_overhaul} onChange={(e) => setForm({ ...form, hours_since_overhaul: Number(e.target.value) })} /></div>
            <div className="field"><label>Vigência preventiva (dias, recorrência)</label>
              <input type="number" value={form.preventive_interval_days} onChange={(e) => setForm({ ...form, preventive_interval_days: e.target.value })} placeholder="Ex.: 180" /></div>
            <div className="field"><label>Próxima manutenção preventiva (data)</label>
              <input type="date" value={form.next_preventive_date} onChange={(e) => setForm({ ...form, next_preventive_date: e.target.value })} /></div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving}>{saving ? "Salvando…" : "Salvar componente"}</button>
        </form>
      )}

      <div className="card scroll-x">
        <table>
          <thead><tr><th>Componente</th><th>Categoria</th><th>Criticidade</th><th>Desgaste (horas)</th><th>Vigência (calendário)</th><th></th></tr></thead>
          <tbody>
            {components.map((c) => (
              <Fragment key={c.id}>
                <tr>
                  <td><strong>{c.name}</strong><div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{c.part_number}</div></td>
                  <td style={{ fontSize: 12.5 }}>{c.category}</td>
                  <td><CriticalityBadge value={c.criticality} /></td>
                  <td style={{ minWidth: 150 }}>{c.wear_pct != null ? <HealthBar value={100 - Math.min(c.wear_pct, 100)} /> : <span style={{ color: "var(--text-secondary)", fontSize: 12.5 }}>Monitorado</span>}</td>
                  <td style={{ minWidth: 160 }}>
                    {editingId === c.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                        <input type="number" placeholder="Intervalo (dias)" value={editForm.preventive_interval_days}
                               onChange={(e) => setEditForm({ ...editForm, preventive_interval_days: e.target.value })}
                               style={{ minHeight: 30, fontSize: 12.5, padding: "4px 8px" }} />
                        <input type="date" value={editForm.next_preventive_date}
                               onChange={(e) => setEditForm({ ...editForm, next_preventive_date: e.target.value })}
                               style={{ minHeight: 30, fontSize: 12.5, padding: "4px 8px" }} />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-primary btn-sm" disabled={savingEdit} onClick={() => saveValidity(c.id)}>Salvar</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <ValidityBadge date={c.next_preventive_date} />
                        <div><button className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => startEditValidity(c)}>✎ Definir vigência</button></div>
                      </div>
                    )}
                  </td>
                  <td style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setHistoryId(historyId === c.id ? null : c.id)}>
                      {historyId === c.id ? "Ocultar histórico" : "🕘 Histórico"}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => removeComponent(c.id)}>Remover</button>
                  </td>
                </tr>
                {historyId === c.id && (
                  <tr>
                    <td colSpan={6} style={{ background: "var(--bg-surface-alt)" }}>
                      <ComponentHistory componentId={c.id} orders={orders} people={people} aircraftId={aircraftId} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {components.length === 0 && <tr><td colSpan={6} style={{ color: "var(--text-secondary)" }}>Nenhum componente cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Histórico de manutenção de uma peça específica: ordens de serviço já
 * registradas para o componente, equipe/responsável envolvidos, e as
 * notificações já emitidas sobre ela. */
function ComponentHistory({ componentId, orders, people, aircraftId }: { componentId: number; orders: MaintenanceOrder[]; people: Person[]; aircraftId: number }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const relatedOrders = orders.filter((o) => o.component_id === componentId);

  useEffect(() => {
    api.get<AppNotification[]>(`/notifications?component_id=${componentId}`).then(setNotifications);
  }, [componentId]);

  function personName(id?: number | null) {
    if (!id) return "—";
    const p = people.find((x) => x.id === id);
    return p ? `${p.rank ? p.rank + " - " : ""}${p.full_name}` : `#${id}`;
  }

  return (
    <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>Ordens de serviço da peça</div>
        {relatedOrders.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nenhuma manutenção registrada para esta peça ainda.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {relatedOrders.map((o) => (
              <div key={o.id} className="card" style={{ padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <Link to={`/manutencao/${o.id}`} style={{ fontWeight: 700, fontSize: 12.5 }}>{o.order_number}</Link>
                  <OrderStatusBadge status={o.status} />
                </div>
                <div style={{ fontSize: 12 }}>{o.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                  Responsável: {personName(o.responsible_id)} {o.team_members ? `· Equipe: ${o.team_members}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>Notificações emitidas sobre esta peça</div>
        {notifications.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nenhuma notificação registrada para esta peça ainda (ver Painel para disparar alertas).</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.map((n) => (
              <div key={n.id} className="card" style={{ padding: 10, fontSize: 11.5 }}>
                <div style={{ fontWeight: 700 }}>{n.channel} · {n.reason}</div>
                <div style={{ color: "var(--text-secondary)" }}>{n.recipient_name} — {n.status}</div>
                <div style={{ color: "var(--text-secondary)" }}>{new Date(n.created_at).toLocaleString("pt-BR")}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <Link to={`/manutencao/nova?aircraft_id=${aircraftId}`} className="btn btn-outline btn-sm">+ Nova OS para esta aeronave</Link>
      </div>
    </div>
  );
}

// ---------------- Manutenção (somente leitura + atalho) ----------------
function OrdersTab({ aircraftId, orders, components }: { aircraftId: number; orders: MaintenanceOrder[]; components: Component[] }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Link to={`/manutencao/nova?aircraft_id=${aircraftId}`} className="btn btn-primary btn-sm">+ Nova Ordem de Serviço</Link>
      </div>
      <div className="card scroll-x">
        <table>
          <thead><tr><th>OS</th><th>Tipo</th><th>Título</th><th>Componente</th><th>Prioridade</th><th>Status</th></tr></thead>
          <tbody>
            {orders.map((o) => {
              const comp = components.find((c) => c.id === o.component_id);
              return (
                <tr key={o.id}>
                  <td><Link to={`/manutencao/${o.id}`}>{o.order_number}</Link></td>
                  <td style={{ fontSize: 12.5 }}>{o.type}</td>
                  <td>{o.title}</td>
                  <td style={{ fontSize: 12.5 }}>{comp?.name ?? "—"}</td>
                  <td><CriticalityBadge value={o.priority} /></td>
                  <td><OrderStatusBadge status={o.status} /></td>
                </tr>
              );
            })}
            {orders.length === 0 && <tr><td colSpan={6} style={{ color: "var(--text-secondary)" }}>Nenhuma ordem de serviço registrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- Pessoal responsável ----------------
/** Grupos/equipes vinculados a esta aeronave (responsabilidade coletiva) -
 * complementa os vínculos individuais com a composição de equipes nomeadas
 * (ver módulo Usuários → Grupos). */
function AircraftGroupsPanel({ aircraftId }: { aircraftId: number }) {
  const [links, setLinks] = useState<AircraftGroupAssignment[]>([]);
  const [allGroups, setAllGroups] = useState<ResponsibleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  function reload() {
    Promise.all([
      api.get<AircraftGroupAssignment[]>(`/aircraft-groups?aircraft_id=${aircraftId}`),
      api.get<ResponsibleGroup[]>("/groups"),
    ]).then(([l, g]) => { setLinks(l); setAllGroups(g); }).finally(() => setLoading(false));
  }
  useEffect(reload, [aircraftId]);

  async function linkGroup(e: FormEvent) {
    e.preventDefault();
    if (!groupId) return;
    setSaving(true);
    try {
      await api.post("/aircraft-groups", { aircraft_id: aircraftId, group_id: groupId, start_date: new Date().toISOString().slice(0, 10) });
      setGroupId("");
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function unlink(linkId: number) {
    if (!confirm("Remover este grupo como responsável pela aeronave?")) return;
    await api.del(`/aircraft-groups/${linkId}`);
    reload();
  }

  if (loading) return null;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontSize: 14.5, margin: 0 }}>Grupos/Equipes responsáveis</h3>
        <Link to="/pessoal/grupos" className="btn btn-outline btn-sm">Gerenciar grupos</Link>
      </div>
      {links.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nenhum grupo vinculado ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {links.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--bg-surface-alt)", borderRadius: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{l.group.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                  {l.group.members.map((m) => m.person.full_name.split(" ").slice(-1)[0]).join(", ")}
                  {" · "}desde {new Date(l.start_date).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => unlink(l.id)}>Remover</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={linkGroup} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <div className="field" style={{ minWidth: 220 }}>
          <label>Vincular grupo existente</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Selecione…</option>
            {allGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !groupId}>Vincular</button>
      </form>
    </div>
  );
}

function PeopleTab({ aircraftId, assignments, people, onReload }: { aircraftId: number; assignments: Assignment[]; people: Person[]; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [personId, setPersonId] = useState<number | "">("");
  const [roleInAircraft, setRoleInAircraft] = useState<AssignmentRole>("Mecânico Responsável");
  const [saving, setSaving] = useState(false);
  const [peopleInGroups, setPeopleInGroups] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.get<ResponsibleGroup[]>("/groups").then((groups) => {
      setPeopleInGroups(new Set(groups.flatMap((g) => g.members.map((m) => m.person.id))));
    });
  }, []);

  const selectedPersonHasNoGroup = personId !== "" && !peopleInGroups.has(personId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!personId) return;
    setSaving(true);
    try {
      await api.post("/assignments", {
        person_id: personId, aircraft_id: aircraftId, role_in_aircraft: roleInAircraft,
        start_date: new Date().toISOString().slice(0, 10),
      });
      setShowForm(false); setPersonId("");
      onReload();
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(id: number) {
    if (!confirm("Remover este vínculo?")) return;
    await api.del(`/assignments/${id}`);
    onReload();
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
        Na prática aeronáutica, a responsabilidade por uma aeronave é coletiva: vínculos individuais
        abaixo se somam aos membros de qualquer grupo/equipe vinculado (aba <Link to="/pessoal/grupos">Grupos</Link>).
      </p>

      <AircraftGroupsPanel aircraftId={aircraftId} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14.5, margin: 0 }}>Vínculos individuais</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancelar" : "+ Vincular Responsável"}</button>
      </div>
      {showForm && (
        <form onSubmit={submit} className="card" style={{ padding: 18, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div className="field" style={{ minWidth: 240 }}>
            <label>Pessoa</label>
            <select required value={personId} onChange={(e) => setPersonId(Number(e.target.value))}>
              <option value="">Selecione…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.rank ? `${p.rank} - ` : ""}{p.full_name} ({p.role})</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 220 }}>
            <label>Função na aeronave</label>
            <select value={roleInAircraft} onChange={(e) => setRoleInAircraft(e.target.value as AssignmentRole)}>
              {ASSIGNMENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Salvando…" : "Vincular"}</button>
          {selectedPersonHasNoGroup && (
            <div style={{ flexBasis: "100%", fontSize: 11.5, color: "var(--status-warn)" }}>
              💡 Esta pessoa não pertence a nenhum grupo/equipe ainda. Um vínculo individual só notifica
              ela mesma — considere também adicioná-la a um <Link to="/pessoal/grupos">grupo</Link> para
              que toda a equipe seja notificada sobre esta aeronave.
            </div>
          )}
        </form>
      )}
      <div className="card scroll-x">
        <table>
          <thead><tr><th>Nome</th><th>Organização</th><th>Função na Aeronave</th><th>Desde</th><th></th></tr></thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.person.rank ? `${a.person.rank} - ` : ""}{a.person.full_name}</strong></td>
                <td style={{ fontSize: 12.5 }}>{a.person.organization}</td>
                <td>{a.role_in_aircraft}</td>
                <td style={{ fontSize: 12.5 }}>{new Date(a.start_date).toLocaleDateString("pt-BR")}</td>
                <td><button className="btn btn-outline btn-sm" onClick={() => removeAssignment(a.id)}>Remover</button></td>
              </tr>
            ))}
            {assignments.length === 0 && <tr><td colSpan={5} style={{ color: "var(--text-secondary)" }}>Nenhum vínculo cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- Confiabilidade (MTBF/MTTR) & Risco Operacional ponderado ----------------
function ReliabilityRiskTab({ aircraftId }: { aircraftId: number }) {
  const [reliability, setReliability] = useState<ReliabilityMetrics | null>(null);
  const [risk, setRisk] = useState<OperationalRiskBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<ReliabilityMetrics>(`/aircraft/${aircraftId}/reliability`),
      api.get<OperationalRiskBreakdown>(`/aircraft/${aircraftId}/operational-risk`),
    ]).then(([r, k]) => { setReliability(r); setRisk(k); }).finally(() => setLoading(false));
  }, [aircraftId]);

  if (loading) return <p>Calculando indicadores de confiabilidade e risco…</p>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="detail-grid">
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14.5, margin: "0 0 4px" }}>Engenharia de Confiabilidade</h3>
        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 14 }}>
          MTBF, MTTR e disponibilidade calculados a partir do histórico real de manutenções corretivas
          concluídas desta aeronave.
        </p>
        {reliability && reliability.sample_size === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{reliability.confidence_note}</p>
        ) : reliability && (
          <>
            <SpecRow label="Amostra" value={`${reliability.sample_size} manutenção(ões) corretiva(s)`} />
            <SpecRow label="MTBF" value={reliability.mtbf_hours != null ? `${reliability.mtbf_hours} h` : undefined} />
            <SpecRow label="MTTR" value={reliability.mttr_hours != null ? `${reliability.mttr_hours} h` : undefined} />
            <SpecRow label="Taxa de falha (λ)" value={reliability.failure_rate_per_hour != null ? `${reliability.failure_rate_per_hour}/h` : undefined} />
            <SpecRow label="Confiabilidade (100h)" value={reliability.reliability_pct_next_100h != null ? `${reliability.reliability_pct_next_100h}%` : undefined} />
            <SpecRow label="Disponibilidade Intrínseca" value={reliability.availability_intrinsic_pct != null ? `${reliability.availability_intrinsic_pct}%` : undefined} />
            <SpecRow label="Disponibilidade Operacional" value={reliability.availability_operational_pct != null ? `${reliability.availability_operational_pct}%` : undefined} />
            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 10 }}>{reliability.confidence_note}</p>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h3 style={{ fontSize: 14.5, margin: 0 }}>Risco Operacional Ponderado</h3>
          {risk && <RiskBadge level={risk.risk_level} />}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 14 }}>
          Modelo de fatores e pesos conforme o documento de referência do projeto.
        </p>
        {risk && (
          <>
            {risk.factors.map((f) => (
              <div key={f.factor} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ fontWeight: 700 }}>{f.factor} <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>({f.weight_pct}%)</span></span>
                  <span>{f.score_pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "var(--bg-surface-alt)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                  <div style={{ width: `${f.score_pct}%`, height: "100%", background: "var(--fab-blue-500)" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{f.basis}</div>
              </div>
            ))}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
              <span>Índice de risco</span>
              <span>{risk.risk_score_pct}%</span>
            </div>
          </>
        )}
      </div>
      <style>{`@media (max-width: 900px) { .detail-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// ---------------- Inspeção Fotográfica ----------------
const DEFECT_TYPES: DefectType[] = ["Corrosão", "Trinca", "Vazamento", "Desgaste", "Outro"];

function InspectionsTab({ aircraftId, components, people }: { aircraftId: number; components: Component[]; people: Person[] }) {
  const [findings, setFindings] = useState<InspectionFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    component_id: "" as number | "", defect_type: "Corrosão" as DefectType, location: "",
    severity: "Média" as Criticality, extent: "", probable_cause: "", amm_reference: "",
    notes: "", recorded_by_id: "" as number | "",
  });

  function reload() {
    api.get<InspectionFinding[]>(`/inspections?aircraft_id=${aircraftId}`).then(setFindings).finally(() => setLoading(false));
  }
  useEffect(reload, [aircraftId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("aircraft_id", String(aircraftId));
      if (form.component_id) fd.append("component_id", String(form.component_id));
      fd.append("defect_type", form.defect_type);
      if (form.location) fd.append("location", form.location);
      fd.append("severity", form.severity);
      if (form.extent) fd.append("extent", form.extent);
      if (form.probable_cause) fd.append("probable_cause", form.probable_cause);
      if (form.amm_reference) fd.append("amm_reference", form.amm_reference);
      if (form.notes) fd.append("notes", form.notes);
      if (form.recorded_by_id) fd.append("recorded_by_id", String(form.recorded_by_id));
      fd.append("file", file);
      await api.upload("/inspections", fd);
      setShowForm(false);
      setFile(null);
      setForm({ ...form, location: "", extent: "", probable_cause: "", amm_reference: "", notes: "" });
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Remover este registro de inspeção?")) return;
    await api.del(`/inspections/${id}`);
    reload();
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
        Fundação manual do módulo de Visão Computacional descrito no projeto: o mecânico fotografa a
        anomalia (corrosão, trinca, vazamento, desgaste) e registra localização, severidade e causa
        provável, criando um histórico visual comparável ao longo do tempo.
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancelar" : "+ Nova Inspeção Fotográfica"}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div className="form-grid">
            <div className="field field-full">
              <label>Foto da anomalia (JPG/PNG/WEBP) *</label>
              <input required type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                     onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="field">
              <label>Tipo de defeito *</label>
              <select value={form.defect_type} onChange={(e) => setForm({ ...form, defect_type: e.target.value as DefectType })}>
                {DEFECT_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Componente relacionado</label>
              <select value={form.component_id} onChange={(e) => setForm({ ...form, component_id: e.target.value ? Number(e.target.value) : "" })}>
                <option value="">Nenhum / estrutura geral</option>
                {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Localização</label>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ex.: longarina próximo à nervura 7" />
            </div>
            <div className="field">
              <label>Severidade</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Criticality })}>
                {(["Baixa", "Média", "Alta", "Crítica"] as Criticality[]).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Extensão / medida observada</label>
              <input value={form.extent} onChange={(e) => setForm({ ...form, extent: e.target.value })} placeholder="Ex.: 18mm" />
            </div>
            <div className="field">
              <label>Referência AMM</label>
              <input value={form.amm_reference} onChange={(e) => setForm({ ...form, amm_reference: e.target.value })} placeholder="AMM Cap. 57" />
            </div>
            <div className="field">
              <label>Registrado por</label>
              <select value={form.recorded_by_id} onChange={(e) => setForm({ ...form, recorded_by_id: e.target.value ? Number(e.target.value) : "" })}>
                <option value="">Selecione…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.rank ? `${p.rank} - ` : ""}{p.full_name}</option>)}
              </select>
            </div>
            <div className="field field-full">
              <label>Causa provável</label>
              <textarea value={form.probable_cause} onChange={(e) => setForm({ ...form, probable_cause: e.target.value })} />
            </div>
            <div className="field field-full">
              <label>Observações</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={saving}>{saving ? "Enviando…" : "Registrar Inspeção"}</button>
        </form>
      )}

      {loading ? <p>Carregando…</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {findings.map((f) => {
            const comp = components.find((c) => c.id === f.component_id);
            return (
              <div key={f.id} className="card" style={{ overflow: "hidden" }}>
                <img src={f.photo_url} alt={f.defect_type}
                     style={{ width: "100%", height: 150, objectFit: "cover" }} />
                <div style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="badge badge-warn">{f.defect_type}</span>
                    <CriticalityBadge value={f.severity} />
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 8 }}>{f.location || comp?.name || "Localização não informada"}</div>
                  {f.probable_cause && <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4 }}>{f.probable_cause}</div>}
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8 }}>
                    {new Date(f.recorded_at).toLocaleDateString("pt-BR")} {f.amm_reference ? `· ${f.amm_reference}` : ""}
                  </div>
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => remove(f.id)}>Remover</button>
                </div>
              </div>
            );
          })}
          {findings.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Nenhuma inspeção fotográfica registrada.</p>}
        </div>
      )}
    </div>
  );
}
