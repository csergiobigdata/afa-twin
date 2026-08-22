import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { LookupCategory, LookupItem } from "../api/types";

/** Gerenciador genérico de um cadastro auxiliar (listbox editável): usado
 * tanto em "Usuários → Cadastros" quanto em "Manutenção → Cadastro de
 * Manutenção", reaproveitando a mesma lógica de listar/adicionar/
 * ativar-inativar/remover itens de uma categoria de LookupItem. */
export default function LookupManager({ category, placeholder }: { category: LookupCategory; placeholder?: string }) {
  const [items, setItems] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  function reload() {
    api.get<LookupItem[]>(`/lookups?category=${encodeURIComponent(category)}&include_inactive=true`)
      .then(setItems).finally(() => setLoading(false));
  }
  useEffect(reload, [category]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!newValue.trim()) return;
    setSaving(true);
    try {
      await api.post("/lookups", { category, value: newValue.trim() });
      setNewValue("");
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: LookupItem) {
    await api.put(`/lookups/${item.id}`, { active: !item.active });
    reload();
  }

  async function remove(item: LookupItem) {
    if (!confirm(`Remover "${item.value}" deste cadastro?`)) return;
    await api.del(`/lookups/${item.id}`);
    reload();
  }

  if (loading) return <p>Carregando…</p>;

  return (
    <div>
      <form onSubmit={add} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={newValue} onChange={(e) => setNewValue(e.target.value)}
               placeholder={placeholder ?? `Novo item de "${category}"…`} style={{ maxWidth: 340 }} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>+ Adicionar</button>
      </form>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => (
          <div key={item.id} className="card" style={{ padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13.5, opacity: item.active ? 1 : 0.5 }}>{item.value}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <span className={`badge ${item.active ? "badge-ok" : "badge-neutral"}`} style={{ cursor: "pointer" }} onClick={() => toggleActive(item)}>
                {item.active ? "Ativo" : "Inativo"}
              </span>
              <button className="btn btn-outline btn-sm" onClick={() => remove(item)}>Remover</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Nenhum item cadastrado.</p>}
      </div>
    </div>
  );
}
