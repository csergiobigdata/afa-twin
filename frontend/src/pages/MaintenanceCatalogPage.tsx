import { useState } from "react";
import type { LookupCategory } from "../api/types";
import LookupManager from "../components/LookupManager";

const TABS: { key: LookupCategory; icon: string; hint: string }[] = [
  { key: "Componente Associado (padrão)", icon: "⚙️", hint: "Nomes padronizados de peças/componentes, para agilizar o cadastro" },
  { key: "Tipo de Intervalo de Manutenção", icon: "⏱️", hint: "Horas de Voo, Dias Corridos, Ciclos…" },
  { key: "Categoria de Alerta de Manutenção Preventiva", icon: "🔔", hint: "Categorias usadas no gráfico do Painel (item 7)" },
];

const MAINTENANCE_TYPES = [
  "Inspeção de Rotina", "Preventiva Programada", "Corretiva",
  "Boletim Técnico (AD/SB)", "Overhaul / Grande Reparo", "Modificação / Modernização",
];
const TIPO_MANUTENCAO = "Tipo de Manutenção" as LookupCategory;

export default function MaintenanceCatalogPage() {
  const [active, setActive] = useState<LookupCategory>(TABS[0].key);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Cadastro de Manutenção</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 18, maxWidth: 700 }}>
        Cadastros auxiliares usados ao registrar uma Ordem de Serviço ou um Protocolo de manutenção.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button className={`btn btn-sm ${active === TIPO_MANUTENCAO ? "btn-primary" : "btn-outline"}`}
                onClick={() => setActive(TIPO_MANUTENCAO)}>
          🔒 Tipo de Manutenção
        </button>
        {TABS.map((t) => (
          <button key={t.key} className={`btn btn-sm ${active === t.key ? "btn-primary" : "btn-outline"}`}
                  title={t.hint} onClick={() => setActive(t.key)}>
            {t.icon} {t.key}
          </button>
        ))}
      </div>

      {active === TIPO_MANUTENCAO ? (
        <div className="card" style={{ padding: 18 }}>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 12 }}>
            "Tipo de Manutenção" é um valor fixo do sistema, usado igualmente na Ordem de Serviço e no
            Protocolo — os dois sempre usam exatamente a mesma lista, para garantir consistência entre
            cadastro e consulta.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MAINTENANCE_TYPES.map((t) => <span key={t} className="badge badge-info">{t}</span>)}
          </div>
        </div>
      ) : (
        <LookupManager category={active} />
      )}
    </div>
  );
}
