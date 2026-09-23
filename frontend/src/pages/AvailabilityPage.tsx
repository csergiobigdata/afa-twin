import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { api } from "../api/client";
import type {
  Aircraft, AuthorizedConfiguration, AvailabilityBoard, AvailabilityBoardEntry, AvailabilityCode,
  AvailabilityCodeCatalog, AvailabilityLocation, AvailabilityUpdate, AvailabilityUpdateCreate,
  ConfigurationCode, StationEquipmentDisplay, StationKey,
} from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { ROLE_PERMISSIONS } from "../auth/AuthContext";
import AircraftPicker from "../components/AircraftPicker";
import AuthorizedConfigSelect from "../components/AuthorizedConfigSelect";
import AuthorizedConfigSymbol from "../components/AuthorizedConfigSymbol";
import { AvailabilityCodeBadge } from "../components/Badges";
import ConfigurationDiagram from "../components/ConfigurationDiagram";
import SortableTh from "../components/SortableTh";
import SplashScreen from "../components/SplashScreen";
import StatCard from "../components/StatCard";

const LOCATIONS: AvailabilityLocation[] = ["Estação Ventral", "Tanque Subalar", "Asas (Dir/Esq)"];
// Cor de destaque do StatCard de cada código (ver Badges.tsx::AVAILABILITY_
// CODE_TONE) - um código novo cadastrado sem entrada aqui cai no tom neutro
// padrão do StatCard (tone undefined), não quebra.
const CODE_STAT_TONE: Record<string, "ok" | "warn" | "critical" | "info"> = {
  DI: "ok", DO: "warn", IN: "critical", IS: "info",
};
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
  fontSize: 12, fontWeight: 600, color: "var(--text-label)",
  display: "flex", flexDirection: "column", gap: 4,
};

// Aeronave selecionada por padrão ao abrir o módulo, no lançamento manual.
const DEFAULT_MANUAL_AIRCRAFT_TAIL = "FAB 5962";

type AvailTab = "quadro" | "cadastro" | "config-autorizadas";

type QuadroSortKey = "aircraft_tail_number" | "aircraft_model" | "code" | "configuration" | "has_subalares" | "reason" | "report_date";

function quadroSortValue(e: AvailabilityBoardEntry, key: QuadroSortKey): string | number {
  switch (key) {
    case "aircraft_tail_number": return e.aircraft_tail_number;
    case "aircraft_model": return e.aircraft_model;
    case "code": return e.code;
    case "configuration": return e.configuration ?? "LISO";
    case "has_subalares": return e.has_subalares ? 1 : 0;
    case "reason": return e.reason ?? "";
    case "report_date": return e.report_date;
  }
}

