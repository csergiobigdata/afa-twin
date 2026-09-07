import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { api } from "../api/client";
import type {
  Aircraft, AuthorizedConfiguration, AvailabilityBoard, AvailabilityCode, AvailabilityLocation,
  AvailabilityUpdate, AvailabilityUpdateCreate, ConfigurationCode, StationEquipmentDisplay, StationKey,
} from "../api/types";
import { useLookupValues } from "../api/useLookup";
import { useAuth } from "../auth/AuthContext";
import { ROLE_PERMISSIONS } from "../auth/AuthContext";
import AuthorizedConfigSelect from "../components/AuthorizedConfigSelect";
import AuthorizedConfigSymbol from "../components/AuthorizedConfigSymbol";
import { AvailabilityCodeBadge } from "../components/Badges";
import ConfigurationDiagram from "../components/ConfigurationDiagram";
import SplashScreen from "../components/SplashScreen";
import StatCard from "../components/StatCard";
import { parseAvailabilityBoardText, type ParsedAvailabilityRow } from "./availabilityParser";

const CODES: AvailabilityCode[] = ["DI", "DO", "IN"];
const LOCATIONS: AvailabilityLocation[] = ["Estação Ventral", "Tanque Subalar", "Asas (Dir/Esq)"];
const CONFIG_CATEGORY = "Configuração de Disponibilidade (asas/hardpoints)" as const;
// Estações centrais (3) mapeiam para "Estação Ventral"; as demais (5/4/2/1,
// todas nas asas) mapeiam para "Asas (Dir/Esq)" - usado ao cadastrar um
// Código de Configuração inteiro de uma vez (ver cadastrarConfiguracaoAutomatica)
// e para pré-preencher "Local" ao escolher uma "Estação" na Configuração Manual.
const STATION_KEYS: StationKey[] = ["station_5", "station_4", "station_3", "station_2", "station_1"];
const STATION_LABELS: Record<StationKey, string> = {
  station_5: "Estação 5", station_4: "Estação 4", station_3: "Estação 3",
  station_2: "Estação 2", station_1: "Estação 1",
};
const STATION_TO_LOCATION: Record<StationKey, AvailabilityLocation> = {
  station_5: "Asas (Dir/Esq)", station_4: "Asas (Dir/Esq)", station_3: "Estação Ventral",
  station_2: "Asas (Dir/Esq)", station_1: "Asas (Dir/Esq)",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Estilo comum de título de campo digitado/selecionado nos formulários desta
// página (Aeronave, Código, Configuração, Local, Motivo/Observação etc.) -
// mesmo peso/cor/tamanho em todos, para os rótulos ficarem alinhados
// visualmente entre si, em vez de cada campo com uma aparência diferente.
const FIELD_LABEL_STYLE: CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
  display: "flex", flexDirection: "column", gap: 4,
};

// Aeronave selecionada por padrão ao abrir o módulo, no lançamento manual.
const DEFAULT_MANUAL_AIRCRAFT_TAIL = "FAB 5962";

