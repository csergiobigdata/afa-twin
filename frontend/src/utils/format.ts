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
