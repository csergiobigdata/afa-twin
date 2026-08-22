import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Aircraft, AircraftCategory, AircraftStatus, RiskLevel } from "../api/types";
import { exampleArtUrl, uploadedPhotoUrl } from "../components/aircraftArt";

const CATEGORIES: AircraftCategory[] = ["Caça", "Ataque", "Transporte", "Treinamento", "Helicóptero", "Patrulha Marítima", "Reabastecimento em Voo"];
const STATUSES: AircraftStatus[] = ["Operacional", "Em Manutenção", "Em Inspeção", "Indisponível", "Em Modernização"];
const RISK_LEVELS: RiskLevel[] = ["Baixo", "Médio", "Alto"];
const SILHOUETTES = [
  { key: "gripen", label: "Caça de asa delta (ex.: Gripen)" },
  { key: "f5em", label: "Caça bimotor clássico (ex.: F-5EM)" },
  { key: "a29", label: "Ataque turboélice (ex.: A-29 Super Tucano)" },
  { key: "amx", label: "Ataque a jato monomotor (ex.: AMX A-1M)" },
  { key: "kc390", label: "Transporte de asa alta (ex.: KC-390 / C-130)" },
  { key: "c130", label: "Transporte de asa alta (ex.: C-130)" },
  { key: "h36", label: "Helicóptero (ex.: H-36 Caracal)" },
  { key: "generic", label: "Genérico" },
];

const EMPTY: Partial<Aircraft> = {
  tail_number: "", nickname: "", manufacturer: "", model: "", category: "Caça",
  squadron: "", base: "", manufacture_year: undefined, total_flight_hours: 0,
  engine_config: "", avionics_config: "", armament_config: "",
  max_speed_kmh: undefined, service_ceiling_m: undefined, max_range_km: undefined, crew_capacity: 1,
  status: "Operacional", silhouette_key: "generic", notes: "",
  next_mission_risk: "Médio", weather_risk: "Médio",
};

