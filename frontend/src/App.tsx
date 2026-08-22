import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AircraftSection from "./pages/AircraftSection";
import AircraftListPage from "./pages/AircraftListPage";
import AircraftSearchPage from "./pages/AircraftSearchPage";
import AircraftFormPage from "./pages/AircraftFormPage";
import AircraftDetailPage from "./pages/AircraftDetailPage";
import PeopleSection from "./pages/PeopleSection";
import PeoplePage from "./pages/PeoplePage";
import GroupsPage from "./pages/GroupsPage";
import LookupsPage from "./pages/LookupsPage";
import MyProfilePage from "./pages/MyProfilePage";
import MaintenanceSection from "./pages/MaintenanceSection";
import MaintenancePage from "./pages/MaintenancePage";
import MaintenanceFormPage from "./pages/MaintenanceFormPage";
import MaintenanceCatalogPage from "./pages/MaintenanceCatalogPage";
import ChecklistsPage from "./pages/ChecklistsPage";
import DiagnosticsPage from "./pages/DiagnosticsPage";
import PlanningPage from "./pages/PlanningPage";
import AuditPage from "./pages/AuditPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/aeronaves" element={<AircraftSection />}>
              <Route index element={<Navigate to="cadastro" replace />} />
              <Route path="cadastro" element={<AircraftListPage />} />
              <Route path="pesquisa" element={<AircraftSearchPage />} />
            </Route>
            <Route path="/aeronaves/novo" element={<AircraftFormPage mode="create" />} />
            <Route path="/aeronaves/:id" element={<AircraftDetailPage />} />
            <Route path="/aeronaves/:id/editar" element={<AircraftFormPage mode="edit" />} />
            <Route path="/perfil" element={<MyProfilePage />} />
            <Route path="/pessoal" element={<PeopleSection />}>
              <Route index element={<Navigate to="usuarios" replace />} />
              <Route path="usuarios" element={<PeoplePage />} />
              <Route path="grupos" element={<GroupsPage />} />
              <Route path="cadastros" element={<LookupsPage />} />
            </Route>
            <Route path="/manutencao" element={<MaintenanceSection />}>
              <Route index element={<Navigate to="ordens" replace />} />
              <Route path="ordens" element={<MaintenancePage />} />
              <Route path="cadastro" element={<MaintenanceCatalogPage />} />
            </Route>
            <Route path="/manutencao/nova" element={<MaintenanceFormPage />} />
            <Route path="/manutencao/:id" element={<MaintenanceFormPage />} />
            <Route path="/diagnostico" element={<DiagnosticsPage />} />
            <Route path="/planejamento" element={<PlanningPage />} />
            <Route path="/protocolos" element={<ChecklistsPage />} />
            <Route path="/auditoria" element={<AuditPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
