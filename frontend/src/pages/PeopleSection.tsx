import { NavLink, Outlet } from "react-router-dom";

const SUB_TABS = [
  { to: "/pessoal/usuarios", label: "Usuários", icon: "🎖️", hint: "Cadastro individual: pilotos, mecânicos, engenheiros, cientistas" },
  { to: "/pessoal/grupos", label: "Grupos", icon: "👥", hint: "Equipes responsáveis por uma ou mais aeronaves" },
  { to: "/pessoal/cadastros", label: "Cadastros Auxiliares", icon: "🗂️", hint: "Organização, Posto/Graduação, Especialidade, Esquadrão" },
];

export default function PeopleSection() {
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
