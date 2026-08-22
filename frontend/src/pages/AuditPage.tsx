import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { AuditLogEntry } from "../api/types";

const ACTION_BADGE: Record<string, string> = {
  "Criação": "badge-ok", "Alteração": "badge-info", "Inativação": "badge-warn",
  "Reativação": "badge-ok", "Cancelamento": "badge-critical",
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");

  useEffect(() => {
    api.get<AuditLogEntry[]>("/audit-log").then(setEntries).finally(() => setLoading(false));
  }, []);

  const entityTypes = useMemo(() => Array.from(new Set(entries.map((e) => e.entity_type))), [entries]);
  const filtered = entityFilter ? entries.filter((e) => e.entity_type === entityFilter) : entries;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Auditoria</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 18, maxWidth: 700 }}>
        Trilha de quem incluiu, alterou, inativou ou cancelou um cadastro, e quando — incluindo
        aeronaves, usuários, componentes, ordens de serviço e grupos/equipes.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={{ maxWidth: 240 }}>
          <option value="">Todos os tipos de cadastro</option>
          {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? <p>Carregando…</p> : (
        <div className="card scroll-x">
          <table>
            <thead><tr><th>Quando</th><th>Ação</th><th>Cadastro</th><th>Item</th><th>Descrição</th><th>Responsável</th></tr></thead>
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
                  <td style={{ fontSize: 12.5 }}>{e.actor_person_name ?? e.actor_username ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ color: "var(--text-secondary)" }}>Nenhum registro de auditoria ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
