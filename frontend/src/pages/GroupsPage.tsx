import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Aircraft, AssignmentRole, Person, ResponsibleGroup } from "../api/types";
import PersonAvatar from "../components/PersonAvatar";

const GROUP_ROLES: AssignmentRole[] = [
  "Piloto Titular", "Piloto Reserva / Sub-Piloto", "Piloto Instrutor", "Mecânico Responsável",
  "Engenheiro de Confiabilidade", "Chefe de Manutenção", "Inspetor de Qualidade",
  "Comandante de Esquadrão", "Cientista Responsável (P&D)",
];

export default function GroupsPage() {
  const [groups, setGroups] = useState<ResponsibleGroup[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  function reload() {
    Promise.all([
      api.get<ResponsibleGroup[]>("/groups"),
      api.get<Person[]>("/people"),
      api.get<Aircraft[]>("/aircraft"),
    ]).then(([g, p, f]) => { setGroups(g); setPeople(p); setFleet(f); }).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function createGroup(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/groups", { name, description: description || null, members: [] });
      setName(""); setDescription(""); setShowForm(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup(g: ResponsibleGroup) {
    if (!confirm(`Excluir o grupo "${g.name}"? Isso remove todos os vínculos de membros e de aeronaves.`)) return;
    await api.del(`/groups/${g.id}`);
    reload();
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 2 }}>Grupos e Equipes Responsáveis</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, maxWidth: 640 }}>
            A responsabilidade por uma aeronave não é de uma única pessoa: monte equipes nomeadas
            (piloto titular, piloto reserva, mecânicos, engenheiros, comandante de esquadrão) e
            atribua uma ou mais equipes a cada aeronave.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancelar" : "+ Novo Grupo"}</button>
      </div>

      {showForm && (
        <form onSubmit={createGroup} className="card" style={{ padding: 18, marginBottom: 20 }}>
          <div className="form-grid">
            <div className="field">
              <label>Apelido do grupo *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Equipe Gripen Alpha" />
            </div>
            <div className="field field-full">
              <label>Descrição</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Equipe multidisciplinar do F-39E FAB 4100" />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={saving}>{saving ? "Criando…" : "Criar grupo"}</button>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 8 }}>Depois de criado, adicione membros e vincule a uma ou mais aeronaves.</p>
        </form>
      )}

      {loading ? <p>Carregando…</p> : groups.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>Nenhum grupo cadastrado ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((g) => (
            <div key={g.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{g.name}</div>
                  {g.description && <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>{g.description}</div>}
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {g.aircraft_tail_numbers.length === 0 ? (
                      <span className="badge badge-neutral">Nenhuma aeronave vinculada</span>
                    ) : g.aircraft_tail_numbers.map((t) => <span key={t} className="badge badge-info">🛩️ {t}</span>)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex" }}>
                    {g.members.slice(0, 5).map((m) => (
                      <div key={m.id} style={{ marginLeft: -8 }}><PersonAvatar person={m.person} size={32} /></div>
                    ))}
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}>
                    {expandedId === g.id ? "Ocultar" : "Gerenciar"}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => removeGroup(g)}>Excluir</button>
                </div>
              </div>

              {expandedId === g.id && (
                <GroupDetail group={g} people={people} fleet={fleet} onReload={reload} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupDetail({ group, people, fleet, onReload }: { group: ResponsibleGroup; people: Person[]; fleet: Aircraft[]; onReload: () => void }) {
  const [personId, setPersonId] = useState<number | "">("");
  const [roleInGroup, setRoleInGroup] = useState<AssignmentRole>("Mecânico Responsável");
  const [aircraftId, setAircraftId] = useState<number | "">("");
  const [savingMember, setSavingMember] = useState(false);
  const [savingLink, setSavingLink] = useState(false);

  async function addMember(e: FormEvent) {
    e.preventDefault();
    if (!personId) return;
    setSavingMember(true);
    try {
      await api.post(`/groups/${group.id}/members`, { person_id: personId, role_in_group: roleInGroup });
      setPersonId("");
      onReload();
    } finally {
      setSavingMember(false);
    }
  }

  async function removeMember(membershipId: number) {
    await api.del(`/groups/${group.id}/members/${membershipId}`);
    onReload();
  }

  async function linkAircraft(e: FormEvent) {
    e.preventDefault();
    if (!aircraftId) return;
    setSavingLink(true);
    try {
      await api.post("/aircraft-groups", {
        aircraft_id: aircraftId, group_id: group.id, start_date: new Date().toISOString().slice(0, 10),
      });
      setAircraftId("");
      onReload();
    } finally {
      setSavingLink(false);
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-subtle)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="group-detail-grid">
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10 }}>Membros do grupo</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {group.members.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <PersonAvatar person={m.person} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.person.rank ? `${m.person.rank} ` : ""}{m.person.full_name}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{m.role_in_group}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => removeMember(m.id)}>Remover</button>
            </div>
          ))}
          {group.members.length === 0 && <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nenhum membro ainda.</p>}
        </div>
        <form onSubmit={addMember} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Adicionar pessoa</label>
            <select value={personId} onChange={(e) => setPersonId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Selecione…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.rank ? `${p.rank} - ` : ""}{p.full_name}</option>)}
            </select>
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Papel no grupo</label>
            <select value={roleInGroup} onChange={(e) => setRoleInGroup(e.target.value as AssignmentRole)}>
              {GROUP_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={savingMember}>Adicionar</button>
        </form>
      </div>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10 }}>Aeronaves sob responsabilidade deste grupo</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {group.aircraft_tail_numbers.length === 0
            ? <p style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Nenhuma aeronave vinculada ainda.</p>
            : group.aircraft_tail_numbers.map((t) => <span key={t} className="badge badge-info">🛩️ {t}</span>)}
        </div>
        <form onSubmit={linkAircraft} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <div className="field" style={{ minWidth: 220 }}>
            <label>Vincular aeronave</label>
            <select value={aircraftId} onChange={(e) => setAircraftId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Selecione…</option>
              {fleet.map((a) => <option key={a.id} value={a.id}>{a.tail_number} · {a.model}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={savingLink}>Vincular</button>
        </form>
      </div>
      <style>{`@media (max-width: 760px) { .group-detail-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
