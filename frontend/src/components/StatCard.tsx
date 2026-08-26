/** Cartão de estatística padrão (usado no Painel e na Atualização de
 * Disponibilidade) - rótulo, valor em destaque e uma linha secundária
 * opcional, com cor de acordo com a severidade (`tone`). */
export default function StatCard({
  label, value, sub, tone,
}: { label: string; value: string | number; sub?: string; tone?: "ok" | "warn" | "critical" | "info" }) {
  const toneColor = tone ? `var(--status-${tone})` : "var(--text-primary)";
  return (
    <div className="card" style={{ padding: "18px 20px", flex: "1 1 180px" }}>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: toneColor, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
