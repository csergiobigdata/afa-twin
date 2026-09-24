/** Cartão de estatística padrão (usado no Painel e na Atualização de
 * Disponibilidade) - rótulo, valor em destaque e uma linha secundária
 * opcional, com cor de acordo com a severidade (`tone`). `valueColor`
 * sobrescreve a cor derivada de `tone` só neste cartão (ex.: valor branco
 * sobre tom "warn", mantendo o rótulo amarelo padrão) sem afetar outros
 * StatCards que usam o mesmo `tone`. `onClick`, quando informado, torna o
 * cartão inteiro clicável (Painel → atalhos para Manutenção/Aeronaves). */
export default function StatCard({
  label, value, sub, tone, valueColor, onClick,
}: {
  label: string; value: string | number; sub?: string; tone?: "ok" | "warn" | "critical" | "info";
  valueColor?: string; onClick?: () => void;
}) {
  const toneColor = valueColor ?? (tone ? `var(--status-${tone})` : "var(--text-primary)");
  return (
    <div
      className={`card${onClick ? " stat-card-clickable" : ""}`}
      style={{ padding: "18px 20px", flex: "1 1 180px", cursor: onClick ? "pointer" : undefined }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div style={{ fontSize: 12.5, color: "var(--text-label)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: toneColor, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
