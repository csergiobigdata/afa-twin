import type { Aircraft, AvailabilityCode } from "../api/types";

/** Tags de configuração de asas/hardpoints reconhecidas no texto colado
 * (cadastro auxiliar editável em Usuários → Cadastros; esta lista é só o
 * ponto de partida usado para reconhecer o texto, não uma trava). */
const KNOWN_CONFIG_TAGS = ["LISO", "ADA", "EEXD", "VENTRAL", "CAA"];

export interface ParsedAvailabilityRow {
  /** Chave estável para a lista React (não muda ao reordenar/editar). */
  key: string;
  raw: string;
  tailDigits: string;
  aircraft: Aircraft | null;
  code: AvailabilityCode | null;
  configuration: string | null;
  hasSubalares: boolean;
  reason: string | null;
  /** Linha não reconhecida (não bate com "<matrícula> - <DI|DO|IN> ...") */
  unrecognized: boolean;
}

function findAircraftByTailDigits(fleet: Aircraft[], tailDigits: string): Aircraft | null {
  return fleet.find((a) => (a.tail_number.match(/\d+/g)?.join("") ?? "") === tailDigits) ?? null;
}

/** Interpreta uma linha do boletim, ex.: "5906 - DO (EEXD TREM DE POUSO)".
 * Heurística transparente e revisável (o usuário confere/edita cada linha
 * antes de salvar) - não é um parser formal de gramática, pois o boletim é
 * texto livre digitado por pessoas. */
export function parseAvailabilityLine(line: string, fleet: Aircraft[], index: number): ParsedAvailabilityRow | null {
  const raw = line.trim();
  if (!raw) return null;

  const key = `${index}-${raw}`;
  const match = raw.match(/^(\d{2,6})\s*-\s*(DI|DO|IN)\b(.*)$/i);
  if (!match) {
    return { key, raw, tailDigits: "", aircraft: null, code: null, configuration: null, hasSubalares: false, reason: null, unrecognized: true };
  }

  const [, tailDigits, codeRaw, restRaw] = match;
  const code = codeRaw.toUpperCase() as AvailabilityCode;

  // Separa grupos entre parênteses do restante do texto da linha.
  const chunks: string[] = [];
  let remainder = restRaw;
  const parenRegex = /\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRegex.exec(restRaw))) {
    if (m[1].trim()) chunks.push(m[1].trim());
  }
  remainder = remainder.replace(parenRegex, "").trim();
  if (remainder) chunks.push(remainder);

  let configuration: string | null = null;
  let hasSubalares = false;
  const reasonParts: string[] = [];

  for (const chunk of chunks) {
    const upper = chunk.toUpperCase();
    if (upper === "SUBALARES") {
      hasSubalares = true;
      continue;
    }
    const tag = KNOWN_CONFIG_TAGS.find((t) => upper === t || upper.startsWith(`${t} `) || upper.startsWith(`${t}-`));
    if (tag && !configuration) {
      configuration = tag;
      const rest = chunk.slice(tag.length).replace(/^[\s-]+/, "").trim();
      if (rest) reasonParts.push(rest);
      continue;
    }
    reasonParts.push(chunk);
  }

  return {
    key, raw, tailDigits,
    aircraft: findAircraftByTailDigits(fleet, tailDigits),
    code, configuration, hasSubalares,
    reason: reasonParts.length ? reasonParts.join("; ") : null,
    unrecognized: false,
  };
}

export function parseAvailabilityBoardText(text: string, fleet: Aircraft[]): ParsedAvailabilityRow[] {
  return text
    .split("\n")
    .map((line, i) => parseAvailabilityLine(line, fleet, i))
    .filter((row): row is ParsedAvailabilityRow => row !== null);
}
