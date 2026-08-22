import { useState } from "react";
import type { Aircraft } from "../api/types";
import { exampleArtUrl, uploadedPhotoUrl } from "./aircraftArt";

/**
 * Botão + modal para visualizar a foto (estática) e a animação (GIF/vídeo
 * curto ou ilustração animada) de uma aeronave. Prioriza a foto real
 * enviada no cadastro; na ausência dela, mostra a ilustração de exemplo
 * associada ao modelo, deixando isso explícito na legenda.
 */
export default function AircraftPhotoViewer({ aircraft, label = "📷 Ver foto" }: { aircraft: Aircraft; label?: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"static" | "animated">("static");

  const hasRealPhoto = !!aircraft.photo_filename;
  const hasRealAnimated = !!aircraft.photo_animated_filename;

  const staticUrl = uploadedPhotoUrl(aircraft.photo_filename) ?? exampleArtUrl(aircraft.silhouette_key, false);
  const animatedUrl = uploadedPhotoUrl(aircraft.photo_animated_filename) ?? exampleArtUrl(aircraft.silhouette_key, true);

  const currentUrl = mode === "static" ? staticUrl : animatedUrl;
  const currentIsReal = mode === "static" ? hasRealPhoto : hasRealAnimated;

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog" aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(6,15,36,0.78)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: "100%", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{aircraft.tail_number} — {aircraft.model}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {currentIsReal ? "Foto enviada no cadastro" : "Ilustração de exemplo do modelo (foto real ainda não anexada)"}
                </div>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>Fechar ✕</button>
            </div>

            <img src={currentUrl} alt={`${aircraft.model} - ${mode === "static" ? "foto estática" : "visualização animada"}`}
                 style={{ width: "100%", display: "block", background: "#0a1f44" }} />

            <div style={{ padding: 14, display: "flex", gap: 8 }}>
              <button type="button" className={`btn btn-sm ${mode === "static" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setMode("static")}>
                🖼️ Foto estática
              </button>
              <button type="button" className={`btn btn-sm ${mode === "animated" ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setMode("animated")}>
                ▶️ Ver animação (detalhes)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
