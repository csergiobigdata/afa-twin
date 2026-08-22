import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "../api/client";
import type { AuthResponse, PersonRole } from "../api/types";

interface AuthState {
  username: string | null;
  role: PersonRole | null;
  personName: string | null;
  personRank: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api.get<AuthResponse>("/auth/me")
      .then(setAuth)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(() => ({
    username: auth?.username ?? null,
    role: auth?.role ?? null,
    personName: auth?.person?.full_name ?? null,
    personRank: auth?.person?.rank ?? null,
    isAuthenticated: !!auth,
    loading,
    login: async (username: string, password: string) => {
      const res = await api.post<AuthResponse>("/auth/login", { username, password });
      setToken(res.access_token);
      setAuth(res);
    },
    logout: () => {
      setToken(null);
      setAuth(null);
    },
  }), [auth, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export const ROLE_PERMISSIONS = {
  canDeleteAircraft: (role: PersonRole | null) => role === "Gestor / Responsável Técnico" || role === "Engenheiro",
  canDeletePerson: (role: PersonRole | null) => role === "Gestor / Responsável Técnico",
  canManageRecords: (role: PersonRole | null) =>
    role === "Gestor / Responsável Técnico" || role === "Engenheiro" || role === "Mecânico",
};
