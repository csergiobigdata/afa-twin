"""Schemas Pydantic (contratos de entrada/saída da API)."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import (
    AircraftCategory, AircraftStatus, PersonRole, ComponentCategory,
    MonitoringType, Criticality, MaintenanceType, OrderStatus, AssignmentRole,
    RiskLevel, DefectType, NotificationChannel, NotificationReason, NotificationStatus,
    LookupCategory, AuditAction, AvailabilityCode,
)


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------- Aircraft ----------------

class AircraftBase(BaseModel):
    tail_number: str = Field(..., examples=["FAB 5962"])
    nickname: Optional[str] = None
    manufacturer: str
    model: str
    category: AircraftCategory
    squadron: Optional[str] = None
    base: Optional[str] = None
    manufacture_year: Optional[int] = None
    total_flight_hours: float = 0
    engine_config: Optional[str] = None
    avionics_config: Optional[str] = None
    armament_config: Optional[str] = None
    max_speed_kmh: Optional[float] = None
    service_ceiling_m: Optional[float] = None
    max_range_km: Optional[float] = None
    crew_capacity: Optional[int] = None
    status: AircraftStatus = AircraftStatus.OPERACIONAL
    silhouette_key: str = "generic"
    notes: Optional[str] = None
    next_mission_risk: RiskLevel = RiskLevel.MEDIO
    weather_risk: RiskLevel = RiskLevel.MEDIO


class AircraftCreate(AircraftBase):
    pass


class AircraftUpdate(BaseModel):
    tail_number: Optional[str] = None
    nickname: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    category: Optional[AircraftCategory] = None
    squadron: Optional[str] = None
    base: Optional[str] = None
    manufacture_year: Optional[int] = None
    total_flight_hours: Optional[float] = None
    engine_config: Optional[str] = None
    avionics_config: Optional[str] = None
    armament_config: Optional[str] = None
    max_speed_kmh: Optional[float] = None
    service_ceiling_m: Optional[float] = None
    max_range_km: Optional[float] = None
    crew_capacity: Optional[int] = None
    status: Optional[AircraftStatus] = None
    silhouette_key: Optional[str] = None
    notes: Optional[str] = None
    next_mission_risk: Optional[RiskLevel] = None
    weather_risk: Optional[RiskLevel] = None


class AircraftOut(AircraftBase, ORMModel):
    id: int
    created_at: dt.datetime
    photo_url: Optional[str] = None
    photo_animated_url: Optional[str] = None
    health_index: Optional[float] = None
    risk_level: Optional[str] = None
    availability_pct: Optional[float] = None
    reliability_pct: Optional[float] = None


# ---------------- Component ----------------

class ComponentBase(BaseModel):
    name: str
    part_number: Optional[str] = None
    serial_number: Optional[str] = None
    category: ComponentCategory
    monitoring_type: MonitoringType = MonitoringType.ON_CONDITION
    criticality: Criticality = Criticality.MEDIA
    install_date: Optional[dt.date] = None
    life_limit_hours: Optional[float] = None
    hours_since_new: float = 0
    hours_since_overhaul: float = 0
    last_inspection_date: Optional[dt.date] = None
    next_inspection_due_hours: Optional[float] = None
    preventive_interval_days: Optional[float] = None
    next_preventive_date: Optional[dt.date] = None
    status: AircraftStatus = AircraftStatus.OPERACIONAL
    notes: Optional[str] = None


class ComponentCreate(ComponentBase):
    aircraft_id: int


class ComponentUpdate(BaseModel):
    name: Optional[str] = None
    part_number: Optional[str] = None
    serial_number: Optional[str] = None
    category: Optional[ComponentCategory] = None
    monitoring_type: Optional[MonitoringType] = None
    criticality: Optional[Criticality] = None
    install_date: Optional[dt.date] = None
    life_limit_hours: Optional[float] = None
    hours_since_new: Optional[float] = None
    hours_since_overhaul: Optional[float] = None
    last_inspection_date: Optional[dt.date] = None
    next_inspection_due_hours: Optional[float] = None
    preventive_interval_days: Optional[float] = None
    next_preventive_date: Optional[dt.date] = None
    status: Optional[AircraftStatus] = None
    notes: Optional[str] = None


class ComponentOut(ComponentBase, ORMModel):
    id: int
    aircraft_id: int
    wear_pct: Optional[float] = None
    created_at: dt.datetime


# ---------------- Person ----------------

class PersonBase(BaseModel):
    full_name: str
    organization: str = "Força Aérea Brasileira"
    role: PersonRole
    rank: Optional[str] = None
    registration_number: Optional[str] = None
    specialty: Optional[str] = None
    squadron: Optional[str] = None
    certifications: Optional[str] = None
    email: Optional[EmailStr] = Field(None, description="Usado para envio real de alertas por e-mail")
    phone_ddd: Optional[str] = Field(None, pattern=r"^\d{2}$", description="DDD com 2 dígitos, ex.: 61")
    phone_number: Optional[str] = Field(None, pattern=r"^\d{5}-\d{4}$", description="Telefone no formato 99999-9999")
    active: bool = True


class PersonCreate(PersonBase):
    pass


class PersonUpdate(BaseModel):
    full_name: Optional[str] = None
    organization: Optional[str] = None
    role: Optional[PersonRole] = None
    rank: Optional[str] = None
    registration_number: Optional[str] = None
    specialty: Optional[str] = None
    squadron: Optional[str] = None
    certifications: Optional[str] = None
    email: Optional[EmailStr] = None
    phone_ddd: Optional[str] = Field(None, pattern=r"^\d{2}$")
    phone_number: Optional[str] = Field(None, pattern=r"^\d{5}-\d{4}$")
    active: Optional[bool] = None


class PersonOut(PersonBase, ORMModel):
    id: int
    photo_url: Optional[str] = None
    created_at: dt.datetime


class PersonSelfUpdate(BaseModel):
    """Campos que o próprio usuário pode editar no 'Meu Perfil' - contato
    usado para o envio de alertas/notificações."""
    email: Optional[EmailStr] = None
    phone_ddd: Optional[str] = Field(None, pattern=r"^\d{2}$")
    phone_number: Optional[str] = Field(None, pattern=r"^\d{5}-\d{4}$")


# ---------------- Assignment ----------------

class AssignmentBase(BaseModel):
    person_id: int
    aircraft_id: int
    role_in_aircraft: AssignmentRole
    start_date: dt.date
    end_date: Optional[dt.date] = None
    notes: Optional[str] = None


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentOut(AssignmentBase, ORMModel):
    id: int
    person: PersonOut
    aircraft: AircraftOut


# ---------------- Grupo/Equipe Responsável ----------------

class GroupMembershipCreate(BaseModel):
    person_id: int
    role_in_group: AssignmentRole


class GroupMembershipOut(ORMModel):
    id: int
    person: PersonOut
    role_in_group: AssignmentRole
    joined_at: dt.date


class ResponsibleGroupBase(BaseModel):
    name: str = Field(..., examples=["Equipe Gripen Alpha"])
    description: Optional[str] = None


class ResponsibleGroupCreate(ResponsibleGroupBase):
    members: list[GroupMembershipCreate] = []


class ResponsibleGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ResponsibleGroupOut(ResponsibleGroupBase, ORMModel):
    id: int
    created_at: dt.datetime
    members: list[GroupMembershipOut] = []
    aircraft_tail_numbers: list[str] = []


class AircraftGroupAssignmentCreate(BaseModel):
    aircraft_id: int
    group_id: int
    start_date: dt.date
    end_date: Optional[dt.date] = None
    notes: Optional[str] = None


class AircraftGroupAssignmentOut(AircraftGroupAssignmentCreate, ORMModel):
    id: int
    group: ResponsibleGroupOut


# ---------------- Maintenance Order ----------------

class MaintenanceOrderBase(BaseModel):
    aircraft_id: int
    component_id: Optional[int] = None
    type: MaintenanceType
    priority: Criticality = Criticality.MEDIA
    status: OrderStatus = OrderStatus.ABERTA
    title: str
    description: Optional[str] = None
    reference_doc: Optional[str] = None
    opened_by_id: Optional[int] = None
    responsible_id: Optional[int] = None
    due_at: Optional[dt.datetime] = None
    flight_hours_at_event: Optional[float] = None
    findings: Optional[str] = None
    actions_taken: Optional[str] = None
    parts_used: Optional[str] = None
    team_members: Optional[str] = None
    team_group_id: Optional[int] = Field(None, description="Equipe/grupo formalmente responsável pela execução")


class MaintenanceOrderCreate(MaintenanceOrderBase):
    pass


class MaintenanceOrderUpdate(BaseModel):
    component_id: Optional[int] = None
    type: Optional[MaintenanceType] = None
    priority: Optional[Criticality] = None
    status: Optional[OrderStatus] = None
    title: Optional[str] = None
    description: Optional[str] = None
    reference_doc: Optional[str] = None
    responsible_id: Optional[int] = None
    due_at: Optional[dt.datetime] = None
    flight_hours_at_event: Optional[float] = None
    findings: Optional[str] = None
    actions_taken: Optional[str] = None
    parts_used: Optional[str] = None
    team_members: Optional[str] = None
    team_group_id: Optional[int] = None
    cancelled_by_id: Optional[int] = Field(None, description="Obrigatório ao definir status = Cancelada")
    cancellation_reason: Optional[str] = None


class MaintenanceOrderOut(MaintenanceOrderBase, ORMModel):
    id: int
    order_number: str
    opened_at: dt.datetime
    closed_at: Optional[dt.datetime] = None
    cancelled_by_id: Optional[int] = None
    cancelled_at: Optional[dt.datetime] = None
    cancellation_reason: Optional[str] = None


# ---------------- Checklist template ----------------

class ChecklistTemplateBase(BaseModel):
    name: str
    aircraft_model: Optional[str] = None
    interval_type: str = "HORAS"
    interval_value: Optional[float] = None
    reference_doc: Optional[str] = None
    items: list[str] = []
    category: MaintenanceType = MaintenanceType.INSPECAO_ROTINA


class ChecklistTemplateCreate(ChecklistTemplateBase):
    pass


class ChecklistTemplateOut(ChecklistTemplateBase, ORMModel):
    id: int
    created_at: dt.datetime


# ---------------- Flight log ----------------

class FlightLogBase(BaseModel):
    aircraft_id: int
    pilot_id: Optional[int] = None
    date: dt.date
    duration_hours: float
    mission_type: Optional[str] = None
    discrepancies: Optional[str] = None


class FlightLogCreate(FlightLogBase):
    pass


class FlightLogOut(FlightLogBase, ORMModel):
    id: int


# ---------------- Atualização de Disponibilidade ----------------

class AvailabilityUpdateBase(BaseModel):
    aircraft_id: int
    report_date: dt.date
    code: AvailabilityCode
    configuration: Optional[str] = Field(
        None, description="Configuração de asas/hardpoints no momento (ex.: LISO, ADA, EEXD, VENTRAL, CAA)."
    )
    has_subalares: bool = False
    reason: Optional[str] = Field(None, description="Motivo/observação, ex.: 'TREM DE POUSO', 'não aciona com UFT à diesel'.")


class AvailabilityUpdateCreate(AvailabilityUpdateBase):
    pass


class AvailabilityUpdateOut(AvailabilityUpdateBase, ORMModel):
    id: int
    aircraft_tail_number: str
    recorded_by_id: Optional[int] = None
    recorded_by_name: Optional[str] = None
    created_at: dt.datetime


class AvailabilityBoardEntry(BaseModel):
    """Última atualização conhecida de uma aeronave - uma linha do quadro."""
    aircraft_id: int
    aircraft_tail_number: str
    aircraft_model: str
    availability_update_id: int
    report_date: dt.date
    code: AvailabilityCode
    configuration: Optional[str] = None
    has_subalares: bool = False
    reason: Optional[str] = None
    created_at: dt.datetime


class AvailabilityBoard(BaseModel):
    """Quadro de disponibilidade da frota: última atualização de cada
    aeronave + totais, no mesmo formato do boletim de esquadrão (Totais
    DI/DO/IN, Configuração DI/DO, SUBALARES)."""
    report_date: Optional[dt.date] = None
    entries: list[AvailabilityBoardEntry]
    di_count: int = 0
    do_count: int = 0
    in_count: int = 0
    subalares_count: int = 0
    configuration_counts: dict[str, int] = {}
    aircraft_without_update: list[str] = []


# ---------------- Auth ----------------

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str
    person: Optional[PersonOut] = None


# ---------------- Inspeção Fotográfica ----------------

class InspectionFindingBase(BaseModel):
    aircraft_id: int
    component_id: Optional[int] = None
    defect_type: DefectType
    location: Optional[str] = None
    severity: Criticality = Criticality.MEDIA
    extent: Optional[str] = None
    probable_cause: Optional[str] = None
    amm_reference: Optional[str] = None
    notes: Optional[str] = None
    recorded_by_id: Optional[int] = None


class InspectionFindingOut(InspectionFindingBase, ORMModel):
    id: int
    photo_url: str
    recorded_at: dt.datetime


# ---------------- Confiabilidade (MTBF/MTTR/Weibull/Disponibilidade) ----------------

class ReliabilityMetrics(BaseModel):
    aircraft_id: int
    aircraft_tail_number: str
    sample_size: int = Field(description="Número de manutenções corretivas concluídas usadas na estimativa")
    mtbf_hours: Optional[float] = Field(None, description="Tempo médio entre falhas (horas de voo)")
    mttr_hours: Optional[float] = Field(None, description="Tempo médio de reparo (horas corridas)")
    failure_rate_per_hour: Optional[float] = Field(None, description="Taxa de falha λ = 1/MTBF")
    reliability_pct_next_100h: Optional[float] = Field(None, description="R(t) estimado para as próximas 100h de voo, modelo exponencial")
    availability_intrinsic_pct: Optional[float] = Field(None, description="MTBF / (MTBF + MTTR)")
    availability_operational_pct: Optional[float] = Field(None, description="Considera também atraso logístico (peças) observado")
    weibull_beta_estimate: Optional[float] = Field(None, description="Estimativa simplificada do parâmetro de forma (β); β≈1 ~ exponencial")
    confidence_note: str = Field(description="Nota de transparência sobre a robustez estatística da estimativa")


# ---------------- Risco Operacional ponderado ----------------

class RiskFactorScore(BaseModel):
    factor: str
    weight_pct: float
    score_pct: float
    contribution_pct: float
    basis: str


class OperationalRiskBreakdown(BaseModel):
    aircraft_id: int
    aircraft_tail_number: str
    factors: list[RiskFactorScore]
    risk_score_pct: float = Field(description="0 = sem risco, 100 = risco máximo")
    risk_level: str


# ---------------- Diagnóstico Inteligente (heurístico) ----------------

class DiagnosticQuery(BaseModel):
    symptom: str = Field(..., min_length=4, examples=["A luz FUEL PRESS permanece acesa"])
    aircraft_model: Optional[str] = None


class DiagnosticMatch(BaseModel):
    order_number: str
    aircraft_tail_number: str
    title: str
    description: Optional[str] = None
    actions_taken: Optional[str] = None
    parts_used: Optional[str] = None
    similarity_pct: float


class DiagnosticResult(BaseModel):
    symptom: str
    total_similar_occurrences: int
    matches: list[DiagnosticMatch]
    most_common_action: Optional[str] = None
    most_common_action_pct: Optional[float] = None
    summary_text: str
    method_note: str = (
        "Busca heurística por similaridade textual sobre o histórico de ordens de serviço da frota "
        "(não é um modelo de linguagem treinado). Fundação para o módulo de Diagnóstico Inteligente "
        "por IA/PLN descrito na evolução planejada do projeto."
    )


# ---------------- Disponibilidade da Frota (projeção) ----------------

class FleetAvailabilityDay(BaseModel):
    date: dt.date
    available_count: int
    unavailable_count: int
    at_risk_tail_numbers: list[str]


class FleetAvailabilityForecast(BaseModel):
    horizon_days: int
    total_aircraft: int
    days: list[FleetAvailabilityDay]
    highest_impact_order: Optional[str] = None
    highest_impact_note: Optional[str] = None


# ---------------- Análise Prospectiva de Manutenção (simulador "e se?") ----------------

class ProspectiveAnalysisRequest(BaseModel):
    aircraft_id: int
    component_id: Optional[int] = None
    postpone_days: int = Field(..., ge=1, le=180)
    daily_flight_hours_estimate: Optional[float] = Field(
        None, description="Estimativa de horas voadas por dia durante o adiamento; se omitido, usa a média histórica da aeronave"
    )


class ProspectiveAnalysisResult(BaseModel):
    aircraft_tail_number: str
    postpone_days: int
    assumed_daily_flight_hours: float
    extra_flight_hours_estimated: float
    current_health_index: float
    projected_health_index: float
    current_risk_level: str
    projected_risk_level: str
    affected_component_name: Optional[str] = None
    current_component_wear_pct: Optional[float] = None
    projected_component_wear_pct: Optional[float] = None
    availability_impact_pct: float = Field(description="Redução estimada na disponibilidade da frota, em pontos percentuais")
    estimated_financial_impact_brl: float = Field(description="Estimativa ilustrativa - ver method_note")
    increased_failure_probability_pct: float
    recommendation: str
    method_note: str = (
        "Simulação determinística e transparente baseada nos dados já cadastrados (não é previsão de "
        "IA/ML). Custo por dia de indisponibilidade é um parâmetro configurável de referência para a "
        "fase piloto - ajuste-o à realidade orçamentária real antes de usar o valor financeiro como "
        "insumo de decisão."
    )


# ---------------- Notificações (e-mail / SMS / WhatsApp) ----------------

class NotificationSendRequest(BaseModel):
    channel: NotificationChannel
    reason: NotificationReason = NotificationReason.MANUAL
    subject: str
    message: str
    aircraft_id: Optional[int] = None
    component_id: Optional[int] = None
    group_id: Optional[int] = Field(None, description="Notifica apenas os membros deste grupo/equipe")
    recipient_person_ids: Optional[list[int]] = Field(
        None,
        description="Se omitido, notifica os responsáveis vinculados à aeronave (individuais + membros dos "
                    "grupos responsáveis) ou, se group_id informado, apenas os membros desse grupo",
    )


class NotificationOut(BaseModel):
    id: int
    channel: NotificationChannel
    reason: NotificationReason
    status: NotificationStatus
    subject: str
    message: str
    detail: Optional[str] = None
    recipient_person_id: Optional[int] = None
    recipient_name: Optional[str] = None
    aircraft_id: Optional[int] = None
    aircraft_tail_number: Optional[str] = None
    component_id: Optional[int] = None
    component_name: Optional[str] = None
    created_at: dt.datetime


class PendingPartAlert(BaseModel):
    aircraft_id: int
    aircraft_tail_number: str
    component_id: int
    component_name: str
    severity: str
    detail: str
    suggested_recipients: list[PersonOut]


# ---------------- Cadastros Auxiliares (Lookups) ----------------

class LookupItemCreate(BaseModel):
    category: LookupCategory
    value: str


class LookupItemUpdate(BaseModel):
    value: Optional[str] = None
    active: Optional[bool] = None


class LookupItemOut(ORMModel):
    id: int
    category: LookupCategory
    value: str
    active: bool
    created_at: dt.datetime


# ---------------- Auditoria ----------------

class AuditLogOut(ORMModel):
    id: int
    actor_username: Optional[str] = None
    actor_person_name: Optional[str] = None
    entity_type: str
    entity_id: int
    entity_label: Optional[str] = None
    action: AuditAction
    summary: str
    created_at: dt.datetime


# ---------------- Dashboard ----------------

class AlertOut(BaseModel):
    severity: str  # info / atencao / critico
    category: str = "Outro"  # ex.: Vigência Vencida, OS Crítica em Aberto, Componente Próximo do Limite
    title: str
    detail: str
    aircraft_id: Optional[int] = None
    aircraft_tail_number: Optional[str] = None
    component_id: Optional[int] = None
    order_id: Optional[int] = None


class FleetSummaryItem(BaseModel):
    """Recorte leve de uma aeronave para a tabela do Painel - evita que o
    front precise de uma segunda chamada a GET /aircraft (que também recalcula
    confiabilidade/MTBF de cada aeronave, desnecessário para esta visão)."""
    id: int
    tail_number: str
    manufacturer: str
    model: str
    silhouette_key: str
    photo_url: Optional[str] = None
    status: AircraftStatus
    health_index: float
    risk_level: str


class DashboardSummary(BaseModel):
    total_aircraft: int
    operational_aircraft: int
    in_maintenance_aircraft: int
    open_orders: int
    critical_orders: int
    average_health_index: float
    average_fleet_availability_pct: float
    alerts: list[AlertOut]
    fleet: list[FleetSummaryItem] = []
    recent_notifications: list[NotificationOut] = []
