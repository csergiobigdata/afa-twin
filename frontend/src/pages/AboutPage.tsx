import { useState } from "react";
import { AfaTwinMark } from "../components/Layout";
import { useTheme } from "../theme/ThemeContext";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../api/client";

const APP_VERSION = "1.2";
const DEVELOPER_NAME = "Walter Vinicius da Costa Malwald";

/** Módulo "Sobre": identificação do aplicativo (nome, desenvolvedor, versão
 * fixa) e a alternância de modo dia/noturno de visualização (ver
 * theme/ThemeContext.tsx e a variação de cores por [data-theme] em
 * theme.css) - "Noturno" mantém as cores históricas do app; "Diurno" usa a
 * paleta clara já existente (superfícies/formulários mais brancos),
 * pensada para telas de cadastro/consulta em ambientes com luz forte
 * (ex.: hangar). */
export default function AboutPage() {
  const { theme, setTheme } = useTheme();
  const { role } = useAuth();
  const [resetUsername, setResetUsername] = useState("");
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  async function handleResetPassword() {
    if (!resetUsername.trim()) return;
    setResetBusy(true);
    setResetMsg(null);
    try {
      const res = await api.post<{ detail: string }>(`/admin/reset-password/${encodeURIComponent(resetUsername.trim())}`);
      setResetMsg({ ok: true, text: res.detail });
      setResetUsername("");
    } catch (err) {
      setResetMsg({ ok: false, text: err instanceof ApiError ? err.message : "Falha ao redefinir a senha." });
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Sobre</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 18 }}>
        Identificação do aplicativo e preferências de visualização.
      </p>

      <div className="card" style={{ padding: 22, marginBottom: 18, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <AfaTwinMark size={56} />
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: ".02em" }}>AFA-TWIN</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Gêmeo Digital para Apoio à Decisão em Manutenção Aeronáutica
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 10 }}>
            Desenvolvido por <strong style={{ color: "var(--text-primary)" }}>{DEVELOPER_NAME}</strong>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>
            Versão <strong style={{ color: "var(--text-primary)" }}>{APP_VERSION}</strong>
          </div>
        </div>
      </div>

      {/* Fundo branco fixo (independente do tema atual), a pedido do usuário,
          para destacar melhor os botões Modo Noturno/Modo Diurno - mesmo
          padrão de sobrescrita local das variáveis --text-* usado no painel
          "Engenharia de Confiabilidade" (AircraftDetailPage.tsx), para todo
          texto/borda dos descendentes herdar tons escuros legíveis sobre
          fundo claro sem precisar sobrescrever cada elemento. */}
      <div
        className="card"
        style={{
          padding: 22, background: "#ffffff", color: "#101828",
          ["--text-primary" as string]: "#101828",
          ["--text-secondary" as string]: "#4b5566",
          ["--text-label" as string]: "#101828",
          ["--border-subtle" as string]: "#dde2ea",
        }}
      >
        <h2 style={{ fontSize: 15.5, margin: "0 0 4px" }}>Aparência</h2>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 14, maxWidth: 560 }}>
          Escolha entre o modo noturno (cores atuais do app) e o modo diurno (telas de cadastro e
          consulta com fundo e formulários mais claros/brancos, indicado para ambientes com bastante
          luz, como um hangar). A escolha fica salva neste dispositivo.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn ${theme === "dark" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setTheme("dark")}
          >
            🌙 Modo Noturno
          </button>
          <button
            type="button"
            className={`btn ${theme === "light" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setTheme("light")}
          >
            ☀️ Modo Diurno
          </button>
        </div>
      </div>

      {role === "Gestor / Responsável Técnico" && (
        <div className="card" style={{ padding: 22, marginTop: 18 }}>
          <h2 style={{ fontSize: 15.5, margin: "0 0 4px" }}>Administração — Redefinir senha</h2>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 0, marginBottom: 14, maxWidth: 560 }}>
            Use quando receber o e-mail de "Esqueci minha Senha" da tela de login. Devolve a senha do
            usuário informado ao padrão (usuários de teste voltam para <code>AfaTwin@2026</code>;
            os 2 administradores voltam para <code>Afatwin@2026#</code>).
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="text" value={resetUsername} onChange={(e) => setResetUsername(e.target.value)}
              placeholder="ex.: mecanico" style={{ maxWidth: 220 }}
              onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }}
            />
            <button type="button" className="btn btn-primary" disabled={resetBusy || !resetUsername.trim()} onClick={handleResetPassword}>
              {resetBusy ? "Redefinindo…" : "Redefinir senha"}
            </button>
          </div>
          {resetMsg && (
            <div className={`badge ${resetMsg.ok ? "badge-ok" : "badge-critical"}`} style={{ display: "block", marginTop: 12, padding: "8px 12px" }}>
              {resetMsg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
