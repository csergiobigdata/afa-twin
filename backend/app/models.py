"""
Modelo de dados do AFA-TWIN - Gêmeo Digital para Apoio à Decisão
em Manutenção Aeronáutica.

Entidades derivadas do documento de referência (digital-twin-tcc.pdf):
configuração instalada, horas de voo por sistema, histórico de
substituições, inspeções, discrepâncias, tendências de desgaste,
disponibilidade de peças, status de manutenção e índice de saúde por
componente. Ver docs/03-modelo-de-dados.md para o diagrama completo.
"""
import enum
import datetime as dt

from sqlalchemy import (
    String, Integer, Float, Boolean, Text, ForeignKey, DateTime, LargeBinary, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


# --------------------------------------------------------------------------
# Arquivos enviados (fotos de aeronave, de perfil, de inspeção fotográfica).
#
# Guardados como dado binário dentro do próprio banco (coluna LargeBinary),
# em vez de arquivo em disco: hospedagens de nuvem "serverless" (ex.: Vercel)
# rodam a API em funções efêmeras sem disco persistente entre chamadas, então
# um arquivo salvo em uma chamada pode não existir mais na próxima. Guardar
# no banco (SQLite localmente, Postgres em nuvem) elimina essa dependência de
# disco, ao custo de consumir uma fração do limite de armazenamento do banco
# gratuito (ver docs/03-modelo-de-dados.md, seção 3, e docs/06, seção 5.2).
# --------------------------------------------------------------------------

class MediaAsset(Base):
    __tablename__ = "media_assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    content_type: Mapped[str] = mapped_column(String(100))
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


# --------------------------------------------------------------------------
# Enumerações de domínio
# --------------------------------------------------------------------------

class AircraftCategory(str, enum.Enum):
    CACA = "Caça"
    ATAQUE = "Ataque"
    TRANSPORTE = "Transporte"
    TREINAMENTO = "Treinamento"
    HELICOPTERO = "Helicóptero"
    PATRULHA = "Patrulha Marítima"
    REABASTECIMENTO = "Reabastecimento em Voo"


class AircraftStatus(str, enum.Enum):
    OPERACIONAL = "Operacional"
    EM_MANUTENCAO = "Em Manutenção"
    EM_INSPECAO = "Em Inspeção"
    INDISPONIVEL = "Indisponível"
    EM_MODERNIZACAO = "Em Modernização"


class PersonRole(str, enum.Enum):
    PILOTO = "Piloto"
    MECANICO = "Mecânico"
    ENGENHEIRO = "Engenheiro"
    CIENTISTA = "Cientista"
    GESTOR = "Gestor / Responsável Técnico"


class ComponentCategory(str, enum.Enum):
    MOTOR = "Motor / Grupo Motopropulsor"
    TREM_POUSO = "Trem de Pouso"
    HIDRAULICO = "Sistema Hidráulico"
    AVIONICO = "Aviônicos"
    ESTRUTURAL = "Estrutura"
    ARMAMENTO = "Armamento"
    COMBUSTIVEL = "Sistema de Combustível"
    ELETRICO = "Sistema Elétrico"
    OXIGENIO = "Oxigênio / Suporte à Vida"
    OUTRO = "Outro"


class MonitoringType(str, enum.Enum):
    HARD_TIME = "Hard Time (vida limite)"
    ON_CONDITION = "On Condition (sob condição)"
    CONDITION_MONITORING = "Condition Monitoring (monitorado)"


class Criticality(str, enum.Enum):
    BAIXA = "Baixa"
    MEDIA = "Média"
    ALTA = "Alta"
    CRITICA = "Crítica"


class MaintenanceType(str, enum.Enum):
    INSPECAO_ROTINA = "Inspeção de Rotina"
    PREVENTIVA_PROGRAMADA = "Preventiva Programada"
    CORRETIVA = "Corretiva"
    BOLETIM_AD_SB = "Boletim Técnico (AD/SB)"
    OVERHAUL = "Overhaul / Grande Reparo"
    MODIFICACAO = "Modificação / Modernização"


class OrderStatus(str, enum.Enum):
    ABERTA = "Aberta"
    EM_ANDAMENTO = "Em Andamento"
    AGUARDANDO_PECA = "Aguardando Peça"
    CONCLUIDA = "Concluída"
    CANCELADA = "Cancelada"


class RiskLevel(str, enum.Enum):
    """Nível de risco qualitativo para fatores de entrada manual do modelo de
    Risco Operacional (ex.: missão prevista, condições meteorológicas) -
    enquanto não há integração automática com sistemas de planejamento de
    missão/meteorologia (ver docs/04-protocolos-e-conformidade.md)."""
    BAIXO = "Baixo"
    MEDIO = "Médio"
    ALTO = "Alto"


class AssignmentRole(str, enum.Enum):
    """Papéis reconhecidos na aviação militar/civil para responsabilidade
    sobre uma aeronave - usados tanto no vínculo individual (Assignment)
    quanto na composição de um grupo/equipe responsável (GroupMembership).
    Ver docs/04-protocolos-e-conformidade.md, seção 7, para a fundamentação."""
    PILOTO_TITULAR = "Piloto Titular"                          # Piloto em Comando (PIC)
    PILOTO_RESERVA = "Piloto Reserva / Sub-Piloto"              # Copiloto / piloto reserva da tripulação
    PILOTO_INSTRUTOR = "Piloto Instrutor"
    MECANICO_RESPONSAVEL = "Mecânico Responsável"               # Crew Chief / mecânico de aeronave dedicada
    ENGENHEIRO_CONFIABILIDADE = "Engenheiro de Confiabilidade"
    CHEFE_MANUTENCAO = "Chefe de Manutenção"                    # Oficial de Manutenção / Maintenance Officer
    INSPETOR = "Inspetor de Qualidade"                          # Quality Assurance (QA)
    COMANDANTE_ESQUADRAO = "Comandante de Esquadrão"            # Autoridade operacional máxima / hierarquia imediata
    CIENTISTA_RESPONSAVEL = "Cientista Responsável (P&D)"


# --------------------------------------------------------------------------
# Aeronave
# --------------------------------------------------------------------------

class Aircraft(Base):
    __tablename__ = "aircraft"

    id: Mapped[int] = mapped_column(primary_key=True)
    tail_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)  # matrícula FAB
    nickname: Mapped[str | None] = mapped_column(String(60), nullable=True)
    manufacturer: Mapped[str] = mapped_column(String(80))
    model: Mapped[str] = mapped_column(String(80))
    category: Mapped[AircraftCategory] = mapped_column(SAEnum(AircraftCategory))
    squadron: Mapped[str | None] = mapped_column(String(120), nullable=True)  # Esquadrão / Grupo de Aviação
    base: Mapped[str | None] = mapped_column(String(120), nullable=True)  # Base Aérea
    manufacture_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_flight_hours: Mapped[float] = mapped_column(Float, default=0)

    # Características e configurações mecânicas
    engine_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    avionics_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    armament_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_speed_kmh: Mapped[float | None] = mapped_column(Float, nullable=True)
    service_ceiling_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_range_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    crew_capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[AircraftStatus] = mapped_column(SAEnum(AircraftStatus), default=AircraftStatus.OPERACIONAL)
    silhouette_key: Mapped[str] = mapped_column(String(30), default="generic")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    # Foto real da aeronave (upload) - imagem estática e uma variação animada
    # (gif/webp) para inspeção visual de detalhes. Guardadas como MediaAsset
    # (ver acima) e servidas em /api/media/<id>. Ver routers/aircraft.py.
    photo_asset_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id"), nullable=True)
    photo_animated_asset_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id"), nullable=True)

    @property
    def photo_url(self) -> str | None:
        return f"/api/media/{self.photo_asset_id}" if self.photo_asset_id else None

    @property
    def photo_animated_url(self) -> str | None:
        return f"/api/media/{self.photo_animated_asset_id}" if self.photo_animated_asset_id else None

    # Fatores de entrada manual do modelo de Risco Operacional ponderado
    # (missão prevista e condições meteorológicas) - ver compute.py e
    # docs/04-protocolos-e-conformidade.md.
    next_mission_risk: Mapped[RiskLevel] = mapped_column(SAEnum(RiskLevel), default=RiskLevel.MEDIO)
    weather_risk: Mapped[RiskLevel] = mapped_column(SAEnum(RiskLevel), default=RiskLevel.MEDIO)

    components: Mapped[list["Component"]] = relationship(back_populates="aircraft", cascade="all, delete-orphan")
    assignments: Mapped[list["Assignment"]] = relationship(back_populates="aircraft", cascade="all, delete-orphan")
    maintenance_orders: Mapped[list["MaintenanceOrder"]] = relationship(back_populates="aircraft", cascade="all, delete-orphan")
    flight_logs: Mapped[list["FlightLog"]] = relationship(back_populates="aircraft", cascade="all, delete-orphan")
    inspection_findings: Mapped[list["InspectionFinding"]] = relationship(back_populates="aircraft", cascade="all, delete-orphan")
    group_assignments: Mapped[list["AircraftGroupAssignment"]] = relationship(back_populates="aircraft", cascade="all, delete-orphan")


