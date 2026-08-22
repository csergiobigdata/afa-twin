import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Aircraft, ChecklistTemplate, MaintenanceType } from "../api/types";
import { useLookupValues } from "../api/useLookup";

const TYPES: MaintenanceType[] = [
  "Inspeção de Rotina", "Preventiva Programada", "Corretiva", "Boletim Técnico (AD/SB)", "Overhaul / Grande Reparo", "Modificação / Modernização",
];

const EMPTY = { name: "", aircraft_model: "", interval_type: "", interval_value: "", reference_doc: "", category: "Inspeção de Rotina" as MaintenanceType, itemsText: "" };

export default function ChecklistsPage() {
  const [items, setItems] = useState<ChecklistTemplate[]>([]);
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const intervalTypes = useLookupValues("Tipo de Intervalo de Manutenção");
  const aircraftModels = useMemo(() => Array.from(new Set(fleet.map((a) => a.model))).sort(), [fleet]);

  function reload() {
    Promise.all([
      api.get<ChecklistTemplate[]>("/checklists"),
      api.get<Aircraft[]>("/aircraft"),
    ]).then(([c, f]) => { setItems(c); setFleet(f); }).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/checklists", {
        name: form.name, aircraft_model: form.aircraft_model || null, interval_type: form.interval_type || "Horas de Voo",
        interval_value: form.interval_value ? Number(form.interval_value) : null, reference_doc: form.reference_doc || null,
        category: form.category, items: form.itemsText.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      setForm(EMPTY);
      setShowForm(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function remove(cid: number) {
    if (!confirm("Remover este protocolo?")) return;
    await api.del(`/checklists/${cid}`);
    reload();
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>Protocolos e Checklists de Manutenção</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Modelos reutilizáveis de inspeção — referência para padronizar procedimentos rigorosos conforme AMM/ICA e boletins técnicos.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancelar" : "+ Novo Protocolo"}</button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card" style={{ padding: 22, marginBottom: 20 }}>
          <div className="form-grid">
            <div className="field field-full">
              <label>Nome do protocolo *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Inspeção de 100 horas - Turboélice" />
            </div>
            <div className="field">
              <label>Modelo de aeronave aplicável</label>
              <select value={form.aircraft_model} onChange={(e) => setForm({ ...form, aircraft_model: e.target.value })}>
                <option value="">Todos os modelos</option>
                {aircraftModels.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Tipo de Manutenção</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as MaintenanceType })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Tipo de Intervalo de Manutenção</label>
              <select value={form.interval_type} onChange={(e) => setForm({ ...form, interval_type: e.target.value })}>
                <option value="">Selecione…</option>
                {intervalTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Valor do intervalo</label>
              <input type="number" value={form.interval_value} onChange={(e) => setForm({ ...form, interval_value: e.target.value })} placeholder="100" />
            </div>
            <div className="field field-full">
              <label>Documento de referência</label>
              <input value={form.reference_doc} onChange={(e) => setForm({ ...form, reference_doc: e.target.value })} placeholder="AMM Cap. 05 / ICA de Manutenção" />
            </div>
            <div className="field field-full">
              <label>Etapas do checklist (uma por linha)</label>
              <textarea rows={6} value={form.itemsText} onChange={(e) => setForm({ ...form, itemsText: e.target.value })}
                        placeholder={"Verificar níveis de fluido hidráulico\nInspecionar pneus e freios\n..."} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={saving}>{saving ? "Salvando…" : "Salvar Protocolo"}</button>
        </form>
      )}

      {loading ? <p>Carregando…</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {items.map((c) => (
            <div key={c.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    {c.aircraft_model ?? "Todos os modelos"} · a cada {c.interval_value} {c.interval_type.toLowerCase()}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--fab-blue-500)", marginTop: 2 }}>{c.category}</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => remove(c.id)}>Remover</button>
              </div>
              {c.reference_doc && <div style={{ fontSize: 12, color: "var(--fab-blue-500)", marginTop: 6, fontWeight: 600 }}>{c.reference_doc}</div>}
              <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 13 }}>
                {c.items.map((it, i) => <li key={i} style={{ marginBottom: 4 }}>{it}</li>)}
              </ul>
            </div>
          ))}
          {items.length === 0 && <p style={{ color: "var(--text-secondary)" }}>Nenhum protocolo cadastrado.</p>}
        </div>
      )}
    </div>
  );
}
