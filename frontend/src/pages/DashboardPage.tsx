import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../api/client";
import type { DashboardSummary, Notification, NotificationChannel } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import AircraftThumbnail from "../components/AircraftThumbnail";
import { HealthBar, RiskBadge, StatusBadge } from "../components/Badges";
import SortableTh from "../components/SortableTh";
import SplashScreen from "../components/SplashScreen";
import StatCard from "../components/StatCard";

const CHART_COLORS = ["#c62828", "#d99a00", "#2f6bc4", "#0b6e4f", "#7a4a9c", "#4b5566", "#0e7c86"];
type ChartMode = "pizza" | "barras" | "linhas";

/** Distribuição das categorias de alerta de manutenção preventiva (Vigência
 * Vencida, OS Crítica em Aberto, Componente Próximo do Limite etc.),
 * alternável entre pizza, barras e linhas. */
function MaintenanceCategoryChart({ alerts }: { alerts: DashboardSummary["alerts"] }) {
  const [mode, setMode] = useState<ChartMode>("pizza");

  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of alerts) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [alerts]);

  const axisTick = { fill: "var(--text-secondary)", fontSize: 11 };

  return (
    <div className="card" style={{ padding: 18, marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 15.5, margin: 0 }}>📊 Principais Categorias de Manutenção Preventiva</h2>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            Distribuição dos alertas ativos por categoria (ver também Manutenção → Cadastro de Manutenção).
          </p>
        </div>
        <div className="card" style={{ display: "flex", padding: 3, gap: 2 }}>
          {(["pizza", "barras", "linhas"] as ChartMode[]).map((m) => (
            <button key={m} type="button" className={`btn btn-sm ${mode === m ? "btn-primary" : "btn-outline"}`}
                    style={{ borderColor: "transparent", textTransform: "capitalize" }} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 13.5, marginTop: 10 }}>Nenhum alerta ativo para exibir no gráfico.</p>
      ) : (
        <div style={{ width: "100%", height: 320, marginTop: 10 }}>
          <ResponsiveContainer>
            {mode === "pizza" ? (
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={{ fill: "var(--text-secondary)", fontSize: 11.5 }}>
                  {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12.5 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            ) : mode === "barras" ? (
              <BarChart data={data}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={axisTick} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={axisTick} />
                <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12.5 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={axisTick} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={axisTick} />
                <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, fontSize: 12.5 }} />
                <Line type="monotone" dataKey="value" stroke="var(--fab-blue-500)" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const CHANNELS: NotificationChannel[] = ["E-mail", "SMS", "WhatsApp"];
const CHANNEL_ICON: Record<NotificationChannel, string> = { "E-mail": "📧", "SMS": "💬", "WhatsApp": "🟢" };

/** Botão inline para notificar os responsáveis vinculados a uma aeronave
 * (por e-mail real, se configurado, ou SMS/WhatsApp simulados nesta fase
 * piloto) sobre um alerta específico do painel. */
function NotifyButton({
  aircraftId, componentId, reason, subject, message,
}: { aircraftId: number; componentId?: number | null; reason: string; subject: string; message: string }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<NotificationChannel>("E-mail");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await api.post<Notification[]>("/notifications/send", {
        channel, reason, subject, message, aircraft_id: aircraftId, component_id: componentId ?? null,
      });
      const statuses = Array.from(new Set(res.map((n) => n.status)));
      setResult(`Registrado para ${res.length} responsável(is) — ${statuses.join(", ")}`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Erro ao notificar.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => setOpen(true)}>
        🔔 Notificar responsáveis
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <select value={channel} onChange={(e) => setChannel(e.target.value as NotificationChannel)} style={{ width: 130, minHeight: 32, padding: "4px 8px", fontSize: 12.5 }}>
          {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_ICON[c]} {c}</option>)}
        </select>
        <button type="button" className="btn btn-primary btn-sm" onClick={send} disabled={sending}>
          {sending ? "Enviando…" : "Enviar"}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
      {result && <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{result}</div>}
    </div>
  );
}

/** Notifica, de uma só vez, os responsáveis (indivíduos + membros de grupos)
 * de todas as aeronaves com peças no período de vencimento da manutenção
 * preventiva - agrupando os alertas por aeronave para enviar uma única
 * mensagem consolidada a cada uma, em vez de uma notificação por peça. */
