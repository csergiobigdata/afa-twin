"""
Popula o banco local com dados de demonstração realistas (porém fictícios
nos detalhes operacionais) para o piloto de testes: frota mista da FAB,
pessoal com postos/graduações e organizações (FAB, ITA, Embraer),
componentes com desgaste variado e ordens de serviço em diferentes status.

Esquadrão/base/horas são ilustrativos para fins do piloto - não representam
dados operacionais reais ou classificados.
"""
import datetime as dt
import os

from sqlalchemy.orm import Session

from . import models, security
from .database import INSPECTION_UPLOADS_DIR


def _today_minus(days: int) -> dt.date:
    return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)).date()


def _today_plus(days: int) -> dt.date:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=days)).date()


def _write_seed_photo(filename: str, svg_body: str) -> str:
    """Grava uma imagem ilustrativa de exemplo (não é uma foto real de dano)
    usada apenas para demonstrar o módulo de Inspeção Fotográfica no piloto."""
    path = os.path.join(INSPECTION_UPLOADS_DIR, filename)
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(svg_body)
    return filename


def seed_if_empty(db: Session) -> None:
    if db.query(models.Aircraft).count() > 0:
        return

    # ---------------- Aeronaves ----------------
    aircraft_data = [
        dict(
            tail_number="FAB 5962", nickname="Super Tucano 62", manufacturer="Embraer",
            model="A-29 Super Tucano", category=models.AircraftCategory.ATAQUE,
            squadron="1º/3º GAv (ilustrativo)", base="Base Aérea de Santa Maria (ilustrativo)",
            manufacture_year=2006, total_flight_hours=3120,
            engine_config="1x turboélice Pratt & Whitney Canada PT6A-68C, hélice quadripá Hartzell",
            avionics_config="Aviônica integrada Elbit, HUD, HOTAS, sistema de navegação GPS/INS",
            armament_config="2x metralhadoras .50 nas asas, pontos externos para foguetes e bombas guiadas",
            max_speed_kmh=590, service_ceiling_m=10670, max_range_km=1330, crew_capacity=2,
            status=models.AircraftStatus.OPERACIONAL, silhouette_key="a29",
            notes="Aeronave de referência do documento de estudo do Digital Twin (exemplo de índice de risco operacional).",
            next_mission_risk=models.RiskLevel.BAIXO, weather_risk=models.RiskLevel.BAIXO,
        ),
        dict(
            tail_number="FAB 4100", nickname="Gripen One", manufacturer="Saab",
            model="F-39E Gripen", category=models.AircraftCategory.CACA,
            squadron="1º GDA (ilustrativo)", base="Base Aérea de Anápolis (ilustrativo)",
            manufacture_year=2022, total_flight_hours=410,
            engine_config="1x turbofan Volvo Aero RM12 com pós-combustão",
            avionics_config="Radar AESA Raven ES-05, sistema de guerra eletrônica, fusão de sensores, capacete HMD",
            armament_config="Canhão interno 27mm Mauser BK27, mísseis ar-ar/ar-superfície em pontos externos",
            max_speed_kmh=2140, service_ceiling_m=15240, max_range_km=1500, crew_capacity=1,
            status=models.AircraftStatus.OPERACIONAL, silhouette_key="gripen",
            notes="Caça de 4,5ª geração, principal projeto de modernização da aviação de caça da FAB (parceria com a Saab).",
        ),
        dict(
            tail_number="FAB 4824", nickname="Tiger 24", manufacturer="Northrop / Embraer (modernização)",
            model="F-5EM Tiger II", category=models.AircraftCategory.CACA,
            squadron="1º/1º GAvCa (ilustrativo)", base="Base Aérea de Canoas (ilustrativo)",
            manufacture_year=1975, total_flight_hours=6890,
            engine_config="2x turbojatos General Electric J85-GE-21C",
            avionics_config="Radar Grifo-F, HUD, sistema de navegação modernizado (programa F-5EM)",
            armament_config="2x canhões M39A2 20mm, mísseis Piranha/AIM-9",
            max_speed_kmh=1700, service_ceiling_m=15790, max_range_km=1400, crew_capacity=1,
            status=models.AircraftStatus.EM_MANUTENCAO, silhouette_key="f5em",
            notes="Aeronave legado com alta acumulação de horas de célula - candidata a inspeções estruturais mais frequentes.",
            next_mission_risk=models.RiskLevel.ALTO, weather_risk=models.RiskLevel.MEDIO,
        ),
        dict(
            tail_number="FAB 5237", nickname="Escorpião 37", manufacturer="Embraer/Aermacchi",
            model="A-1M AMX", category=models.AircraftCategory.ATAQUE,
            squadron="Esquadrão Escorpião (ilustrativo)", base="Base Aérea de Santa Cruz (ilustrativo)",
            manufacture_year=1990, total_flight_hours=5410,
            engine_config="1x turbofan Rolls-Royce Spey Mk 807",
            avionics_config="Aviônica modernizada (Programa A-1M), HUD, sistema de navegação/ataque integrado",
            armament_config="1x canhão M61 Vulcan 20mm (versão monoposto), pontos externos para bombas e mísseis",
            max_speed_kmh=900, service_ceiling_m=13000, max_range_km=1850, crew_capacity=1,
            status=models.AircraftStatus.OPERACIONAL, silhouette_key="amx",
            notes="Aeronave de ataque de fabricação nacional, papel relevante em missões de apoio aéreo aproximado.",
        ),
        dict(
            tail_number="FAB 2856", nickname="Millennium 56", manufacturer="Embraer",
            model="KC-390 Millennium", category=models.AircraftCategory.TRANSPORTE,
            squadron="1º Esquadrão de Transporte Militar (ilustrativo)", base="Base Aérea de Anápolis (ilustrativo)",
            manufacture_year=2019, total_flight_hours=1980,
            engine_config="2x turbofans International Aero Engines V2500-E5",
            avionics_config="Cockpit full glass, fly-by-wire, sistema de reabastecimento em voo (probe and drogue)",
            armament_config="Não aplicável (aeronave de transporte) - pode operar contramedidas defensivas",
            max_speed_kmh=870, service_ceiling_m=11000, max_range_km=6000, crew_capacity=3,
            status=models.AircraftStatus.OPERACIONAL, silhouette_key="kc390",
            notes="Plataforma multimissão: transporte tático, reabastecimento em voo e evacuação aeromédica.",
        ),
        dict(
            tail_number="FAB 2464", nickname="Hercules 64", manufacturer="Lockheed Martin",
            model="C-130H Hercules", category=models.AircraftCategory.TRANSPORTE,
            squadron="1º/1º GT (ilustrativo)", base="Base Aérea dos Afonsos (ilustrativo)",
            manufacture_year=1988, total_flight_hours=15420,
            engine_config="4x turboélices Allison T56-A-15",
            avionics_config="Aviônica parcialmente modernizada, sistema de navegação GPS/INS",
            armament_config="Não aplicável (aeronave de transporte)",
            max_speed_kmh=600, service_ceiling_m=10060, max_range_km=3800, crew_capacity=5,
            status=models.AircraftStatus.EM_INSPECAO, silhouette_key="c130",
            notes="Aeronave veterana da frota de transporte - inspeção estrutural programada (IAM) em andamento.",
        ),
        dict(
            tail_number="FAB 8940", nickname="Caracal 40", manufacturer="Airbus Helicopters",
            model="H-36 Caracal", category=models.AircraftCategory.HELICOPTERO,
            squadron="Esquadrão Poti (ilustrativo)", base="Base Aérea de Natal (ilustrativo)",
            manufacture_year=2013, total_flight_hours=2340,
            engine_config="2x turboeixos Turbomeca Makila 2A1",
            avionics_config="Sistema de navegação tática, FLIR, guincho de resgate",
            armament_config="Metralhadoras de porta (missões de combate e busca e salvamento)",
            max_speed_kmh=310, service_ceiling_m=4575, max_range_km=850, crew_capacity=2,
            status=models.AircraftStatus.OPERACIONAL, silhouette_key="h36",
            notes="Emprego em busca e salvamento (SAR) e transporte de tropas especiais.",
        ),
    ]

    aircraft_objs = {}
    for data in aircraft_data:
        a = models.Aircraft(**data)
        db.add(a)
        db.flush()
        aircraft_objs[data["tail_number"]] = a

    # ---------------- Pessoal ----------------
    people_data = [
        dict(full_name="Cel Av Ricardo Almeida Ferraz", organization="Força Aérea Brasileira",
             role=models.PersonRole.GESTOR, rank="Coronel Aviador", registration_number="FAB-018234",
             specialty="Chefia de Manutenção de Frota", squadron="Ala de Caça", email="r.ferraz@fab.mil.br",
             phone_ddd="61", phone_number="99999-0001"),
        dict(full_name="Ten Cel Av Marina Duque Estrada", organization="Força Aérea Brasileira",
             role=models.PersonRole.PILOTO, rank="Tenente-Coronel Aviadora", registration_number="FAB-024581",
             specialty="Piloto de Caça - Gripen F-39E", squadron="1º GDA",
             certifications="Habilitação F-39E, Curso de Piloto de Provas (EPP)", email="m.estrada@fab.mil.br",
             phone_ddd="61", phone_number="99999-0002"),
        dict(full_name="Maj Av Bruno Castro Vieira", organization="Força Aérea Brasileira",
             role=models.PersonRole.PILOTO, rank="Major Aviador", registration_number="FAB-027760",
             specialty="Piloto Instrutor - A-29 Super Tucano", squadron="1º/3º GAv",
             certifications="Habilitação A-29, Instrutor de Voo", email="b.vieira@fab.mil.br",
             phone_ddd="61", phone_number="99999-0003"),
        dict(full_name="Cap Esp Mec Douglas Nogueira Prado", organization="Força Aérea Brasileira",
             role=models.PersonRole.MECANICO, rank="Capitão Especialista em Mecânica", registration_number="FAB-031290",
             specialty="Manutenção de Célula e Motor - Caças", squadron="Esquadrão de Manutenção",
             certifications="Curso de Especialização em Mecânica de Aeronaves (CFOE)", email="d.prado@fab.mil.br",
             phone_ddd="61", phone_number="99999-0004"),
        dict(full_name="1S BMA Elias Tavares Cunha", organization="Força Aérea Brasileira",
             role=models.PersonRole.MECANICO, rank="1º Sargento - Base Mecânico de Aviação", registration_number="FAB-045102",
             specialty="Sistemas Hidráulicos e Trem de Pouso", squadron="Esquadrão de Manutenção",
             certifications="Curso de Formação de Sargentos (CFS-BMA)", email="e.cunha@fab.mil.br",
             phone_ddd="61", phone_number="99999-0005"),
        dict(full_name="2S BAV Patrícia Lemos Andrade", organization="Força Aérea Brasileira",
             role=models.PersonRole.MECANICO, rank="2º Sargento - Base Aviônicos", registration_number="FAB-048873",
             specialty="Aviônicos e Sistemas de Armamento", squadron="Esquadrão de Manutenção",
             certifications="Curso de Formação de Sargentos (CFS-BAV)", email="p.andrade@fab.mil.br",
             phone_ddd="61", phone_number="99999-0006"),
        dict(full_name="Eng. Camila Rezende Sales", organization="ITA",
             role=models.PersonRole.ENGENHEIRO, rank="Engenheira - Pesquisadora ITA", registration_number="ITA-2024-1187",
             specialty="Engenharia de Confiabilidade e Manutenção", squadron=None,
             certifications="Doutorado em Engenharia Aeronáutica e Mecânica (ITA)", email="camila.sales@ita.br",
             phone_ddd="12", phone_number="98888-1001"),
        dict(full_name="Eng. Felipe Augusto Kimura", organization="Embraer",
             role=models.PersonRole.ENGENHEIRO, rank="Engenheiro de Suporte ao Produto", registration_number="EMB-778341",
             specialty="Estruturas e Análise de Vida Útil de Componentes", squadron=None,
             certifications="Engenharia Aeroespacial, Especialista em Fadiga Estrutural", email="felipe.kimura@embraer.com.br",
             phone_ddd="12", phone_number="98888-1002"),
        dict(full_name="Dra. Helena Bittencourt Ramos", organization="ITA",
             role=models.PersonRole.CIENTISTA, rank="Professora / Pesquisadora", registration_number="ITA-DOC-0456",
             specialty="Inteligência Artificial aplicada a Manutenção Preditiva", squadron=None,
             certifications="Pós-doutorado em Aprendizado de Máquina para Confiabilidade", email="helena.ramos@ita.br",
             phone_ddd="12", phone_number="98888-1003"),
    ]
    people_objs = {}
    for data in people_data:
        p = models.Person(**data)
        db.add(p)
        db.flush()
        people_objs[data["full_name"]] = p

    # ---------------- Vínculos ----------------
    db.add_all([
        models.Assignment(person_id=people_objs["Cel Av Ricardo Almeida Ferraz"].id,
                           aircraft_id=aircraft_objs["FAB 4100"].id,
                           role_in_aircraft=models.AssignmentRole.CHEFE_MANUTENCAO, start_date=_today_minus(400)),
        models.Assignment(person_id=people_objs["Ten Cel Av Marina Duque Estrada"].id,
                           aircraft_id=aircraft_objs["FAB 4100"].id,
                           role_in_aircraft=models.AssignmentRole.PILOTO_TITULAR, start_date=_today_minus(200)),
        models.Assignment(person_id=people_objs["Maj Av Bruno Castro Vieira"].id,
                           aircraft_id=aircraft_objs["FAB 5962"].id,
                           role_in_aircraft=models.AssignmentRole.PILOTO_INSTRUTOR, start_date=_today_minus(600)),
        models.Assignment(person_id=people_objs["Cap Esp Mec Douglas Nogueira Prado"].id,
                           aircraft_id=aircraft_objs["FAB 4824"].id,
                           role_in_aircraft=models.AssignmentRole.MECANICO_RESPONSAVEL, start_date=_today_minus(300)),
        models.Assignment(person_id=people_objs["1S BMA Elias Tavares Cunha"].id,
                           aircraft_id=aircraft_objs["FAB 2464"].id,
                           role_in_aircraft=models.AssignmentRole.MECANICO_RESPONSAVEL, start_date=_today_minus(150)),
        models.Assignment(person_id=people_objs["Eng. Camila Rezende Sales"].id,
                           aircraft_id=aircraft_objs["FAB 5962"].id,
                           role_in_aircraft=models.AssignmentRole.ENGENHEIRO_CONFIABILIDADE, start_date=_today_minus(500)),
        models.Assignment(person_id=people_objs["Eng. Felipe Augusto Kimura"].id,
                           aircraft_id=aircraft_objs["FAB 5237"].id,
                           role_in_aircraft=models.AssignmentRole.ENGENHEIRO_CONFIABILIDADE, start_date=_today_minus(250)),
        models.Assignment(person_id=people_objs["Dra. Helena Bittencourt Ramos"].id,
                           aircraft_id=aircraft_objs["FAB 4100"].id,
                           role_in_aircraft=models.AssignmentRole.CIENTISTA_RESPONSAVEL, start_date=_today_minus(120)),
    ])

    # ---------------- Grupos / Equipes Responsáveis ----------------
    # A responsabilidade por uma aeronave não recai sobre uma única pessoa -
    # ver docs/04, seção 7. Cada grupo reúne piloto(s), mecânico(s),
    # engenheiro(s) e a hierarquia imediata (comandante de esquadrão),
    # podendo ser vinculado a mais de uma aeronave.
    grupo_gripen = models.ResponsibleGroup(
        name="Equipe Gripen Alpha",
        description="Equipe multidisciplinar responsável pelo F-39E Gripen FAB 4100 (piloto, "
                     "engenharia de confiabilidade, mecânica e comando de esquadrão).",
    )
    grupo_hercules = models.ResponsibleGroup(
        name="Turma de Manutenção Hercules",
        description="Turma de manutenção dedicada ao C-130H Hercules FAB 2464 (célula, motor e "
                     "inspeção de qualidade).",
    )
    db.add_all([grupo_gripen, grupo_hercules])
    db.flush()

    db.add_all([
        # Equipe Gripen Alpha
        models.GroupMembership(group_id=grupo_gripen.id, person_id=people_objs["Ten Cel Av Marina Duque Estrada"].id,
                                role_in_group=models.AssignmentRole.PILOTO_TITULAR),
        models.GroupMembership(group_id=grupo_gripen.id, person_id=people_objs["Maj Av Bruno Castro Vieira"].id,
                                role_in_group=models.AssignmentRole.PILOTO_RESERVA),
        models.GroupMembership(group_id=grupo_gripen.id, person_id=people_objs["Cap Esp Mec Douglas Nogueira Prado"].id,
                                role_in_group=models.AssignmentRole.MECANICO_RESPONSAVEL),
        models.GroupMembership(group_id=grupo_gripen.id, person_id=people_objs["Eng. Camila Rezende Sales"].id,
                                role_in_group=models.AssignmentRole.ENGENHEIRO_CONFIABILIDADE),
        models.GroupMembership(group_id=grupo_gripen.id, person_id=people_objs["Cel Av Ricardo Almeida Ferraz"].id,
                                role_in_group=models.AssignmentRole.COMANDANTE_ESQUADRAO),
        # Turma de Manutenção Hercules
        models.GroupMembership(group_id=grupo_hercules.id, person_id=people_objs["1S BMA Elias Tavares Cunha"].id,
                                role_in_group=models.AssignmentRole.MECANICO_RESPONSAVEL),
        models.GroupMembership(group_id=grupo_hercules.id, person_id=people_objs["2S BAV Patrícia Lemos Andrade"].id,
                                role_in_group=models.AssignmentRole.INSPETOR),
        models.GroupMembership(group_id=grupo_hercules.id, person_id=people_objs["Cap Esp Mec Douglas Nogueira Prado"].id,
                                role_in_group=models.AssignmentRole.CHEFE_MANUTENCAO),
    ])

    db.add_all([
        models.AircraftGroupAssignment(aircraft_id=aircraft_objs["FAB 4100"].id, group_id=grupo_gripen.id,
                                        start_date=_today_minus(120)),
        models.AircraftGroupAssignment(aircraft_id=aircraft_objs["FAB 2464"].id, group_id=grupo_hercules.id,
                                        start_date=_today_minus(150)),
    ])

    # ---------------- Componentes ----------------
    components_data = [
        # FAB 5962 - A-29 (referência do documento: saúde alta, risco baixo)
        dict(aircraft_id=aircraft_objs["FAB 5962"].id, name="Motor PT6A-68C", part_number="PT6A-68C",
             serial_number="SN-11245", category=models.ComponentCategory.MOTOR,
             monitoring_type=models.MonitoringType.HARD_TIME, criticality=models.Criticality.CRITICA,
             install_date=_today_minus(900), life_limit_hours=3600, hours_since_new=3120, hours_since_overhaul=1180,
             last_inspection_date=_today_minus(40), next_inspection_due_hours=3200),
        dict(aircraft_id=aircraft_objs["FAB 5962"].id, name="Trem de Pouso Principal", part_number="LG-A29-02",
             category=models.ComponentCategory.TREM_POUSO, monitoring_type=models.MonitoringType.ON_CONDITION,
             criticality=models.Criticality.ALTA, install_date=_today_minus(1500), hours_since_new=3120,
             hours_since_overhaul=600, last_inspection_date=_today_minus(20),
             preventive_interval_days=180, next_preventive_date=_today_plus(8)),

        # FAB 4100 - Gripen (nova, baixo desgaste)
        dict(aircraft_id=aircraft_objs["FAB 4100"].id, name="Motor RM12", part_number="RM12-V2",
             serial_number="SN-88231", category=models.ComponentCategory.MOTOR,
             monitoring_type=models.MonitoringType.HARD_TIME, criticality=models.Criticality.CRITICA,
             install_date=_today_minus(400), life_limit_hours=4000, hours_since_new=410, hours_since_overhaul=410,
             last_inspection_date=_today_minus(10), next_inspection_due_hours=500),
        dict(aircraft_id=aircraft_objs["FAB 4100"].id, name="Radar AESA Raven ES-05", part_number="ES-05-RV",
             category=models.ComponentCategory.AVIONICO, monitoring_type=models.MonitoringType.CONDITION_MONITORING,
             criticality=models.Criticality.ALTA, install_date=_today_minus(400), hours_since_new=410,
             hours_since_overhaul=0, last_inspection_date=_today_minus(5),
             preventive_interval_days=365, next_preventive_date=_today_plus(200)),

        # FAB 4824 - F-5EM (legado, alto desgaste -> deve gerar alertas)
        dict(aircraft_id=aircraft_objs["FAB 4824"].id, name="Longarina Principal da Asa", part_number="WS-F5-07",
             category=models.ComponentCategory.ESTRUTURAL, monitoring_type=models.MonitoringType.HARD_TIME,
             criticality=models.Criticality.CRITICA, install_date=_today_minus(6000), life_limit_hours=7000,
             hours_since_new=6890, hours_since_overhaul=6890, last_inspection_date=_today_minus(90),
             next_inspection_due_hours=6900, status=models.AircraftStatus.EM_INSPECAO,
             notes="Vida limite se aproximando - candidata a substituição/reparo estrutural."),
        dict(aircraft_id=aircraft_objs["FAB 4824"].id, name="Turbojato J85-GE-21C (esquerdo)", part_number="J85-21C-L",
             category=models.ComponentCategory.MOTOR, monitoring_type=models.MonitoringType.HARD_TIME,
             criticality=models.Criticality.CRITICA, install_date=_today_minus(2200), life_limit_hours=3000,
             hours_since_new=6890, hours_since_overhaul=2850, last_inspection_date=_today_minus(60),
             next_inspection_due_hours=2900,
             preventive_interval_days=90, next_preventive_date=_today_minus(5)),

        # FAB 5237 - AMX
        dict(aircraft_id=aircraft_objs["FAB 5237"].id, name="Motor Spey Mk807", part_number="SPEY-807",
             category=models.ComponentCategory.MOTOR, monitoring_type=models.MonitoringType.HARD_TIME,
             criticality=models.Criticality.CRITICA, install_date=_today_minus(1800), life_limit_hours=5800,
             hours_since_new=5410, hours_since_overhaul=3900, last_inspection_date=_today_minus(30),
             next_inspection_due_hours=4000),

        # FAB 2464 - C-130 (muitas horas, em inspeção)
        dict(aircraft_id=aircraft_objs["FAB 2464"].id, name="Turboélice T56-A-15 (nº2)", part_number="T56-A15-2",
             category=models.ComponentCategory.MOTOR, monitoring_type=models.MonitoringType.HARD_TIME,
             criticality=models.Criticality.CRITICA, install_date=_today_minus(3000), life_limit_hours=9000,
             hours_since_new=15420, hours_since_overhaul=8700, last_inspection_date=_today_minus(15),
             next_inspection_due_hours=8800, status=models.AircraftStatus.EM_INSPECAO),

        # FAB 8940 - Caracal
        dict(aircraft_id=aircraft_objs["FAB 8940"].id, name="Motor Makila 2A1 (direito)", part_number="MAK-2A1-R",
             category=models.ComponentCategory.MOTOR, monitoring_type=models.MonitoringType.HARD_TIME,
             criticality=models.Criticality.ALTA, install_date=_today_minus(1200), life_limit_hours=3500,
             hours_since_new=2340, hours_since_overhaul=1900, last_inspection_date=_today_minus(25),
             next_inspection_due_hours=2000),

        # FAB 2856 - KC-390 (exemplo dedicado de vigência por calendário: uma
        # peça vencida, uma vencendo em breve e uma dentro do prazo - para
        # demonstrar o disparo de alertas/notificações aos responsáveis).
        dict(aircraft_id=aircraft_objs["FAB 2856"].id, name="Bateria de Emergência", part_number="BAT-EMG-390",
             category=models.ComponentCategory.ELETRICO, monitoring_type=models.MonitoringType.ON_CONDITION,
             criticality=models.Criticality.ALTA, install_date=_today_minus(340), hours_since_new=1980,
             hours_since_overhaul=0, last_inspection_date=_today_minus(340),
             preventive_interval_days=365, next_preventive_date=_today_minus(3),
             notes="Vigência de calendário (validade da bateria) vencida - substituição necessária."),
        dict(aircraft_id=aircraft_objs["FAB 2856"].id, name="Extintor de Incêndio Portátil", part_number="EXT-PORT-01",
             category=models.ComponentCategory.OUTRO, monitoring_type=models.MonitoringType.ON_CONDITION,
             criticality=models.Criticality.MEDIA, install_date=_today_minus(700), hours_since_new=1980,
             hours_since_overhaul=0, last_inspection_date=_today_minus(700),
             preventive_interval_days=730, next_preventive_date=_today_plus(6),
             notes="Vigência de calendário (recarga/validade) vencendo em breve."),
        dict(aircraft_id=aircraft_objs["FAB 2856"].id, name="Kit de Vedação do Sistema de Reabastecimento",
             part_number="SEAL-KIT-390", category=models.ComponentCategory.HIDRAULICO,
             monitoring_type=models.MonitoringType.ON_CONDITION, criticality=models.Criticality.MEDIA,
             install_date=_today_minus(90), hours_since_new=1980, hours_since_overhaul=0,
             last_inspection_date=_today_minus(90),
             preventive_interval_days=180, next_preventive_date=_today_plus(90),
             notes="Vigência dentro do prazo - referência de item saudável para comparação."),
    ]
    component_objs = []
    for data in components_data:
        c = models.Component(**data)
        db.add(c)
        db.flush()
        component_objs.append(c)

    # ---------------- Ordens de serviço ----------------
    db.add_all([
        models.MaintenanceOrder(
            order_number="OS-2026-0001", aircraft_id=aircraft_objs["FAB 4824"].id,
            component_id=component_objs[4].id,  # longarina F-5EM
            type=models.MaintenanceType.INSPECAO_ROTINA, priority=models.Criticality.CRITICA,
            status=models.OrderStatus.EM_ANDAMENTO,
            title="Inspeção estrutural da longarina principal (IAM)",
            description="Inspeção de anomalias estruturais conforme boletim técnico e limite de vida da longarina.",
            reference_doc="AMM F-5EM Cap. 57 / Boletim Técnico BT-057-19",
            opened_by_id=people_objs["Cap Esp Mec Douglas Nogueira Prado"].id,
            responsible_id=people_objs["Eng. Felipe Augusto Kimura"].id,
            opened_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=5),
            due_at=dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=10),
            flight_hours_at_event=6890,
            findings="Indícios de fadiga próximos ao limite estabelecido pelo fabricante.",
        ),
        models.MaintenanceOrder(
            order_number="OS-2026-0002", aircraft_id=aircraft_objs["FAB 2464"].id,
            component_id=component_objs[7].id,  # T56 C-130
            type=models.MaintenanceType.OVERHAUL, priority=models.Criticality.ALTA,
            status=models.OrderStatus.AGUARDANDO_PECA,
            title="Overhaul programado do motor nº2 (T56-A-15)",
            description="Substituição de componentes internos do motor conforme programa de manutenção hard-time.",
            reference_doc="AMM C-130H Cap. 72",
            opened_by_id=people_objs["1S BMA Elias Tavares Cunha"].id,
            responsible_id=people_objs["1S BMA Elias Tavares Cunha"].id,
            opened_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=12),
            due_at=dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=20),
            flight_hours_at_event=15420,
            parts_used="Kit de vedação, rolamentos - aguardando remessa do almoxarifado central",
        ),
        models.MaintenanceOrder(
            order_number="OS-2026-0003", aircraft_id=aircraft_objs["FAB 5962"].id,
            type=models.MaintenanceType.PREVENTIVA_PROGRAMADA, priority=models.Criticality.MEDIA,
            status=models.OrderStatus.CONCLUIDA,
            title="Inspeção de 100 horas",
            description="Checklist padrão de inspeção de 100 horas de célula e motor.",
            reference_doc="AMM A-29 Cap. 05",
            opened_by_id=people_objs["Maj Av Bruno Castro Vieira"].id,
            responsible_id=people_objs["Cap Esp Mec Douglas Nogueira Prado"].id,
            opened_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30),
            closed_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=28),
            flight_hours_at_event=3100,
            actions_taken="Inspeção realizada sem discrepâncias relevantes.",
        ),
        models.MaintenanceOrder(
            order_number="OS-2026-0004", aircraft_id=aircraft_objs["FAB 4100"].id,
            type=models.MaintenanceType.BOLETIM_AD_SB, priority=models.Criticality.BAIXA,
            status=models.OrderStatus.ABERTA,
            title="Aplicação de boletim de serviço (atualização de software de aviônicos)",
            description="Boletim de serviço do fabricante para atualização do sistema de fusão de sensores.",
            reference_doc="SB-F39-2026-014",
            opened_by_id=people_objs["Dra. Helena Bittencourt Ramos"].id,
            opened_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=2),
            due_at=dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=25),
        ),
    ])

    # Histórico de manutenções corretivas concluídas - alimenta tanto o
    # cálculo de Confiabilidade (MTBF/MTTR, por aeronave) quanto a base de
    # busca do Diagnóstico Inteligente (heurístico), reproduzindo o exemplo
    # do documento de referência ("luz FUEL PRESS permanece acesa" ->
    # historicamente resolvido, na maior parte das vezes, com a substituição
    # da válvula reguladora de pressão de combustível).
    def _corrective(order_number, aircraft_key, days_ago, repair_hours, title, description, findings, actions_taken, parts_used, opened_by_key, responsible_key, reference_doc):
        opened = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days_ago)
        return models.MaintenanceOrder(
            order_number=order_number, aircraft_id=aircraft_objs[aircraft_key].id,
            type=models.MaintenanceType.CORRETIVA, priority=models.Criticality.ALTA,
            status=models.OrderStatus.CONCLUIDA, title=title, description=description,
            reference_doc=reference_doc,
            opened_by_id=people_objs[opened_by_key].id, responsible_id=people_objs[responsible_key].id,
            opened_at=opened, closed_at=opened + dt.timedelta(hours=repair_hours),
            findings=findings, actions_taken=actions_taken, parts_used=parts_used,
        )

    db.add_all([
        _corrective("OS-2025-0031", "FAB 5962", 340, 6,
                    "Luz de alerta FUEL PRESS acesa em voo de cruzeiro",
                    "Piloto reportou luz FUEL PRESS acesa de forma intermitente durante cruzeiro.",
                    "Pressão de combustível oscilando fora da faixa nominal na válvula reguladora.",
                    "Substituição da válvula reguladora de pressão de combustível.",
                    "1x válvula reguladora de pressão de combustível (P/N compatível AMM Cap. 28)",
                    "Maj Av Bruno Castro Vieira", "Cap Esp Mec Douglas Nogueira Prado", "AMM A-29 Cap. 28"),
        _corrective("OS-2025-0044", "FAB 5962", 120, 10,
                    "Vibração anômala do motor durante o táxi",
                    "Mecânico reportou vibração fora do padrão durante rolagem antes da decolagem.",
                    "Desbalanceamento leve identificado na hélice.",
                    "Balanceamento da hélice e inspeção do eixo do redutor.",
                    "Kit de balanceamento de hélice",
                    "Cap Esp Mec Douglas Nogueira Prado", "Cap Esp Mec Douglas Nogueira Prado", "AMM A-29 Cap. 61"),
        _corrective("OS-2025-0052", "FAB 4100", 200, 5,
                    "Indicador FUEL PRESS intermitente no painel",
                    "Alerta FUEL PRESS surgiu de forma intermitente durante missão de treinamento.",
                    "Válvula reguladora de pressão com resposta fora da especificação.",
                    "Substituição da válvula reguladora de pressão de combustível.",
                    "1x válvula reguladora de pressão de combustível",
                    "Ten Cel Av Marina Duque Estrada", "Eng. Camila Rezende Sales", "AMM F-39E Cap. 28"),
        _corrective("OS-2025-0067", "FAB 4824", 400, 14,
                    "Luz FUEL PRESS permanece acesa em voo de cruzeiro",
                    "Luz de alerta FUEL PRESS permaneceu acesa durante todo o trecho de cruzeiro.",
                    "Confirmado defeito na válvula reguladora de pressão (histórico recorrente na frota).",
                    "Substituição da válvula reguladora de pressão de combustível.",
                    "1x válvula reguladora de pressão de combustível",
                    "Cap Esp Mec Douglas Nogueira Prado", "Eng. Felipe Augusto Kimura", "AMM F-5EM Cap. 28"),
        _corrective("OS-2025-0071", "FAB 5237", 260, 8,
                    "Alerta FUEL PRESS acionado no painel",
                    "Alerta FUEL PRESS acionado logo após a decolagem, missão abortada por precaução.",
                    "Válvula reguladora de pressão fora da faixa aceitável de operação.",
                    "Substituição da válvula reguladora de pressão de combustível.",
                    "1x válvula reguladora de pressão de combustível",
                    "1S BMA Elias Tavares Cunha", "Eng. Felipe Augusto Kimura", "AMM A-1M Cap. 28"),
        _corrective("OS-2025-0083", "FAB 2856", 90, 4,
                    "Luz FUEL PRESS acesa durante a subida",
                    "Luz FUEL PRESS acendeu durante a subida inicial, missão concluída sem outras anomalias.",
                    "Sensor de pressão fora de calibração; válvula reguladora testada dentro da especificação.",
                    "Ajuste de calibração do sensor de pressão (não foi necessário substituir a válvula).",
                    "Nenhuma peça substituída",
                    "1S BMA Elias Tavares Cunha", "1S BMA Elias Tavares Cunha", "AMM KC-390 Cap. 28"),
        _corrective("OS-2025-0019", "FAB 2464", 500, 20,
                    "Luz FUEL PRESS acesa de forma intermitente",
                    "Luz FUEL PRESS relatada como intermitente em três voos consecutivos.",
                    "Válvula reguladora de pressão apresentando desgaste acima do esperado.",
                    "Substituição da válvula reguladora de pressão de combustível.",
                    "1x válvula reguladora de pressão de combustível",
                    "1S BMA Elias Tavares Cunha", "Eng. Camila Rezende Sales", "AMM C-130H Cap. 28"),
    ])

    # ---------------- Protocolos / Checklists ----------------
    db.add(models.ChecklistTemplate(
        name="Inspeção de 50 horas - Caças a jato", aircraft_model="F-39E / F-5EM",
        interval_type="HORAS", interval_value=50,
        reference_doc="AMM Cap. 05 - Inspeções Programadas",
        items_json='["Verificar níveis de fluido hidráulico", "Inspecionar pneus e freios", '
                    '"Verificar vazamentos no compartimento do motor", "Testar sistema de aviônicos básicos", '
                    '"Inspecionar superfícies de comando de voo", "Registrar horas e assinar livro de bordo"]',
        category=models.MaintenanceType.INSPECAO_ROTINA,
    ))
    db.add(models.ChecklistTemplate(
        name="Inspeção de 100 horas - Turboélice", aircraft_model="A-29 Super Tucano",
        interval_type="HORAS", interval_value=100,
        reference_doc="AMM A-29 Cap. 05",
        items_json='["Inspeção visual da hélice", "Verificar filtros de óleo do motor", '
                    '"Inspecionar trem de pouso e amortecedores", "Testar sistema elétrico e baterias", '
                    '"Verificar estrutura da fuselagem quanto a corrosão/trincas", "Lubrificação geral conforme AMM"]',
        category=models.MaintenanceType.INSPECAO_ROTINA,
    ))
    db.add(models.ChecklistTemplate(
        name="Inspeção Anual de Manutenção (IAM) - Estrutural", aircraft_model="Todos",
        interval_type="DIAS", interval_value=365,
        reference_doc="ICA de Manutenção - Inspeção Geral de Célula",
        items_json='["Inspeção detalhada de longarinas e reforços estruturais", "Verificar corrosão em áreas críticas", '
                    '"Inspecionar cablagem elétrica", "Revisar AD/SB pendentes", '
                    '"Atualizar histórico de vida útil dos componentes hard-time", "Emitir laudo de aeronavegabilidade"]',
        category=models.MaintenanceType.OVERHAUL,
    ))

    # ---------------- Inspeção Fotográfica (exemplo) ----------------
    # Imagens ilustrativas geradas para o piloto (NÃO são fotos reais de
    # dano) apenas para demonstrar o histórico visual comparável ao longo
    # do tempo por componente, descrito no documento de referência.
    trinca_svg = _write_seed_photo("exemplo-trinca.svg", """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
  <rect width="400" height="260" fill="#8b93a1"/>
  <rect x="0" y="0" width="400" height="260" fill="url(#rivets)" opacity="0.15"/>
  <defs><pattern id="rivets" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="20" cy="20" r="2.4" fill="#0a1f44"/></pattern></defs>
  <path d="M40 210 L120 150 L150 160 L210 90 L240 100 L320 40" fill="none" stroke="#1a1a1a" stroke-width="3"/>
  <path d="M40 210 L120 150 L150 160 L210 90 L240 100 L320 40" fill="none" stroke="#ff3b3b" stroke-width="1" stroke-dasharray="4 3"/>
  <circle cx="210" cy="90" r="26" fill="none" stroke="#ff3b3b" stroke-width="3"/>
  <text x="200" y="240" text-anchor="middle" font-family="Segoe UI, Arial" font-size="14" fill="#ffffff">Exemplo ilustrativo - trinca em painel estrutural</text>
</svg>""")
    corrosao_svg = _write_seed_photo("exemplo-corrosao.svg", """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
  <rect width="400" height="260" fill="#9aa1ad"/>
  <ellipse cx="180" cy="130" rx="70" ry="46" fill="#a9662f" opacity="0.75"/>
  <ellipse cx="200" cy="120" rx="42" ry="26" fill="#7a4a1f" opacity="0.8"/>
  <ellipse cx="150" cy="150" rx="30" ry="18" fill="#c98a4b" opacity="0.7"/>
  <circle cx="210" cy="90" r="30" fill="none" stroke="#ff3b3b" stroke-width="3"/>
  <text x="200" y="240" text-anchor="middle" font-family="Segoe UI, Arial" font-size="14" fill="#ffffff">Exemplo ilustrativo - corrosão em revestimento</text>
</svg>""")

    db.commit()

    db.add_all([
        models.InspectionFinding(
            aircraft_id=aircraft_objs["FAB 4824"].id, component_id=component_objs[4].id,
            photo_filename=trinca_svg, defect_type=models.DefectType.TRINCA,
            location="Longarina principal da asa, próximo à nervura nº 7",
            severity=models.Criticality.CRITICA, extent="Aprox. 18mm de extensão visível",
            probable_cause="Fadiga estrutural associada à alta acumulação de horas de célula.",
            amm_reference="AMM F-5EM Cap. 57", recorded_by_id=people_objs["Eng. Felipe Augusto Kimura"].id,
            recorded_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=6),
            notes="Imagem ilustrativa de exemplo (piloto de testes) - registrada junto à OS-2026-0001.",
        ),
        models.InspectionFinding(
            aircraft_id=aircraft_objs["FAB 2464"].id, component_id=None,
            photo_filename=corrosao_svg, defect_type=models.DefectType.CORROSAO,
            location="Revestimento inferior da fuselagem, seção de carga",
            severity=models.Criticality.MEDIA, extent="Área de aproximadamente 6x4 cm",
            probable_cause="Exposição prolongada à umidade e ciclo térmico em operações costeiras.",
            amm_reference="AMM C-130H Cap. 51", recorded_by_id=people_objs["1S BMA Elias Tavares Cunha"].id,
            recorded_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=18),
            notes="Imagem ilustrativa de exemplo (piloto de testes).",
        ),
    ])

    db.commit()

    # ---------------- Histórico de notificações (exemplo) ----------------
    # Registros ilustrativos mostrando os dois cenários de notificação:
    # mudança de status da aeronave e vigência de peça próxima do vencimento.
    db.add_all([
        models.Notification(
            channel=models.NotificationChannel.EMAIL, reason=models.NotificationReason.MUDANCA_STATUS,
            status=models.NotificationStatus.SIMULADA,
            subject="[AFA-TWIN] FAB 2464 mudou de status: Operacional → Em Inspeção",
            message="A aeronave FAB 2464 (Lockheed Martin C-130H Hercules) mudou de status de "
                    '"Operacional" para "Em Inspeção".',
            detail="Envio real de e-mail não configurado nesta instância (defina AFA_TWIN_SMTP_HOST/"
                   "AFA_TWIN_SMTP_USER/AFA_TWIN_SMTP_PASSWORD). Notificação registrada no histórico.",
            recipient_person_id=people_objs["1S BMA Elias Tavares Cunha"].id,
            aircraft_id=aircraft_objs["FAB 2464"].id,
            created_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=15),
        ),
        models.Notification(
            channel=models.NotificationChannel.WHATSAPP, reason=models.NotificationReason.VENCIMENTO_PECA,
            status=models.NotificationStatus.SIMULADA,
            subject="[AFA-TWIN] Vigência próxima do vencimento: Turbojato J85-GE-21C (esquerdo)",
            message="O componente Turbojato J85-GE-21C (esquerdo) da aeronave FAB 4824 está com a "
                    "manutenção preventiva vencida. Verificar e programar substituição/serviço.",
            detail="Envio real de WhatsApp requer a API oficial do WhatsApp Business (ou um gateway de "
                   "terceiros) - não incluído nesta fase piloto, sem custo. Notificação registrada "
                   "apenas no histórico.",
            recipient_person_id=people_objs["Eng. Felipe Augusto Kimura"].id,
            aircraft_id=aircraft_objs["FAB 4824"].id, component_id=component_objs[5].id,
            created_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=6),
        ),
    ])
    db.commit()

    # ---------------- Usuários de acesso (piloto de testes) ----------------
    demo_users = [
        ("gestor", "AfaTwin@2026", models.PersonRole.GESTOR, "Cel Av Ricardo Almeida Ferraz"),
        ("piloto", "AfaTwin@2026", models.PersonRole.PILOTO, "Ten Cel Av Marina Duque Estrada"),
        ("mecanico", "AfaTwin@2026", models.PersonRole.MECANICO, "Cap Esp Mec Douglas Nogueira Prado"),
        ("engenheiro", "AfaTwin@2026", models.PersonRole.ENGENHEIRO, "Eng. Camila Rezende Sales"),
        ("cientista", "AfaTwin@2026", models.PersonRole.CIENTISTA, "Dra. Helena Bittencourt Ramos"),
    ]
    for username, password, role, person_name in demo_users:
        pw_hash, salt = security.hash_password(password)
        db.add(models.User(
            username=username, password_hash=pw_hash, password_salt=salt, role=role,
            person_id=people_objs[person_name].id,
        ))
    db.commit()

    # ---------------- Cadastros Auxiliares (listbox editáveis) ----------------
    lookup_seed: dict[models.LookupCategory, list[str]] = {
        models.LookupCategory.ORGANIZACAO: [
            "Força Aérea Brasileira", "ITA", "Embraer", "Outra",
        ],
        models.LookupCategory.POSTO_GRADUACAO: [
            "Tenente-Brigadeiro", "Major-Brigadeiro", "Brigadeiro", "Coronel", "Tenente-Coronel", "Major",
            "Capitão", "1º Tenente", "2º Tenente", "Aspirante-a-Oficial",
            "Suboficial", "1º Sargento", "2º Sargento", "3º Sargento", "Cabo", "Soldado",
            "Professor Titular", "Professor Associado", "Pesquisador", "Doutorando", "Mestrando",
            "Engenheiro Sênior", "Engenheiro Pleno", "Engenheiro de Suporte ao Produto", "Especialista Técnico", "Civil",
        ],
        models.LookupCategory.ESPECIALIDADE: [
            "Chefia de Manutenção de Frota", "Piloto de Caça - Gripen F-39E", "Piloto Instrutor - A-29 Super Tucano",
            "Manutenção de Célula e Motor - Caças", "Sistemas Hidráulicos e Trem de Pouso",
            "Aviônicos e Sistemas de Armamento", "Engenharia de Confiabilidade e Manutenção",
            "Estruturas e Análise de Vida Útil de Componentes",
            "Inteligência Artificial aplicada a Manutenção Preditiva",
        ],
        models.LookupCategory.ESQUADRAO: [
            "Ala de Caça", "1º GDA (ilustrativo)", "1º/3º GAv (ilustrativo)", "1º/1º GAvCa (ilustrativo)",
            "Esquadrão Escorpião (ilustrativo)", "1º Esquadrão de Transporte Militar (ilustrativo)",
            "1º/1º GT (ilustrativo)", "Esquadrão Poti (ilustrativo)", "Esquadrão de Manutenção",
        ],
        models.LookupCategory.COMPONENTE_PADRAO: [
            "Motor", "Trem de Pouso Principal", "Trem de Pouso do Nariz", "Radar", "Bateria de Emergência",
            "Extintor de Incêndio Portátil", "Kit de Vedação Hidráulica", "Pás de Hélice/Rotor", "Longarina Principal",
        ],
        models.LookupCategory.TIPO_INTERVALO: ["Horas de Voo", "Dias Corridos", "Ciclos"],
        models.LookupCategory.CATEGORIA_ALERTA: [
            "Vigência Vencida", "Vigência Próxima do Vencimento", "Componente Próximo do Limite",
            "Vida Limite Excedida", "OS Crítica em Aberto",
        ],
    }
    for category, values in lookup_seed.items():
        for value in values:
            db.add(models.LookupItem(category=category, value=value))
    db.commit()

    # ---------------- Auditoria (exemplo ilustrativo) ----------------
    db.add_all([
        models.AuditLog(
            actor_username="gestor", actor_person_name="Cel Av Ricardo Almeida Ferraz",
            entity_type="Aeronave", entity_id=aircraft_objs["FAB 4100"].id, entity_label="FAB 4100",
            action=models.AuditAction.CRIACAO, summary="Aeronave FAB 4100 (Saab F-39E Gripen) cadastrada.",
            created_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=120),
        ),
        models.AuditLog(
            actor_username="mecanico", actor_person_name="Cap Esp Mec Douglas Nogueira Prado",
            entity_type="Ordem de Serviço", entity_id=1, entity_label="OS-2026-0001",
            action=models.AuditAction.CRIACAO, summary='OS-2026-0001 criada: "Inspeção estrutural da longarina principal (IAM)".',
            created_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=5),
        ),
    ])
    db.commit()
