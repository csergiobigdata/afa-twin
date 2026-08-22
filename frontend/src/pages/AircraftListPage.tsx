import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Aircraft } from "../api/types";
import AircraftThumbnail from "../components/AircraftThumbnail";
import AircraftPhotoViewer from "../components/AircraftPhotoViewer";
import { HealthBar, RiskBadge, StatusBadge } from "../components/Badges";

type ViewMode = "lista" | "grade";
const VIEW_MODE_KEY = "afa_twin_aircraft_view_mode";

export default function AircraftListPage() {
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
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

  const filtered = fleet.filter((a) => {
    const matchQuery = `${a.tail_number} ${a.nickname ?? ""} ${a.model} ${a.manufacturer}`.toLowerCase().includes(query.toLowerCase());
    const matchCategory = !categoryFilter || a.category === categoryFilter;
    return matchQuery && matchCategory;
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

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" placeholder="Buscar por matrícula, apelido ou modelo…" value={query}
               onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 320 }} />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <div className="card" style={{ display: "flex", padding: 3, gap: 2 }}>
          <button type="button" className={`btn btn-sm ${viewMode === "lista" ? "btn-primary" : "btn-outline"}`}
                  style={{ borderColor: "transparent" }} onClick={() => changeView("lista")}>☰ Lista</button>
          <button type="button" className={`btn btn-sm ${viewMode === "grade" ? "btn-primary" : "btn-outline"}`}
                  style={{ borderColor: "transparent" }} onClick={() => changeView("grade")}>▦ Grade</button>
        </div>
      </div>

      {loading ? <p>Carregando frota…</p> : filtered.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>Nenhuma aeronave encontrada.</p>
      ) : viewMode === "lista" ? (
        <div className="card scroll-x">
          <table>
            <thead>
              <tr>
                <th></th><th>Aeronave</th><th>Categoria</th><th>Esquadrão / Base</th>
                <th>Status</th><th>Saúde</th><th>Risco</th><th>Horas</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
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
                  <td style={{ fontSize: 12.5 }}>{a.total_flight_hours.toLocaleString("pt-BR")} h</td>
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
                  {a.total_flight_hours.toLocaleString("pt-BR")} h de voo acumuladas
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