# --------------------------------------------------------------------------
# Componente (rastreio de desgaste / vida útil)
# --------------------------------------------------------------------------

class Component(Base):
    __tablename__ = "components"

    id: Mapped[int] = mapped_column(primary_key=True)
    aircraft_id: Mapped[int] = mapped_column(ForeignKey("aircraft.id"))

    name: Mapped[str] = mapped_column(String(120))
    part_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    category: Mapped[ComponentCategory] = mapped_column(SAEnum(ComponentCategory))
    monitoring_type: Mapped[MonitoringType] = mapped_column(SAEnum(MonitoringType), default=MonitoringType.ON_CONDITION)
    criticality: Mapped[Criticality] = mapped_column(SAEnum(Criticality), default=Criticality.MEDIA)

    install_date: Mapped[dt.date | None] = mapped_column(nullable=True)
    life_limit_hours: Mapped[float | None] = mapped_column(Float, nullable=True)  # hard-time
    hours_since_new: Mapped[float] = mapped_column(Float, default=0)
    hours_since_overhaul: Mapped[float] = mapped_column(Float, default=0)
    last_inspection_date: Mapped[dt.date | None] = mapped_column(nullable=True)
    next_inspection_due_hours: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Vigência de uso por calendário (independente das horas de voo) e
    # controle de alerta/notificação de manutenção preventiva - ex.: peças
    # com validade/prazo de troca por tempo decorrido (borrachas, baterias,
    # itens de suporte à vida), não apenas por horas de uso.
    preventive_interval_days: Mapped[float | None] = mapped_column(Float, nullable=True)
    next_preventive_date: Mapped[dt.date | None] = mapped_column(nullable=True)

    status: Mapped[AircraftStatus] = mapped_column(SAEnum(AircraftStatus), default=AircraftStatus.OPERACIONAL)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    aircraft: Mapped["Aircraft"] = relationship(back_populates="components")

    @property
    def wear_pct(self) -> float | None:
        """Percentual de vida consumida, quando o componente tem limite de vida (hard-time)."""
        if self.life_limit_hours and self.life_limit_hours > 0:
            return round(min(self.hours_since_overhaul / self.life_limit_hours, 1.5) * 100, 1)
        return None


