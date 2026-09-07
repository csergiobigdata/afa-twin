import type { ConfigurationCode } from "../api/types";
import AuthorizedConfigSymbol from "./AuthorizedConfigSymbol";

/** Silhueta da aeronave vista de frente, com um ponto por estação de
 * hardpoint (5, 4, 3, 2, 1) - recriação vetorial simplificada/ilustrativa
 * do diagrama do documento de referência (não um fac-símile pixel a
 * pixel). Usada como cabeçalho fixo do "Código de Configuração"
 * selecionado, com a faixa de estações logo abaixo (ver
 * ConfigurationDiagram). */
function AircraftFrontView() {
  return (
    <svg viewBox="0 0 300 130" width="100%" style={{ maxWidth: 320 }} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        {/* deriva (cauda vertical) */}
        <path d="M150 8 L163 46 L137 46 Z" />
        {/* disco do hélice (tracejado) + cubo do motor/canópia */}
        <circle cx="150" cy="58" r="21" strokeDasharray="3 3" />
        <circle cx="150" cy="58" r="12" />
        {/* asas, do centro até a ponta */}
        <path d="M150 63 L18 96 M150 63 L282 96" />
      </g>
      {/* pontos de estação: 5/4 na asa esquerda, 2/1 na asa direita */}
      <circle cx="52" cy="88" r="3.4" fill="currentColor" />
      <circle cx="92" cy="79" r="3.4" fill="currentColor" />
      <circle cx="208" cy="79" r="3.4" fill="currentColor" />
      <circle cx="248" cy="88" r="3.4" fill="currentColor" />
    </svg>
  );
}

const STATIONS: { key: "station_5" | "station_4" | "station_3" | "station_2" | "station_1"; label: string }[] = [
  { key: "station_5", label: "Estação 5" },
  { key: "station_4", label: "Estação 4" },
  { key: "station_3", label: "Estação 3" },
  { key: "station_2", label: "Estação 2" },
  { key: "station_1", label: "Estação 1" },
];

/** Mostra a silhueta da aeronave e, logo abaixo, uma estação (5 a 1) por
 * coluna com o equipamento daquele código (ícone + nome), no mesmo
 * formato do documento de referência (aeronave em cima, estações embaixo).
 * `symbolFor` resolve o símbolo SVG de um nome de equipamento (ver
 * Configurações Autorizadas). Sem `code` selecionado, mostra as 5 colunas
 * vazias - o painel fica sempre visível (não só depois de escolher algo). */
export default function ConfigurationDiagram({
  code, symbolFor,
}: { code: ConfigurationCode | null; symbolFor: (equipment: string) => string | undefined }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
        {code ? `Configuração ${code.code}` : "Configuração"}
      </div>
      <div className="card" style={{ padding: 12, background: "#fff", display: "inline-block" }}>
        <div style={{ color: "#111" }}><AircraftFrontView /></div>
        <div style={{ display: "flex", marginTop: 6 }}>
          {STATIONS.map((s) => {
            const equipment = code?.[s.key];
            const svg = equipment ? symbolFor(equipment) : undefined;
            return (
              <div
                key={s.key}
                style={{
                  flex: 1, minWidth: 52, border: "1px solid #ccc", borderTop: "3px solid #111",
                  padding: "4px 3px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                }}
              >
                <div style={{ fontSize: 8.5, fontWeight: 700, color: "#111", textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ minHeight: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "#111" }}>
                  {svg ? <AuthorizedConfigSymbol svg={svg} size={20} /> : <span style={{ color: "#bbb", fontSize: 11 }}>—</span>}
                </div>
                {equipment && (
                  <div style={{ fontSize: 7, color: "#333", lineHeight: 1.15, textAlign: "center" }}>{equipment}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
