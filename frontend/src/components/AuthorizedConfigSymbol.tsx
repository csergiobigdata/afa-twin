import { useMemo } from "react";

/** Tags e atributos permitidos num símbolo SVG de Configuração Autorizada -
 * o suficiente para os ícones geométricos simples do cadastro (formas,
 * texto curto). Qualquer coisa fora desta lista é descartada antes da
 * marcação chegar a `dangerouslySetInnerHTML`, como segunda camada de
 * defesa contra XSS além da validação já feita no backend (schemas.py) -
 * o campo é texto livre editável pelo cadastro, então nunca deve ser
 * tratado como confiável só porque passou pela API uma vez. */
const ALLOWED_TAGS = new Set([
  "svg", "path", "circle", "ellipse", "line", "rect", "polygon", "polyline",
  "g", "text", "defs", "lineargradient", "radialgradient", "stop",
]);
const ALLOWED_ATTRS = new Set([
  "viewbox", "xmlns", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "points",
  "width", "height", "transform", "font-size", "font-weight", "font-family", "text-anchor",
  "offset", "stop-color", "id", "opacity",
]);

function sanitizeSvg(raw: string): string | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  } catch {
    return null;
  }
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg" || root.querySelector("parsererror")) return null;

  function clean(el: Element) {
    for (const child of Array.from(el.children)) {
      if (!ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
        child.remove();
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (!ALLOWED_ATTRS.has(name) || attr.value.toLowerCase().includes("javascript:")) {
          child.removeAttribute(attr.name);
        }
      }
      clean(child);
    }
  }
  clean(root);
  for (const attr of Array.from(root.attributes)) {
    if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) root.removeAttribute(attr.name);
  }
  // Preenche o contêiner independentemente do width/height originais (o
  // dimensionamento real é decidido pelo `size` do componente, via CSS).
  root.setAttribute("width", "100%");
  root.setAttribute("height", "100%");
  return new XMLSerializer().serializeToString(root);
}

/** Renderiza o símbolo (SVG inline) de uma Configuração Autorizada, com
 * sanitização client-side (ver sanitizeSvg acima) antes de injetar como
 * HTML. Ver models.py::AuthorizedConfiguration para o porquê do símbolo
 * ficar embutido no próprio registro em vez de um upload separado. */
export default function AuthorizedConfigSymbol({ svg, size = 28 }: { svg: string; size?: number }) {
  const safe = useMemo(() => sanitizeSvg(svg), [svg]);
  if (!safe) {
    return (
      <span style={{ width: size, height: size, display: "inline-block", color: "var(--text-secondary)" }} title="Símbolo inválido">
        ⚠️
      </span>
    );
  }
  return (
    <span
      style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
