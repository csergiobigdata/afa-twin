/** Formata um total de horas decimais (ex.: 10000.833) como "[hh]:mm" -
 * horas com pelo menos 2 dígitos (zero à esquerda) e separador de milhar
 * ("."), dois pontos, minutos com 2 dígitos (ex.: 1 -> "01:00", 23 ->
 * "23:00", 10000.833... -> "10.000:50"). Usado em toda exibição de campos
 * de horas do app (livro de bordo, componentes, confiabilidade etc.) - os
 * campos de ENTRADA continuam em número decimal simples, só a exibição usa
 * esta máscara. */
export function formatHoursHHMM(totalHours: number | null | undefined): string {
  if (totalHours == null || Number.isNaN(totalHours)) return "—";
  const totalMinutes = Math.round(totalHours * 60);
  const hours = Math.trunc(totalMinutes / 60);
  const minutes = Math.abs(totalMinutes % 60);
  const hoursStr = hours.toLocaleString("pt-BR", { minimumIntegerDigits: 2 });
  return `${hoursStr}:${String(minutes).padStart(2, "0")}`;
}

/** Formata um timestamp ISO como "dd/mm/yyyy hh:mm:ss" (24h) - usado nas
 * colunas de data/hora de listas (ex.: "Aberta em" de Ordens de Serviço),
 * onde só a data costumava aparecer. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return `${date} ${time}`;
}
