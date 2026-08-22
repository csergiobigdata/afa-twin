import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AfaTwinMark } from "../components/Layout";
import AircraftSilhouette from "../components/AircraftSilhouette";

const DEMO_USERS = [
  { user: "gestor", label: "Gestor / Responsável Técnico" },
  { user: "piloto", label: "Piloto" },
  { user: "mecanico", label: "Mecânico" },
  { user: "engenheiro", label: "Engenheiro" },
  { user: "cientista", label: "Cientista (P&D)" },
];

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("Usuário ou senha inválidos. Verifique suas credenciais.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, var(--fab-navy-950) 0%, var(--fab-navy-900) 55%, var(--fab-blue-500) 130%)",
      padding: 20,
    }}>
      <div style={{ display: "flex", gap: 0, width: "100%", maxWidth: 940, borderRadius: 20, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{
          flex: 1, background: "rgba(255,255,255,.04)", color: "#fff", padding: "44px 36px",
          display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 280,
        }} className="login-hero">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
              <AfaTwinMark size={44} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 22 }}>AFA-TWIN</div>
                <div style={{ fontSize: 12.5, opacity: 0.8 }}>Gêmeo Digital para Apoio à Decisão<br />em Manutenção Aeronáutica</div>
              </div>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.85, maxWidth: 340 }}>
              Piloto de testes para controle e gerenciamento de manutenção de aeronaves militares —
              desenvolvido para uso conjunto por pilotos, mecânicos, engenheiros e cientistas da
              FAB, ITA e Embraer.
            </p>
          </div>
          <div style={{ display: "flex", gap: 18, opacity: 0.9, flexWrap: "wrap" }}>
            {["gripen", "a29", "f5em", "kc390", "h36"].map((v) => (
              <AircraftSilhouette key={v} variant={v} size={54} monochrome className="text-white" />
            ))}
          </div>
        </div>

        <div style={{ flex: 1, background: "var(--bg-surface)", padding: "44px 36px", minWidth: 300 }}>
          <h1 style={{ fontSize: 20, marginBottom: 4 }}>Acesso ao sistema</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 22 }}>
            Entre com sua matrícula/usuário e senha institucional.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="username">Usuário</label>
              <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                     placeholder="ex.: mecanico" autoComplete="username" required />
            </div>
            <div className="field" style={{ marginBottom: 18 }}>
              <label htmlFor="password">Senha</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                     placeholder="••••••••" autoComplete="current-password" required />
            </div>
            {error && (
              <div className="badge badge-critical" style={{ display: "block", marginBottom: 14, padding: "8px 12px" }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>
              CONTAS DE DEMONSTRAÇÃO (piloto de testes)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DEMO_USERS.map((u) => (
                <button key={u.user} type="button" className="btn btn-outline btn-sm"
                        onClick={() => { setUsername(u.user); setPassword("AfaTwin@2026"); }}>
                  {u.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 8 }}>
              Senha padrão de demonstração: <code>AfaTwin@2026</code>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 760px) { .login-hero { display: none !important; } }
        .text-white { color: #ffffff; }
      `}</style>
    </div>
  );
}
