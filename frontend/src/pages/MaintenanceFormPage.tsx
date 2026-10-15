import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  Aircraft, ChecklistTemplate, Component, Criticality, MaintenanceOrder, MaintenanceType, OrderStatus, Person, ResponsibleGroup,
} from "../api/types";
import { CriticalityBadge, OrderStatusBadge } from "../components/Badges";
import { formatDateTimeShort } from "../utils/format";

const TYPES: MaintenanceType[] = [
  "Inspeção de Rotina", "Preventiva Programada", "Corretiva", "Boletim Técnico (AD/SB)", "Overhaul / Grande Reparo", "Modificação / Modernização",
];
const PRIORITIES: Criticality[] = ["Baixa", "Média", "Alta", "Crítica"];
const STATUSES: OrderStatus[] = ["Aberta", "Em Andamento", "Aguardando Peça", "Concluída", "Cancelada"];
const TERMINAL: OrderStatus[] = ["Concluída", "Cancelada"];

const ACTION_BY_TYPE: Record<MaintenanceType, string> = {
  "Inspeção de Rotina": "Inspeção de rotina",
  "Preventiva Programada": "Manutenção preventiva programada",
  "Corretiva": "Manutenção corretiva",
  "Boletim Técnico (AD/SB)": "Atendimento a boletim técnico (AD/SB)",
  "Overhaul / Grande Reparo": "Overhaul / grande reparo",
  "Modificação / Modernização": "Modificação / modernização",
};

/** Monta uma sugestão de Título/Descrição a partir dos demais campos já
 * preenchidos (Aeronave, Componente ou Protocolo/Checklist, Tipo,
 * Prioridade, Horas de voo) - só preenche quando o usuário clica em
 * "Sugerir" (nunca sobrescreve sozinho), e o texto gerado continua
 * livremente editável depois. */
function buildSuggestion(
  order: Partial<MaintenanceOrder>, fleet: Aircraft[], components: Component[], checklists: ChecklistTemplate[],
): { title: string; description: string } {
  const aircraft = fleet.find((a) => a.id === order.aircraft_id);
  const component = components.find((c) => c.id === order.component_id);
  const checklist = !component ? checklists.find((c) => c.id === order.checklist_template_id) : undefined;
  const action = ACTION_BY_TYPE[order.type ?? "Corretiva"] ?? "Manutenção";
  const subject = component?.name ?? checklist?.name ?? aircraft?.tail_number ?? "aeronave";

  const title = `${action} — ${subject}`;

  const sentences: string[] = [];
  sentences.push(
    aircraft
      ? `${action} na aeronave ${aircraft.tail_number} (${aircraft.manufacturer} ${aircraft.model})`
        + `${component ? `, componente ${component.name}` : checklist ? `, conforme protocolo "${checklist.name}"` : ""}.`
      : `${action}${component ? ` no componente ${component.name}` : ""}.`
  );
  sentences.push(`Prioridade ${order.priority ?? "Média"}.`);
  if (order.flight_hours_at_event) {
    sentences.push(`Horas de voo acumuladas no evento: ${order.flight_hours_at_event}h.`);
  }

  return { title, description: sentences.join(" ") };
}

