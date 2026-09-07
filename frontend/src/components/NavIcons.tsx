/** Ícones de navegação do menu lateral/inferior - linhas vetoriais (não
 * emoji, que renderizam com nitidez/estilo inconsistentes entre SO/
 * navegador/fonte) num único estilo consistente (stroke, currentColor -
 * acompanha a cor do item ativo/inativo automaticamente). */
export type NavIconName =
  | "painel" | "aeronaves" | "manutencao" | "diagnostico" | "planejamento"
  | "disponibilidade" | "usuarios" | "protocolos" | "auditoria" | "sobre";

const PATHS: Record<NavIconName, string> = {
  // Painel: grade/dashboard (4 blocos)
  painel: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.4"/><rect x="13" y="3.5" width="7.5" height="4.6" rx="1.4"/><rect x="13" y="10.1" width="7.5" height="10.4" rx="1.4"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.4"/>',
  // Aeronaves: avião visto de cima, estilizado
  aeronaves: '<path d="M12 2.5 L13.4 9.5 L21 13.2 L21 15 L13.4 13 L13.4 18.3 L16.3 20.3 L16.3 21.7 L12 20.6 L7.7 21.7 L7.7 20.3 L10.6 18.3 L10.6 13 L3 15 L3 13.2 L10.6 9.5 Z"/>',
  // Manutenção: chave de boca
  manutencao: '<path d="M15.5 3a4 4 0 0 0-5.3 4.6L4 13.8a2 2 0 0 0 2.8 2.8l6.2-6.2A4 4 0 0 0 17.6 6l-2.7 2.7-2-2L15.5 3z"/><circle cx="6" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
  // Diagnóstico: pulso/eletrocardiograma
  diagnostico: '<path d="M2.5 12h4l2-6 3.5 12 2.5-9 1.5 3h5.5" stroke-linecap="round" stroke-linejoin="round"/>',
  // Planejamento: calendário com marca de verificação
  planejamento: '<rect x="3.5" y="4.5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17" stroke-linecap="round"/><path d="M8 3v3M16 3v3" stroke-linecap="round"/><path d="M8.5 14.5l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>',
  // Disponibilidade: avião decolando
  disponibilidade: '<path d="M3 21h18" stroke-linecap="round"/><path d="M5 15.5 L11 13 L18.5 5.5 a1.3 1.3 0 0 1 2.1 1.4 L15 15 L18 17.5 L15.3 18 L13 16.5 L9.5 17.3 L8 15.8 Z" stroke-linejoin="round"/>',
  // Usuários: duas pessoas
  usuarios: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" stroke-linecap="round"/><circle cx="17.5" cy="9" r="2.5"/><path d="M15.8 14.2c2.7.4 4.7 2.6 4.7 5.8" stroke-linecap="round"/>',
  // Protocolos: prancheta com lista
  protocolos: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><rect x="8.5" y="2" width="7" height="3" rx="1"/><path d="M8 10.5h8M8 14h8M8 17.5h5" stroke-linecap="round"/>',
  // Auditoria: lupa
  auditoria: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M19.5 19.5l-4.3-4.3" stroke-linecap="round"/>',
  // Sobre: círculo com "i"
  sobre: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="7.7" r="0.9" fill="currentColor" stroke="none"/><path d="M12 11v6" stroke-linecap="round"/>',
};

export default function NavIcon({ name, size = 20 }: { name: NavIconName; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.6"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
