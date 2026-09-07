import { AfaTwinMark } from "../components/Layout";
import { useTheme } from "../theme/ThemeContext";

const APP_VERSION = "1.2";
const DEVELOPER_NAME = "Walter Vinicius Malwald";

/** Módulo "Sobre": identificação do aplicativo (nome, desenvolvedor, versão
 * fixa) e a alternância de modo dia/noturno de visualização (ver
 * theme/ThemeContext.tsx e a variação de cores por [data-theme] em
 * theme.css) - "Noturno" mantém as cores históricas do app; "Diurno" usa a
 * paleta clara já existente (superfícies/formulários mais brancos),
 * pensada para telas de cadastro/consulta em ambientes com luz forte
 * (ex.: hangar). */
export default function AboutPage() {
  const { theme, setTheme } = useTheme();

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

      <div className="card" style={{ padding: 22 }}>
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
    </div>
  );
}
