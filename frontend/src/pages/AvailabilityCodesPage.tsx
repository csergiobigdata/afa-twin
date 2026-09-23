import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { AvailabilityCodeCatalog } from "../api/types";

/** Cadastro de Códigos de Disponibilidade (DI/DO/IN/IS de fábrica,
 * extensível) - código de 2 caracteres + descrição de até 40, alimenta os
 * seletores "Código" e o reconhecimento do texto colado em Disponibilidade.
 * Ver models.py::AvailabilityCodeCatalog. Tela própria (antes era uma seção
 * dentro de Configurações Autorizadas) para ficar acessível direto pelo
 * botão "Códigos de Disponibilidade" em Aeronaves. */
export default function AvailabilityCodesPage() {
  const [availabilityCodes, setAvailabilityCodes] = useState<AvailabilityCodeCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  function reload() {
    api.get<AvailabilityCodeCatalog[]>("/availability-codes")
      .then(setAvailabilityCodes).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  const [newCode, setNewCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editDescription, setEditDescription] = useState("");

  async function addCode(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/availability-codes", { code: newCode.trim(), description: newDescription.trim() });
      setNewCode("");
      setNewDescription("");
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar código.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c: AvailabilityCodeCatalog) {
    setEditingId(c.id);
    setEditCode(c.code);
    setEditDescription(c.description);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    setError(null);
    try {
      await api.put(`/availability-codes/${id}`, { code: editCode.trim(), description: editDescription.trim() });
      setEditingId(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar código.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCode(c: AvailabilityCodeCatalog) {
    if (!confirm(`Remover o código "${c.code}" (${c.description})?`)) return;
    try {
      await api.del(`/availability-codes/${c.id}`);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao remover código.");
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Códigos de Disponibilidade</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 18, maxWidth: 720 }}>
        Códigos aceitos no boletim de disponibilidade (DI/DO/IN/IS de fábrica) — alimentam os seletores
        "Código" e o reconhecimento do texto colado no módulo Disponibilidade. Cadastre aqui um código
        novo, se for preciso, sem precisar de nova versão do sistema.
      </p>

      <div className="card" style={{ padding: 18 }}>
        {loading ? <p>Carregando…</p> : (
          <div className="scroll-x" style={{ marginBottom: 14 }}>
            <table>
              <thead><tr><th style={{ width: 70 }}>Código</th><th>Descrição</th><th></th></tr></thead>
              <tbody>
                {availabilityCodes.map((c) => (
                  <tr key={c.id}>
                    {editingId === c.id ? (
                      <>
                        <td>
                          <input value={editCode} maxLength={2} onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                 style={{ width: 60, minHeight: 30, fontSize: 12.5, padding: "4px 8px" }} />
                        </td>
                        <td>
                          <input value={editDescription} maxLength={40} onChange={(e) => setEditDescription(e.target.value)}
                                 style={{ width: "100%", minHeight: 30, fontSize: 12.5, padding: "4px 8px" }} />
                        </td>
                        <td style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => saveEdit(c.id)}>Salvar</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Cancelar</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><span className="badge badge-neutral">{c.code}</span></td>
                        <td style={{ fontSize: 13 }}>{c.description}</td>
                        <td style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => startEdit(c)}>Editar</button>
                          <button className="btn btn-outline btn-sm" onClick={() => removeCode(c)}>Remover</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {availabilityCodes.length === 0 && (
                  <tr><td colSpan={3} style={{ color: "var(--text-secondary)" }}>Nenhum código cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={addCode} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ maxWidth: 100 }}>
            <label>Código (2 letras)</label>
            <input required maxLength={2} value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="ex.: IS" />
          </div>
          <div className="field" style={{ flex: "1 1 280px" }}>
            <label>Descrição (até 40 caracteres)</label>
            <input required maxLength={40} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="ex.: Inspeção" />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>+ Adicionar</button>
        </form>
        {error && <p style={{ color: "var(--status-critical)", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  );
}
