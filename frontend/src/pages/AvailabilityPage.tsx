import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type {
  Aircraft, AvailabilityBoard, AvailabilityCode, AvailabilityUpdate, AvailabilityUpdateCreate,
} from "../api/types";
import { useLookupValues } from "../api/useLookup";
import { useAuth } from "../auth/AuthContext";
import { ROLE_PERMISSIONS } from "../auth/AuthContext";
import { AvailabilityCodeBadge } from "../components/Badges";
import SplashScreen from "../components/SplashScreen";
import StatCard from "../components/StatCard";
import { parseAvailabilityBoardText, type ParsedAvailabilityRow } from "./availabilityParser";

const CODES: AvailabilityCode[] = ["DI", "DO", "IN"];
const CONFIG_CATEGORY = "Configuração de Disponibilidade (asas/hardpoints)" as const;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function AvailabilityPage() {
  const { role } = useAuth();
  const canManage = ROLE_PERMISSIONS.canManageRecords(role);
  const configOptions = useLookupValues(CONFIG_CATEGORY);

  const [board, setBoard] = useState<AvailabilityBoard | null>(null);
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [recent, setRecent] = useState<AvailabilityUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  function reload() {
    Promise.all([
      api.get<AvailabilityBoard>("/availability-updates/board"),
      api.get<Aircraft[]>("/aircraft"),
      api.get<AvailabilityUpdate[]>("/availability-updates?limit=20"),
    ]).then(([b, f, r]) => { setBoard(b); setFleet(f); setRecent(r); }).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  // ---------------- Colar boletim do esquadrão ----------------
  const [pasteText, setPasteText] = useState("");
  const [pasteDate, setPasteDate] = useState(todayIso());
  const [parsedRows, setParsedRows] = useState<ParsedAvailabilityRow[] | null>(null);
  const [includedKeys, setIncludedKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  function analyze() {
    const rows = parseAvailabilityBoardText(pasteText, fleet);
    setParsedRows(rows);
    setIncludedKeys(new Set(rows.filter((r) => !r.unrecognized && r.aircraft && r.code).map((r) => r.key)));
    setSaveResult(null);
  }

  function patchRow(key: string, patch: Partial<ParsedAvailabilityRow>) {
    setParsedRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  }

  function toggleIncluded(key: string) {
    setIncludedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const readyToSaveCount = useMemo(
    () => (parsedRows ?? []).filter((r) => includedKeys.has(r.key) && r.aircraft && r.code).length,
    [parsedRows, includedKeys],
  );

  async function saveBoard() {
    if (!parsedRows) return;
    const toSave = parsedRows.filter((r) => includedKeys.has(r.key) && r.aircraft && r.code);
    if (toSave.length === 0) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const payload: AvailabilityUpdateCreate[] = toSave.map((r) => ({
        aircraft_id: r.aircraft!.id, report_date: pasteDate, code: r.code!,
        configuration: r.configuration, has_subalares: r.hasSubalares, reason: r.reason,
      }));
      await api.post("/availability-updates/bulk", payload);
      setSaveResult(`${toSave.length} lançamento(s) salvo(s) para ${formatDate(pasteDate)}.`);
      setParsedRows(null);
      setPasteText("");
      reload();
    } catch (err) {
      setSaveResult(err instanceof Error ? err.message : "Erro ao salvar boletim.");
    } finally {
      setSaving(false);
    }
  }

  // ---------------- Lançamento manual (uma aeronave por vez) ----------------
  const [manualAircraftId, setManualAircraftId] = useState("");
  const [manualCode, setManualCode] = useState<AvailabilityCode>("DI");
  const [manualConfig, setManualConfig] = useState("");
  const [manualSubalares, setManualSubalares] = useState(false);
  const [manualReason, setManualReason] = useState("");
  const [manualDate, setManualDate] = useState(todayIso());
  const [manualSaving, setManualSaving] = useState(false);

  async function submitManual(e: FormEvent) {
    e.preventDefault();
    if (!manualAircraftId) return;
    setManualSaving(true);
    try {
      await api.post<AvailabilityUpdate>("/availability-updates", {
        aircraft_id: Number(manualAircraftId), report_date: manualDate, code: manualCode,
        configuration: manualConfig || null, has_subalares: manualSubalares, reason: manualReason || null,
      });
      setManualReason(""); setManualSubalares(false); setManualConfig("");
      reload();
    } finally {
      setManualSaving(false);
    }
  }

  async function removeUpdate(id: number) {
    if (!confirm("Remover este lançamento de disponibilidade?")) return;
    await api.del(`/availability-updates/${id}`);
    reload();
  }

  if (loading) return <SplashScreen fullscreen={false} />;
  if (!board) return <p>Não foi possível carregar a disponibilidade.</p>;

  // Mostra todas as tags conhecidas (cadastro auxiliar) mesmo com contagem
  // zero, igual ao boletim original (ex.: "VENTRAL: 0") - mais as que
  // aparecerem no quadro mas não estiverem (ainda) no cadastro auxiliar.
  const configTagOrder = Array.from(new Set([...configOptions, ...Object.keys(board.configuration_counts)]));
  const configEntries = configTagOrder.map((tag) => [tag, board.configuration_counts[tag] ?? 0] as const);

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, marginBottom: 2 }}>Atualização de Disponibilidade</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Boletim de linha de voo do esquadrão (código por aeronave + configuração de asas/hardpoints),
          no mesmo formato usado pela unidade — complementar ao status de cadastro de cada aeronave.
        </p>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <StatCard label="DI" value={board.di_count} tone="ok" sub="Disponível" />
        <StatCard label="DO" value={board.do_count} tone="warn" sub="Indisponível (causa operacional)" />
        <StatCard label="IN" value={board.in_count} tone="critical" sub="Indisponível" />
        <StatCard label="Subalares" value={board.subalares_count} tone="info" sub="Cargas subalares (fora ADA)" />
        {board.report_date && <StatCard label="Boletim mais recente" value={formatDate(board.report_date)} />}
      </div>

      {board.di_count + board.do_count > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Configuração DI/DO (asas/hardpoints)</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {configEntries.map(([tag, count]) => (
              <span key={tag} className="badge badge-neutral" style={{ fontSize: 13 }}>{tag}: {count}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ fontSize: 15.5, margin: 0 }}>Quadro — última atualização por aeronave</h2>
        </div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr><th>Aeronave</th><th>Modelo</th><th>Código</th><th>Configuração</th><th>Subalares</th><th>Motivo</th><th>Data</th>{canManage && <th></th>}</tr>
            </thead>
            <tbody>
              {board.entries.map((e) => (
                <tr key={e.availability_update_id}>
                  <td style={{ fontWeight: 700 }}>{e.aircraft_tail_number}</td>
                  <td style={{ fontSize: 12.5 }}>{e.aircraft_model}</td>
                  <td><AvailabilityCodeBadge code={e.code} /></td>
                  <td style={{ fontSize: 12.5 }}>{e.configuration ?? "LISO"}</td>
                  <td style={{ fontSize: 12.5 }}>{e.has_subalares ? "Sim" : "—"}</td>
                  <td style={{ fontSize: 12.5 }}>{e.reason ?? "—"}</td>
                  <td style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{formatDate(e.report_date)}</td>
                  {canManage && (
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => removeUpdate(e.availability_update_id)}>Remover</button>
                    </td>
                  )}
                </tr>
              ))}
              {board.entries.length === 0 && (
                <tr><td colSpan={canManage ? 8 : 7} style={{ color: "var(--text-secondary)" }}>Nenhum lançamento de disponibilidade ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {board.aircraft_without_update.length > 0 && (
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 12 }}>
            Sem nenhum lançamento ainda: {board.aircraft_without_update.join(", ")}.
          </p>
        )}
      </div>

      {canManage && (
        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <h2 style={{ fontSize: 15.5, margin: "0 0 4px" }}>Colar boletim do dia</h2>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 12 }}>
            Cole o texto do boletim no formato "5906 - DO (EEXD TREM DE POUSO)", uma aeronave por linha.
            O reconhecimento é uma heurística revisável — confira e ajuste cada linha antes de salvar.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
              Data do boletim:
              <input type="date" value={pasteDate} onChange={(e) => setPasteDate(e.target.value)} style={{ maxWidth: 170 }} />
            </label>
          </div>
          <textarea
            value={pasteText} onChange={(e) => setPasteText(e.target.value)}
            placeholder={"5906 - DO (EEXD TREM DE POUSO)\n5914 - DI\n5919 - DI (SUBALARES)\n..."}
            style={{ width: "100%", minHeight: 140, fontFamily: "monospace", fontSize: 12.5 }}
          />
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={analyze} disabled={!pasteText.trim()}>Analisar</button>
          </div>

          {parsedRows && (
            <div style={{ marginTop: 16 }}>
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <th>Incluir</th><th>Linha original</th><th>Aeronave</th><th>Código</th>
                      <th>Configuração</th><th>Subalares</th><th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r) => (
                      <tr key={r.key} style={{ opacity: r.aircraft && r.code ? 1 : 0.7 }}>
                        <td>
                          <input
                            type="checkbox" checked={includedKeys.has(r.key)}
                            disabled={!r.aircraft || !r.code}
                            onChange={() => toggleIncluded(r.key)}
                          />
                        </td>
                        <td style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--text-secondary)", maxWidth: 220 }}>{r.raw}</td>
                        <td>
                          <select
                            value={r.aircraft?.id ?? ""}
                            onChange={(e) => patchRow(r.key, { aircraft: fleet.find((a) => a.id === Number(e.target.value)) ?? null })}
                            style={{ minWidth: 160 }}
                          >
                            <option value="">— não encontrada —</option>
                            {fleet.map((a) => <option key={a.id} value={a.id}>{a.tail_number} · {a.model}</option>)}
                          </select>
                        </td>
                        <td>
                          <select value={r.code ?? ""} onChange={(e) => patchRow(r.key, { code: (e.target.value || null) as AvailabilityCode | null })} style={{ minWidth: 80 }}>
                            <option value="">—</option>
                            {CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            list="availability-config-options" value={r.configuration ?? ""}
                            onChange={(e) => patchRow(r.key, { configuration: e.target.value || null })}
                            style={{ maxWidth: 110 }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input type="checkbox" checked={r.hasSubalares} onChange={(e) => patchRow(r.key, { hasSubalares: e.target.checked })} />
                        </td>
                        <td>
                          <input
                            value={r.reason ?? ""} onChange={(e) => patchRow(r.key, { reason: e.target.value || null })}
                            style={{ minWidth: 160 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="availability-config-options">
                  {configOptions.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <button className="btn btn-primary" onClick={saveBoard} disabled={saving || readyToSaveCount === 0}>
                  {saving ? "Salvando…" : `Salvar ${readyToSaveCount} lançamento(s)`}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setParsedRows(null)}>Descartar</button>
                {saveResult && <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{saveResult}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {canManage && (
        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <h2 style={{ fontSize: 15.5, margin: "0 0 12px" }}>Lançamento manual (uma aeronave)</h2>
          <form onSubmit={submitManual} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              Aeronave
              <select value={manualAircraftId} onChange={(e) => setManualAircraftId(e.target.value)} required style={{ minWidth: 180 }}>
                <option value="">Selecione…</option>
                {fleet.map((a) => <option key={a.id} value={a.id}>{a.tail_number} · {a.model}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              Código
              <select value={manualCode} onChange={(e) => setManualCode(e.target.value as AvailabilityCode)} style={{ minWidth: 90 }}>
                {CODES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              Configuração
              <input list="availability-config-options-manual" value={manualConfig} onChange={(e) => setManualConfig(e.target.value)} style={{ maxWidth: 130 }} />
              <datalist id="availability-config-options-manual">
                {configOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </label>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, paddingBottom: 8 }}>
              <input type="checkbox" checked={manualSubalares} onChange={(e) => setManualSubalares(e.target.checked)} /> Subalares
            </label>
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4, flex: "1 1 200px" }}>
              Motivo / observação
              <input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="ex.: TREM DE POUSO" />
            </label>
            <label style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              Data
              <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} style={{ maxWidth: 150 }} />
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={manualSaving || !manualAircraftId}>
              {manualSaving ? "Salvando…" : "+ Lançar"}
            </button>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ fontSize: 15.5, margin: "0 0 12px" }}>Histórico recente</h2>
        <div className="scroll-x">
          <table>
            <thead><tr><th>Aeronave</th><th>Código</th><th>Configuração</th><th>Subalares</th><th>Motivo</th><th>Data</th><th>Registrado por</th></tr></thead>
            <tbody>
              {recent.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.aircraft_tail_number}</td>
                  <td><AvailabilityCodeBadge code={u.code} /></td>
                  <td style={{ fontSize: 12.5 }}>{u.configuration ?? "LISO"}</td>
                  <td style={{ fontSize: 12.5 }}>{u.has_subalares ? "Sim" : "—"}</td>
                  <td style={{ fontSize: 12.5 }}>{u.reason ?? "—"}</td>
                  <td style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{formatDate(u.report_date)}</td>
                  <td style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{u.recorded_by_name ?? "—"}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={7} style={{ color: "var(--text-secondary)" }}>Nenhum lançamento registrado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
