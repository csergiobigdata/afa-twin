import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuditLogEntry, AuditLogFilterOptions, AuditLogPage } from "../api/types";
import SortableTh from "../components/SortableTh";

// Cores mais vivas que as classes badge-* padrão (mesma família de cor -
// verde/azul/amarelo/vermelho - só mais saturadas) sobre fundo branco fixo
// em vez do fundo translúcido padrão: sobre o fundo azul-marinho escuro do
// tema Noturno, o badge-* translúcido ficava quase invisível nesta coluna.
const ACTION_BADGE_COLOR: Record<string, string> = {
  "Criação": "#0fa968", "Reativação": "#0fa968",
  "Alteração": "#2f6bc4", "Inativação": "#d98c00", "Cancelamento": "#e23c3c",
};

type SortKey = "created_at" | "action" | "entity_type" | "entity_label" | "summary" | "actor";

const PAGE_SIZE = 50;

function actorName(e: AuditLogEntry): string {
  return e.actor_person_name ?? e.actor_username ?? "—";
}

export default function AuditPage() {
  const [page, setPage] = useState<AuditLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterOptions, setFilterOptions] = useState<AuditLogFilterOptions>({ entity_types: [], actions: [], actors: [] });

  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageNumber, setPageNumber] = useState(1);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "created_at" ? "desc" : "asc"); }
    setPageNumber(1);
  }

  // Opções dos 3 seletores de filtro, carregadas uma vez (não dependem da
  // página/filtro atual - são os valores distintos de todo o histórico).
  useEffect(() => {
    api.get<AuditLogFilterOptions>("/audit-log/filter-options").then(setFilterOptions).catch(() => {});
  }, []);

  // Busca por texto livre com debounce (evita 1 chamada de API por tecla
  // digitada) - também reinicia a paginação para a página 1.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPageNumber(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Filtro, ordenação e paginação acontecem no backend (ver routers/
  // audit.py) - a cada mudança de filtro/ordenação/página, uma nova página
  // de resultados é buscada, em vez de baixar o histórico inteiro de uma
  // vez (o que ficaria cada vez mais lento conforme o histórico cresce).
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (entityFilter) params.set("entity_type", entityFilter);
    if (actionFilter) params.set("action", actionFilter);
    if (actorFilter) params.set("actor", actorFilter);
    if (search) params.set("search", search);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("sort_key", sortKey);
    params.set("sort_dir", sortDir);
    params.set("page", String(pageNumber));
    params.set("page_size", String(PAGE_SIZE));
    api.get<AuditLogPage>(`/audit-log?${params.toString()}`).then(setPage).finally(() => setLoading(false));
  }, [entityFilter, actionFilter, actorFilter, search, dateFrom, dateTo, sortKey, sortDir, pageNumber]);

  function updateFilter(setter: (v: string) => void) {
    return (value: string) => { setter(value); setPageNumber(1); };
  }
  const setEntityFilterAndReset = updateFilter(setEntityFilter);
  const setActionFilterAndReset = updateFilter(setActionFilter);
  const setActorFilterAndReset = updateFilter(setActorFilter);
  const setDateFromAndReset = updateFilter(setDateFrom);
  const setDateToAndReset = updateFilter(setDateTo);

  function clearFilters() {
    setEntityFilter(""); setActionFilter(""); setActorFilter("");
    setSearchInput(""); setSearch(""); setDateFrom(""); setDateTo("");
    setPageNumber(1);
  }
  const hasActiveFilters = !!(entityFilter || actionFilter || actorFilter || search || dateFrom || dateTo);

  const total = page?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          <select value={entityFilter} onChange={(e) => setEntityFilterAndReset(e.target.value)}>
            <option value="">Todos</option>
            {filterOptions.entity_types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <label>Ação</label>
          <select value={actionFilter} onChange={(e) => setActionFilterAndReset(e.target.value)}>
            <option value="">Todas</option>
            {filterOptions.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 200 }}>
          <label>Responsável</label>
          <select value={actorFilter} onChange={(e) => setActorFilterAndReset(e.target.value)}>
            <option value="">Todos</option>
            {filterOptions.actors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label>De</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFromAndReset(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label>Até</label>
          <input type="date" value={dateTo} onChange={(e) => setDateToAndReset(e.target.value)} />
        </div>
        <div className="field" style={{ flex: "1 1 220px", minWidth: 200 }}>
          <label>Buscar (item/descrição)</label>
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="ex.: FAB 5962, motor…" />
        </div>
        {hasActiveFilters && (
          <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>Limpar filtros</button>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
        {total === 0 ? "0 registro(s)." : `Página ${pageNumber} de ${totalPages} — ${total} registro(s) no total.`}
      </p>

      {loading && !page ? <p>Carregando…</p> : (
        <>
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
              <tbody style={{ opacity: loading ? 0.6 : 1 }}>
                {(page?.items ?? []).map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontSize: 11.5, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td><span className="badge" style={{ background: "#fff", color: ACTION_BADGE_COLOR[e.action] ?? "#3d4a63" }}>{e.action}</span></td>
                    <td style={{ fontSize: 12.5 }}>{e.entity_type}</td>
                    <td style={{ fontSize: 12.5 }}>{e.entity_label ?? `#${e.entity_id}`}</td>
                    <td style={{ fontSize: 12.5 }}>{e.summary}</td>
                    <td style={{ fontSize: 12.5 }}>{actorName(e)}</td>
                  </tr>
                ))}
                {(page?.items.length ?? 0) === 0 && (
                  <tr><td colSpan={6} style={{ color: "var(--text-secondary)" }}>Nenhum registro de auditoria encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <button type="button" className="btn btn-outline btn-sm" disabled={pageNumber <= 1}
                      onClick={() => setPageNumber((p) => Math.max(1, p - 1))}>
                ← Anterior
              </button>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Página {pageNumber} de {totalPages}</span>
              <button type="button" className="btn btn-outline btn-sm" disabled={pageNumber >= totalPages}
                      onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}>
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