export default function AircraftFormPage({ mode }: { mode: "create" | "edit" }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Partial<Aircraft>>(EMPTY);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [staticFile, setStaticFile] = useState<File | null>(null);
  const [staticPreview, setStaticPreview] = useState<string | null>(null);
  const [animatedFile, setAnimatedFile] = useState<File | null>(null);
  const [animatedPreview, setAnimatedPreview] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && id) {
      api.get<Aircraft>(`/aircraft/${id}`).then(setForm).finally(() => setLoading(false));
    }
  }, [mode, id]);

  function set<K extends keyof Aircraft>(key: K, value: Aircraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onPickStaticFile(file: File | null) {
    setStaticFile(file);
    setStaticPreview(file ? URL.createObjectURL(file) : null);
  }

  function onPickAnimatedFile(file: File | null) {
    setAnimatedFile(file);
    setAnimatedPreview(file ? URL.createObjectURL(file) : null);
  }

  async function uploadPhotos(aircraftId: number) {
    if (staticFile) {
      const fd = new FormData();
      fd.append("file", staticFile);
      await api.upload(`/aircraft/${aircraftId}/photo`, fd);
    }
    if (animatedFile) {
      const fd = new FormData();
      fd.append("file", animatedFile);
      await api.upload(`/aircraft/${aircraftId}/photo-animated`, fd);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let aircraftId: number;
      if (mode === "create") {
        const created = await api.post<Aircraft>("/aircraft", form);
        aircraftId = created.id;
      } else {
        await api.put<Aircraft>(`/aircraft/${id}`, form);
        aircraftId = Number(id);
      }
      await uploadPhotos(aircraftId);
      navigate(`/aeronaves/${aircraftId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar aeronave.");
    } finally {
      setSaving(false);
    }
  }

  const currentStaticUrl = staticPreview ?? uploadedPhotoUrl(form.photo_filename) ?? exampleArtUrl(form.silhouette_key ?? "generic", false);
  const currentAnimatedUrl = animatedPreview ?? uploadedPhotoUrl(form.photo_animated_filename) ?? exampleArtUrl(form.silhouette_key ?? "generic", true);

  if (loading) return <p>Carregando…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{mode === "create" ? "Nova Aeronave" : `Editar Aeronave — ${form.tail_number}`}</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        Cadastro de nome, marca, modelo, características e configurações mecânicas da aeronave.
      </p>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 22 }}>
        <SectionTitle>Identificação</SectionTitle>
        <div className="form-grid">
          <div className="field">
            <label>Matrícula (tail number) *</label>
            <input required value={form.tail_number ?? ""} onChange={(e) => set("tail_number", e.target.value)} placeholder="FAB 4100" />
          </div>
          <div className="field">
            <label>Apelido</label>
            <input value={form.nickname ?? ""} onChange={(e) => set("nickname", e.target.value)} placeholder="Gripen One" />
          </div>
          <div className="field">
            <label>Marca / Fabricante *</label>
            <input required value={form.manufacturer ?? ""} onChange={(e) => set("manufacturer", e.target.value)} placeholder="Saab / Embraer" />
          </div>
          <div className="field">
            <label>Modelo *</label>
            <input required value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} placeholder="F-39E Gripen" />
          </div>
          <div className="field">
            <label>Categoria *</label>
            <select required value={form.category} onChange={(e) => set("category", e.target.value as AircraftCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Ícone / silhueta</label>
            <select value={form.silhouette_key} onChange={(e) => set("silhouette_key", e.target.value)}>
              {SILHOUETTES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <SectionTitle>Lotação e Status</SectionTitle>
        <div className="form-grid">
          <div className="field">
            <label>Esquadrão / Grupo de Aviação</label>
            <input value={form.squadron ?? ""} onChange={(e) => set("squadron", e.target.value)} placeholder="1º GDA" />
          </div>
          <div className="field">
            <label>Base Aérea</label>
            <input value={form.base ?? ""} onChange={(e) => set("base", e.target.value)} placeholder="Base Aérea de Anápolis" />
          </div>
          <div className="field">
            <label>Ano de fabricação</label>
            <input type="number" value={form.manufacture_year ?? ""} onChange={(e) => set("manufacture_year", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div className="field">
            <label>Horas de voo acumuladas</label>
            <input type="number" step="0.1" value={form.total_flight_hours ?? 0} onChange={(e) => set("total_flight_hours", Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Status operacional</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value as AircraftStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Capacidade de tripulação</label>
            <input type="number" value={form.crew_capacity ?? ""} onChange={(e) => set("crew_capacity", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
        </div>

        <SectionTitle>Desempenho</SectionTitle>
        <div className="form-grid">
          <div className="field">
            <label>Velocidade máxima (km/h)</label>
            <input type="number" value={form.max_speed_kmh ?? ""} onChange={(e) => set("max_speed_kmh", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div className="field">
            <label>Teto de serviço (m)</label>
            <input type="number" value={form.service_ceiling_m ?? ""} onChange={(e) => set("service_ceiling_m", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div className="field">
            <label>Alcance máximo (km)</label>
            <input type="number" value={form.max_range_km ?? ""} onChange={(e) => set("max_range_km", e.target.value ? Number(e.target.value) : undefined)} />
          </div>
        </div>

        <SectionTitle>Foto da Aeronave</SectionTitle>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: -6, marginBottom: 12 }}>
          Anexe uma foto real desta aeronave (estática) e, opcionalmente, uma imagem animada (GIF/WEBP)
          para inspeção visual de detalhes. Enquanto nenhuma foto for enviada, uma ilustração de exemplo
          do modelo é exibida no lugar.
        </p>
        <div className="form-grid">
          <div className="field">
            <label>Foto estática (JPG, PNG ou WEBP · máx. 6MB)</label>
            <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                   onChange={(e) => onPickStaticFile(e.target.files?.[0] ?? null)} />
            <img src={currentStaticUrl} alt="Pré-visualização da foto estática"
                 style={{ marginTop: 10, width: "100%", maxWidth: 320, borderRadius: 10, border: "1px solid var(--border-subtle)" }} />
          </div>
          <div className="field">
            <label>Imagem animada / GIF (opcional · máx. 6MB)</label>
            <input type="file" accept=".gif,.webp,image/gif,image/webp"
                   onChange={(e) => onPickAnimatedFile(e.target.files?.[0] ?? null)} />
            <img src={currentAnimatedUrl} alt="Pré-visualização da imagem animada"
                 style={{ marginTop: 10, width: "100%", maxWidth: 320, borderRadius: 10, border: "1px solid var(--border-subtle)" }} />
          </div>
        </div>

        <SectionTitle>Fatores de Risco Operacional (entrada manual)</SectionTitle>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: -6, marginBottom: 12 }}>
          Usados no cálculo ponderado de Risco Operacional (aba Confiabilidade/Risco), até que haja
          integração automática com sistemas de planejamento de missão e meteorologia.
        </p>
        <div className="form-grid">
          <div className="field">
            <label>Risco da missão prevista</label>
            <select value={form.next_mission_risk} onChange={(e) => set("next_mission_risk", e.target.value as RiskLevel)}>
              {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Risco das condições meteorológicas</label>
            <select value={form.weather_risk} onChange={(e) => set("weather_risk", e.target.value as RiskLevel)}>
              {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <SectionTitle>Características e Configurações Mecânicas</SectionTitle>
        <div className="form-grid">
          <div className="field field-full">
            <label>Configuração do motor</label>
            <textarea value={form.engine_config ?? ""} onChange={(e) => set("engine_config", e.target.value)} placeholder="Ex.: 1x turbofan Volvo Aero RM12 com pós-combustão" />
          </div>
          <div className="field field-full">
            <label>Configuração de aviônicos</label>
            <textarea value={form.avionics_config ?? ""} onChange={(e) => set("avionics_config", e.target.value)} placeholder="Ex.: Radar AESA, HUD, sistema de navegação integrado" />
          </div>
          <div className="field field-full">
            <label>Configuração de armamento</label>
            <textarea value={form.armament_config ?? ""} onChange={(e) => set("armament_config", e.target.value)} placeholder="Ex.: Canhão interno, pontos externos para mísseis" />
          </div>
          <div className="field field-full">
            <label>Observações</label>
            <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        {error && <div className="badge badge-critical" style={{ display: "block", padding: "8px 12px", marginTop: 16 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Salvando…" : "Salvar Aeronave"}</button>
          <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--fab-blue-500)", textTransform: "uppercase", letterSpacing: ".04em", margin: "22px 0 12px" }}>
      {children}
    </div>
  );
}
