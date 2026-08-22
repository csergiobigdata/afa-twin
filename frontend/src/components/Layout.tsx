import type { CSSProperties } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Painel", icon: "📊", end: true },
  { to: "/aeronaves", label: "Aeronaves", icon: "🛩️" },
  { to: "/manutencao", label: "Manutenção", icon: "🔧" },
  { to: "/diagnostico", label: "Diagnóstico", icon: "🩺" },
  { to: "/planejamento", label: "Planejamento", icon: "📈" },
  { to: "/pessoal", label: "Usuários", icon: "🎖️" },
  { to: "/protocolos", label: "Protocolos", icon: "📋" },
  { to: "/auditoria", label: "Auditoria", icon: "🕵️" },
];

export default function Layout() {
  const { username, role, personName, personRank, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          background: "var(--fab-navy-900)", color: "#fff",
          padding: "12px 20px", display: "flex", alignItems: "center", gap: 14,
          position: "sticky", top: 0, zIndex: 20, boxShadow: "var(--shadow-md)",
        }}
      >
        <AfaTwinMark size={36} />
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: ".02em" }}>AFA-TWIN</div>
          <div style={{ fontSize: 11.5, opacity: 0.75 }}>Digital Twin: Manutenção Aeronáutica</div>
        </div>
        <div style={{ flex: 1 }} />
        <Link
          to="/perfil"
          title="Meu Perfil"
          style={{ textAlign: "right", display: "none", textDecoration: "none", color: "#fff" }}
          className="user-info-desktop"
        >
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>👤 {personName ?? username}</div>
          <div style={{ fontSize: 11.5, opacity: 0.75 }}>{personRank ?? role}</div>
        </Link>
        <Link to="/perfil" title="Meu Perfil" className="profile-icon-mobile"
              style={{ color: "#fff", borderColor: "rgba(255,255,255,.35)", textDecoration: "none" }}>
          <span className="btn btn-outline btn-sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>👤</span>
        </Link>
        <button
          className="btn btn-outline btn-sm"
          style={{ color: "#fff", borderColor: "rgba(255,255,255,.35)" }}
          onClick={() => { logout(); navigate("/login"); }}
        >
          Sair
        </button>
      </header>

      <div style={{ flex: 1, display: "flex" }}>
        <nav className="side-nav" style={sideNavStyle}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 10, textDecoration: "none",
                color: isActive ? "#fff" : "var(--text-secondary)",
                background: isActive ? "var(--fab-navy-900)" : "transparent",
                fontWeight: 600, fontSize: 14.5,
              })}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <Link to="/perfil" style={{ marginTop: "auto", padding: 16, fontSize: 11.5, color: "var(--text-secondary)", textDecoration: "none" }}>
            👤 Meu Perfil<br />
            <strong style={{ color: "var(--text-primary)" }}>{personName}</strong><br />
            {personRank ?? role}
          </Link>
        </nav>

        <main style={{ flex: 1, padding: "22px 22px 90px", minWidth: 0 }}>
          <div className="container" style={{ padding: 0 }}>
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="bottom-nav" style={bottomNavStyle}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              textDecoration: "none", color: isActive ? "var(--fab-navy-900)" : "var(--text-secondary)",
              fontSize: 11, fontWeight: 700, flex: 1, padding: "8px 0",
            })}
          >
            <span style={{ fontSize: 19 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <style>{`
        .side-nav { display: none; }
        .bottom-nav { display: flex; }
        .user-info-desktop { display: none; }
        .profile-icon-mobile { display: inline-block; }
        @media (min-width: 860px) {
          .side-nav { display: flex; }
          .bottom-nav { display: none; }
          .user-info-desktop { display: block; }
          .profile-icon-mobile { display: none; }
        }
      `}</style>
    </div>
  );
}

const sideNavStyle: CSSProperties = {
  width: 220, flexShrink: 0, background: "var(--bg-surface)", borderRight: "1px solid var(--border-subtle)",
  padding: 14, flexDirection: "column", gap: 4, position: "sticky", top: 61, height: "calc(100dvh - 61px)",
};

const bottomNavStyle: CSSProperties = {
  position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--bg-surface)",
  borderTop: "1px solid var(--border-subtle)", padding: "4px 6px calc(env(safe-area-inset-bottom) + 4px)",
  zIndex: 20, boxShadow: "0 -2px 10px rgba(0,0,0,.06)",
};

export function AfaTwinMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="20" fill="#0a1f44" />
      <polygon points="50,14 88,50 50,86 12,50" fill="#0b7a3f" />
      <polygon points="50,26 76,50 50,74 24,50" fill="#ffcc29" />
      <circle cx="50" cy="50" r="17" fill="#1c4f9c" />
      <g fill="#f4f6fb" opacity="0.9">
        <circle cx="50" cy="40" r="1" />
        <circle cx="58" cy="46" r="1.3" />
        <circle cx="44" cy="50" r="0.9" />
        <circle cx="53" cy="57" r="1.1" />
      </g>
      <g transform="translate(50 50) rotate(-38) translate(-50 -50)" fill="#f4f6fb" stroke="#0a1f44" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M50 18 L52.3 42 L76 50 L76 53.6 L52.3 48.8 L52.3 62 L60.5 69 L60.5 72 L50 68 L39.5 72 L39.5 69 L47.7 62 L47.7 48.8 L24 53.6 L24 50 L47.7 42 Z" />
      </g>
    </svg>
  );
}
