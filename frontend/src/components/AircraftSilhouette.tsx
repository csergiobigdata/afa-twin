/**
 * Ilustrações vetoriais (silhuetas estilizadas, vista superior) das
 * categorias de aeronaves da frota. Não são fotografias reais - são
 * ícones originais desenhados para o piloto de testes, de forma a evitar
 * qualquer questão de direitos de imagem/licenciamento nesta fase.
 *
 * Recomenda-se, em uma fase posterior, substituir por fotos oficiais
 * licenciadas (ex.: acervo público da Agência Força Aérea / FAB) por
 * modelo de aeronave. Ver docs/02-arquitetura-da-solucao.md.
 */
import type { CSSProperties, ReactElement } from "react";

export type SilhouetteKey = "a29" | "gripen" | "f5em" | "amx" | "kc390" | "c130" | "h36" | "generic";

interface Props {
  variant: string;
  size?: number;
  className?: string;
  monochrome?: boolean;
  /**
   * Desenha um fundo claro fixo por trás do ícone, independente do tema
   * (claro/escuro) da aplicação. O ícone é preenchido em azul-marinho sólido
   * e fica com contraste muito baixo sobre superfícies escuras (tema escuro)
   * sem esse fundo. Ativado por padrão; desligue apenas quando o ícone já
   * estiver sobre uma superfície clara garantida (ex.: fundo branco/hero).
   */
  framed?: boolean;
}

function Roundel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#0b6e4f" />
      <circle cx={cx} cy={cy} r={r * 0.66} fill="#ffcc29" />
      <circle cx={cx} cy={cy} r={r * 0.36} fill="#0a1f44" />
    </g>
  );
}

function FighterDelta({ fill }: { fill: string }) {
  // Caça de asa delta (referência estilizada: Gripen)
  return (
    <g fill={fill}>
      <path d="M100 6 L108 46 L172 84 L172 92 L108 74 L104 96 L120 100 L120 104 L80 104 L80 100 L96 96 L92 74 L28 92 L28 84 L92 46 Z" />
      <path d="M96 96 L86 116 L92 118 L100 108 L108 118 L114 116 L104 96 Z" />
      <Roundel cx={100} cy={54} r={7} />
    </g>
  );
}

function FighterTwinTail({ fill }: { fill: string }) {
  // Caça clássico bimotor a jato (referência estilizada: F-5EM)
  return (
    <g fill={fill}>
      <path d="M100 8 L106 50 L168 78 L168 86 L106 66 L106 90 L124 98 L124 102 L76 102 L76 98 L94 90 L94 66 L32 86 L32 78 L94 50 Z" />
      <rect x="90" y="88" width="6" height="16" />
      <rect x="104" y="88" width="6" height="16" />
      <Roundel cx={100} cy={52} r={6.5} />
    </g>
  );
}

function TurbopropAttack({ fill }: { fill: string }) {
  // Ataque turboélice de asa reta (referência estilizada: A-29 Super Tucano)
  return (
    <g fill={fill}>
      <rect x="97" y="4" width="6" height="10" rx="2" />
      <path d="M100 12 L104 78 L176 90 L176 97 L104 88 L104 100 L114 108 L114 112 L86 112 L86 108 L96 100 L96 88 L24 97 L24 90 L96 78 Z" />
      <path d="M92 100 L84 100 L88 88 L92 88 Z" />
      <path d="M108 100 L116 100 L112 88 L108 88 Z" />
      <Roundel cx={100} cy={60} r={7} />
    </g>
  );
}

function AttackJetAMX({ fill }: { fill: string }) {
  // Ataque a jato monomotor (referência estilizada: AMX A-1M)
  return (
    <g fill={fill}>
      <path d="M100 8 L105 58 L170 82 L170 90 L105 74 L107 98 L118 104 L118 108 L82 108 L82 104 L93 98 L95 74 L30 90 L30 82 L95 58 Z" />
      <Roundel cx={100} cy={58} r={6.5} />
    </g>
  );
}

function TransportHighWing({ fill }: { fill: string }) {
  // Transporte militar de asa alta (referência estilizada: KC-390 / C-130)
  return (
    <g fill={fill}>
      <rect x="92" y="6" width="16" height="86" rx="8" />
      <path d="M12 44 L188 44 L188 54 L12 54 Z" />
      <path d="M92 78 L60 108 L60 112 L94 96 Z" />
      <path d="M108 78 L140 108 L140 112 L106 96 Z" />
      <rect x="86" y="90" width="8" height="18" />
      <rect x="106" y="90" width="8" height="18" />
      <Roundel cx={100} cy={30} r={8} />
    </g>
  );
}

function Helicopter({ fill }: { fill: string }) {
  // Helicóptero (referência estilizada: H-36 Caracal)
  return (
    <g fill={fill}>
      <ellipse cx="100" cy="70" rx="18" ry="34" />
      <rect x="98" y="34" width="4" height="10" />
      <rect x="6" y="38" width="188" height="4" rx="2" />
      <path d="M100 96 L100 116" stroke={fill} strokeWidth="4" />
      <rect x="86" y="112" width="28" height="4" rx="2" />
      <rect x="150" y="98" width="4" height="16" />
      <rect x="142" y="96" width="20" height="3" />
      <Roundel cx={100} cy={66} r={9} />
    </g>
  );
}

function GenericJet({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M100 8 L106 60 L165 80 L165 88 L106 72 L106 96 L118 104 L118 108 L82 108 L82 104 L94 96 L94 72 L35 88 L35 80 L94 60 Z" />
      <Roundel cx={100} cy={56} r={7} />
    </g>
  );
}

const VARIANT_MAP: Record<string, (fill: string) => ReactElement> = {
  gripen: (fill) => <FighterDelta fill={fill} />,
  f5em: (fill) => <FighterTwinTail fill={fill} />,
  a29: (fill) => <TurbopropAttack fill={fill} />,
  amx: (fill) => <AttackJetAMX fill={fill} />,
  kc390: (fill) => <TransportHighWing fill={fill} />,
  c130: (fill) => <TransportHighWing fill={fill} />,
  h36: (fill) => <Helicopter fill={fill} />,
  generic: (fill) => <GenericJet fill={fill} />,
};

export default function AircraftSilhouette({ variant, size = 64, className, monochrome, framed = true }: Props) {
  const renderer = VARIANT_MAP[variant] ?? VARIANT_MAP.generic;
  const fill = monochrome ? "currentColor" : "#0a1f44";
  const style: CSSProperties = { display: "block", borderRadius: framed && !monochrome ? 10 : undefined };
  const showFrame = framed && !monochrome;
  return (
    <svg viewBox="0 0 200 120" width={size} height={size * 0.6} className={className} style={style} aria-hidden="true">
      {showFrame && <rect x="0" y="0" width="200" height="120" rx="14" fill="#eef1f6" />}
      {renderer(fill)}
    </svg>
  );
}