class DefectType(str, enum.Enum):
    CORROSAO = "Corrosão"
    TRINCA = "Trinca"
    VAZAMENTO = "Vazamento"
    DESGASTE = "Desgaste"
    OUTRO = "Outro"


# --------------------------------------------------------------------------
# Inspeção Fotográfica (fundação manual do módulo de Visão Computacional
# descrito no documento de referência: mecânico fotografa corrosão, trinca,
# vazamento ou desgaste; localização/severidade/causa/referência AMM são
# preenchidas pelo mecânico/engenheiro nesta fase piloto, criando um
# histórico visual comparável ao longo do tempo por componente).
# --------------------------------------------------------------------------

class InspectionFinding(Base):
    __tablename__ = "inspection_findings"

    id: Mapped[int] = mapped_column(primary_key=True)
    aircraft_id: Mapped[int] = mapped_column(ForeignKey("aircraft.id"))
    component_id: Mapped[int | None] = mapped_column(ForeignKey("components.id"), nullable=True)

    photo_asset_id: Mapped[int] = mapped_column(ForeignKey("media_assets.id"))
    defect_type: Mapped[DefectType] = mapped_column(SAEnum(DefectType))
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    severity: Mapped[Criticality] = mapped_column(SAEnum(Criticality), default=Criticality.MEDIA)
    extent: Mapped[str | None] = mapped_column(String(200), nullable=True)  # extensão/medida observada
    probable_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    amm_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    recorded_by_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    recorded_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    aircraft: Mapped["Aircraft"] = relationship(back_populates="inspection_findings")
    component: Mapped["Component | None"] = relationship()
    recorded_by: Mapped["Person | None"] = relationship()

    @property
    def photo_url(self) -> str:
        return f"/api/media/{self.photo_asset_id}"


