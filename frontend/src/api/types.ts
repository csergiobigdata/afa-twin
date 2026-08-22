export type AircraftCategory =
  | "Caça" | "Ataque" | "Transporte" | "Treinamento" | "Helicóptero"
  | "Patrulha Marítima" | "Reabastecimento em Voo";

export type AircraftStatus =
  | "Operacional" | "Em Manutenção" | "Em Inspeção" | "Indisponível" | "Em Modernização";

// Antes um enum fixo; agora um cadastro auxiliar editável (LookupCategory.ORGANIZACAO),
// então o tipo aceita qualquer string cadastrada, com as opções conhecidas como sugestão.
export type Organization = string;

export type PersonRole = "Piloto" | "Mecânico" | "Engenheiro" | "Cientista" | "Gestor / Responsável Técnico";

export type ComponentCategory =
  | "Motor / Grupo Motopropulsor" | "Trem de Pouso" | "Sistema Hidráulico" | "Aviônicos"
  | "Estrutura" | "Armamento" | "Sistema de Combustível" | "Sistema Elétrico"
  | "Oxigênio / Suporte à Vida" | "Outro";

export type MonitoringType = "Hard Time (vida limite)" | "On Condition (sob condição)" | "Condition Monitoring (monitorado)";

export type Criticality = "Baixa" | "Média" | "Alta" | "Crítica";

export type MaintenanceType =
  | "Inspeção de Rotina" | "Preventiva Programada" | "Corretiva"
  | "Boletim Técnico (AD/SB)" | "Overhaul / Grande Reparo" | "Modificação / Modernização";

export type OrderStatus = "Aberta" | "Em Andamento" | "Aguardando Peça" | "Concluída" | "Cancelada";

export type AssignmentRole =
  | "Piloto Titular" | "Piloto Reserva / Sub-Piloto" | "Piloto Instrutor" | "Mecânico Responsável"
  | "Engenheiro de Confiabilidade" | "Chefe de Manutenção" | "Inspetor de Qualidade"
  | "Comandante de Esquadrão" | "Cientista Responsável (P&D)";

export type RiskLevel = "Baixo" | "Médio" | "Alto";

export type DefectType = "Corrosão" | "Trinca" | "Vazamento" | "Desgaste" | "Outro";

export interface Aircraft {
  id: number;
  tail_number: string;
  nickname?: string | null;
  manufacturer: string;
  model: string;
  category: AircraftCategory;
  squadron?: string | null;
  base?: string | null;
  manufacture_year?: number | null;
  total_flight_hours: number;
  engine_config?: string | null;
  avionics_config?: string | null;
  armament_config?: string | null;
  max_speed_kmh?: number | null;
  service_ceiling_m?: number | null;
  max_range_km?: number | null;
  crew_capacity?: number | null;
  status: AircraftStatus;
  silhouette_key: string;
  notes?: string | null;
  next_mission_risk: RiskLevel;
  weather_risk: RiskLevel;
  created_at: string;
  photo_url?: string | null;
  photo_animated_url?: string | null;
  health_index?: number | null;
  risk_level?: string | null;
  availability_pct?: number | null;
  reliability_pct?: number | null;
}

export interface Component {
  id: number;
  aircraft_id: number;
  name: string;
  part_number?: string | null;
  serial_number?: string | null;
  category: ComponentCategory;
  monitoring_type: MonitoringType;
  criticality: Criticality;
  install_date?: string | null;
  life_limit_hours?: number | null;
  hours_since_new: number;
  hours_since_overhaul: number;
  last_inspection_date?: string | null;
  next_inspection_due_hours?: number | null;
  preventive_interval_days?: number | null;
  next_preventive_date?: string | null;
  status: AircraftStatus;
  notes?: string | null;
  wear_pct?: number | null;
  created_at: string;
}

export interface Person {
  id: number;
  full_name: string;
  organization: Organization;
  role: PersonRole;
  rank?: string | null;
  registration_number?: string | null;
  specialty?: string | null;
  squadron?: string | null;
  certifications?: string | null;
  email?: string | null;
  phone_ddd?: string | null;
  phone_number?: string | null;
  photo_url?: string | null;
  active: boolean;
  created_at: string;
}

export interface GroupMembership {
  id: number;
  person: Person;
  role_in_group: AssignmentRole;
  joined_at: string;
}

export interface ResponsibleGroup {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
  members: GroupMembership[];
  aircraft_tail_numbers: string[];
}

export interface AircraftGroupAssignment {
  id: number;
  aircraft_id: number;
  group_id: number;
  start_date: string;
  end_date?: string | null;
  notes?: string | null;
  group: ResponsibleGroup;
}

export interface Assignment {
  id: number;
  person_id: number;
  aircraft_id: number;
  role_in_aircraft: AssignmentRole;
  start_date: string;
  end_date?: string | null;
  notes?: string | null;
  person: Person;
  aircraft: Aircraft;
}

export interface MaintenanceOrder {
  id: number;
  order_number: string;
  aircraft_id: number;
  component_id?: number | null;
  type: MaintenanceType;
  priority: Criticality;
  status: OrderStatus;
  title: string;
  description?: string | null;
  reference_doc?: string | null;
  opened_by_id?: number | null;
  responsible_id?: number | null;
  opened_at: string;
  due_at?: string | null;
  closed_at?: string | null;
  flight_hours_at_event?: number | null;
  findings?: string | null;
  actions_taken?: string | null;
  parts_used?: string | null;
  team_members?: string | null;
  team_group_id?: number | null;
  cancelled_by_id?: number | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
}

