import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { Person } from "../api/types";
import PersonAvatar from "../components/PersonAvatar";

export default function MyProfilePage() {
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", phone_ddd: "", phone_number: "" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 9);
    return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  function load() {
    api.get<Person>("/people/me")
      .then((p) => {
        setPerson(p);
        setForm({ email: p.email ?? "", phone_ddd: p.phone_ddd ?? "", phone_number: p.phone_number ?? "" });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar perfil."))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setEmailTouched(true);
    if (!emailValid) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      await api.put("/people/me", form);
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        await api.upload("/people/me/photo", fd);
      }
      setFile(null);
      setPreview(null);
      setSavedMsg("Perfil atualizado com sucesso.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Carregando perfil…</p>;
  if (error && !person) return <p style={{ color: "var(--status-critical)" }}>{error}</p>;
  if (!person) return null;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, marginBottom: 2 }}>Meu Perfil</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        Sua foto e seus dados de contato — usados para o envio de alertas e notificações de manutenção.
      </p>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <img
            src={preview ?? undefined} alt=""
            style={preview ? { width: 84, height: 84, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-subtle)" } : { display: "none" }}
          />
          {!preview && <PersonAvatar person={person} size={84} />}
          <div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{person.rank ? `${person.rank} ` : ""}{person.full_name}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{person.role} · {person.organization}</div>
            {person.squadron && <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{person.squadron}</div>}
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Foto de perfil</label>
            <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                   onChange={(e) => {
                     const f = e.target.files?.[0] ?? null;
                     setFile(f);
                     setPreview(f ? URL.createObjectURL(f) : null);
                   }} />
          </div>
          <div className="form-grid">
            <div className="field field-full">
              <label>Email</label>
              <input
                type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                onBlur={() => setEmailTouched(true)}
              />
              {emailTouched && !emailValid && (
                <span style={{ color: "var(--status-critical)", fontSize: 11.5, marginTop: 4, display: "block" }}>
                  Informe um e-mail em formato válido (ex.: nome@dominio.com).
                </span>
              )}
            </div>
            <div className="field" style={{ maxWidth: 90 }}>
              <label>DDD</label>
              <input value={form.phone_ddd} inputMode="numeric" maxLength={2}
                     onChange={(e) => setForm({ ...form, phone_ddd: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                     placeholder="61" />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input value={form.phone_number} inputMode="numeric" maxLength={10}
                     onChange={(e) => setForm({ ...form, phone_number: formatPhone(e.target.value) })}
                     placeholder="99999-9999" />
            </div>
          </div>

          {error && <div className="badge badge-critical" style={{ display: "block", padding: "8px 12px", marginTop: 14 }}>{error}</div>}
          {savedMsg && <div className="badge badge-ok" style={{ display: "block", padding: "8px 12px", marginTop: 14 }}>{savedMsg}</div>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: 18 }} disabled={saving}>
            {saving ? "Salvando…" : "Salvar Perfil"}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 18, marginTop: 18 }}>
        <h3 style={{ fontSize: 14.5, margin: "0 0 10px" }}>Dados institucionais (somente leitura)</h3>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 10 }}>
          Alterações em função, posto/graduação, matrícula ou especialidade dependem do Gestor
          (cadastro de Usuários).
        </p>
        <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 6 }}>
          <span style={{ color: "var(--text-secondary)" }}>Matrícula</span><span>{person.registration_number ?? "—"}</span>
          <span style={{ color: "var(--text-secondary)" }}>Especialidade</span><span>{person.specialty ?? "—"}</span>
          <span style={{ color: "var(--text-secondary)" }}>Certificações</span><span>{person.certifications ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}
