/**
 * Ilustrações "pôster" (estática + animada em SVG) associadas a cada
 * modelo/categoria de aeronave, usadas como imagem de exemplo enquanto
 * nenhuma foto real for anexada ao cadastro (ou nenhuma animação real for
 * anexada, no caso do slot animado - toda a frota atual já tem foto
 * estática real, mas várias aeronaves ainda não têm animação própria). São
 * ilustrações vetoriais originais para os demais modelos - ver nota em
 * docs/02-arquitetura-da-solucao.md sobre a recomendação de, futuramente,
 * substituí-las por fotos oficiais licenciadas por modelo de aeronave.
 *
 * O modelo "a29" já usa a foto real de referência (ver images/aeronave
 * tucano a 29.jpg) em vez do desenho vetorial, tanto no slot estático
 * quanto no animado (não há uma animação real de reposição ainda) - a
 * pedido do usuário, por ser o modelo de toda a frota atual.
 */
const KNOWN_KEYS = ["gripen", "f5em", "a29", "amx", "kc390", "c130", "h36", "generic"];

export function exampleArtUrl(silhouetteKey: string, animated = false): string {
  const key = KNOWN_KEYS.includes(silhouetteKey) ? silhouetteKey : "generic";
  if (key === "a29") return "/reference/a29-tucano.png";
  return `/aircraft-art/${key}${animated ? "-animated" : ""}.svg`;
}

/** URL de uma foto enviada pelo usuário (já pronta, servida pelo backend em /api/media/<id>), ou null se não houver. */
export function uploadedPhotoUrl(url?: string | null): string | null {
  return url || null;
}
