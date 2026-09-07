import { useEffect, useState, type FormEvent } from "react";
import type { Person, PersonRole } from "../api/types";
import { useLookupValues } from "../api/useLookup";

const ROLES: PersonRole[] = ["Piloto", "Mecânico", "Engenheiro", "Cientista", "Gestor / Responsável Técnico"];

export interface PersonFormValues {
  full_name: string;
  organization: string;
  role: PersonRole;
  rank: string;
  registration_number: string;
  specialty: string;
  squadron: string;
  certifications: string;
  email: string;
  phone_ddd: string;
  phone_number: string;
  active: boolean;
}

const EMPTY: PersonFormValues = {
  full_name: "", organization: "Força Aérea Brasileira", role: "Mecânico", rank: "",
  registration_number: "", specialty: "", squadron: "", certifications: "",
  email: "", phone_ddd: "", phone_number: "", active: true,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function fromPerson(p?: Partial<Person>): PersonFormValues {
  if (!p) return EMPTY;
  return {
    full_name: p.full_name ?? "", organization: p.organization ?? "Força Aérea Brasileira",
    role: (p.role as PersonRole) ?? "Mecânico", rank: p.rank ?? "",
    registration_number: p.registration_number ?? "", specialty: p.specialty ?? "",
    squadron: p.squadron ?? "", certifications: p.certifications ?? "",
    email: p.email ?? "", phone_ddd: p.phone_ddd ?? "", phone_number: p.phone_number ?? "",
    active: p.active ?? true,
  };
}

/** Formulário completo de Usuário - usado tanto no cadastro (Novo Usuário)
 * quanto na edição (todos os campos disponíveis para alteração, conforme
 * solicitado), com Esquadrão/Unidade, Especialidade, Organização e Posto/
 * Graduação/Cargo como listbox (Cadastros Auxiliares). */
export default function PersonForm({
  initial, onSubmit, submitLabel, saving, showActiveToggle = true, extraButton,
}: {
  initial?: Partial<Person>;
  onSubmit: (values: PersonFormValues) => void | Promise<void>;
  submitLabel: string;
  saving: boolean;
  showActiveToggle?: boolean;
  extraButton?: React.ReactNode;
}) {
  const [form, setForm] = useState<PersonFormValues>(() => fromPerson(initial));
  const [emailTouched, setEmailTouched] = useState(false);

  useEffect(() => setForm(fromPerson(initial)), [initial]);

  const organizations = useLookupValues("Organização");
  const ranks = useLookupValues("Posto / Graduação / Cargo");
  const specialties = useLookupValues("Especialidade");
  const squadrons = useLookupValues("Esquadrão / Unidade");

  const emailValid = !form.email || EMAIL_PATTERN.test(form.email);

  function set<K extends keyof PersonFormValues>(key: K, value: PersonFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailTouched(true);
    if (!emailValid) return;
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="field field-full">
          <label>Nome completo *</label>
          <input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Ex.: Ten Cel Av Marina Duque Estrada" />
        </div>
        <div className="field">
          <label>Organização</label>
          <input list="organizacao-options" value={form.organization} onChange={(e) => set("organization", e.target.value)} />
          <datalist id="organizacao-options">
            {organizations.map((o) => <option key={o} value={o} />)}
          </datalist>
        </div>
        <div className="field">
          <label>Função *</label>
          <select required value={form.role} onChange={(e) => set("role", e.target.value as PersonRole)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Posto / Graduação / Cargo</label>
          <select value={form.rank} onChange={(e) => set("rank", e.target.value)}>
            <option value="">Selecione…</option>
            {ranks.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Matrícula / Identidade funcional</label>
          <input value={form.registration_number} onChange={(e) => set("registration_number", e.target.value)} placeholder="FAB-000000 / ITA-0000 / EMB-000000" />
        </div>
        <div className="field">
          <label>Especialidade</label>
          <select value={form.specialty} onChange={(e) => set("specialty", e.target.value)}>
            <option value="">Selecione…</option>
            {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Esquadrão / Unidade</label>
          <select value={form.squadron} onChange={(e) => set("squadron", e.target.value)}>
            <option value="">Selecione…</option>
            {squadrons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Email</label>
          <input
            type="email" value={form.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={() => setEmailTouched(true)}
            placeholder="nome@organizacao.mil.br"
          />
          {emailTouched && !emailValid && (
            <span style={{ color: "var(--status-critical)", fontSize: 11.5, marginTop: 4, display: "block" }}>
              Informe um e-mail em formato válido (ex.: nome@dominio.com).
            </span>
          )}
        </div>
        <div className="field" style={{ maxWidth: 90 }}>
          <label>DDD</label>
          <input
            value={form.phone_ddd} inputMode="numeric" maxLength={2}
            onChange={(e) => set("phone_ddd", e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder="61"
          />
        </div>
        <div className="field">
          <label>Telefone</label>
          <input
            value={form.phone_number} inputMode="numeric" maxLength={10}
            onChange={(e) => set("phone_number", formatPhone(e.target.value))}
            placeholder="99999-9999"
          />
        </div>
        <div className="field field-full">
          <label>Habilitações / Certificações (protocolo de qualificação)</label>
          <textarea value={form.certifications} onChange={(e) => set("certifications", e.target.value)}
                    placeholder="Ex.: Habilitação F-39E, Curso de Especialização em Mecânica de Aeronaves, licenças ANAC/DECEA aplicáveis…" />
        </div>
        {showActiveToggle && (
          <div className="field">
            <label>Status</label>
            <select value={form.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")}>
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </select>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Salvando…" : submitLabel}</button>
        {extraButton}
      </div>
    </form>
  );
}
