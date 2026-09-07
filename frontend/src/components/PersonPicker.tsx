import { useEffect, useRef, useState } from "react";
import type { Person, PersonRole } from "../api/types";

const PERSON_ROLES: PersonRole[] = ["Piloto", "Mecânico", "Engenheiro", "Cientista", "Gestor / Responsável Técnico"];

function personLabel(p: Person): string {
  return `${p.rank ? `${p.rank} - ` : ""}${p.full_name}`;
}

/** Seletor de Pessoa por nome/sobrenome (digitação, filtra em tempo real),
 * com um filtro adicional por cargo/função (PersonRole) para restringir a
 * lista às pessoas daquele cargo antes de escolher - usado em "Vínculos
 * individuais" (ver AircraftDetailPage.tsx) no lugar de um <select> com
 * todas as pessoas listadas de uma vez. Ao escolher, entrega a Person
 * inteira (não só o id) para o chamador poder pré-preencher outros campos
 * (ex.: Função na aeronave) a partir do cargo dela. */
export default function PersonPicker({
  people, selected, onSelect, placeholder = "Digite o nome ou sobrenome…",
}: {
  people: Person[];
  selected: Person | null;
  onSelect: (person: Person | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<PersonRole | "">("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const filtered = people.filter((p) => {
    const matchRole = !roleFilter || p.role === roleFilter;
    const matchQuery = !query.trim() || p.full_name.toLowerCase().includes(query.trim().toLowerCase());
    return matchRole && matchQuery;
  });

  function pick(p: Person) {
    onSelect(p);
    setQuery("");
    setOpen(false);
  }

  function clearSelection() {
    onSelect(null);
    setQuery("");
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          value={selected && !open ? personLabel(selected) : query}
          onFocus={() => { setOpen(true); if (selected) { setQuery(""); onSelect(null); } }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder={placeholder}
          style={{ minWidth: 220 }}
          autoComplete="off"
        />
        <select
          value={roleFilter} title="Filtrar por cargo/função"
          onChange={(e) => setRoleFilter(e.target.value as PersonRole | "")}
          style={{ maxWidth: 150 }}
        >
          <option value="">Todos os cargos</option>
          {PERSON_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {open && (
        <div
          role="listbox" className="card"
          style={{
            position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, minWidth: 280,
            maxHeight: 260, overflowY: "auto", padding: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {selected && (
            <button
              type="button" onClick={clearSelection}
              style={{ display: "block", width: "100%", padding: "6px 8px", background: "transparent", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, textAlign: "left", color: "var(--text-secondary)" }}
            >
              ✕ Limpar seleção
            </button>
          )}
          {filtered.map((p) => (
            <button
              key={p.id} type="button" role="option" onClick={() => pick(p)}
              style={{
                display: "block", width: "100%", padding: "7px 8px",
                background: "transparent", border: "none", borderRadius: 6, cursor: "pointer",
                fontSize: 12.5, textAlign: "left", color: "var(--text-primary)",
              }}
            >
              {personLabel(p)} <span style={{ color: "var(--text-secondary)" }}>({p.role})</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "8px", fontSize: 12, color: "var(--text-secondary)" }}>
              Nenhuma pessoa encontrada.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
