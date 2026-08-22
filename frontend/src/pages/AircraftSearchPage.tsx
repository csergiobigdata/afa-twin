import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Aircraft } from "../api/types";
import { exampleArtUrl, uploadedPhotoUrl } from "../components/aircraftArt";
import { HealthBar, RiskBadge, StatusBadge } from "../components/Badges";

export default function AircraftSearchPage() {
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  useEffect(() => {
    api.get<Aircraft[]>("/aircraft").then(setFleet).finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => Array.from(new Set(fleet.map((a) => a.category))), [fleet]);

  const filtered = fleet.filter((a) => {
    const haystack = `${a.tail_number} ${a.nickname ?? ""} ${a.model} ${a.manufacturer} ${a.category}`.toLowerCase();
    const matchQuery = haystack.includes(query.trim().toLowerCase());
    const matchCategory = !categoryFilter || a.category === categoryFilter;
    return matchQuery && matchCategory;
  });

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, marginBottom: 2 }}>Pesquisa Visual de Aeronaves</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 640 }}>
          Navegue pelas fotos dos modelos cadastrados ou digite para filtrar por matrícula, apelido,
          modelo ou fabricante. Clique em qualquer linha (ou na própria foto) para abrir o cadastro completo.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          type="text" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="🔎 Digite o modelo, fabricante, matrícula ou apelido…"
          style={{ flex: "1 1 320px", maxWidth: 460, fontSize: 15.5, padding: "12px 16px" }}
        />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p>Carregando fotos da frota…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>Nenhuma aeronave encontrada para "{query}".</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((a) => {
            const photoUrl = uploadedPhotoUrl(a.photo_url) ?? exampleArtUrl(a.silhouette_key, false);
            const isRealPhoto = !!a.photo_url;
            return (
              <Link
                key={a.id}
                to={`/aeronaves/${a.id}`}
                className="card aircraft-search-row"
                style={{
                  display: "flex", alignItems: "center", gap: 16, padding: 12,
                  textDecoration: "none", color: "inherit",
                }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={photoUrl} alt={`${a.manufacturer} ${a.model}`}
                    style={{
                      width: 148, height: 96, objectFit: "cover", borderRadius: 10,
                      border: "1px solid var(--border-subtle)", background: "#0a1f44", cursor: "pointer",
                    }}
                  />
                  {!isRealPhoto && (
                    <span style={{
                      position: "absolute", bottom: 4, left: 4, fontSize: 9.5, fontWeight: 700,
                      background: "rgba(10,31,68,0.8)", color: "#fff", padding: "2px 6px", borderRadius: 999,
                    }}>
                      ilustração
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16.5, fontWeight: 800 }}>{a.tail_number}</span>
                    {a.nickname && <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>"{a.nickname}"</span>}
                  </div>
                  <div style={{ fontSize: 14, marginTop: 2 }}>{a.manufacturer} · {a.model}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>
                    {a.category} · {a.squadron}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <StatusBadge status={a.status} />
                    <RiskBadge level={a.risk_level} />
                  </div>
                </div>

                <div style={{ width: 150, flexShrink: 0, display: "none" }} className="search-health-col">
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Saúde</div>
                  <HealthBar value={a.health_index} />
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 6 }}>
                    {a.total_flight_hours.toLocaleString("pt-BR")} h
                  </div>
                </div>

                <div style={{ fontSize: 20, color: "var(--text-secondary)", flexShrink: 0 }}>›</div>
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .aircraft-search-row { transition: transform .1s ease, box-shadow .15s ease; }
        .aircraft-search-row:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        @media (min-width: 720px) { .search-health-col { display: block !important; } }
      `}</style>
    </div>
  );
}
