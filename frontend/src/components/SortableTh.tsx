/** Cabeçalho de coluna de tabela clicável - ordena por aquele campo,
 * alternando crescente/decrescente a cada clique (mesmo campo) ou já
 * começando decrescente num campo novo (ver AuditPage.tsx/AircraftListPage.tsx). */
export default function SortableTh<K extends string>({
  label, sortKey, active, dir, onClick,
}: { label: string; sortKey: K; active: boolean; dir: "asc" | "desc"; onClick: (key: K) => void }) {
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
