import type { Aircraft } from "../api/types";
import { exampleArtUrl, uploadedPhotoUrl } from "./aircraftArt";

/**
 * Miniatura padronizada de uma aeronave: prioriza a foto real enviada no
 * cadastro; na ausência dela, usa a mesma ilustração "pôster" (fundo de céu,
 * roldana, legenda) exibida no visualizador de foto e na Pesquisa Visual -
 * padrão único em toda a aplicação, em vez do ícone de linha simples usado
 * anteriormente em listas/painéis.
 */
export default function AircraftThumbnail({
  aircraft, width = 64, height, rounded = 10,
}: { aircraft: Aircraft; width?: number; height?: number; rounded?: number }) {
  const url = uploadedPhotoUrl(aircraft.photo_url) ?? exampleArtUrl(aircraft.silhouette_key, false);
  const h = height ?? Math.round(width * 0.62);
  return (
    <img
      src={url} alt={`${aircraft.manufacturer} ${aircraft.model}`}
      style={{
        width, height: h, objectFit: "cover", borderRadius: rounded,
        border: "1px solid var(--border-subtle)", background: "#0a1f44", flexShrink: 0, display: "block",
      }}
    />
  );
}
