import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { DiagnosticResult } from "../api/types";

const EXAMPLES = [
  "A luz FUEL PRESS permanece acesa em voo de cruzeiro",
  "Vibração anômala do motor durante o táxi",
  "Alerta de pressão hidráulica intermitente",
];

export default function DiagnosticsPage() {
  const [symptom, setSymptom] = useState("");
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (symptom.trim().length < 4) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<DiagnosticResult>("/diagnostics/search", { symptom });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao consultar o diagnóstico.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Diagnóstico Inteligente</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20, maxWidth: 720 }}>
        Descreva o sintoma observado (ex.: uma luz de alerta acesa, um ruído, uma vibração) e o sistema
        busca ocorrências semelhantes já resolvidas no histórico de manutenção de toda a frota,
        indicando a ação mais comum utilizada para solucioná-las.
      </p>

      <form onSubmit={submit} className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div className="field">
          <label>Sintoma observado</label>
          <textarea required minLength={4} value={symptom} onChange={(e) => setSymptom(e.target.value)}
                    placeholder='Ex.: "A luz FUEL PRESS permanece acesa"' rows={3} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, marginBottom: 14 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="btn btn-outline btn-sm" onClick={() => setSymptom(ex)}>{ex}</button>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? "Pesquisando…" : "Pesquisar ocorrências semelhantes"}</button>
        {error && <div className="badge badge-critical" style={{ display: "block", padding: "8px 12px", marginTop: 12 }}>{error}</div>}
      </form>

      {result && (
        <div className="card" style={{ padding: 18 }}>
          <div style={{
            background: "var(--bg-surface-alt)", borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15,
            borderLeft: "4px solid var(--fab-blue-500)",
          }}>
            {result.summary_text}
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 10 }}>{result.method_note}</p>

          {result.matches.length > 0 && (
            <div className="scroll-x" style={{ marginTop: 16 }}>
              <table>
                <thead><tr><th>Similaridade</th><th>OS</th><th>Aeronave</th><th>Título</th><th>Ação tomada</th></tr></thead>
                <tbody>
                  {result.matches.map((m) => (
                    <tr key={m.order_number}>
                      <td><span className="badge badge-info">{m.similarity_pct}%</span></td>
                      <td>{m.order_number}</td>
                      <td>{m.aircraft_tail_number}</td>
                      <td>{m.title}</td>
                      <td style={{ fontSize: 12.5 }}>{m.actions_taken ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
