import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../api/client";
import type { DashboardSummary, Notification, NotificationChannel } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import AircraftThumbnail from "../components/AircraftThumbnail";
import { HealthBar, RiskBadge, StatusBadge } from "../components/Badges";
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

export default function DashboardPage() {
  const { personName, personRank, role } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, marginBottom: 2 }}>Painel de Apoio à Decisão</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Bem-vindo(a), {personRank ? `${personRank} ` : ""}{personName ?? role}. Visão geral da frota e alertas de manutenção.
        </p>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <StatCard label="Aeronaves na frota" value={summary.total_aircraft} />
        <StatCard label="Operacionais" value={summary.operational_aircraft} tone="ok" sub={`${summary.average_fleet_availability_pct}% de disponibilidade`} />
        <StatCard label="Em manutenção/inspeção" value={summary.in_maintenance_aircraft} tone="warn" />
        <StatCard label="OS em aberto" value={summary.open_orders} tone={summary.critical_orders > 0 ? "critical" : "info"} sub={`${summary.critical_orders} crítica(s)`} />
        <StatCard label="Índice médio de saúde" value={`${summary.average_health_index}%`} tone={summary.average_health_index >= 85 ? "ok" : summary.average_health_index >= 65 ? "warn" : "critical"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, alignItems: "start" }} className="dash-grid">
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

          <h2 style={{ fontSize: 15.5, margin: "22px 0 12px" }}>📜 Notificações Recentes</h2>
          {recentNotifications.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Nenhuma notificação registrada ainda.</p>
          ) : (
            <div className="scroll-x">
              <table>
                <thead><tr><th>Canal</th><th>Motivo</th><th>Destinatário</th><th>Aeronave</th><th>Status</th><th>Quando</th></tr></thead>
                <tbody>
                  {recentNotifications.map((n) => (
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
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8 }}>
            E-mail é enviado de verdade quando o servidor tem SMTP configurado; sem isso, e sempre para
            SMS/WhatsApp nesta fase piloto (sem custo), a notificação fica registrada aqui como "Simulada".
          </p>
        </div>

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
      </div>

      <MaintenanceCategoryChart alerts={summary.alerts} />

      <style>{`@media (max-width: 900px) { .dash-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
