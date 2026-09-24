import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { Aircraft, MaintenanceOrder, OrderStatus, Criticality } from "../api/types";
import { CriticalityBadge, OrderStatusBadge } from "../components/Badges";
import SortableTh from "../components/SortableTh";

const STATUSES: OrderStatus[] = ["Aberta", "Em Andamento", "Aguardando Peça", "Concluída", "Cancelada"];
const PRIORITIES: Criticality[] = ["Baixa", "Média", "Alta", "Crítica"];
const PRIORITY_ORDER: Record<string, number> = { "Baixa": 0, "Média": 1, "Alta": 2, "Crítica": 3 };
// Opção combinada no seletor de Status - soma os 3 status considerados "em
// aberto" (ver backend/app/routers/dashboard.py::open_orders); o Painel
// manda para cá com ?status=open ao clicar no cartão "OS em aberto".
const OPEN_STATUSES: OrderStatus[] = ["Aberta", "Em Andamento", "Aguardando Peça"];
const OPEN_FILTER_VALUE = "__OPEN__";

type SortKey = "order_number" | "aircraft" | "type" | "title" | "priority" | "status" | "opened_at";

export default function MaintenancePage() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(() => (searchParams.get("status") === "open" ? OPEN_FILTER_VALUE : ""));
  const [priorityFilter, setPriorityFilter] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("opened_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "opened_at" ? "desc" : "asc"); }
  }

  useEffect(() => {
    Promise.all([api.get<MaintenanceOrder[]>("/maintenance-orders"), api.get<Aircraft[]>("/aircraft")])
      .then(([o, f]) => { setOrders(o); setFleet(f); })
      .finally(() => setLoading(false));
  }, []);

  function aircraftLabel(id: number) {
    const a = fleet.find((f) => f.id === id);
    return a ? `${a.tail_number} · ${a.model}` : `#${id}`;
  }

  function sortValue(o: MaintenanceOrder, key: SortKey): string | number {
    switch (key) {
      case "order_number": return o.order_number;
      case "aircraft": return aircraftLabel(o.aircraft_id);
      case "type": return o.type;
      case "title": return o.title;
      case "priority": return PRIORITY_ORDER[o.priority] ?? -1;
      case "status": return o.status;
      case "opened_at": return new Date(o.opened_at).getTime();
    }
  }

  const filtered = orders.filter((o) => {
    if (statusFilter === OPEN_FILTER_VALUE) {
      if (!OPEN_STATUSES.includes(o.status)) return false;
    } else if (statusFilter && o.status !== statusFilter) return false;
    if (priorityFilter && o.priority !== priorityFilter) return false;
    if (query) {
      const q = query.trim().toLowerCase();
      if (!`${o.order_number} ${o.title} ${aircraftLabel(o.aircraft_id)}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>Ordens de Serviço e Manutenção</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Controle rigoroso de inspeções, correções, overhauls e boletins técnicos (AD/SB).</p>
        </div>
        <Link to="/manutencao/nova" className="btn btn-primary">+ Nova Ordem de Serviço</Link>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input type="text" placeholder="Buscar por OS, título ou aeronave…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 280 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todos os status</option>
          <option value={OPEN_FILTER_VALUE}>Em aberto (Aberta + Em Andamento + Aguardando Peça)</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todas as prioridades</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loading ? <p>Carregando…</p> : (
        <div className="card scroll-x">
          <table>
            <thead>
              <tr>
                <SortableTh label="OS" sortKey="order_number" active={sortKey === "order_number"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Aeronave" sortKey="aircraft" active={sortKey === "aircraft"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Tipo" sortKey="type" active={sortKey === "type"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Título" sortKey="title" active={sortKey === "title"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Prioridade" sortKey="priority" active={sortKey === "priority"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Status" sortKey="status" active={sortKey === "status"} dir={sortDir} onClick={toggleSort} />
                <SortableTh label="Aberta em" sortKey="opened_at" active={sortKey === "opened_at"} dir={sortDir} onClick={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/manutencao/${o.id}`} style={{ fontWeight: 700 }}>{o.order_number}</Link></td>
                  <td style={{ fontSize: 12.5 }}>{aircraftLabel(o.aircraft_id)}</td>
                  <td style={{ fontSize: 12.5 }}>{o.type}</td>
                  <td>{o.title}</td>
                  <td><CriticalityBadge value={o.priority} /></td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td style={{ fontSize: 12.5 }}>{new Date(o.opened_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ color: "var(--text-secondary)" }}>Nenhuma ordem de serviço encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
