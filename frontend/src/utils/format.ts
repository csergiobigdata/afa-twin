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

// Todo timestamp (opened_at, created_at, cancelled_at, recorded_at etc.) é
// gravado em UTC no banco - exibir sem converter mostraria o horário errado
// (ex.: uma OS aberta às 00:13 em Brasília aparecia como "03:13"). Horário
// de Brasília é sempre UTC-3 fixo (Brasil aboliu o horário de verão em
// 2019), mas usamos o nome do fuso IANA para o navegador fazer a conversão
// - também deliberadamente FIXO (não o fuso do dispositivo de quem está
// vendo a tela), a pedido do usuário: o horário exibido deve ser sempre o
// de Brasília, não o fuso local de cada aparelho.
const BRASILIA_TZ = "America/Sao_Paulo";

/** Formata um timestamp ISO (UTC) como "dd/mm/yyyy" no horário de Brasília -
 * para campos de data+hora onde só o dia importa (ex.: recorded_at de uma
 * inspeção). Não usar em campos que já são só-data (ex.: flight_log.date,
 * sem componente de horário) - esses não têm o problema de fuso. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: BRASILIA_TZ });
}

/** Formata um timestamp ISO como "dd/mm/yyyy hh:mm:ss" (24h) no horário de
 * Brasília - usado nas colunas de data/hora de listas (ex.: "Aberta em" de
 * Ordens de Serviço), onde só a data costumava aparecer. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { timeZone: BRASILIA_TZ });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: BRASILIA_TZ });
  return `${date} ${time}`;
}

/** Como formatDateTime, mas sem segundos - usado em listas mais compactas
 * (notificações, auditoria, cancelamento de OS). */
export function formatDateTimeShort(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { timeZone: BRASILIA_TZ });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: BRASILIA_TZ });
  return `${date} ${time}`;
}
