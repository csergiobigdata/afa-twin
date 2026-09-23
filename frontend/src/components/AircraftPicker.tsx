import { useEffect, useRef, useState } from "react";
import type { Aircraft } from "../api/types";

function aircraftLabel(a: Aircraft): string {
  return `${a.tail_number} · ${a.model}`;
}

/** Seletor de Aeronave por matrícula/modelo (digitação, filtra em tempo
 * real) - usado em Disponibilidade (Cadastro de Configuração e
 * Configurações Autorizadas) no lugar de um <select> com toda a frota
 * listada de uma vez, para localizar mais rápido numa frota grande.
 * `selectedId` segue o mesmo formato de id-string já usado nesses lugares
 * (string vazia = nada selecionado). */
export default function AircraftPicker({
  fleet, selectedId, onSelect, placeholder = "Digite a matrícula ou modelo…",
}: {
  fleet: Aircraft[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = fleet.find((a) => String(a.id) === selectedId) ?? null;

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const filtered = fleet.filter((a) => {
    const q = query.trim().toLowerCase();
    return !q || a.tail_number.toLowerCase().includes(q) || a.model.toLowerCase().includes(q);
  });

  function pick(a: Aircraft) {
    onSelect(String(a.id));
    setQuery("");
    setOpen(false);
  }

  function clearSelection() {
    onSelect("");
    setQuery("");
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={selected && !open ? aircraftLabel(selected) : query}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        style={{ minWidth: 220 }}
        autoComplete="off"
      />
      {open && (
        <div
          role="listbox" className="card"
          style={{
            position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, minWidth: 260,
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
          {filtered.map((a) => (
            <button
              key={a.id} type="button" role="option" onClick={() => pick(a)}
              style={{
                display: "block", width: "100%", padding: "7px 8px",
                background: "transparent", border: "none", borderRadius: 6, cursor: "pointer",
                fontSize: 12.5, textAlign: "left", color: "var(--text-primary)",
              }}
            >
              {aircraftLabel(a)}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "8px", fontSize: 12, color: "var(--text-secondary)" }}>
              Nenhuma aeronave encontrada.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