export default function AvailabilityPage() {
  const { role } = useAuth();
  const canManage = ROLE_PERMISSIONS.canManageRecords(role);

  const [board, setBoard] = useState<AvailabilityBoard | null>(null);
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AvailTab>("quadro");

  // ---------------- Filtro e ordenação do "Quadro — última atualização" ----------------
  const [quadroAircraftFilter, setQuadroAircraftFilter] = useState("");
  const [quadroCodeFilter, setQuadroCodeFilter] = useState("");
  const [quadroConfigFilter, setQuadroConfigFilter] = useState("");
  const [quadroSubalaresFilter, setQuadroSubalaresFilter] = useState<"" | "sim" | "nao">("");
  const [quadroReasonFilter, setQuadroReasonFilter] = useState("");
  const [quadroSortKey, setQuadroSortKey] = useState<QuadroSortKey>("aircraft_tail_number");
  const [quadroSortDir, setQuadroSortDir] = useState<"asc" | "desc">("asc");
  function toggleQuadroSort(key: QuadroSortKey) {
    if (key === quadroSortKey) setQuadroSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setQuadroSortKey(key); setQuadroSortDir("asc"); }
  }
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

  // Cadastro de Códigos de Disponibilidade (DI/DO/IN/IS de fábrica,
  // extensível - ver Aeronaves → Configurações Autorizadas → Códigos de
  // Disponibilidade) - alimenta os seletores "Código" abaixo e o
  // reconhecimento do texto colado, em vez de uma lista fixa no código.
  const [availabilityCodes, setAvailabilityCodes] = useState<AvailabilityCodeCatalog[]>([]);
  useEffect(() => {
    api.get<AvailabilityCodeCatalog[]>("/availability-codes").then(setAvailabilityCodes).catch(() => setAvailabilityCodes([]));
  }, []);
  const codeValues = useMemo(() => availabilityCodes.map((c) => c.code), [availabilityCodes]);

  function reload() {
    Promise.all([
      api.get<AvailabilityBoard>("/availability-updates/board"),
      api.get<Aircraft[]>("/aircraft"),
    ]).then(([b, f]) => { setBoard(b); setFleet(f); }).finally(() => setLoading(false));
  }
  useEffect(reload, []);

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

  // Sem gerenciar cadastros, só há um grupo de informação (Quadro) - sem
  // sentido mostrar uma barra de aba com um único item.
  const TABS: { key: AvailTab; label: string }[] = canManage
    ? [
        { key: "quadro", label: "Quadro — Última Atualização" },
        { key: "cadastro", label: "Cadastro de Configuração" },
        { key: "config-autorizadas", label: "Configurações Autorizadas" },
      ]
    : [{ key: "quadro", label: "Quadro — Última Atualização" }];

  // Opções dos filtros do Quadro, derivadas dos próprios lançamentos
  // presentes (não do cadastro completo) - só oferece filtrar por um código/
  // configuração que de fato aparece no quadro atual.
  const quadroCodeOptions = Array.from(new Set(board.entries.map((e) => e.code))).sort();
  const quadroConfigOptions = Array.from(new Set(board.entries.map((e) => e.configuration ?? "LISO"))).sort();

  const quadroEntries = [...board.entries]
    .filter((e) => {
      if (quadroAircraftFilter) {
        const q = quadroAircraftFilter.trim().toLowerCase();
        if (!`${e.aircraft_tail_number} ${e.aircraft_model}`.toLowerCase().includes(q)) return false;
      }
      if (quadroCodeFilter && e.code !== quadroCodeFilter) return false;
      if (quadroConfigFilter && (e.configuration ?? "LISO") !== quadroConfigFilter) return false;
      if (quadroSubalaresFilter === "sim" && !e.has_subalares) return false;
      if (quadroSubalaresFilter === "nao" && e.has_subalares) return false;
      if (quadroReasonFilter && !(e.reason ?? "").toLowerCase().includes(quadroReasonFilter.trim().toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const va = quadroSortValue(a, quadroSortKey);
      const vb = quadroSortValue(b, quadroSortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return quadroSortDir === "asc" ? cmp : -cmp;
    });
  const quadroFiltersActive = !!(quadroAircraftFilter || quadroCodeFilter || quadroConfigFilter || quadroSubalaresFilter || quadroReasonFilter);
  function clearQuadroFilters() {
    setQuadroAircraftFilter(""); setQuadroCodeFilter(""); setQuadroConfigFilter("");
    setQuadroSubalaresFilter(""); setQuadroReasonFilter("");
  }

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
        {availabilityCodes.map((c) => (
          <StatCard
            key={c.code} label={c.code} value={board.code_counts[c.code] ?? 0}
            tone={CODE_STAT_TONE[c.code]} sub={c.description}
          />
        ))}
        <StatCard label="Subalares" value={board.subalares_count} tone="info" sub="Cargas subalares (fora ADA)" />
        {board.report_date && <StatCard label="Boletim mais recente" value={formatDate(board.report_date)} />}
      </div>

      {/* Barra de abas + conteúdo unificados num único painel (mesma borda/
          sombra, sem gap entre eles), para ficar claro que compõem uma coisa
          só, não dois blocos soltos. A faixa da barra tem fundo azul claro
          fixo (independente do tema) - destaca a área clicável de navegação
          entre abas frente ao conteúdo escuro logo abaixo; a aba ativa vira
          uma "pastilha" azul-marinho preenchida sobre essa faixa. */}
      <div className="card" style={{ marginBottom: 18, overflow: "hidden" }}>
        {TABS.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: 8, background: "#dfeaf9" }}>
            {TABS.map(({ key, label }) => (
              <button
                key={key} onClick={() => setActiveTab(key)}
                style={{
                  border: "none", cursor: "pointer", borderRadius: 8,
                  padding: "11px 18px", fontSize: 14, fontWeight: 700,
                  background: activeTab === key ? "var(--fab-navy-900)" : "transparent",
                  color: activeTab === key ? "#fff" : "#3d4a63",
                }}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: 18 }}>
          {activeTab === "quadro" && (
            <div>
              <h2 style={{ fontSize: 15.5, margin: "0 0 12px" }}>Quadro — última atualização por aeronave</h2>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
                <label style={{ ...FIELD_LABEL_STYLE, minWidth: 180 }}>
                  Aeronave
                  <input value={quadroAircraftFilter} onChange={(e) => setQuadroAircraftFilter(e.target.value)} placeholder="matrícula ou modelo…" />
                </label>
                <label style={{ ...FIELD_LABEL_STYLE, minWidth: 120 }}>
                  Código
                  <select value={quadroCodeFilter} onChange={(e) => setQuadroCodeFilter(e.target.value)}>
                    <option value="">Todos</option>
                    {quadroCodeOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label style={{ ...FIELD_LABEL_STYLE, minWidth: 180 }}>
                  Configuração
                  <select value={quadroConfigFilter} onChange={(e) => setQuadroConfigFilter(e.target.value)}>
                    <option value="">Todas</option>
                    {quadroConfigOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label style={{ ...FIELD_LABEL_STYLE, minWidth: 120 }}>
                  Subalares
                  <select value={quadroSubalaresFilter} onChange={(e) => setQuadroSubalaresFilter(e.target.value as "" | "sim" | "nao")}>
                    <option value="">Todos</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </label>
                <label style={{ ...FIELD_LABEL_STYLE, minWidth: 180 }}>
                  Motivo
                  <input value={quadroReasonFilter} onChange={(e) => setQuadroReasonFilter(e.target.value)} placeholder="buscar no motivo…" />
                </label>
                {quadroFiltersActive && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={clearQuadroFilters}>Limpar filtros</button>
                )}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 0, marginBottom: 8 }}>
                {quadroEntries.length} de {board.entries.length} aeronave(s).
              </p>

              <div className="scroll-x">
                <table>
                  <thead>
                    <tr>
                      <SortableTh label="Aeronave" sortKey="aircraft_tail_number" active={quadroSortKey === "aircraft_tail_number"} dir={quadroSortDir} onClick={toggleQuadroSort} />
                      <SortableTh label="Modelo" sortKey="aircraft_model" active={quadroSortKey === "aircraft_model"} dir={quadroSortDir} onClick={toggleQuadroSort} />
                      <SortableTh label="Código" sortKey="code" active={quadroSortKey === "code"} dir={quadroSortDir} onClick={toggleQuadroSort} />
                      <SortableTh label="Configuração" sortKey="configuration" active={quadroSortKey === "configuration"} dir={quadroSortDir} onClick={toggleQuadroSort} />
                      <SortableTh label="Subalares" sortKey="has_subalares" active={quadroSortKey === "has_subalares"} dir={quadroSortDir} onClick={toggleQuadroSort} />
                      <SortableTh label="Motivo" sortKey="reason" active={quadroSortKey === "reason"} dir={quadroSortDir} onClick={toggleQuadroSort} />
                      <SortableTh label="Data" sortKey="report_date" active={quadroSortKey === "report_date"} dir={quadroSortDir} onClick={toggleQuadroSort} />
                      {canManage && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {quadroEntries.map((e) => (
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
                    {quadroEntries.length === 0 && (
                      <tr><td colSpan={canManage ? 8 : 7} style={{ color: "var(--text-secondary)" }}>Nenhum lançamento de disponibilidade encontrado.</td></tr>
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
          )}

          {canManage && activeTab === "cadastro" && (
            <div>
              <h2 style={{ fontSize: 15.5, margin: "0 0 4px" }}>Cadastro de Configuração da Aeronave</h2>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 14, maxWidth: 640 }}>
                Duas formas de cadastrar o equipamento de uma aeronave: <strong>Configuração Manual</strong> (um
                equipamento por vez) ou <strong>Configuração Automática</strong> (aplica de uma vez um Código de
                Configuração já cadastrado, substituindo a configuração atual).
              </p>
              <label style={{ ...FIELD_LABEL_STYLE, maxWidth: 260, marginBottom: 18 }}>
                Aeronave
                <AircraftPicker fleet={fleet} selectedId={manualAircraftId} onSelect={setManualAircraftId} />
              </label>

              {/* Dois grupos distintos e visualmente separados (cada um com sua
                  própria borda): Configuração Manual (um equipamento por vez) e
                  Configuração Automática (aplica um Código de Configuração
                  inteiro de uma vez). Nenhum dos dois mostra o diagrama aqui -
                  ele fica sempre visível no final da aba "Configurações
                  Autorizadas", refletindo a configuração ATUAL da aeronave. */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 480px", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 14 }}>
                  <h3 style={{ fontSize: 13.5, margin: "0 0 10px", color: "var(--text-primary)" }}>Configuração Manual</h3>
                  <form onSubmit={submitManual} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <label style={FIELD_LABEL_STYLE}>
                      Código
                      <select value={manualCode} onChange={(e) => setManualCode(e.target.value as AvailabilityCode)} style={{ minWidth: 90 }}>
                        {codeValues.map((c) => <option key={c} value={c}>{c}</option>)}
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

                <div style={{ flex: "1 1 320px", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 14 }}>
                  <h3 style={{ fontSize: 13.5, margin: "0 0 10px", color: "var(--text-primary)" }}>Configuração Automática</h3>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <label style={{ ...FIELD_LABEL_STYLE, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      Código
                      <select
                        value={selectedCodeId} onChange={(e) => setSelectedCodeId(e.target.value ? Number(e.target.value) : "")}
                        style={{ minWidth: 170 }} disabled={!manualAircraftId}
                      >
                        <option value="">Selecione…</option>
                        {configCodes.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
                      </select>
                    </label>
                    <button
                      type="button" className="btn btn-outline btn-sm" disabled={!selectedCode || launchingCode}
                      onClick={cadastrarConfiguracaoAutomatica} title="Substitui a configuração atual da aeronave pela deste código"
                      style={{ color: "#fff" }}
                    >
                      {launchingCode ? "Cadastrando…" : "+ Cadastrar Configuração"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {canManage && activeTab === "config-autorizadas" && (
            <div>
              <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 14 }}>
                <h3 style={{ fontSize: 13.5, margin: "0 0 2px", color: "var(--text-primary)" }}>
                  Configurações Autorizadas:
                  {manualAircraftId && (() => {
                    const a = fleet.find((x) => x.id === Number(manualAircraftId));
                    return a ? (
                      <span className="badge badge-warn" style={{ marginLeft: 8, fontSize: 13 }}>
                        {a.tail_number} · {a.model}
                      </span>
                    ) : null;
                  })()}
                </h3>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 0, marginBottom: 12 }}>
                  Lançamentos de disponibilidade da aeronave selecionada abaixo (ou em "Cadastro de Configuração").
                </p>
                <label style={{ ...FIELD_LABEL_STYLE, maxWidth: 260, marginBottom: 14 }}>
                  Aeronave
                  <AircraftPicker fleet={fleet} selectedId={manualAircraftId} onSelect={setManualAircraftId} />
                </label>
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

              {/* Diagrama da configuração ATUAL da aeronave, reconstruído
                  estação a estação a partir do histórico (ver
                  currentConfigDisplay), refletindo tanto lançamentos manuais
                  quanto automáticos. */}
              {manualAircraftId && (
                <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 14, marginTop: 16, textAlign: "center" }}>
                  <ConfigurationDiagram code={currentConfigDisplay} symbolFor={(eq) => configSymbol(eq)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