export default function AvailabilityPage() {
  const { role } = useAuth();
  const canManage = ROLE_PERMISSIONS.canManageRecords(role);
  const configOptions = useLookupValues(CONFIG_CATEGORY);

  const [board, setBoard] = useState<AvailabilityBoard | null>(null);
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  // Configurações Autorizadas (cadastro completo) - as ativas (status_disp =
  // "A") populam o seletor de "Configuração" do lançamento manual; o
  // conjunto completo serve para achar o símbolo de um lançamento antigo
  // mesmo que o equipamento tenha sido inativado depois (ver Aeronaves →
  // Configurações Autorizadas).
  const [allConfigs, setAllConfigs] = useState<AuthorizedConfiguration[]>([]);
  useEffect(() => {
    api.get<AuthorizedConfiguration[]>("/authorized-configurations")
      .then(setAllConfigs).catch(() => setAllConfigs([]));
  }, []);
  const activeConfigs = useMemo(() => allConfigs.filter((c) => c.status_disp === "A"), [allConfigs]);
  function configSymbol(equipment: string | null | undefined): string | undefined {
    return equipment ? allConfigs.find((c) => c.equipment === equipment)?.symbol_svg : undefined;
  }

  // Catálogo de Códigos de Configuração (combinação padronizada de
  // equipamento por estação, ex.: "12", "21I") - ver Aeronaves →
  // Configurações Autorizadas → Códigos de Configuração.
  const [configCodes, setConfigCodes] = useState<ConfigurationCode[]>([]);
  useEffect(() => {
    // Só os códigos "A" (Ativo) - com marcação de bolinha vermelha no
    // boletim vigente e detalhamento por estação conferido - aparecem como
    // opção para lançar aqui (ver Aeronaves → Configurações Autorizadas →
    // Códigos de Configuração para consultar TODOS os códigos, inclusive
    // os "I" cadastrados só para referência).
    api.get<ConfigurationCode[]>("/configuration-codes?status_disp=A").then(setConfigCodes).catch(() => setConfigCodes([]));
  }, []);
  const [selectedCodeId, setSelectedCodeId] = useState<number | "">("");
  const selectedCode = configCodes.find((c) => c.id === selectedCodeId) ?? null;
  const [launchingCode, setLaunchingCode] = useState(false);

  function reload() {
    Promise.all([
      api.get<AvailabilityBoard>("/availability-updates/board"),
      api.get<Aircraft[]>("/aircraft"),
    ]).then(([b, f]) => { setBoard(b); setFleet(f); }).finally(() => setLoading(false));
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

  // ---------------- Cadastro de Configuração da Aeronave (Manual + Automática) ----------------
  const [manualAircraftId, setManualAircraftId] = useState("");
  const [manualCode, setManualCode] = useState<AvailabilityCode>("DI");
  const [manualConfig, setManualConfig] = useState("");
  const [manualLocation, setManualLocation] = useState<AvailabilityLocation | "">("");
  const [manualStation, setManualStation] = useState<StationKey | "">("");
  const [manualReason, setManualReason] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  // Ao escolher uma Estação na Configuração Manual, pré-preenche "Local" a
  // partir dela (STATION_TO_LOCATION) - o usuário ainda pode trocar Local
  // manualmente depois (ex.: um item de Tanque Subalar que não é de uma
  // estação específica).
  function handleManualStationChange(value: StationKey | "") {
    setManualStation(value);
    if (value) setManualLocation(STATION_TO_LOCATION[value]);
  }

  // Valor padrão ao abrir o módulo: pré-seleciona a FAB 5962 assim que a
  // frota carrega, sem sobrescrever uma escolha manual do usuário depois.
  useEffect(() => {
    if (manualAircraftId || fleet.length === 0) return;
    const def = fleet.find((a) => a.tail_number === DEFAULT_MANUAL_AIRCRAFT_TAIL);
    if (def) setManualAircraftId(String(def.id));
  }, [fleet, manualAircraftId]);

  // Configurações atualmente lançadas para a aeronave selecionada no
  // lançamento manual (em vez de um histórico recente genérico de toda a
  // frota) - refeita a cada troca de aeronave e a cada `reload()` (que troca
  // a identidade de `board`), para refletir imediatamente um lançamento ou
  // remoção.
  const [selectedHistory, setSelectedHistory] = useState<AvailabilityUpdate[]>([]);
  const [selectedHistoryLoading, setSelectedHistoryLoading] = useState(false);
  useEffect(() => {
    if (!manualAircraftId) {
      setSelectedHistory([]);
      return;
    }
    setSelectedHistoryLoading(true);
    api.get<AvailabilityUpdate[]>(`/availability-updates?aircraft_id=${manualAircraftId}&limit=50`)
      .then(setSelectedHistory)
      .finally(() => setSelectedHistoryLoading(false));
  }, [manualAircraftId, board]);

  // Configuração ATUAL da aeronave selecionada, reconstruída estação a
  // estação a partir do histórico (o mais recente lançamento com essa
  // estação preenchida vence, já que `selectedHistory` vem ordenado do mais
  // novo para o mais antigo) - mostrada no mesmo diagrama usado para
  // consultar um Código de Configuração do catálogo, tanto para
  // lançamentos feitos na Configuração Manual quanto na Automática.
  const currentConfigDisplay = useMemo<StationEquipmentDisplay | null>(() => {
    if (!manualAircraftId) return null;
    const bySlot: Partial<Record<StationKey, string>> = {};
    for (const u of selectedHistory) {
      if (u.station && u.configuration && !(u.station in bySlot)) {
        bySlot[u.station] = u.configuration;
      }
    }
    return { code: "Atual", ...bySlot };
  }, [manualAircraftId, selectedHistory]);

  async function submitManual(e: FormEvent) {
    e.preventDefault();
    if (!manualAircraftId) return;
    setManualSaving(true);
    try {
      // A data não é mais escolhida pelo usuário neste formulário (sempre
      // "hoje") - o registro em si já guarda `created_at` automaticamente
      // (data/hora reais do lançamento, para auditoria/relatórios/logs).
      await api.post<AvailabilityUpdate>("/availability-updates", {
        aircraft_id: Number(manualAircraftId), report_date: todayIso(), code: manualCode,
        configuration: manualConfig || null, has_subalares: false, reason: manualReason || null,
        location: manualLocation || null, station: manualStation || null,
      });
      setManualReason(""); setManualConfig(""); setManualLocation(""); setManualStation("");
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

  // "Configuração Automática": aplica de uma vez um Código de Configuração
  // já cadastrado, SUBSTITUINDO a configuração atual da aeronave (não soma
  // às entradas anteriores) - primeiro remove todo lançamento com
  // equipamento (`configuration`) já existente para a aeronave selecionada,
  // depois cadastra um lançamento por estação preenchida do código
  // escolhido (ex.: "12" cadastra 3: estações 4, 3 e 2). Para lançar
  // equipamento por equipamento em vez de um código inteiro, ver
  // "Configuração Manual" ao lado.
  async function cadastrarConfiguracaoAutomatica() {
    if (!manualAircraftId || !selectedCode) return;
    setLaunchingCode(true);
    try {
      const toRemove = selectedHistory.filter((u) => u.configuration);
      if (toRemove.length > 0) {
        await Promise.all(toRemove.map((u) => api.del(`/availability-updates/${u.id}`)));
      }
      const payload: AvailabilityUpdateCreate[] = STATION_KEYS
        .filter((s) => selectedCode[s])
        .map((s) => ({
          aircraft_id: Number(manualAircraftId), report_date: todayIso(), code: manualCode,
          configuration: selectedCode[s] as string, has_subalares: false,
          reason: `Código de configuração ${selectedCode.code}`, location: STATION_TO_LOCATION[s], station: s,
        }));
      if (payload.length > 0) {
        await api.post("/availability-updates/bulk", payload);
      }
      setSelectedCodeId("");
      reload();
    } finally {
      setLaunchingCode(false);
    }
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
            <label style={{ ...FIELD_LABEL_STYLE, flexDirection: "row", alignItems: "center" }}>
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
        <>
        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <h2 style={{ fontSize: 15.5, margin: "0 0 4px" }}>Cadastro de Configuração da Aeronave</h2>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 14, maxWidth: 640 }}>
            Duas formas de cadastrar o equipamento de uma aeronave: <strong>Configuração Manual</strong> (um
            equipamento por vez) ou <strong>Configuração Automática</strong> (aplica de uma vez um Código de
            Configuração já cadastrado, substituindo a configuração atual).
          </p>
          <label style={{ ...FIELD_LABEL_STYLE, maxWidth: 260, marginBottom: 18 }}>
            Aeronave
            <select value={manualAircraftId} onChange={(e) => setManualAircraftId(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Selecione…</option>
              {fleet.map((a) => <option key={a.id} value={a.id}>{a.tail_number} · {a.model}</option>)}
            </select>
          </label>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 420px" }}>
              <h3 style={{ fontSize: 13.5, margin: "0 0 10px", color: "var(--text-primary)" }}>Configuração Manual</h3>
              <form onSubmit={submitManual} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={FIELD_LABEL_STYLE}>
                  Código
                  <select value={manualCode} onChange={(e) => setManualCode(e.target.value as AvailabilityCode)} style={{ minWidth: 90 }}>
                    {CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label style={FIELD_LABEL_STYLE}>
                  Configuração
                  <AuthorizedConfigSelect options={activeConfigs} value={manualConfig} onChange={setManualConfig} />
                </label>
                <label style={FIELD_LABEL_STYLE}>
                  Estação
                  <select
                    value={manualStation} onChange={(e) => handleManualStationChange(e.target.value as StationKey | "")}
                    style={{ minWidth: 130 }} title="Estação do diagrama (5 a 1) - opcional"
                  >
                    <option value="">— Nenhuma —</option>
                    {STATION_KEYS.map((s) => <option key={s} value={s}>{STATION_LABELS[s]}</option>)}
                  </select>
                </label>
                <label style={FIELD_LABEL_STYLE}>
                  Local
                  <select value={manualLocation} onChange={(e) => setManualLocation(e.target.value as AvailabilityLocation | "")} style={{ minWidth: 160 }}>
                    <option value="">— Selecione —</option>
                    {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <label style={{ ...FIELD_LABEL_STYLE, flex: "1 1 200px" }}>
                  Motivo / Observação
                  <input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="ex.: TREM DE POUSO" />
                </label>
                <button type="submit" className="btn btn-primary btn-sm" disabled={manualSaving || !manualAircraftId}>
                  {manualSaving ? "Salvando…" : "+ Adicionar"}
                </button>
              </form>
            </div>

            {/* Painel da Configuração Automática - sempre visível assim que
                uma aeronave é selecionada (não só ao escolher um código),
                com a silhueta da aeronave e a faixa de estações (5 a 1) do
                Código de Configuração escolhido logo abaixo (ver
                ConfigurationDiagram e docs/03-modelo-de-dados.md). */}
            {manualAircraftId && (
              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                <h3 style={{ fontSize: 13.5, margin: "0 0 2px", color: "var(--text-primary)" }}>Configuração Automática</h3>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <label style={FIELD_LABEL_STYLE}>
                    Configuração
                    <select
                      value={selectedCodeId} onChange={(e) => setSelectedCodeId(e.target.value ? Number(e.target.value) : "")}
                      style={{ minWidth: 170 }}
                    >
                      <option value="">Selecione…</option>
                      {configCodes.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
                    </select>
                  </label>
                  <button
                    type="button" className="btn btn-outline btn-sm" disabled={!selectedCode || launchingCode}
                    onClick={cadastrarConfiguracaoAutomatica} title="Substitui a configuração atual da aeronave pela deste código"
                  >
                    {launchingCode ? "Cadastrando…" : "Cadastrar Configuração"}
                  </button>
                </div>
                <div style={{ alignSelf: "center" }}>
                  {/* Sem um código em preview (Automática), mostra a configuração
                      ATUAL da aeronave (currentConfigDisplay) - lançada manual ou
                      automaticamente - para o usuário sempre poder visualizá-la,
                      não só ao escolher um código novo para aplicar. */}
                  <ConfigurationDiagram code={selectedCode ?? currentConfigDisplay} symbolFor={(eq) => configSymbol(eq)} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 18, marginBottom: 18 }}>
          <h2 style={{ fontSize: 15.5, margin: "0 0 2px" }}>
            Configurações Autorizadas para a Aeronave
            {manualAircraftId && (() => {
              const a = fleet.find((x) => x.id === Number(manualAircraftId));
              return a ? (
                <span className="badge badge-warn" style={{ marginLeft: 8, fontSize: 13 }}>
                  {a.tail_number} · {a.model}
                </span>
              ) : null;
            })()}
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 0, marginBottom: 12 }}>
            Lançamentos de disponibilidade da aeronave selecionada em "Cadastro de Configuração da Aeronave" acima.
          </p>
          {!manualAircraftId ? (
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Selecione uma aeronave acima para ver suas configurações lançadas.
            </p>
          ) : selectedHistoryLoading ? (
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Carregando…</p>
          ) : (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr><th></th><th>Código</th><th>Configuração</th><th>Estação</th><th>Local</th><th>Motivo/Obs</th><th></th></tr>
                </thead>
                <tbody>
                  {selectedHistory.map((u) => (
                    <tr key={u.id}>
                      <td>
                        {configSymbol(u.configuration) && <AuthorizedConfigSymbol svg={configSymbol(u.configuration)!} size={20} />}
                      </td>
                      <td><AvailabilityCodeBadge code={u.code} /></td>
                      <td style={{ fontSize: 12.5 }}>{u.configuration ?? "LISO"}</td>
                      <td style={{ fontSize: 12.5 }}>{u.station ? STATION_LABELS[u.station] : "—"}</td>
                      <td style={{ fontSize: 12.5 }}>{u.location ?? "—"}</td>
                      <td style={{ fontSize: 12.5 }}>{u.reason ?? "—"}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => removeUpdate(u.id)}>Remover</button>
                      </td>
                    </tr>
                  ))}
                  {selectedHistory.length === 0 && (
                    <tr><td colSpan={7} style={{ color: "var(--text-secondary)" }}>Nenhuma configuração lançada para esta aeronave ainda.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
