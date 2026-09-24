import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Aircraft, AircraftStatus } from "../api/types";
import AircraftThumbnail from "../components/AircraftThumbnail";
import AircraftPhotoViewer from "../components/AircraftPhotoViewer";
import { HealthBar, RiskBadge, StatusBadge } from "../components/Badges";
import SortableTh from "../components/SortableTh";
import SplashScreen from "../components/SplashScreen";
import { formatHoursHHMM } from "../utils/format";

type ViewMode = "lista" | "grade";
const VIEW_MODE_KEY = "afa_twin_aircraft_view_mode";

type SortKey = "tail_number" | "category" | "squadron" | "status" | "health_index" | "risk_level" | "total_flight_hours";
// Ordem de severidade para ordenar "Risco" de forma útil (não alfabética,
// que misturaria Alto/Baixo/Crítico/Médio fora de ordem de gravidade).
const RISK_ORDER: Record<string, number> = { "Baixo": 0, "Médio": 1, "Alto": 2, "Crítico": 3 };
const RISK_LEVELS = ["Baixo", "Médio", "Alto", "Crítico"];
const STATUSES: AircraftStatus[] = ["Operacional", "Em Manutenção", "Em Inspeção", "Indisponível", "Em Modernização"];
// Opção combinada no seletor de Status - o Painel manda para cá com
// ?status=manutencao-inspecao ao clicar no cartão "Em manutenção/inspeção",
// que soma os dois status (não existe um status único "Em Manutenção/
// Inspeção" no cadastro).
const MAINT_STATUSES: AircraftStatus[] = ["Em Manutenção", "Em Inspeção"];
const MAINT_FILTER_VALUE = "__MAINT__";

function sortValue(a: Aircraft, key: SortKey): string | number {
  switch (key) {
    case "tail_number": return a.tail_number;
    case "category": return a.category;
    case "squadron": return a.squadron ?? "";
    case "status": return a.status;
    case "health_index": return a.health_index ?? -1;
    case "risk_level": return RISK_ORDER[a.risk_level ?? ""] ?? -1;
    case "total_flight_hours": return a.total_flight_hours;
  }
}

