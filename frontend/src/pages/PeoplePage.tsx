import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Person, PersonRole } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import PersonAvatar from "../components/PersonAvatar";
import PersonForm, { type PersonFormValues } from "../components/PersonForm";

const ROLES: PersonRole[] = ["Piloto", "Mecânico", "Engenheiro", "Cientista", "Gestor / Responsável Técnico"];

function phoneFull(p: Person): string {
  if (p.phone_ddd && p.phone_number) return `(${p.phone_ddd}) ${p.phone_number}`;
  return p.phone_number ?? "—";
}

function toPayload(v: PersonFormValues) {
  return {
    full_name: v.full_name, organization: v.organization, role: v.role,
    rank: v.rank || null, registration_number: v.registration_number || null,
    specialty: v.specialty || null, squadron: v.squadron || null,
    certifications: v.certifications || null, email: v.email || null,
    phone_ddd: v.phone_ddd || null, phone_number: v.phone_number || null,
    active: v.active,
  };
}

export default function PeoplePage() {
  useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState("");
  const [query, setQuery] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function reload() {
    api.get<Person[]>("/people").then(setPeople).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function createPerson(values: PersonFormValues) {
    setSaving(true);
    try {
      await api.post("/people", toPayload(values));
      setShowForm(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: number, values: PersonFormValues) {
    setSavingEdit(true);
    try {
      await api.put(`/people/${id}`, toPayload(values));
      if (editFile) {
        const fd = new FormData();
        fd.append("file", editFile);
        await api.upload(`/people/${id}/photo`, fd);
      }
      setEditingId(null);
      setEditFile(null);
      reload();
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(p: Person) {
    await api.put(`/people/${p.id}`, { active: !p.active });
    reload();
  }

  const filtered = people.filter((p) => {
    const matchRole = !roleFilter || p.role === roleFilter;
    const matchQuery = `${p.full_name} ${p.registration_number ?? ""} ${p.specialty ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matchRole && matchQuery;
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>Cadastro de Usuários</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Pilotos, mecânicos, engenheiros, cientistas e responsáveis técnicos.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancelar" : "+ Novo Usuário"}</button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 22, marginBottom: 20 }}>
          <PersonForm onSubmit={createPerson} submitLabel="Salvar Cadastro" saving={saving} showActiveToggle={false} />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <input type="text" placeholder="Buscar por nome, matrícula ou especialidade…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 320 }} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Todas as funções</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 10 }}>
        Usuários não são excluídos, apenas inativados — a inativação (e quem a realizou) fica registrada
        na <Link to="/auditoria">Auditoria</Link>.
      </p>

      {loading ? <p>Carregando…</p> : (
        <div className="card scroll-x">
          <table>
            <thead><tr><th></th><th>Nome</th><th>Função</th><th>Organização</th><th>Contato</th><th>Matrícula</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <Fragment key={p.id}>
                  <tr>
                    <td><PersonAvatar person={p} size={38} /></td>
                    <td><strong>{p.rank ? `${p.rank} ` : ""}{p.full_name}</strong>{p.squadron && <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{p.squadron}</div>}</td>
                    <td><span className="badge badge-info">{p.role}</span></td>
                    <td style={{ fontSize: 12.5 }}>{p.organization}</td>
                    <td style={{ fontSize: 12 }}>{p.email ?? "—"}<br />{phoneFull(p)}</td>
                    <td style={{ fontSize: 12.5 }}>{p.registration_number ?? "—"}</td>
                    <td>
                      <span className={`badge ${p.active ? "badge-ok" : "badge-neutral"}`} style={{ cursor: "pointer" }} onClick={() => toggleActive(p)}>
                        {p.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditingId(editingId === p.id ? null : p.id)}>
                        {editingId === p.id ? "Fechar" : "✎ Editar"}
                      </button>
                    </td>
                  </tr>
                  {editingId === p.id && (
                    <tr>
                      <td colSpan={8} style={{ background: "var(--bg-surface-alt)" }}>
                        <div style={{ padding: 18, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                          <div style={{ textAlign: "center" }}>
                            <PersonAvatar person={p} size={84} />
                            <div style={{ marginTop: 8 }}>
                              <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                     style={{ fontSize: 11.5, maxWidth: 160 }}
                                     onChange={(e) => setEditFile(e.target.files?.[0] ?? null)} />
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 320 }}>
                            <PersonForm
                              initial={p}
                              onSubmit={(values) => saveEdit(p.id, values)}
                              submitLabel="Salvar Alterações"
                              saving={savingEdit}
                              showActiveToggle
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} style={{ color: "var(--text-secondary)" }}>Nenhuma pessoa encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
