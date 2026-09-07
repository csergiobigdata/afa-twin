import { useState } from "react";
import type { LookupCategory } from "../api/types";
import LookupManager from "../components/LookupManager";

const CATEGORIES: { key: LookupCategory; icon: string; hint: string }[] = [
  { key: "Organização", icon: "🏛️", hint: "FAB, ITA, Embraer e outras organizações parceiras" },
  { key: "Posto / Graduação / Cargo", icon: "🎖️", hint: "Postos e graduações militares, ou cargos civis" },
  { key: "Especialidade", icon: "🛠️", hint: "Especialidades técnicas de pilotos, mecânicos, engenheiros e cientistas" },
  { key: "Esquadrão / Unidade", icon: "🛩️", hint: "Esquadrões, grupos de aviação e unidades" },
];

const SYSTEM_ROLES = ["Piloto", "Mecânico", "Engenheiro", "Cientista", "Gestor / Responsável Técnico"];
const FUNCAO = "Função" as LookupCategory;

export default function LookupsPage() {
  const [active, setActive] = useState<LookupCategory>("Organização");

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Cadastros Auxiliares</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 18, maxWidth: 680 }}>
        Listas usadas como opção de seleção (listbox) nos formulários de Usuários. Adicione novos itens
        conforme a necessidade da sua organização.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => (
          <button key={c.key} className={`btn btn-sm ${active === c.key ? "btn-primary" : "btn-outline"}`}
                  title={c.hint} onClick={() => setActive(c.key)}>
            {c.icon} {c.key}
          </button>
        ))}
        <button className={`btn btn-sm ${active === FUNCAO ? "btn-primary" : "btn-outline"}`} onClick={() => setActive(FUNCAO)}>
          🔒 Função
        </button>
      </div>

      {active === FUNCAO ? (
        <div className="card" style={{ padding: 18 }}>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
            "Função" é um papel fixo do sistema (não editável aqui) porque determina permissões de
            acesso e regras de negócio (ex.: quem pode excluir cadastros). Para adicionar uma nova
            função seria necessário também definir suas permissões — uma alteração de código, não
            apenas de cadastro.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SYSTEM_ROLES.map((r) => <span key={r} className="badge badge-info">{r}</span>)}
          </div>
        </div>
      ) : (
        <LookupManager category={active} />
      )}
    </div>
  );
}