function NotifyAllPendingButton({ alerts, onDone }: { alerts: DashboardSummary["alerts"]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<NotificationChannel>("E-mail");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const partAlerts = alerts.filter((a) => !!a.component_id && !!a.aircraft_id);
  const byAircraft = new Map<number, { tail: string; items: typeof partAlerts }>();
  for (const a of partAlerts) {
    const key = a.aircraft_id!;
    if (!byAircraft.has(key)) byAircraft.set(key, { tail: a.aircraft_tail_number ?? `#${key}`, items: [] });
    byAircraft.get(key)!.items.push(a);
  }

  async function sendAll() {
    setSending(true);
    setResult(null);
    try {
      let notificationCount = 0;
      for (const [aircraftId, group] of byAircraft) {
        const subject = `[AFA-TWIN] ${group.items.length} peça(s) próxima(s) do vencimento — ${group.tail}`;
        const message = group.items.map((a) => `• ${a.title}: ${a.detail}`).join("\n");
        const res = await api.post<Notification[]>("/notifications/send", {
          channel, reason: "Vencimento de Peça", subject, message, aircraft_id: aircraftId,
        });
        notificationCount += res.length;
      }
      setResult(`${byAircraft.size} aeronave(s) notificada(s) — ${notificationCount} notificação(ões) registrada(s).`);
      onDone();
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Erro ao notificar em lote.");
    } finally {
      setSending(false);
    }
  }

  if (byAircraft.size === 0) return null;

  if (!open) {
    return (
      <button type="button" className="btn btn-accent btn-sm" onClick={() => setOpen(true)}>
        🔔📢 Notificar todos ({byAircraft.size} aeronave{byAircraft.size > 1 ? "s" : ""})
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select value={channel} onChange={(e) => setChannel(e.target.value as NotificationChannel)} style={{ width: 130, minHeight: 32, padding: "4px 8px", fontSize: 12.5 }}>
          {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_ICON[c]} {c}</option>)}
        </select>
        <button type="button" className="btn btn-accent btn-sm" onClick={sendAll} disabled={sending}>
          {sending ? "Enviando…" : `Confirmar envio a ${byAircraft.size} aeronave(s)`}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
      {result && <div style={{ fontSize: 11.5, color: "var(--text-secondary)", textAlign: "right" }}>{result}</div>}
    </div>
  );
}

type DashTab = "frota" | "alertas" | "notificacoes" | "categorias";
const DASH_TABS: { key: DashTab; label: string }[] = [
  { key: "frota", label: "Frota — Saúde e Risco Operacional" },
  { key: "alertas", label: "Alertas de Desgaste e Manutenção" },
  { key: "notificacoes", label: "Notificações Recentes" },
  { key: "categorias", label: "Principais Categorias de Manutenção" },
];

type NotifSortKey = "channel" | "reason" | "recipient_name" | "aircraft_tail_number" | "status" | "created_at";

