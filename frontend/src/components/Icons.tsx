/** Ícones pequenos e genéricos reaproveitados em botões por toda a
 * aplicação (ex.: "+ Nova Ordem de Serviço") - linha vetorial com
 * currentColor, mesmo padrão de NavIcons.tsx, em vez do caractere de texto
 * "+" cru. */
export function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 4v16M4 12h16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
