import { NavLink, Outlet } from "react-router-dom";

const SUB_TABS = [
  { to: "/aeronaves/cadastro", label: "Cadastro", icon: "📋", hint: "Lista administrativa: gerenciar, editar e excluir registros" },
  { to: "/aeronaves/pesquisa", label: "Pesquisa", icon: "🔍", hint: "Busca visual pelo modelo, com foto de cada aeronave" },
];

export default function AircraftSection() {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {SUB_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            title={tab.hint}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 18px", borderRadius: 999, textDecoration: "none",
              fontWeight: 700, fontSize: 14,
              background: isActive ? "var(--fab-navy-900)" : "var(--bg-surface)",
              color: isActive ? "#fff" : "var(--text-primary)",
              border: "1px solid " + (isActive ? "var(--fab-navy-900)" : "var(--border-subtle)"),
            })}
          >
            <span>{tab.icon}</span> {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
