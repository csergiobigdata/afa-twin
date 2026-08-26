"""
Atualização de Disponibilidade - módulo "Disponibilidade e Confiabilidade"
do documento de referência, na forma como a própria unidade já registra o
boletim diário/por turno de linha de voo (ex.: "5906 - DO (EEXD TREM DE
POUSO)", com totais de DI/DO/IN e de configuração de asas/hardpoints).

Este quadro é complementar - não substitui - o `Aircraft.status` (mais
estável, ligado ao cadastro/Ordens de Serviço) nem as métricas de engenharia
de `reliability.py` (MTBF/MTTR): aqui o código reflete a leitura operacional
do dia, informada manualmente pela unidade, útil como fonte de dados mais
granular para essas outras análises no futuro. Ver docs/03-modelo-de-dados.md.
"""
from __future__ import annotations

from sqlalchemy.orm import Session, joinedload

from . import models, schemas

_DI_DO_CODES = (models.AvailabilityCode.DI, models.AvailabilityCode.DO)


def compute_availability_board(db: Session) -> schemas.AvailabilityBoard:
    aircraft_list = db.query(models.Aircraft).order_by(models.Aircraft.tail_number).all()

    # Uma consulta só, ordenada de forma que a primeira ocorrência de cada
    # aeronave já seja a mais recente (report_date desc, depois created_at
    # desc para desempatar lançamentos do mesmo dia).
    updates = db.query(models.AvailabilityUpdate).options(
        joinedload(models.AvailabilityUpdate.aircraft)
    ).order_by(
        models.AvailabilityUpdate.aircraft_id,
        models.AvailabilityUpdate.report_date.desc(),
        models.AvailabilityUpdate.created_at.desc(),
    ).all()

    latest_by_aircraft: dict[int, models.AvailabilityUpdate] = {}
    for u in updates:
        latest_by_aircraft.setdefault(u.aircraft_id, u)

    entries: list[schemas.AvailabilityBoardEntry] = []
    di = do = in_ = subalares = 0
    configuration_counts: dict[str, int] = {}
    report_dates = []

    for a in aircraft_list:
        u = latest_by_aircraft.get(a.id)
        if u is None:
            continue
        report_dates.append(u.report_date)
        entries.append(schemas.AvailabilityBoardEntry(
            aircraft_id=a.id, aircraft_tail_number=a.tail_number, aircraft_model=a.model,
            availability_update_id=u.id, report_date=u.report_date, code=u.code,
            configuration=u.configuration, has_subalares=u.has_subalares, reason=u.reason,
            created_at=u.created_at,
        ))
        if u.code == models.AvailabilityCode.DI:
            di += 1
        elif u.code == models.AvailabilityCode.DO:
            do += 1
        else:
            in_ += 1
        if u.has_subalares:
            subalares += 1
        # "Configuração DI/DO" no boletim original só soma as aeronaves
        # disponíveis/indisponíveis por causa operacional (DI/DO), não as IN.
        # Uma aeronave com SUBALARES e sem outra configuração explícita não
        # entra no total "LISO" (asa limpa) - ela já é contada à parte em
        # subalares_count, e é isso que o boletim original quis dizer com
        # "SUBALARES: 1 (fora o ADA)": uma aeronave com carga subalar não é
        # "limpa", mesmo sem ADA/EEXD/CAA/VENTRAL específico.
        if u.code in _DI_DO_CODES and not (u.configuration is None and u.has_subalares):
            key = u.configuration or "LISO"
            configuration_counts[key] = configuration_counts.get(key, 0) + 1

    without_update = [a.tail_number for a in aircraft_list if a.id not in latest_by_aircraft]

    return schemas.AvailabilityBoard(
        report_date=max(report_dates) if report_dates else None,
        entries=entries,
        di_count=di, do_count=do, in_count=in_,
        subalares_count=subalares,
        configuration_counts=configuration_counts,
        aircraft_without_update=without_update,
    )


def to_out(u: models.AvailabilityUpdate) -> schemas.AvailabilityUpdateOut:
    return schemas.AvailabilityUpdateOut(
        id=u.id, aircraft_id=u.aircraft_id, aircraft_tail_number=u.aircraft.tail_number,
        report_date=u.report_date, code=u.code, configuration=u.configuration,
        has_subalares=u.has_subalares, reason=u.reason,
        recorded_by_id=u.recorded_by_id, recorded_by_name=u.recorded_by.full_name if u.recorded_by else None,
        created_at=u.created_at,
    )
