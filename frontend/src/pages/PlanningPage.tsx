import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Aircraft, Component, FleetAvailabilityForecast, ProspectiveAnalysisResult } from "../api/types";

export default function PlanningPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Disponibilidade da Frota &amp; Análise Prospectiva</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, maxWidth: 760 }}>
        Ferramentas de apoio estratégico descritas no documento de referência: projeção de disponibilidade
        da frota e simulação de impacto ao adiar uma manutenção ("Análise Prospectiva de Manutenção").
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }} className="planning-grid">
        <FleetAvailabilitySection />
        <ProspectiveAnalysisSection />
      </div>
      <style>{`@media (max-width: 980px) { .planning-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function FleetAvailabilitySection() {
  const [forecast, setForecast] = useState<FleetAvailabilityForecast | null>(null);
  const [horizon, setHorizon] = useState(14);
  const [loading, setLoading] = useState(true);

  function load(h: number) {
    setLoading(true);
    api.get<FleetAvailabilityForecast>(`/planning/fleet-availability?horizon_days=${h}`)
      .then(setForecast).finally(() => setLoading(false));
  }
  useEffect(() => load(horizon), [horizon]);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 style={{ fontSize: 14.5, margin: 0 }}>Disponibilidade da Frota — Projeção</h3>
        <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} style={{ width: 130 }}>
          <option value={7}>7 dias</option>
          <option value={14}>14 dias</option>
          <option value={30}>30 dias</option>
        </select>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 14 }}>
        Considera aeronaves atualmente em manutenção/inspeção e ordens de serviço em aberto com prazo definido.
      </p>
      {loading || !forecast ? <p>Calculando…</p> : (
        <>
          {forecast.highest_impact_note && (
            <div style={{ background: "var(--status-warn-bg)", color: "var(--status-warn)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, marginBottom: 14 }}>
              ⚠ {forecast.highest_impact_note}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, marginBottom: 8 }}>
            {forecast.days.map((d) => {
              const pct = forecast.total_aircraft ? (d.available_count / forecast.total_aircraft) * 100 : 100;
              const color = pct >= 80 ? "var(--status-ok)" : pct >= 50 ? "var(--status-warn)" : "var(--status-critical)";
              return (
                <div key={d.date} title={`${new Date(d.date).toLocaleDateString("pt-BR")}: ${d.available_count}/${forecast.total_aircraft} disponíveis`}
                     style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ background: color, borderRadius: "3px 3px 0 0", height: `${pct}%`, minHeight: 4 }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-secondary)" }}>
            <span>{new Date(forecast.days[0]?.date).toLocaleDateString("pt-BR")}</span>
            <span>{new Date(forecast.days[forecast.days.length - 1]?.date).toLocaleDateString("pt-BR")}</span>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 12 }}>
            Passe o cursor sobre as barras para ver a disponibilidade estimada de cada dia (aeronaves disponíveis / total da frota: {forecast.total_aircraft}).
          </p>
        </>
      )}
    </div>
  );
}

function ProspectiveAnalysisSection() {
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [aircraftId, setAircraftId] = useState<number | "">("");
  const [componentId, setComponentId] = useState<number | "">("");
  const [postponeDays, setPostponeDays] = useState(10);
  const [result, setResult] = useState<ProspectiveAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.get<Aircraft[]>("/aircraft").then(setFleet); }, []);
  useEffect(() => {
    if (aircraftId) {
      api.get<Component[]>(`/components?aircraft_id=${aircraftId}`).then(setComponents);
    } else {
      setComponents([]);
    }
    setComponentId("");
  }, [aircraftId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!aircraftId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<ProspectiveAnalysisResult>("/planning/prospective-analysis", {
        aircraft_id: aircraftId, component_id: componentId || null, postpone_days: postponeDays,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao simular o cenário.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ fontSize: 14.5, margin: "0 0 4px" }}>Análise Prospectiva de Manutenção</h3>
      <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 14 }}>
        "O que acontece se eu adiar esta inspeção/manutenção?" — simulação determinística sobre os dados já cadastrados.
      </p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="field">
          <label>Aeronave *</label>
          <select required value={aircraftId} onChange={(e) => setAircraftId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Selecione…</option>
            {fleet.map((a) => <option key={a.id} value={a.id}>{a.tail_number} · {a.model}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Componente afetado (opcional)</label>
          <select value={componentId} onChange={(e) => setComponentId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Nenhum específico</option>
            {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Dias de adiamento</label>
          <input type="number" min={1} max={180} value={postponeDays} onChange={(e) => setPostponeDays(Number(e.target.value))} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Simulando…" : "Simular cenário"}</button>
        {error && <div className="badge badge-critical" style={{ display: "block", padding: "8px 12px" }}>{error}</div>}
      </form>

      {result && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <MiniStat label="Saúde atual → projetada" value={`${result.current_health_index}% → ${result.projected_health_index}%`} />
            <MiniStat label="Risco atual → projetado" value={`${result.current_risk_level} → ${result.projected_risk_level}`} />
            <MiniStat label="Horas extras estimadas" value={`${result.extra_flight_hours_estimated} h`} />
            <MiniStat label="Aumento na prob. de falha" value={`+${result.increased_failure_probability_pct}%`} />
            <MiniStat label="Impacto na disponibilidade" value={`-${result.availability_impact_pct} p.p.`} />
            <MiniStat label="Impacto financeiro estimado" value={result.estimated_financial_impact_brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
          </div>
          {result.affected_component_name && (
            <p style={{ fontSize: 12.5 }}>
              Desgaste do componente <strong>{result.affected_component_name}</strong>: {result.current_component_wear_pct?.toFixed(1)}% → {result.projected_component_wear_pct?.toFixed(1)}%
            </p>
          )}
          <div style={{
            background: "var(--bg-surface-alt)", borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 600, marginTop: 6,
          }}>
            {result.recommendation}
          </div>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 10 }}>{result.method_note}</p>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg-surface-alt)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 10.5, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
