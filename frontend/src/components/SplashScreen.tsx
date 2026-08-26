/**
 * Flash de entrada do aplicativo: exibido enquanto a sessão é verificada
 * (AuthProvider/ProtectedRoute) e reaproveitado, em versão não-fullscreen,
 * como carregamento do Painel de Apoio à Decisão - substituindo o texto seco
 * "Carregando painel de apoio à decisão…" por algo consistente com a
 * identidade visual do AFA-TWIN.
 *
 * A silhueta é uma representação estilizada (não fotográfica) de um A-29
 * Super Tucano em perfil - cores de camuflagem FAB (verde-oliva/bege) e
 * cauda azul com friso amarelo/verde -, sem matrícula específica (é só
 * decoração de carregamento, não um dado da frota). Anima com um
 * deslocamento horizontal contínuo da esquerda para a direita, simulando o
 * avião "voando" através da tela.
 */
export default function SplashScreen({
  fullscreen = true,
  message = "Acessando dados AFA-Twin",
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
        gap: 30,
        minHeight: fullscreen ? "100vh" : 460,
        width: "100%",
        background: "linear-gradient(160deg, var(--fab-navy-900) 0%, var(--fab-navy-950) 100%)",
        color: "var(--text-inverse)",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="splash-jet-wrap">
        <svg viewBox="0 0 340 120" width={220} height={78} className="splash-jet" aria-hidden="true">
          <defs>
            <linearGradient id="splashFuselage" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#748259" />
              <stop offset="100%" stopColor="#9aa08a" />
            </linearGradient>
            <linearGradient id="splashStripe" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffcc29" />
              <stop offset="100%" stopColor="#0b7a3f" />
            </linearGradient>
          </defs>

          {/* O avião é desenhado com o nariz do lado esquerdo (x baixo) e a
              cauda do lado direito (x alto) - mas a animação desloca o
              elemento inteiro da esquerda para a direita (CSS `left`
              crescente), o que faria o lado de MAIOR x (a cauda) liderar o
              movimento, parecendo voar de marcha à ré. Espelhamos tudo
              horizontalmente aqui para o nariz liderar corretamente. */}
          <g transform="scale(-1,1) translate(-340,0)">
            {/* rastro/esteira atrás do avião */}
            <rect x="-40" y="57" width="55" height="3" rx="1.5" fill="rgba(255,255,255,0.35)" />
            <rect x="-70" y="59" width="35" height="2" rx="1" fill="rgba(255,255,255,0.2)" />

            {/* asa baixa (desenhada antes da fuselagem, para ficar por baixo) + tanques subalares
                pendurados por hastes finas - propositalmente destacados da fuselagem para não
                serem confundidos com trem de pouso */}
            <path d="M145,68 L205,68 L182,110 L128,110 Z" fill="#4a5738" stroke="#0a1f44" strokeWidth={1.5} />
            <line x1="140" y1="108" x2="140" y2="118" stroke="#0a1f44" strokeWidth={1.5} />
            <ellipse cx="140" cy="123" rx="11" ry="5.5" fill="#c9d2e2" stroke="#0a1f44" strokeWidth={1} />
            <line x1="188" y1="104" x2="188" y2="112" stroke="#0a1f44" strokeWidth={1.5} opacity={0.85} />
            <ellipse cx="188" cy="116" rx="9" ry="4.5" fill="#aab6cc" stroke="#0a1f44" strokeWidth={1} opacity={0.85} />

            {/* estabilizador horizontal */}
            <path d="M286,55 L318,60 L288,65 Z" fill="url(#splashFuselage)" stroke="#0a1f44" strokeWidth={1.5} />

            {/* deriva (cauda vertical) - azul com friso diagonal, como o exemplo de referência */}
            <path d="M268,40 C280,20 300,13 313,17 L317,60 C302,53 282,49 268,40 Z" fill="#173b74" stroke="#0a1f44" strokeWidth={1.5} />
            <path d="M281,23 L292,20 L301,38 L290,41 Z" fill="url(#splashStripe)" />
            <circle cx="279" cy="45" r="5" fill="#0b7a3f" stroke="#0a1f44" strokeWidth={0.75} />
            <circle cx="279" cy="45" r="3.1" fill="#ffcc29" />
            <circle cx="279" cy="45" r="1.4" fill="#1c4f9c" />

            {/* fuselagem */}
            <path
              d="M18,60 C26,45 55,37 100,35 C160,32 232,36 287,50 C302,54 313,58 317,60
                 C313,63 297,68 271,72 C221,80 150,84 95,80 C55,77 28,70 18,60 Z"
              fill="url(#splashFuselage)" stroke="#0a1f44" strokeWidth={1.5}
            />

            {/* bolha da canópia (dois postos, piloto + instrutor) */}
            <path d="M104,37 C116,26 160,25 174,35 C178,42 176,48 165,49 C140,51 116,49 106,45 C102,43 101,40 104,37 Z"
                  fill="#141b24" opacity={0.92} stroke="#3a4658" strokeWidth={1} />
            <line x1="140" y1="27" x2="140" y2="48" stroke="#3a4658" strokeWidth={1} opacity={0.7} />

            {/* nariz + hélice (par de pás + disco de desfoque, simulando rotação) */}
            <circle cx="12" cy="59" r="4.5" fill="#22282f" />
            <g className="splash-prop" style={{ transformOrigin: "12px 59px" }}>
              <ellipse cx="12" cy="59" rx="3" ry="32" fill="#cfd8e6" opacity={0.4} />
              <line x1="12" y1="28" x2="12" y2="90" stroke="#e8edf5" strokeWidth={2} opacity={0.85} />
              <line x1="-19" y1="59" x2="43" y2="59" stroke="#e8edf5" strokeWidth={2} opacity={0.55} />
            </g>
          </g>
        </svg>
      </div>

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
      </div>

      <style>{`
        .splash-jet-wrap { position: relative; width: min(92%, 900px); height: 140px; overflow: hidden; }
        .splash-jet {
          position: absolute; top: 50%; left: -30%;
          margin-top: -39px;
          animation: splash-fly 4.5s linear infinite;
          filter: drop-shadow(0 8px 16px rgba(0,0,0,0.4));
        }
        @keyframes splash-fly {
          0%   { left: -30%; }
          100% { left: 115%; }
        }
        .splash-prop { animation: splash-prop-spin 0.15s linear infinite; }
        @keyframes splash-prop-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
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
          .splash-jet { animation: none !important; left: 20% !important; }
          .splash-prop, .splash-dots span { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
