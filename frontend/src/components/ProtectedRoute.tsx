import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import SplashScreen from "./SplashScreen";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    // Flash de entrada do aplicativo, exibido enquanto a sessão salva é
    // validada com o servidor (GET /auth/me) antes de liberar o acesso.
    return <SplashScreen />;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
