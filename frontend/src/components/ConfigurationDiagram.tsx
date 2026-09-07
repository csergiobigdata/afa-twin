import type { ConfigurationCode } from "../api/types";
import AuthorizedConfigSymbol from "./AuthorizedConfigSymbol";

// Silhueta real da aeronave vista de frente, recortada da imagem de
// referência enviada pelo usuário (docs/"Exemplo de Configuração.png") -
// substitui a recriação vetorial usada antes. Usada como cabeçalho fixo do
// "Código de Configuração" selecionado, com a faixa de estações logo
// abaixo (ver ConfigurationDiagram).
const AIRCRAFT_SILHOUETTE_IMAGE = "/reference/aeronave-silhueta.png";

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
        <img
          src={AIRCRAFT_SILHOUETTE_IMAGE} alt="Aeronave vista de frente, com as estações de hardpoint"
          style={{ width: "100%", maxWidth: 320, display: "block" }}
        />
        <div style={{ display: "flex", marginTop: -4 }}>
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
