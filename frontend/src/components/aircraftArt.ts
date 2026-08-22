/**
 * Ilustrações "pôster" (estática + animada em SVG) associadas a cada
 * modelo/categoria de aeronave, usadas como imagem de exemplo enquanto
 * nenhuma foto real for anexada ao cadastro. São ilustrações vetoriais
 * originais - ver nota em docs/02-arquitetura-da-solucao.md sobre a
 * recomendação de, futuramente, substituí-las por fotos oficiais
 * licenciadas por modelo de aeronave.
 */
const KNOWN_KEYS = ["gripen", "f5em", "a29", "amx", "kc390", "c130", "h36", "generic"];

export function exampleArtUrl(silhouetteKey: string, animated = false): string {
  const key = KNOWN_KEYS.includes(silhouetteKey) ? silhouetteKey : "generic";
  return `/aircraft-art/${key}${animated ? "-animated" : ""}.svg`;
}

/** URL de uma foto enviada pelo usuário (servida pelo backend), ou null se não houver. */
export function uploadedPhotoUrl(filename?: string | null): string | null {
  return filename ? `/media/aircraft/${encodeURIComponent(filename)}` : null;
}
