import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Aircraft, ChecklistTemplate, MaintenanceType } from "../api/types";
import { useLookupValues } from "../api/useLookup";
import { PlusIcon } from "../components/Icons";

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
  const [selected, setSelected] = useState<ChecklistTemplate | null>(null);

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
    setSelected((s) => (s?.id === cid ? null : s));
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
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancelar" : <><PlusIcon /> Novo Protocolo</>}</button>
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
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {items.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", padding: 18 }}>Nenhum protocolo cadastrado.</p>
          ) : (
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Protocolo</th>
                    <th>Modelo aplicável</th>
                    <th>Tipo de Manutenção</th>
                    <th>Intervalo</th>
                    <th>Etapas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} onClick={() => setSelected(c)} style={{ cursor: "pointer" }} title="Ver detalhes do protocolo">
                      <td style={{ fontWeight: 700 }}>{c.name}</td>
                      <td style={{ fontSize: 12.5 }}>{c.aircraft_model ?? "Todos os modelos"}</td>
                      <td style={{ fontSize: 12.5, color: "var(--fab-yellow-500)", fontWeight: 600 }}>{c.category}</td>
                      <td style={{ fontSize: 12.5 }}>
                        {c.interval_value ? `a cada ${c.interval_value} ${c.interval_type.toLowerCase()}` : "—"}
                      </td>
                      <td style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{c.items.length} etapa(s)</td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={(ev) => { ev.stopPropagation(); remove(c.id); }}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selected && (
        <div
          role="dialog" aria-modal="true"
          onClick={() => setSelected(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(6,15,36,0.78)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: "100%", maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{selected.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--fab-pink-500)", fontWeight: 600, marginTop: 2 }}>
                  {selected.aircraft_model ?? "Todos os modelos"}
                  {selected.interval_value ? ` · a cada ${selected.interval_value} ${selected.interval_type.toLowerCase()}` : ""}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--fab-yellow-500)", marginTop: 2, fontWeight: 600 }}>{selected.category}</div>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>Fechar ✕</button>
            </div>
            <div style={{ padding: 20 }}>
              {selected.reference_doc && (
                <div style={{ fontSize: 12.5, color: "var(--fab-yellow-500)", fontWeight: 600, marginBottom: 12 }}>
                  📄 {selected.reference_doc}
                </div>
              )}
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-label)", marginBottom: 6 }}>
                Etapas do checklist
              </div>
              {selected.items.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Nenhuma etapa cadastrada.</p>
              ) : (
                <ol style={{ paddingLeft: 20, fontSize: 13.5 }}>
                  {selected.items.map((it, i) => <li key={i} style={{ marginBottom: 6 }}>{it}</li>)}
                </ol>
              )}
            </div>
            <div style={{ padding: "0 20px 20px" }}>
              <button className="btn btn-outline btn-sm" onClick={() => remove(selected.id)}>Remover protocolo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
