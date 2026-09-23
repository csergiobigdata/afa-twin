import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { AuditLogEntry } from "../api/types";

const ACTION_BADGE: Record<string, string> = {
  "Criação": "badge-ok", "Alteração": "badge-info", "Inativação": "badge-warn",
  "Reativação": "badge-ok", "Cancelamento": "badge-critical",
};

type SortKey = "created_at" | "action" | "entity_type" | "entity_label" | "summary" | "actor";

function actorName(e: AuditLogEntry): string {
  return e.actor_person_name ?? e.actor_username ?? "—";
}

function sortValue(e: AuditLogEntry, key: SortKey): string | number {
  switch (key) {
    case "created_at": return new Date(e.created_at).getTime();
    case "action": return e.action;
    case "entity_type": return e.entity_type;
    case "entity_label": return e.entity_label ?? `#${e.entity_id}`;
    case "summary": return e.summary;
    case "actor": return actorName(e);
  }
}

/** Cabeçalho de coluna clicável - ordena a tabela por aquele campo, alternando
 * crescente/decrescente a cada clique (mesmo campo) ou começando decrescente
 * num campo novo (mais útil por padrão: mais recente/mais "alto" primeiro). */
function SortableTh({
  label, sortKey, active, dir, onClick,
}: { label: string; sortKey: SortKey; active: boolean; dir: "asc" | "desc"; onClick: (key: SortKey) => void }) {
  return (
    <th
      onClick={() => onClick(sortKey)}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      title="Clique para ordenar por esta coluna"
    >
      {label} <span style={{ opacity: active ? 1 : 0.25 }}>{active ? (dir === "asc" ? "▲" : "▼") : "▲"}</span>
    </th>
  );
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created_at" ? "desc" : "asc");
    }
  }

  useEffect(() => {
    api.get<AuditLogEntry[]>("/audit-log").then(setEntries).finally(() => setLoading(false));
  }, []);

  const entityTypes = useMemo(() => Array.from(new Set(entries.map((e) => e.entity_type))).sort(), [entries]);
  const actions = useMemo(() => Array.from(new Set(entries.map((e) => e.action))).sort(), [entries]);
  const actors = useMemo(() => Array.from(new Set(entries.map(actorName))).sort(), [entries]);

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
    let rows = entries.filter((e) => {
      if (entityFilter && e.entity_type !== entityFilter) return false;
      if (actionFilter && e.action !== actionFilter) return false;
      if (actorFilter && actorName(e) !== actorFilter) return false;
      const ts = new Date(e.created_at).getTime();
      if (fromMs != null && ts < fromMs) return false;
      if (toMs != null && ts > toMs) return false;
      if (searchLower) {
        const haystack = `${e.summary} ${e.entity_label ?? ""} ${e.entity_type}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [entries, entityFilter, actionFilter, actorFilter, search, dateFrom, dateTo, sortKey, sortDir]);

  function clearFilters() {
    setEntityFilter(""); setActionFilter(""); setActorFilter(""); setSearch(""); setDateFrom(""); setDateTo("");
  }
  const hasActiveFilters = !!(entityFilter || actionFilter || actorFilter || search || dateFrom || dateTo);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Auditoria</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 18, maxWidth: 700 }}>
        Trilha de quem incluiu, alterou, inativou ou cancelou um cadastro, e quando — incluindo
        aeronaves, usuários, componentes, ordens de serviço e grupos/equipes.
      </p>

      <div className="card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ minWidth: 180 }}>
          <label>Cadastro</label>
          <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
            <option value="">Todos</option>
            {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <label>Ação</label>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">Todas</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 200 }}>
          <label>Responsável</label>
          <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}>
            <option value="">Todos</option>
            {actors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label>De</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label>Até</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="field" style={{ flex: "1 1 220px", minWidth: 200 }}>
          <label>Buscar (item/descrição)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex.: FAB 5962, motor…" />
        </div>
        {hasActiveFilters && (
          <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>Limpar filtros</button>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
        {filtered.length} de {entries.length} registro(s).
      </p>

      {loading ? <p>Carregando…</p> : (
        <div className="card scroll-x">
          <table>
            <thead>
              <tr>
                <SortableTh label="Data/Hora" sortKey="created_at" active={sortKey === "created_at"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Ação" sortKey="action" active={sortKey === "action"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Cadastro" sortKey="entity_type" active={sortKey === "entity_type"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Item" sortKey="entity_label" active={sortKey === "entity_label"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Descrição" sortKey="summary" active={sortKey === "summary"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Responsável" sortKey="actor" active={sortKey === "actor"} dir={sortDir} onClick={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontSize: 11.5, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td><span className={`badge ${ACTION_BADGE[e.action] ?? "badge-neutral"}`}>{e.action}</span></td>
                  <td style={{ fontSize: 12.5 }}>{e.entity_type}</td>
                  <td style={{ fontSize: 12.5 }}>{e.entity_label ?? `#${e.entity_id}`}</td>
                  <td style={{ fontSize: 12.5 }}>{e.summary}</td>
                  <td style={{ fontSize: 12.5 }}>{actorName(e)}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ color: "var(--text-secondary)" }}>Nenhum registro de auditoria encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