# --------------------------------------------------------------------------
# Pessoa (pilotos, mecânicos, engenheiros, cientistas, responsáveis)
# --------------------------------------------------------------------------

class Person(Base):
    __tablename__ = "people"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(150))
    # Texto livre (não mais enum fixo) para permitir cadastro de novas
    # organizações via Cadastros Auxiliares (LookupItem, categoria ORGANIZACAO)
    # sem exigir alteração de código - ver routers/lookups.py.
    organization: Mapped[str] = mapped_column(String(80), default="Força Aérea Brasileira")
    role: Mapped[PersonRole] = mapped_column(SAEnum(PersonRole))
    rank: Mapped[str | None] = mapped_column(String(60), nullable=True)  # Posto/Graduação (militares) ou cargo (civis)
    registration_number: Mapped[str | None] = mapped_column(String(60), nullable=True)  # matrícula / identidade funcional
    specialty: Mapped[str | None] = mapped_column(String(150), nullable=True)  # ex.: Motorista de Célula, Aviônicos, Confiabilidade
    squadron: Mapped[str | None] = mapped_column(String(120), nullable=True)
    certifications: Mapped[str | None] = mapped_column(Text, nullable=True)  # habilitações/licenças, separadas por vírgula
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)  # usado para envio real de alertas por e-mail
    phone_ddd: Mapped[str | None] = mapped_column(String(4), nullable=True)  # código de área (DDD)
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)  # número, sem o DDD
    photo_asset_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id"), nullable=True)  # foto de perfil
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    assignments: Mapped[list["Assignment"]] = relationship(back_populates="person", cascade="all, delete-orphan")
    group_memberships: Mapped[list["GroupMembership"]] = relationship(back_populates="person", cascade="all, delete-orphan")
    user: Mapped["User | None"] = relationship(back_populates="person", uselist=False)

    @property
    def phone_full(self) -> str | None:
        if self.phone_ddd and self.phone_number:
            return f"({self.phone_ddd}) {self.phone_number}"
        return self.phone_number

    @property
    def photo_url(self) -> str | None:
        return f"/api/media/{self.photo_asset_id}" if self.photo_asset_id else None


class Assignment(Base):
    """Vínculo entre uma pessoa e uma aeronave (quem é responsável por quê)."""
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"))
    aircraft_id: Mapped[int] = mapped_column(ForeignKey("aircraft.id"))
    role_in_aircraft: Mapped[AssignmentRole] = mapped_column(SAEnum(AssignmentRole))
    start_date: Mapped[dt.date] = mapped_column(default=lambda: now_utc().date())
    end_date: Mapped[dt.date | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    person: Mapped["Person"] = relationship(back_populates="assignments")
    aircraft: Mapped["Aircraft"] = relationship(back_populates="assignments")


# --------------------------------------------------------------------------
# Grupo/Equipe Responsável - a responsabilidade por uma aeronave, na prática
# aeronáutica, não recai sobre uma única pessoa: envolve o piloto em comando,
# eventual copiloto/piloto reserva, o mecânico responsável (crew chief),
# engenheiro de confiabilidade, inspetor de qualidade e o comandante de
# esquadrão (autoridade operacional). Um "grupo" modela essa equipe nomeada
# (ex.: "Equipe Gripen Alpha"), reutilizável e atribuível a uma ou mais
# aeronaves - inclusive mais de um grupo por aeronave (ex.: uma equipe de
# célula/motor e outra de aviônicos). Ver docs/04, seção 7.
# --------------------------------------------------------------------------

class ResponsibleGroup(Base):
    __tablename__ = "responsible_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))  # apelido do grupo, ex.: "Equipe Gripen Alpha"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    members: Mapped[list["GroupMembership"]] = relationship(back_populates="group", cascade="all, delete-orphan")
    aircraft_links: Mapped[list["AircraftGroupAssignment"]] = relationship(back_populates="group", cascade="all, delete-orphan")


class GroupMembership(Base):
    """Composição do grupo: quem participa e com qual papel."""
    __tablename__ = "group_memberships"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("responsible_groups.id"))
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"))
    role_in_group: Mapped[AssignmentRole] = mapped_column(SAEnum(AssignmentRole))
    joined_at: Mapped[dt.date] = mapped_column(default=lambda: now_utc().date())

    group: Mapped["ResponsibleGroup"] = relationship(back_populates="members")
    person: Mapped["Person"] = relationship(back_populates="group_memberships")


