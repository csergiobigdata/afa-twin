import { useEffect, useRef, useState } from "react";
import type { AuthorizedConfiguration } from "../api/types";
import AuthorizedConfigSymbol from "./AuthorizedConfigSymbol";

/** Seletor de "Configuração" (Configuração Autorizada) com o símbolo de
 * cada equipamento visível nas opções - um <select> nativo não consegue
 * exibir um ícone por item de forma confiável entre navegadores, por isso
 * este é um combobox próprio (botão + lista sobreposta), usado no
 * lançamento manual de disponibilidade (ver AvailabilityPage) para
 * facilitar a identificação visual do equipamento na hora de escolher. */
export default function AuthorizedConfigSelect({
  options, value, onChange, placeholder = "— LISO —",
}: {
  options: AuthorizedConfiguration[];
  value: string;
  onChange: (equipment: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const selected = options.find((o) => o.equipment === value);

  function pick(equipment: string) {
    onChange(equipment);
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button" className="btn btn-outline btn-sm" onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox" aria-expanded={open}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 190, fontWeight: 400 }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
          {selected && <AuthorizedConfigSymbol svg={selected.symbol_svg} size={17} />}
          <span style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selected ? selected.equipment : placeholder}
          </span>
        </span>
        <span aria-hidden style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>

      {open && (
        <div
          role="listbox" className="card"
          style={{
            position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, minWidth: 260,
            maxHeight: 280, overflowY: "auto", padding: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          <button
            type="button" role="option" aria-selected={value === ""} onClick={() => pick("")}
            style={{
              display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "7px 8px",
              background: value === "" ? "var(--bg-surface-alt)" : "transparent", border: "none",
              borderRadius: 6, cursor: "pointer", fontSize: 12.5, textAlign: "left", color: "var(--text-primary)",
            }}
          >
            {placeholder}
          </button>
          {options.map((o) => (
            <button
              key={o.id} type="button" role="option" aria-selected={value === o.equipment} onClick={() => pick(o.equipment)}
              style={{
                display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "7px 8px",
                background: value === o.equipment ? "var(--bg-surface-alt)" : "transparent", border: "none",
                borderRadius: 6, cursor: "pointer", fontSize: 12.5, textAlign: "left", color: "var(--text-primary)",
              }}
            >
              <AuthorizedConfigSymbol svg={o.symbol_svg} size={18} />
              {o.equipment}
            </button>
          ))}
          {options.length === 0 && (
            <div style={{ padding: "8px", fontSize: 12, color: "var(--text-secondary)" }}>
              Nenhuma configuração ativa cadastrada.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
