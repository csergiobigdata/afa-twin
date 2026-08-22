import type { AircraftStatus, Criticality, OrderStatus } from "../api/types";

export function StatusBadge({ status }: { status: AircraftStatus }) {
  const map: Record<AircraftStatus, string> = {
    "Operacional": "badge-ok",
    "Em Manutenção": "badge-warn",
    "Em Inspeção": "badge-warn",
    "Indisponível": "badge-critical",
    "Em Modernização": "badge-info",
  };
  return <span className={`badge ${map[status] ?? "badge-neutral"}`}>{status}</span>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = {
    "Aberta": "badge-info",
    "Em Andamento": "badge-warn",
    "Aguardando Peça": "badge-warn",
    "Concluída": "badge-ok",
    "Cancelada": "badge-neutral",
  };
  return <span className={`badge ${map[status] ?? "badge-neutral"}`}>{status}</span>;
}

export function CriticalityBadge({ value }: { value: Criticality }) {
  const map: Record<Criticality, string> = {
    "Baixa": "badge-ok",
    "Média": "badge-info",
    "Alta": "badge-warn",
    "Crítica": "badge-critical",
  };
  return <span className={`badge ${map[value] ?? "badge-neutral"}`}>{value}</span>;
}

export function RiskBadge({ level }: { level?: string | null }) {
  const map: Record<string, string> = {
    "Baixo": "badge-ok",
    "Médio": "badge-warn",
    "Alto": "badge-warn",
    "Crítico": "badge-critical",
  };
  return <span className={`badge ${map[level ?? ""] ?? "badge-neutral"}`}>Risco {level ?? "-"}</span>;
}

export function HealthBar({ value }: { value?: number | null }) {
  const v = value ?? 100;
  const color = v >= 90 ? "var(--status-ok)" : v >= 75 ? "var(--status-info)" : v >= 55 ? "var(--status-warn)" : "var(--status-critical)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--bg-surface-alt)", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 42, textAlign: "right" }}>{v.toFixed(0)}%</span>
    </div>
  );
}