class AircraftGroupAssignment(Base):
    """Vincula um grupo/equipe como responsável por uma aeronave. Uma
    aeronave pode ter mais de um grupo responsável simultaneamente."""
    __tablename__ = "aircraft_group_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    aircraft_id: Mapped[int] = mapped_column(ForeignKey("aircraft.id"))
    group_id: Mapped[int] = mapped_column(ForeignKey("responsible_groups.id"))
    start_date: Mapped[dt.date] = mapped_column(default=lambda: now_utc().date())
    end_date: Mapped[dt.date | None] = mapped_column(nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    aircraft: Mapped["Aircraft"] = relationship(back_populates="group_assignments")
    group: Mapped["ResponsibleGroup"] = relationship(back_populates="aircraft_links")


# --------------------------------------------------------------------------
# Ordem de Serviço / Manutenção
# --------------------------------------------------------------------------

class MaintenanceOrder(Base):
    __tablename__ = "maintenance_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    aircraft_id: Mapped[int] = mapped_column(ForeignKey("aircraft.id"))
    component_id: Mapped[int | None] = mapped_column(ForeignKey("components.id"), nullable=True)

    type: Mapped[MaintenanceType] = mapped_column(SAEnum(MaintenanceType))
    priority: Mapped[Criticality] = mapped_column(SAEnum(Criticality), default=Criticality.MEDIA)
    status: Mapped[OrderStatus] = mapped_column(SAEnum(OrderStatus), default=OrderStatus.ABERTA)

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_doc: Mapped[str | None] = mapped_column(String(200), nullable=True)  # AMM / ICA / Boletim

    opened_by_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    responsible_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)

    opened_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    due_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    flight_hours_at_event: Mapped[float | None] = mapped_column(Float, nullable=True)
    findings: Mapped[str | None] = mapped_column(Text, nullable=True)
    actions_taken: Mapped[str | None] = mapped_column(Text, nullable=True)
    parts_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    team_members: Mapped[str | None] = mapped_column(Text, nullable=True)  # observações livres sobre a equipe
    team_group_id: Mapped[int | None] = mapped_column(ForeignKey("responsible_groups.id"), nullable=True)  # equipe/grupo formal

    # Uma OS nunca é excluída, e uma vez Concluída/Cancelada não pode mais ser
    # alterada (ver routers/maintenance.py). O cancelamento exige registrar
    # quem cancelou e quando, e dispara notificação ao grupo responsável.
    cancelled_by_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    cancelled_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    aircraft: Mapped["Aircraft"] = relationship(back_populates="maintenance_orders")
    component: Mapped["Component | None"] = relationship()
    opened_by: Mapped["Person | None"] = relationship(foreign_keys=[opened_by_id])
    responsible: Mapped["Person | None"] = relationship(foreign_keys=[responsible_id])
    cancelled_by: Mapped["Person | None"] = relationship(foreign_keys=[cancelled_by_id])
    team_group: Mapped["ResponsibleGroup | None"] = relationship()


# --------------------------------------------------------------------------
# Protocolo / Checklist de manutenção (modelo reutilizável)
# --------------------------------------------------------------------------

class ChecklistTemplate(Base):
    __tablename__ = "checklist_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    aircraft_model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    interval_type: Mapped[str] = mapped_column(String(20), default="HORAS")  # HORAS / DIAS / CICLOS
    interval_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    reference_doc: Mapped[str | None] = mapped_column(String(200), nullable=True)
    items_json: Mapped[str] = mapped_column(Text, default="[]")  # lista de etapas serializada em JSON
    category: Mapped[MaintenanceType] = mapped_column(SAEnum(MaintenanceType), default=MaintenanceType.INSPECAO_ROTINA)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


# --------------------------------------------------------------------------
# Livro de bordo simplificado
# --------------------------------------------------------------------------

class FlightLog(Base):
    __tablename__ = "flight_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    aircraft_id: Mapped[int] = mapped_column(ForeignKey("aircraft.id"))
    pilot_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    date: Mapped[dt.date] = mapped_column(default=lambda: now_utc().date())
    duration_hours: Mapped[float] = mapped_column(Float, default=0)
    mission_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    discrepancies: Mapped[str | None] = mapped_column(Text, nullable=True)  # discrepâncias do livro de bordo

    aircraft: Mapped["Aircraft"] = relationship(back_populates="flight_logs")
    pilot: Mapped["Person | None"] = relationship()


