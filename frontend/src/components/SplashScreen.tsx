import { useEffect, useState } from "react";
import FlyingJet from "./FlyingJet";

/**
 * Flash de entrada do aplicativo: exibido enquanto a sessão é verificada
 * (AuthProvider/ProtectedRoute) e reaproveitado, em versão não-fullscreen,
 * como carregamento do Painel de Apoio à Decisão - substituindo o texto seco
 * "Carregando painel de apoio à decisão…" por algo consistente com a
 * identidade visual do AFA-TWIN.
 *
 * A animação é a foto real de um A-29 Super Tucano da esquadrilha (ver
 * FlyingJet), deslocando-se da esquerda para a direita, simulando a
 * aeronave "voando" através da tela.
 */
export default function SplashScreen({
  fullscreen = true,
  message = "Acessando dados AFA-Twin",
}: {
  fullscreen?: boolean;
  message?: string;
}) {
  // Depois de alguns segundos, soma uma dica sobre o motivo mais provável de
  // uma demora maior: o plano gratuito de nuvem "dorme" o servidor/banco
  // depois de um tempo sem uso, e a primeira chamada depois disso acorda os
  // dois (~10s medidos, ver docs/02, seção 3.2) - sem essa dica, uma tela
  // "Carregando..." parada por vários segundos parece travada/quebrada.
  const [showSlowHint, setShowSlowHint] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowSlowHint(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: fullscreen ? "fixed" : "static",
        inset: fullscreen ? 0 : undefined,
        zIndex: fullscreen ? 9999 : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 30,
        minHeight: fullscreen ? "100vh" : 460,
        width: "100%",
        background: "linear-gradient(160deg, var(--fab-navy-900) 0%, var(--fab-navy-950) 100%)",
        color: "var(--text-inverse)",
      }}
      role="status"
      aria-live="polite"
    >
      <FlyingJet width={220} trackHeight={140} durationS={4.5} />

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: ".02em" }}>
          {message}
          <span className="splash-dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--fab-navy-100, #9aa7c2)", marginTop: 7, opacity: 0.85 }}>
          Gêmeo Digital de Manutenção Aeronáutica
        </div>
        {showSlowHint && (
          <div style={{ fontSize: 12.5, color: "var(--fab-yellow-500)", marginTop: 12, maxWidth: 340, opacity: 0.95 }}>
            Demorando mais que o normal? O servidor gratuito "acorda" após um período sem uso — costuma
            levar só alguns segundos a mais na primeira vez.
          </div>
        )}
      </div>

      <style>{`
        .splash-dots span {
          display: inline-block; animation: splash-blink 1.4s infinite;
          opacity: 0;
        }
        .splash-dots span:nth-child(2) { animation-delay: .2s; }
        .splash-dots span:nth-child(3) { animation-delay: .4s; }
        @keyframes splash-blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .splash-dots span { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
