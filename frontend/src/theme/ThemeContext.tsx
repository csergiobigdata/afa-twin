import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** Modo dia/noturno de visualização (ver Sobre → alternância de tema, e a
 * variação de cores por [data-theme] em theme.css). "dark" (noturno)
 * reproduz as cores atuais/históricas do app; "light" (diurno) usa a
 * paleta clara já existente em theme.css (superfícies/formulários mais
 * brancos), pensada para uso em hangar com luz forte. */
export type ThemeMode = "light" | "dark";

const THEME_KEY = "afa_twin_theme";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ambientes sem localStorage (ex.: modo privado) - segue o padrão */
  }
  // Padrão "dark" (noturno): mantém a aparência histórica do app para quem
  // nunca escolheu explicitamente, em vez de seguir o tema do sistema
  // operacional (que poderia trocar a aparência sem aviso).
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ambientes sem localStorage - a troca ainda funciona nesta sessão */
    }
  }, [theme]);

  function setTheme(mode: ThemeMode) {
    setThemeState(mode);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de ThemeProvider");
  return ctx;
}
