/**
 * Flash de entrada do aplicativo: exibido enquanto a sessão é verificada
 * (AuthProvider/ProtectedRoute) e reaproveitado, em versão não-fullscreen,
 * como carregamento do Painel de Apoio à Decisão - substituindo o texto seco
 * "Carregando painel de apoio à decisão…" por algo consistente com a
 * identidade visual do AFA-TWIN (o mesmo caça estilizado do ícone do app,
 * sobrevoando o losango da bandeira, em rota de aproximação/decolagem).
 */
export default function SplashScreen({
  fullscreen = true,
  message = "Acessando dados AFA-Twin ...",
}: {
  fullscreen?: boolean;
  message?: string;
}) {
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
        gap: 22,
        minHeight: fullscreen ? "100vh" : 260,
        width: "100%",
        background: "linear-gradient(160deg, var(--fab-navy-900) 0%, var(--fab-navy-950) 100%)",
        color: "var(--text-inverse)",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="splash-jet-wrap">
        <svg viewBox="0 0 512 512" width={96} height={96} className="splash-jet">
          <defs>
            <linearGradient id="splashJetBody" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f4f6fb" />
              <stop offset="100%" stopColor="#c9d2e2" />
            </linearGradient>
          </defs>
          <polygon points="256,70 442,256 256,442 70,256" fill="#0b7a3f" opacity={0.9} />
          <polygon points="256,132 380,256 256,380 132,256" fill="#ffcc29" opacity={0.9} />
          <circle cx="256" cy="256" r="82" fill="#1c4f9c" opacity={0.9} />
          <g
            transform="translate(256 256) rotate(-38) translate(-256 -256)"
            fill="url(#splashJetBody)"
            stroke="#0a1f44"
            strokeWidth={4}
            strokeLinejoin="round"
          >
            <path
              d="M256 96 L268 214 L392 258 L392 276 L268 250 L268 318 L316 356 L316 372 L256 350
                 L196 372 L196 356 L244 318 L244 250 L120 276 L120 258 L244 214 Z"
            />
            <path d="M244 318 L226 344 L238 348 L256 330 L274 348 L286 344 L268 318 Z" fill="#0a1f44" stroke="none" />
          </g>
        </svg>
        <div className="splash-trail" />
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: ".02em" }}>
          {message}
          <span className="splash-dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--fab-navy-100, #9aa7c2)", marginTop: 6, opacity: 0.85 }}>
          Gêmeo Digital de Manutenção Aeronáutica
        </div>
      </div>

      <style>{`
        .splash-jet-wrap { position: relative; width: 160px; height: 96px; overflow: visible; }
        .splash-jet {
          position: absolute; left: 0; top: 0;
          animation: splash-fly 2.6s ease-in-out infinite;
          filter: drop-shadow(0 6px 14px rgba(0,0,0,0.35));
        }
        .splash-trail {
          position: absolute; left: -40px; top: 46px; width: 90px; height: 3px; border-radius: 2px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55));
          animation: splash-trail 2.6s ease-in-out infinite;
        }
        @keyframes splash-fly {
          0%   { transform: translate(0px, 6px) rotate(-3deg); }
          50%  { transform: translate(28px, -6px) rotate(2deg); }
          100% { transform: translate(0px, 6px) rotate(-3deg); }
        }
        @keyframes splash-trail {
          0%   { transform: translateX(0px); opacity: 0.5; }
          50%  { transform: translateX(28px); opacity: 0.9; }
          100% { transform: translateX(0px); opacity: 0.5; }
        }
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
          .splash-jet, .splash-trail, .splash-dots span { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
