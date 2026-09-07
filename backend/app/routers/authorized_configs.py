"""Configurações Autorizadas para Aeronaves - cadastro mestre dos
equipamentos/cargas de asas e hardpoints (pilones vazios, armamento,
lançadores, tanques externos, pods FLIR/casulo etc.) derivado da tabela de
símbolos do boletim de disponibilidade do esquadrão. Ver nota completa em
models.py::AuthorizedConfiguration.
"""
import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import audit, models, schemas, security
from .. import config_pdf
from ..database import get_db

_ALLOWED_PDF_EXT = {".pdf"}
_MAX_PDF_BYTES = 15 * 1024 * 1024  # 15MB

router = APIRouter(
    prefix="/api/authorized-configurations", tags=["configurações autorizadas"],
    dependencies=[Depends(security.get_current_user)],
)


@router.get("", response_model=list[schemas.AuthorizedConfigurationOut])
def list_configurations(
    status_disp: models.ConfigDispStatus | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.AuthorizedConfiguration)
    if status_disp:
        q = q.filter(models.AuthorizedConfiguration.status_disp == status_disp)
    return q.order_by(models.AuthorizedConfiguration.id).all()


def _get_or_404(db: Session, config_id: int) -> models.AuthorizedConfiguration:
    item = db.get(models.AuthorizedConfiguration, config_id)
    if not item:
        raise HTTPException(404, "Configuração autorizada não encontrada")
    return item


@router.post("", response_model=schemas.AuthorizedConfigurationOut, status_code=201)
def create_configuration(
    payload: schemas.AuthorizedConfigurationCreate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    item = models.AuthorizedConfiguration(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    audit.log_action(
        db, actor, "Configuração Autorizada", item.id, models.AuditAction.CRIACAO,
        f"Configuração autorizada criada: {item.equipment} (status {item.status_disp.value}).",
        entity_label=item.equipment,
    )
    return item


@router.post("/load-from-pdf", response_model=schemas.AuthorizedConfigPdfLoadResult)
def load_from_pdf(
    file: UploadFile = File(...), db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    """Atualiza em lote o status_disp de TODO o cadastro a partir de um
    documento .pdf de Configurações Autorizadas (ex.: uma Ordem Técnica/
    OTFN da aeronave, como docs/CONFIGURAÇÕES AUTORIZADAS.pdf). Rejeita o
    documento (400) se o texto não contiver a sigla "OTFN", ou se não
    houver uma página com o título "Configurações Autorizadas" e a tabela
    de símbolos - ver config_pdf.py para a validação e extração completas
    (usa a camada de texto real do PDF, sem OCR). Itens do cadastro
    encontrados no texto dessa página viram "A" (Ativo); os demais, "I"
    (Inativo)."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _ALLOWED_PDF_EXT:
        raise HTTPException(400, f"Formato não suportado. Use um dos formatos: {', '.join(sorted(_ALLOWED_PDF_EXT))}")
    content = file.file.read(_MAX_PDF_BYTES + 1)
    if len(content) > _MAX_PDF_BYTES:
        raise HTTPException(400, "Arquivo excede o limite de 15MB.")

    catalog = db.query(models.AuthorizedConfiguration).order_by(models.AuthorizedConfiguration.id).all()
    if not catalog:
        raise HTTPException(400, "Não há itens cadastrados para atualizar.")

    try:
        marks, note = config_pdf.extract_marks(content, [item.equipment for item in catalog])
    except config_pdf.ConfigPdfError as exc:
        raise HTTPException(400, str(exc)) from exc

    active_count = inactive_count = 0
    for item, marked in zip(catalog, marks):
        item.status_disp = models.ConfigDispStatus.ATIVO if marked else models.ConfigDispStatus.INATIVO
        if marked:
            active_count += 1
        else:
            inactive_count += 1
    db.commit()
    for item in catalog:
        db.refresh(item)

    audit.log_action(
        db, actor, "Configuração Autorizada", 0, models.AuditAction.ALTERACAO,
        f"Status de disponibilidade recarregado a partir de PDF: {active_count} ativa(s), "
        f"{inactive_count} inativa(s) de {len(catalog)} item(ns).",
        entity_label="Carregamento por PDF",
    )

    return schemas.AuthorizedConfigPdfLoadResult(
        items_checked=len(catalog), active_count=active_count, inactive_count=inactive_count,
        note=note, items=catalog,
    )


@router.put("/{config_id}", response_model=schemas.AuthorizedConfigurationOut)
def update_configuration(
    config_id: int, payload: schemas.AuthorizedConfigurationUpdate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    item = _get_or_404(db, config_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    audit.log_action(
        db, actor, "Configuração Autorizada", item.id, models.AuditAction.ALTERACAO,
        f"Configuração autorizada alterada: {item.equipment} (status {item.status_disp.value}).",
        entity_label=item.equipment,
    )
    return item


@router.delete("/{config_id}", status_code=204)
def delete_configuration(
    config_id: int, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    item = _get_or_404(db, config_id)
    equipment = item.equipment
    db.delete(item)
    db.commit()
    audit.log_action(
        db, actor, "Configuração Autorizada", config_id, models.AuditAction.CANCELAMENTO,
        f"Configuração autorizada removida: {equipment}.",
        entity_label=equipment,
    )
    return None