export default function MaintenanceFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [fleet, setFleet] = useState<Aircraft[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [groups, setGroups] = useState<ResponsibleGroup[]>([]);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);
  const [order, setOrder] = useState<Partial<MaintenanceOrder>>({
    aircraft_id: searchParams.get("aircraft_id") ? Number(searchParams.get("aircraft_id")) : undefined,
    type: "Inspeção de Rotina", priority: "Média", status: "Aberta", title: "",
  });
  const [originalStatus, setOriginalStatus] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Aircraft[]>("/aircraft").then(setFleet);
    api.get<Person[]>("/people").then(setPeople);
    api.get<ResponsibleGroup[]>("/groups").then(setGroups);
    api.get<ChecklistTemplate[]>("/checklists").then(setChecklists);
  }, []);

  useEffect(() => {
    if (order.aircraft_id) {
      api.get<Component[]>(`/components?aircraft_id=${order.aircraft_id}`).then(setComponents);
    } else {
      setComponents([]);
    }
  }, [order.aircraft_id]);

  useEffect(() => {
    if (isEdit) {
      api.get<MaintenanceOrder>(`/maintenance-orders/${id}`)
        .then((o) => { setOrder(o); setOriginalStatus(o.status); })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const isLocked = isEdit && originalStatus !== null && TERMINAL.includes(originalStatus);
  const isCancelling = order.status === "Cancelada" && originalStatus !== "Cancelada";

  function set<K extends keyof MaintenanceOrder>(key: K, value: MaintenanceOrder[K]) {
    setOrder((o) => ({ ...o, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isCancelling && !order.cancelled_by_id) {
      setError("Para cancelar, selecione o responsável pelo cancelamento.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/maintenance-orders/${id}`, order);
      } else {
        const created = await api.post<MaintenanceOrder>("/maintenance-orders", order);
        navigate(`/manutencao/${created.id}`);
        return;
      }
      navigate("/manutencao/ordens");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a ordem de serviço.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Carregando…</p>;

  const selectedAircraft = fleet.find((a) => a.id === order.aircraft_id);
  const checklistsSorted = [...checklists].sort((a, b) => {
    const aMatch = selectedAircraft && a.aircraft_model === selectedAircraft.model ? 0 : 1;
    const bMatch = selectedAircraft && b.aircraft_model === selectedAircraft.model ? 0 : 1;
    return aMatch - bMatch;
  });
  const selectedChecklist = checklists.find((c) => c.id === order.checklist_template_id);

  function selectChecklist(checklistId: number | null) {
    set("checklist_template_id", checklistId);
    if (checklistId) {
      const checklist = checklists.find((c) => c.id === checklistId);
      if (checklist?.reference_doc && !order.reference_doc) {
        set("reference_doc", checklist.reference_doc);
      }
    }
  }

  return (
    <div>
      <Link to="/manutencao/ordens" style={{ fontSize: 13, textDecoration: "none" }}>← Voltar às ordens de serviço</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>{isEdit ? `Ordem de Serviço ${order.order_number}` : "Nova Ordem de Serviço"}</h1>
        {isEdit && order.priority && <CriticalityBadge value={order.priority} />}
        {isEdit && order.status && <OrderStatusBadge status={order.status} />}
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
        Registro formal de manutenção — siga o protocolo: referência técnica (AMM/ICA/Boletim), responsável designado e evidências de execução.
        Uma OS nunca é excluída; uma vez concluída ou cancelada, torna-se imutável.
      </p>

      {isLocked && (
        <div className="card" style={{ padding: 14, marginBottom: 16, borderLeft: "4px solid var(--status-info)" }}>
          <strong>Esta OS está {order.status} e não pode mais ser alterada.</strong>
          {order.status === "Cancelada" && (
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 6 }}>
              Cancelada em {order.cancelled_at ? formatDateTimeShort(order.cancelled_at) : "—"}
              {order.cancellation_reason ? ` — motivo: ${order.cancellation_reason}` : ""}
            </div>
          )}
        </div>
      )}

      <fieldset disabled={isLocked} style={{ border: "none", padding: 0, margin: 0 }}>
      <form onSubmit={submit} className="card" style={{ padding: 22 }}>
        <div className="form-grid">
          <div className="field">
            <label>Aeronave *</label>
            <select required value={order.aircraft_id ?? ""} disabled={isEdit}
                    onChange={(e) => set("aircraft_id", Number(e.target.value))}>
              <option value="">Selecione…</option>
              {fleet.map((a) => <option key={a.id} value={a.id}>{a.tail_number} · {a.model}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Componente associado</label>
            <select
              value={order.component_id ?? ""} disabled={!!order.checklist_template_id}
              onChange={(e) => {
                const componentId = e.target.value ? Number(e.target.value) : null;
                set("component_id", componentId);
                if (componentId) set("checklist_template_id", null);
              }}
            >
              <option value="">Nenhum / aeronave inteira</option>
              {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Protocolo/Checklist aplicado</label>
            <select
              value={order.checklist_template_id ?? ""} disabled={!!order.component_id}
              onChange={(e) => selectChecklist(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Nenhum</option>
              {checklistsSorted.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.aircraft_model ? ` (${c.aircraft_model})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-full" style={{ marginTop: -8 }}>
            <p style={{ fontSize: 11.5, color: "var(--text-secondary)", margin: 0 }}>
              <strong>Componente associado</strong> x <strong>Protocolo/Checklist aplicado</strong>: use
              Componente quando a OS for sobre uma peça específica; use Protocolo/Checklist quando for uma
              inspeção programada que cobre a aeronave inteira (ex.: "Inspeção de 100 horas") — essa é a
              prática real da Aeronáutica, inspeções periódicas seguem um checklist fixo, e achados
              específicos encontrados durante a inspeção podem depois ser vinculados a um componente,
              editando a OS. Os dois campos são mutuamente exclusivos.
            </p>
            {selectedChecklist && selectedChecklist.items.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, background: "var(--bg-surface-alt)", borderRadius: 6, padding: "8px 10px" }}>
                <strong>Itens do protocolo "{selectedChecklist.name}":</strong>
                <ol style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {selectedChecklist.items.map((item, i) => <li key={i}>{item}</li>)}
                </ol>
              </div>
            )}
          </div>
          <div className="field">
            <label>Tipo de Manutenção *</label>
            <select required value={order.type} onChange={(e) => set("type", e.target.value as MaintenanceType)}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Prioridade *</label>
            <select required value={order.priority} onChange={(e) => set("priority", e.target.value as Criticality)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {isEdit && (
            <div className="field">
              <label>Status</label>
              <select value={order.status} onChange={(e) => set("status", e.target.value as OrderStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>Responsável técnico</label>
            <select value={order.responsible_id ?? ""} onChange={(e) => set("responsible_id", e.target.value ? Number(e.target.value) : null)}>
              <option value="">Selecione…</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.rank ? `${p.rank} - ` : ""}{p.full_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Horas de voo no evento</label>
            <input type="number" value={order.flight_hours_at_event ?? ""} onChange={(e) => set("flight_hours_at_event", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="field field-full" style={{ marginBottom: -4 }}>
            <button
              type="button" className="btn btn-outline btn-sm" style={{ alignSelf: "flex-start" }}
              disabled={!order.aircraft_id}
              onClick={() => {
                const { title, description } = buildSuggestion(order, fleet, components, checklists);
                set("title", title);
                set("description", description);
              }}
            >
              💡 Sugerir título e descrição
            </button>
          </div>
          <div className="field field-full">
            <label>Título *</label>
            <input required value={order.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Inspeção de 100 horas" />
          </div>
          <div className="field field-full">
            <label>Descrição</label>
            <textarea value={order.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="field field-full">
            <label>Referência técnica (AMM / ICA / Boletim AD-SB)</label>
            <input value={order.reference_doc ?? ""} onChange={(e) => set("reference_doc", e.target.value)} placeholder="Ex.: AMM Cap. 05 / SB-F39-2026-014" />
          </div>
          <div className="field">
            <label>Equipe envolvida na execução</label>
            <select value={order.team_group_id ?? ""} onChange={(e) => set("team_group_id", e.target.value ? Number(e.target.value) : null)}>
              <option value="">Selecione um grupo/equipe…</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Observações sobre a equipe (opcional)</label>
            <input value={order.team_members ?? ""} onChange={(e) => set("team_members", e.target.value)} placeholder="Ex.: reforço de plantão, apoio externo…" />
          </div>
          {isEdit && (
            <>
              <div className="field field-full">
                <label>Constatações (findings)</label>
                <textarea value={order.findings ?? ""} onChange={(e) => set("findings", e.target.value)} />
              </div>
              <div className="field field-full">
                <label>Ações realizadas</label>
                <textarea value={order.actions_taken ?? ""} onChange={(e) => set("actions_taken", e.target.value)} />
              </div>
              <div className="field field-full">
                <label>Peças utilizadas</label>
                <textarea value={order.parts_used ?? ""} onChange={(e) => set("parts_used", e.target.value)} />
              </div>
            </>
          )}
          {isCancelling && (
            <>
              <div className="field">
                <label>Cancelado por *</label>
                <select required value={order.cancelled_by_id ?? ""} onChange={(e) => set("cancelled_by_id", e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Selecione o responsável…</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.rank ? `${p.rank} - ` : ""}{p.full_name}</option>)}
                </select>
              </div>
              <div className="field field-full">
                <label>Motivo do cancelamento</label>
                <textarea value={order.cancellation_reason ?? ""} onChange={(e) => set("cancellation_reason", e.target.value)} />
                <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4 }}>
                  Data e hora do cancelamento são registradas automaticamente, e o grupo/equipe responsável será notificado.
                </p>
              </div>
            </>
          )}
        </div>

        {error && <div className="badge badge-critical" style={{ display: "block", padding: "8px 12px", marginTop: 16 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
          <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>Voltar</button>
        </div>
      </form>
      </fieldset>
    </div>
  );
}