export interface ChecklistTemplate {
  id: number;
  name: string;
  aircraft_model?: string | null;
  interval_type: string;
  interval_value?: number | null;
  reference_doc?: string | null;
  items: string[];
  category: MaintenanceType;
  created_at: string;
}

export interface FlightLog {
  id: number;
  aircraft_id: number;
  pilot_id?: number | null;
  date: string;
  duration_hours: number;
  mission_type?: string | null;
  discrepancies?: string | null;
}

export interface Alert {
  severity: "info" | "atencao" | "critico";
  category: string;
  title: string;
  detail: string;
  aircraft_id?: number | null;
  aircraft_tail_number?: string | null;
  component_id?: number | null;
  order_id?: number | null;
}

export interface DashboardSummary {
  total_aircraft: number;
  operational_aircraft: number;
  in_maintenance_aircraft: number;
  open_orders: number;
  critical_orders: number;
  average_health_index: number;
  average_fleet_availability_pct: number;
  alerts: Alert[];
}

export interface InspectionFinding {
  id: number;
  aircraft_id: number;
  component_id?: number | null;
  photo_url: string;
  defect_type: DefectType;
  location?: string | null;
  severity: Criticality;
  extent?: string | null;
  probable_cause?: string | null;
  amm_reference?: string | null;
  notes?: string | null;
  recorded_by_id?: number | null;
  recorded_at: string;
}

export interface ReliabilityMetrics {
  aircraft_id: number;
  aircraft_tail_number: string;
  sample_size: number;
  mtbf_hours?: number | null;
  mttr_hours?: number | null;
  failure_rate_per_hour?: number | null;
  reliability_pct_next_100h?: number | null;
  availability_intrinsic_pct?: number | null;
  availability_operational_pct?: number | null;
  weibull_beta_estimate?: number | null;
  confidence_note: string;
}

export interface RiskFactorScore {
  factor: string;
  weight_pct: number;
  score_pct: number;
  contribution_pct: number;
  basis: string;
}

export interface OperationalRiskBreakdown {
  aircraft_id: number;
  aircraft_tail_number: string;
  factors: RiskFactorScore[];
  risk_score_pct: number;
  risk_level: string;
}

export interface DiagnosticMatch {
  order_number: string;
  aircraft_tail_number: string;
  title: string;
  description?: string | null;
  actions_taken?: string | null;
  parts_used?: string | null;
  similarity_pct: number;
}

export interface DiagnosticResult {
  symptom: string;
  total_similar_occurrences: number;
  matches: DiagnosticMatch[];
  most_common_action?: string | null;
  most_common_action_pct?: number | null;
  summary_text: string;
  method_note: string;
}

export interface FleetAvailabilityDay {
  date: string;
  available_count: number;
  unavailable_count: number;
  at_risk_tail_numbers: string[];
}

export interface FleetAvailabilityForecast {
  horizon_days: number;
  total_aircraft: number;
  days: FleetAvailabilityDay[];
  highest_impact_order?: string | null;
  highest_impact_note?: string | null;
}

export interface ProspectiveAnalysisResult {
  aircraft_tail_number: string;
  postpone_days: number;
  assumed_daily_flight_hours: number;
  extra_flight_hours_estimated: number;
  current_health_index: number;
  projected_health_index: number;
  current_risk_level: string;
  projected_risk_level: string;
  affected_component_name?: string | null;
  current_component_wear_pct?: number | null;
  projected_component_wear_pct?: number | null;
  availability_impact_pct: number;
  estimated_financial_impact_brl: number;
  increased_failure_probability_pct: number;
  recommendation: string;
  method_note: string;
}

export type NotificationChannel = "E-mail" | "SMS" | "WhatsApp";
export type NotificationReason =
  | "Mudança de Status da Aeronave" | "Vencimento de Peça" | "Manutenção Registrada"
  | "Cancelamento de Ordem de Serviço" | "Manual";
export type NotificationStatus = "Enviada" | "Simulada" | "Falha no Envio";

export interface Notification {
  id: number;
  channel: NotificationChannel;
  reason: NotificationReason;
  status: NotificationStatus;
  subject: string;
  message: string;
  detail?: string | null;
  recipient_person_id?: number | null;
  recipient_name?: string | null;
  aircraft_id?: number | null;
  aircraft_tail_number?: string | null;
  component_id?: number | null;
  component_name?: string | null;
  created_at: string;
}

export interface PendingPartAlert {
  aircraft_id: number;
  aircraft_tail_number: string;
  component_id: number;
  component_name: string;
  severity: string;
  detail: string;
  suggested_recipients: Person[];
}

export type LookupCategory =
  | "Organização" | "Posto / Graduação / Cargo" | "Especialidade" | "Esquadrão / Unidade"
  | "Componente Associado (padrão)" | "Tipo de Intervalo de Manutenção"
  | "Categoria de Alerta de Manutenção Preventiva";

export interface LookupItem {
  id: number;
  category: LookupCategory;
  value: string;
  active: boolean;
  created_at: string;
}

export type AuditAction = "Criação" | "Alteração" | "Inativação" | "Reativação" | "Cancelamento";

export interface AuditLogEntry {
  id: number;
  actor_username?: string | null;
  actor_person_name?: string | null;
  entity_type: string;
  entity_id: number;
  entity_label?: string | null;
  action: AuditAction;
  summary: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  username: string;
  role: PersonRole;
  person?: Person | null;
}
