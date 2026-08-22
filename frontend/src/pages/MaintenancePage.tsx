import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Aircraft, MaintenanceOrder, OrderStatus, Criticality } from "../api/types";
import { CriticalityBadge, OrderStatusBadge } from "../components/Badges";

const STATUSES: OrderStatus[] = ["Aberta", "Em Andamento", "Aguardando Peça", "Concluída", "Cancelada"];
const PRIORITIES: Criticality[] = ["Baixa", "Média", "Alta", "Crítica"];

export default function MaintenancePage() {
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  useEffect(() => {
    Promise.all([api.get<MaintenanceOrder[]>("/maintenance-orders"), api.get<Aircraft[]>("/aircraft")])
      .then(([o, f]) => { setOrders(o); setFleet(f); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter((o) => (!statusFilter || o.status === statusFilter) && (!priorityFilter || o.priority === priorityFilter));

  function aircraftLabel(id: number) {
    const a = fleet.find((f) => f.id === id);
    return a ? `${a.tail_number} · ${a.model}` : `#${id}`;
  }

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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todos os status</option>
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
            <thead><tr><th>OS</th><th>Aeronave</th><th>Tipo</th><th>Título</th><th>Prioridade</th><th>Status</th><th>Aberta em</th></tr></thead>
            <tbody>
              {filtered.map((o) => (
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
