import type { StationEquipmentDisplay, StationKey } from "../api/types";
import AuthorizedConfigSymbol from "./AuthorizedConfigSymbol";

// Desenho técnico da aeronave vista de frente com as 5 estações de
// hardpoint, recortado do novo template de referência enviado pelo usuário
// (a parte de baixo do original, com as caixas coloridas de exemplo, foi
// descartada - as caixas abaixo do desenho aqui já são geradas
// dinamicamente com o equipamento real de cada estação). Substitui a
// silhueta usada antes (aeronave-silhueta.png).
const AIRCRAFT_SILHOUETTE_IMAGE = "/reference/config-diagram-template.png";

// Mesma cor pastel de cada estação no template de referência (rosa/
// amarelo/verde/laranja/azul, da estação 5 até a 1), para a caixa embaixo
// do desenho continuar a "linha" que desce de cada asa/pilone.
const STATIONS: { key: StationKey; label: string; color: string }[] = [
  { key: "station_5", label: "Estação 5", color: "#f3cfce" },
  { key: "station_4", label: "Estação 4", color: "#f0ecc0" },
  { key: "station_3", label: "Estação 3", color: "#cce8d2" },
  { key: "station_2", label: "Estação 2", color: "#fddbb8" },
  { key: "station_1", label: "Estação 1", color: "#d6dcf2" },
];

/** Mostra a silhueta da aeronave e, logo abaixo, uma estação (5 a 1) por
 * coluna com o equipamento daquele código (ícone + nome), no mesmo
 * formato do documento de referência (aeronave em cima, estações embaixo).
 * `symbolFor` resolve o símbolo SVG de um nome de equipamento (ver
 * Configurações Autorizadas). Sem `code` selecionado, mostra as 5 colunas
 * vazias - o painel fica sempre visível (não só depois de escolher algo). */
export default function ConfigurationDiagram({
  code, symbolFor,
}: { code: StationEquipmentDisplay | null; symbolFor: (equipment: string) => string | undefined }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
        {code ? `Configuração ${code.code}` : "Configuração"}
      </div>
      <div className="card" style={{ padding: 12, background: "#fff", display: "inline-block" }}>
        <img
          src={AIRCRAFT_SILHOUETTE_IMAGE} alt="Aeronave vista de frente, com as estações de hardpoint"
          style={{ width: "100%", maxWidth: 480, display: "block" }}
        />
        <div style={{ display: "flex", marginTop: -2 }}>
          {STATIONS.map((s) => {
            const equipment = code?.[s.key];
            const svg = equipment ? symbolFor(equipment) : undefined;
            return (
              <div
                key={s.key}
                style={{
                  flex: 1, minWidth: 68, border: "1px solid #999", borderTop: "3px solid #111",
                  background: s.color, padding: "6px 4px", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 4,
                }}
              >
                <div style={{ fontSize: 9.5, fontWeight: 700, color: "#111", textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ minHeight: 22, display: "flex", alignItems: "center", justifyContent: "center", color: "#111" }}>
                  {svg ? <AuthorizedConfigSymbol svg={svg} size={22} /> : <span style={{ color: "#666", fontSize: 12 }}>—</span>}
                </div>
                {equipment && (
                  <div style={{ fontSize: 7.5, color: "#222", lineHeight: 1.15, textAlign: "center" }}>{equipment}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
