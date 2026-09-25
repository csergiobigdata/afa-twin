import { useState } from "react";
import type { StationEquipmentDisplay, StationKey } from "../api/types";
import AuthorizedConfigSymbol from "./AuthorizedConfigSymbol";

// Desenho técnico da aeronave vista de frente com as 5 estações de
// hardpoint, recortado do template de referência enviado pelo usuário (a
// parte de baixo do original, com as caixas coloridas de exemplo, foi
// descartada - as caixas abaixo do desenho aqui já são geradas
// dinamicamente com o equipamento real de cada estação).
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

type DiagramProps = { code: StationEquipmentDisplay | null; symbolFor: (equipment: string) => string | undefined };

/** Corpo do diagrama (desenho + faixa de estações), reaproveitado tanto no
 * tamanho normal (inline na tela) quanto no tamanho ampliado (modal de
 * zoom) - `imageMaxWidth`/`scale` controlam o tamanho de cada versão. */
function DiagramBody({ code, symbolFor, imageMaxWidth, scale }: DiagramProps & { imageMaxWidth: number; scale: number }) {
  return (
    <div className="card" style={{ padding: 12 * scale, background: "#fff", display: "inline-block" }}>
      <img
        src={AIRCRAFT_SILHOUETTE_IMAGE} alt="Aeronave vista de frente, com as estações de hardpoint"
        style={{ width: "100%", maxWidth: imageMaxWidth, display: "block" }}
      />
      <div style={{ display: "flex", marginTop: -2 }}>
        {STATIONS.map((s) => {
          const equipment = code?.[s.key];
          const svg = equipment ? symbolFor(equipment) : undefined;
          return (
            <div
              key={s.key}
              style={{
                flex: 1, minWidth: 68 * scale, border: "1px solid #999", borderTop: `${3 * scale}px solid #111`,
                background: s.color, padding: `${6 * scale}px ${4 * scale}px`, display: "flex", flexDirection: "column",
                alignItems: "center", gap: 4 * scale,
              }}
            >
              <div style={{ fontSize: 9.5 * scale, fontWeight: 700, color: "#111", textTransform: "uppercase" }}>{s.label}</div>
              <div style={{ minHeight: 22 * scale, display: "flex", alignItems: "center", justifyContent: "center", color: "#111" }}>
                {svg ? <AuthorizedConfigSymbol svg={svg} size={22 * scale} /> : <span style={{ color: "#666", fontSize: 12 * scale }}>—</span>}
              </div>
              {equipment && (
                <div style={{ fontSize: 7.5 * scale, color: "#222", lineHeight: 1.15, textAlign: "center" }}>{equipment}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mostra a silhueta da aeronave e, logo abaixo, uma estação (5 a 1) por
 * coluna com o equipamento daquele código (ícone + nome), no mesmo
 * formato do documento de referência (aeronave em cima, estações embaixo).
 * `symbolFor` resolve o símbolo SVG de um nome de equipamento (ver
 * Configurações Autorizadas). Sem `code` selecionado, mostra as 5 colunas
 * vazias - o painel fica sempre visível (não só depois de escolher algo).
 * Clicável: abre uma versão ampliada em tela cheia, para ler melhor os
 * ícones/nomes de cada estação (a pedido do usuário). */
export default function ConfigurationDiagram({ code, symbolFor }: DiagramProps) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
        {code ? `Configuração ${code.code}` : "Configuração"}
      </div>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        title="Clique para ampliar"
        style={{ border: "none", background: "none", padding: 0, cursor: "zoom-in", display: "inline-block" }}
      >
        <DiagramBody code={code} symbolFor={symbolFor} imageMaxWidth={480} scale={1} />
      </button>
      <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginTop: 4 }}>🔍 Clique na imagem para ampliar</div>

      {zoomed && (
        <div
          role="dialog" aria-modal="true"
          onClick={() => setZoomed(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(6,15,36,0.85)", zIndex: 200,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflow: "auto",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", maxWidth: "95vw" }}>
            <button
              type="button" className="btn btn-outline btn-sm"
              onClick={() => setZoomed(false)}
              style={{ marginBottom: 12, background: "#fff" }}
            >
              Fechar ✕
            </button>
            <div>
              <DiagramBody code={code} symbolFor={symbolFor} imageMaxWidth={900} scale={1.8} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