export default function AircraftListPage() {
  const [searchParams] = useSearchParams();
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  // Pré-preenchidos a partir da URL (ver Painel → StatCards "Operacionais" e
  // "Em manutenção/inspeção", que navegam para cá já filtrados).
  const [statusFilter, setStatusFilter] = useState(() => {
    const s = searchParams.get("status");
    return s === "manutencao-inspecao" ? MAINT_FILTER_VALUE : (s ?? "");
  });
  const [riskFilter, setRiskFilter] = useState("");
  const [squadronFilter, setSquadronFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tail_number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || "lista";
    } catch {
      return "lista";
    }
  });

  useEffect(() => {
    api.get<Aircraft[]>("/aircraft").then(setFleet).finally(() => setLoading(false));
  }, []);

  function changeView(mode: ViewMode) {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* ignora ambientes sem storage */ }
  }

  const categories = useMemo(() => Array.from(new Set(fleet.map((a) => a.category))), [fleet]);
  const squadrons = useMemo(() => Array.from(new Set(fleet.map((a) => a.squadron).filter((s): s is string => !!s))).sort(), [fleet]);

  const filtered = fleet.filter((a) => {
    const matchQuery = `${a.tail_number} ${a.nickname ?? ""} ${a.model} ${a.manufacturer}`.toLowerCase().includes(query.toLowerCase());
    const matchCategory = !categoryFilter || a.category === categoryFilter;
    const matchStatus = !statusFilter || (statusFilter === MAINT_FILTER_VALUE ? MAINT_STATUSES.includes(a.status) : a.status === statusFilter);
    const matchRisk = !riskFilter || a.risk_level === riskFilter;
    const matchSquadron = !squadronFilter || a.squadron === squadronFilter;
    return matchQuery && matchCategory && matchStatus && matchRisk && matchSquadron;
  });
  const sorted = [...filtered].sort((x, y) => {
    const vx = sortValue(x, sortKey);
    const vy = sortValue(y, sortKey);
    const cmp = typeof vx === "number" && typeof vy === "number" ? vx - vy : String(vx).localeCompare(String(vy), "pt-BR");
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>Cadastro de Aeronaves</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Frota cadastrada, configuração mecânica e status de manutenção.</p>
        </div>
        <Link to="/aeronaves/novo" className="btn btn-primary">+ Nova Aeronave</Link>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" placeholder="Buscar por matrícula, apelido ou modelo…" value={query}
               onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 320 }} />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={squadronFilter} onChange={(e) => setSquadronFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todos os esquadrões/bases</option>
          {squadrons.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todos os status</option>
          <option value={MAINT_FILTER_VALUE}>Em Manutenção/Inspeção (ambos)</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Todos os riscos</option>
          {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {(categoryFilter || statusFilter || riskFilter || squadronFilter || query) && (
          <button
            type="button" className="btn btn-outline btn-sm"
            onClick={() => { setQuery(""); setCategoryFilter(""); setStatusFilter(""); setRiskFilter(""); setSquadronFilter(""); }}
          >
            Limpar filtros
          </button>
        )}
        <div style={{ flex: 1 }} />
        <div className="card" style={{ display: "flex", padding: 3, gap: 2 }}>
          <button type="button" className={`btn btn-sm ${viewMode === "lista" ? "btn-primary" : "btn-outline"}`}
                  style={{ borderColor: "transparent" }} onClick={() => changeView("lista")}>☰ Lista</button>
          <button type="button" className={`btn btn-sm ${viewMode === "grade" ? "btn-primary" : "btn-outline"}`}
                  style={{ borderColor: "transparent" }} onClick={() => changeView("grade")}>▦ Grade</button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 0, marginBottom: 14 }}>
        {filtered.length} de {fleet.length} aeronave(s).
      </p>

      {loading ? <SplashScreen fullscreen={false} message="Carregando frota" /> : filtered.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>Nenhuma aeronave encontrada.</p>
      ) : viewMode === "lista" ? (
        <div className="card scroll-x">
          <table>
            <thead>
              <tr>
                <th></th>
                <SortableTh label="Aeronave" sortKey="tail_number" active={sortKey === "tail_number"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Categoria" sortKey="category" active={sortKey === "category"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Esquadrão / Base" sortKey="squadron" active={sortKey === "squadron"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Status" sortKey="status" active={sortKey === "status"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Saúde" sortKey="health_index" active={sortKey === "health_index"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Risco" sortKey="risk_level" active={sortKey === "risk_level"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Horas" sortKey="total_flight_hours" active={sortKey === "total_flight_hours"} dir={sortDir} onClick={toggleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.id}>
                  <td><AircraftThumbnail aircraft={a} width={64} height={40} rounded={6} /></td>
                  <td>
                    <Link to={`/aeronaves/${a.id}`} style={{ fontWeight: 700, textDecoration: "none" }}>{a.tail_number}</Link>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{a.nickname ? `"${a.nickname}" · ` : ""}{a.manufacturer} {a.model}</div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{a.category}</td>
                  <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{a.squadron}<br />{a.base}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td style={{ minWidth: 150 }}><HealthBar value={a.health_index} /></td>
                  <td><RiskBadge level={a.risk_level} /></td>
                  <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{formatHoursHHMM(a.total_flight_hours)} h</td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <AircraftPhotoViewer aircraft={a} />
                    <Link to={`/aeronaves/${a.id}`} className="btn btn-outline btn-sm">Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map((a) => (
            <div key={a.id} className="card" style={{ padding: 18 }}>
              <Link to={`/aeronaves/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{a.tail_number}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{a.nickname}</div>
                  </div>
                  <AircraftThumbnail aircraft={a} width={100} height={62} />
                </div>
                <div style={{ fontSize: 13.5, marginTop: 8 }}>{a.manufacturer} · {a.model}</div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>{a.category} · {a.squadron}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <StatusBadge status={a.status} />
                  <RiskBadge level={a.risk_level} />
                </div>
                <div style={{ marginTop: 12 }}><HealthBar value={a.health_index} /></div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                  {formatHoursHHMM(a.total_flight_hours)} h de voo acumuladas
                </div>
              </Link>
              <div style={{ marginTop: 12 }}>
                <AircraftPhotoViewer aircraft={a} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