# --------------------------------------------------------------------------
# Usuário (autenticação simplificada do piloto de testes)
# --------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200))
    password_salt: Mapped[str] = mapped_column(String(64))
    role: Mapped[PersonRole] = mapped_column(SAEnum(PersonRole))
    person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    person: Mapped["Person | None"] = relationship(back_populates="user")


# --------------------------------------------------------------------------
# Notificações (e-mail / SMS / WhatsApp) - alerta de mudança de status de
# aeronave e de vigência de peças próxima do vencimento, com histórico
# completo de quem foi notificado, por qual canal e com qual resultado.
# Ver backend/app/notifications.py para a lógica de envio.
# --------------------------------------------------------------------------

class NotificationChannel(str, enum.Enum):
    EMAIL = "E-mail"
    SMS = "SMS"
    WHATSAPP = "WhatsApp"


class NotificationReason(str, enum.Enum):
    MUDANCA_STATUS = "Mudança de Status da Aeronave"
    VENCIMENTO_PECA = "Vencimento de Peça"
    MANUTENCAO_REGISTRADA = "Manutenção Registrada"
    CANCELAMENTO_OS = "Cancelamento de Ordem de Serviço"
    MANUAL = "Manual"


class NotificationStatus(str, enum.Enum):
    ENVIADA = "Enviada"
    SIMULADA = "Simulada"
    FALHA = "Falha no Envio"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    channel: Mapped[NotificationChannel] = mapped_column(SAEnum(NotificationChannel))
    reason: Mapped[NotificationReason] = mapped_column(SAEnum(NotificationReason), default=NotificationReason.MANUAL)
    status: Mapped[NotificationStatus] = mapped_column(SAEnum(NotificationStatus))

    subject: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)  # resultado/erro do envio, para transparência

    recipient_person_id: Mapped[int | None] = mapped_column(ForeignKey("people.id"), nullable=True)
    aircraft_id: Mapped[int | None] = mapped_column(ForeignKey("aircraft.id"), nullable=True)
    component_id: Mapped[int | None] = mapped_column(ForeignKey("components.id"), nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    recipient: Mapped["Person | None"] = relationship()
    aircraft: Mapped["Aircraft | None"] = relationship()
    component: Mapped["Component | None"] = relationship()


# --------------------------------------------------------------------------
# Cadastros Auxiliares (listas editáveis usadas como listbox em formulários -
# Organização, Posto/Graduação/Cargo, Especialidade, Esquadrão/Unidade,
# Componente Padrão, Tipo de Intervalo de Manutenção, Categoria de Alerta
# Preventivo). "Função" (PersonRole) e "Tipo de Manutenção" (MaintenanceType)
# permanecem enums fixos do sistema por estarem ligados a regras de negócio
# (permissões, cálculo de confiabilidade) - ver docs/04, seção 8.
# --------------------------------------------------------------------------

class LookupCategory(str, enum.Enum):
    ORGANIZACAO = "Organização"
    POSTO_GRADUACAO = "Posto / Graduação / Cargo"
    ESPECIALIDADE = "Especialidade"
    ESQUADRAO = "Esquadrão / Unidade"
    COMPONENTE_PADRAO = "Componente Associado (padrão)"
    TIPO_INTERVALO = "Tipo de Intervalo de Manutenção"
    CATEGORIA_ALERTA = "Categoria de Alerta de Manutenção Preventiva"


class LookupItem(Base):
    __tablename__ = "lookup_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[LookupCategory] = mapped_column(SAEnum(LookupCategory))
    value: Mapped[str] = mapped_column(String(150))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


# --------------------------------------------------------------------------
# Auditoria - trilha de quem incluiu/alterou/inativou/cancelou um registro,
# quando. Ver backend/app/audit.py.
# --------------------------------------------------------------------------

class AuditAction(str, enum.Enum):
    CRIACAO = "Criação"
    ALTERACAO = "Alteração"
    INATIVACAO = "Inativação"
    REATIVACAO = "Reativação"
    CANCELAMENTO = "Cancelamento"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_username: Mapped[str | None] = mapped_column(String(60), nullable=True)
    actor_person_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(60))  # ex.: "Aeronave", "Usuário", "Ordem de Serviço"
    entity_id: Mapped[int] = mapped_column(Integer)
    entity_label: Mapped[str | None] = mapped_column(String(200), nullable=True)  # ex.: matrícula/nome, para exibição
    action: Mapped[AuditAction] = mapped_column(SAEnum(AuditAction))
    summary: Mapped[str] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