function notifSortValue(n: Notification, key: NotifSortKey): string | number {
  switch (key) {
    case "channel": return n.channel;
    case "reason": return n.reason;
    case "recipient_name": return n.recipient_name ?? "";
    case "aircraft_tail_number": return n.aircraft_tail_number ?? "";
    case "status": return n.status;
    case "created_at": return new Date(n.created_at).getTime();
  }
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { personName, personRank, role } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashTab>("frota");

  // ---------------- Filtro e ordenação de "Notificações Recentes" ----------------
  const [notifChannelFilter, setNotifChannelFilter] = useState("");
  const [notifReasonFilter, setNotifReasonFilter] = useState("");
  const [notifStatusFilter, setNotifStatusFilter] = useState("");
  const [notifQuery, setNotifQuery] = useState("");
  const [notifSortKey, setNotifSortKey] = useState<NotifSortKey>("created_at");
  const [notifSortDir, setNotifSortDir] = useState<"asc" | "desc">("desc");
  function toggleNotifSort(key: NotifSortKey) {
    if (key === notifSortKey) setNotifSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setNotifSortKey(key); setNotifSortDir(key === "created_at" ? "desc" : "asc"); }
  }

  // Uma única chamada monta a tela inteira (totais, frota e notificações
  // recentes já vêm juntos em /dashboard/summary) - antes eram 3 chamadas
  // em paralelo, com a de /aircraft recalculando confiabilidade/MTBF de toda
  // a frota à toa só para preencher esta tabela.
  function reload() {
    api.get<DashboardSummary>("/dashboard/summary").then(setSummary).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  if (loading) return <SplashScreen fullscreen={false} />;
  if (!summary) return <p>Não foi possível carregar o painel.</p>;

  const fleet = summary.fleet;
  const recentNotifications = summary.recent_notifications;
  const notifChannelOptions = Array.from(new Set(recentNotifications.map((n) => n.channel))).sort();
  const notifReasonOptions = Array.from(new Set(recentNotifications.map((n) => n.reason))).sort();
  const notifStatusOptions = Array.from(new Set(recentNotifications.map((n) => n.status))).sort();
  const filteredNotifications = recentNotifications
    .filter((n) => {
      if (notifChannelFilter && n.channel !== notifChannelFilter) return false;
      if (notifReasonFilter && n.reason !== notifReasonFilter) return false;
      if (notifStatusFilter && n.status !== notifStatusFilter) return false;
      if (notifQuery) {
        const q = notifQuery.trim().toLowerCase();
        if (!`${n.recipient_name ?? ""} ${n.aircraft_tail_number ?? ""}`.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const va = notifSortValue(a, notifSortKey);
      const vb = notifSortValue(b, notifSortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return notifSortDir === "asc" ? cmp : -cmp;
    });

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, marginBottom: 2 }}>Painel de Apoio à Decisão</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Bem-vindo(a), {personRank ? `${personRank} ` : ""}{personName ?? role}. Visão geral da frota e alertas de manutenção.
        </p>
      </div>

      {/* Os 4 primeiros cartões navegam para o módulo/filtro correspondente
          (Manutenção → Ordens em aberto; Aeronaves → lista, opcionalmente
          filtrada por Status) - só o "Índice médio de saúde" fica sem
          atalho, por não corresponder a uma tela própria. */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        {/* Cor própria (rosa), fora do jogo de 4 tons ok/warn/critical/info -
            é uma contagem simples, não uma severidade, e evita repetir a
            mesma cor de "OS em aberto" (que também pode cair em "info"/azul
            quando não há OS crítica). Mesma cor usada para "Subalares" em
            Disponibilidade, por ser o mesmo papel (contagem neutra). */}
        <StatCard label="Aeronaves na frota" value={summary.total_aircraft} valueColor="var(--fab-pink-500)" onClick={() => navigate("/aeronaves/cadastro")} />
        <StatCard
          label="Operacionais" value={summary.operational_aircraft} tone="ok"
          sub={`${summary.average_fleet_availability_pct}% de disponibilidade`}
          onClick={() => navigate("/aeronaves/cadastro?status=Operacional")}
        />
        <StatCard
          label="Em manutenção/inspeção" value={summary.in_maintenance_aircraft} tone="warn" valueColor="var(--stat-value-onwarn)"
          onClick={() => navigate("/aeronaves/cadastro?status=manutencao-inspecao")}
        />
        <StatCard
          label="OS em aberto" value={summary.open_orders} tone={summary.critical_orders > 0 ? "critical" : "info"}
          sub={`${summary.critical_orders} crítica(s)`}
          onClick={() => navigate("/manutencao/ordens?status=open")}
        />
        <StatCard label="Índice médio de saúde" value={`${summary.average_health_index}%`} tone={summary.average_health_index >= 85 ? "ok" : summary.average_health_index >= 65 ? "warn" : "critical"} />
      </div>

      <div className="card" style={{ display: "flex", gap: 6, marginBottom: 18, padding: 6, flexWrap: "wrap" }}>
        {DASH_TABS.map(({ key, label }) => (
          <button
            key={key} onClick={() => setActiveTab(key)}
            className="btn btn-sm"
            style={{
              border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 700,
              background: activeTab === key ? "var(--fab-navy-900)" : "transparent",
              color: activeTab === key ? "#fff" : "var(--text-label)",
            }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === "frota" && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 15.5, margin: 0 }}>Frota — Saúde e Risco Operacional</h2>
            <Link to="/aeronaves" className="btn btn-outline btn-sm">Ver todas</Link>
          </div>
          <div className="scroll-x">
            <table>
              <thead>
                <tr><th></th><th>Aeronave</th><th>Status</th><th>Saúde</th><th>Risco</th></tr>
              </thead>
              <tbody>
                {fleet.map((a) => (
                  <tr key={a.id}>
                    <td><AircraftThumbnail aircraft={a} width={58} height={36} rounded={6} /></td>
                    <td>
                      <Link to={`/aeronaves/${a.id}`} style={{ fontWeight: 700, textDecoration: "none" }}>{a.tail_number}</Link>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.model}</div>
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td style={{ minWidth: 140 }}><HealthBar value={a.health_index} /></td>
                    <td><RiskBadge level={a.risk_level} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "alertas" && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 15.5, margin: 0 }}>Alertas de Desgaste e Manutenção</h2>
            <NotifyAllPendingButton alerts={summary.alerts} onDone={reload} />
          </div>
          {summary.alerts.length === 0 && (
            <p style={{ color: "var(--text-secondary)", fontSize: 13.5 }}>Nenhum alerta ativo. Frota dentro dos parâmetros esperados.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {summary.alerts.map((a, i) => (
              <div key={i} style={{
                borderLeft: `4px solid var(--status-${a.severity === "critico" ? "critical" : a.severity === "atencao" ? "warn" : "info"})`,
                background: "var(--bg-surface-alt)", borderRadius: 8, padding: "10px 12px",
              }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{a.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>{a.detail}</div>
                {a.aircraft_id && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <Link to={`/aeronaves/${a.aircraft_id}`} style={{ fontSize: 12, fontWeight: 700 }}>Ver aeronave →</Link>
                    <NotifyButton
                      aircraftId={a.aircraft_id} componentId={a.component_id}
                      reason={a.component_id ? "Vencimento de Peça" : "Manual"}
                      subject={`[AFA-TWIN] ${a.title}`} message={a.detail}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "notificacoes" && (
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 15.5, margin: "0 0 12px" }}>📜 Notificações Recentes</h2>
          {recentNotifications.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Nenhuma notificação registrada ainda.</p>
          ) : (
            <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <input type="text" placeholder="Buscar por destinatário ou aeronave…" value={notifQuery}
                     onChange={(e) => setNotifQuery(e.target.value)} style={{ maxWidth: 260 }} />
              <select value={notifChannelFilter} onChange={(e) => setNotifChannelFilter(e.target.value)} style={{ maxWidth: 160 }}>
                <option value="">Todos os canais</option>
                {notifChannelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={notifReasonFilter} onChange={(e) => setNotifReasonFilter(e.target.value)} style={{ maxWidth: 220 }}>
                <option value="">Todos os motivos</option>
                {notifReasonOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={notifStatusFilter} onChange={(e) => setNotifStatusFilter(e.target.value)} style={{ maxWidth: 180 }}>
                <option value="">Todos os status</option>
                {notifStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <SortableTh label="Canal" sortKey="channel" active={notifSortKey === "channel"} dir={notifSortDir} onClick={toggleNotifSort} />
                    <SortableTh label="Motivo" sortKey="reason" active={notifSortKey === "reason"} dir={notifSortDir} onClick={toggleNotifSort} />
                    <SortableTh label="Destinatário" sortKey="recipient_name" active={notifSortKey === "recipient_name"} dir={notifSortDir} onClick={toggleNotifSort} />
                    <SortableTh label="Aeronave" sortKey="aircraft_tail_number" active={notifSortKey === "aircraft_tail_number"} dir={notifSortDir} onClick={toggleNotifSort} />
                    <SortableTh label="Status" sortKey="status" active={notifSortKey === "status"} dir={notifSortDir} onClick={toggleNotifSort} />
                    <SortableTh label="Data/Hora" sortKey="created_at" active={notifSortKey === "created_at"} dir={notifSortDir} onClick={toggleNotifSort} />
                  </tr>
                </thead>
                <tbody>
                  {filteredNotifications.map((n) => (
                    <tr key={n.id}>
                      <td>{CHANNEL_ICON[n.channel]} {n.channel}</td>
                      <td style={{ fontSize: 12.5 }}>{n.reason}</td>
                      <td style={{ fontSize: 12.5 }}>{n.recipient_name ?? "—"}</td>
                      <td style={{ fontSize: 12.5 }}>{n.aircraft_tail_number ?? "—"}</td>
                      <td>
                        <span className={`badge ${n.status === "Enviada" ? "badge-ok" : n.status === "Falha no Envio" ? "badge-critical" : "badge-neutral"}`}>
                          {n.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{new Date(n.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {filteredNotifications.length === 0 && (
                    <tr><td colSpan={6} style={{ color: "var(--text-secondary)" }}>Nenhuma notificação encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
          <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8 }}>
            E-mail é enviado de verdade quando o servidor tem SMTP configurado; sem isso, e sempre para
            SMS/WhatsApp nesta fase piloto (sem custo), a notificação fica registrada aqui como "Simulada".
          </p>
        </div>
      )}

      {activeTab === "categorias" && <MaintenanceCategoryChart alerts={summary.alerts} />}
    </div>
  );
}
