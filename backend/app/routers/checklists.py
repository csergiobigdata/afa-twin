import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/checklists", tags=["protocolos e checklists"],
    dependencies=[Depends(security.get_current_user)],
)


def _to_out(c: models.ChecklistTemplate) -> schemas.ChecklistTemplateOut:
    out = schemas.ChecklistTemplateOut.model_validate(c)
    out.items = json.loads(c.items_json or "[]")
    return out


@router.get("", response_model=list[schemas.ChecklistTemplateOut])
def list_checklists(db: Session = Depends(get_db)):
    return [_to_out(c) for c in db.query(models.ChecklistTemplate).all()]


@router.post("", response_model=schemas.ChecklistTemplateOut, status_code=201)
def create_checklist(payload: schemas.ChecklistTemplateCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    items = data.pop("items")
    c = models.ChecklistTemplate(items_json=json.dumps(items, ensure_ascii=False), **data)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _to_out(c)


@router.delete("/{checklist_id}", status_code=204)
def delete_checklist(checklist_id: int, db: Session = Depends(get_db)):
    c = db.get(models.ChecklistTemplate, checklist_id)
    if not c:
        raise HTTPException(404, "Protocolo não encontrado")
    db.delete(c)
    db.commit()
    return None
