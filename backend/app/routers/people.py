import mimetypes
import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import audit, models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/people", tags=["pessoal"],
    dependencies=[Depends(security.get_current_user)],
)

ALLOWED_PHOTO_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_UPLOAD_BYTES = 6 * 1024 * 1024


def _save_photo(db: Session, file: UploadFile) -> int:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_PHOTO_EXT:
        raise HTTPException(400, f"Formato não suportado. Use: {', '.join(sorted(ALLOWED_PHOTO_EXT))}")
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "Arquivo excede o limite de 6MB.")
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    asset = models.MediaAsset(content_type=content_type, data=content)
    db.add(asset)
    db.flush()
    return asset.id


def _delete_photo_if_exists(db: Session, asset_id: int | None) -> None:
    if not asset_id:
        return
    asset = db.get(models.MediaAsset, asset_id)
    if asset:
        db.delete(asset)


# ---------------- Meu Perfil (usuário autenticado) ----------------
# Definido antes das rotas com {person_id} para "me" não ser interpretado
# como um identificador numérico.

@router.get("/me", response_model=schemas.PersonOut)
def get_my_profile(user: models.User = Depends(security.get_current_user)):
    if not user.person:
        raise HTTPException(404, "Este usuário de acesso não está vinculado a um cadastro de pessoa.")
    return user.person


@router.put("/me", response_model=schemas.PersonOut)
def update_my_profile(
    payload: schemas.PersonSelfUpdate,
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    if not user.person:
        raise HTTPException(404, "Este usuário de acesso não está vinculado a um cadastro de pessoa.")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user.person, key, value)
    db.commit()
    db.refresh(user.person)
    return user.person


@router.post("/me/photo", response_model=schemas.PersonOut)
def upload_my_photo(
    file: UploadFile = File(...),
    user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    if not user.person:
        raise HTTPException(404, "Este usuário de acesso não está vinculado a um cadastro de pessoa.")
    old_asset_id = user.person.photo_asset_id
    user.person.photo_asset_id = _save_photo(db, file)
    _delete_photo_if_exists(db, old_asset_id)
    db.commit()
    db.refresh(user.person)
    return user.person


@router.delete("/me/photo", response_model=schemas.PersonOut)
def delete_my_photo(user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    if not user.person:
        raise HTTPException(404, "Este usuário de acesso não está vinculado a um cadastro de pessoa.")
    _delete_photo_if_exists(db, user.person.photo_asset_id)
    user.person.photo_asset_id = None
    db.commit()
    db.refresh(user.person)
    return user.person


# ---------------- Cadastro geral de pessoal ----------------

@router.get("", response_model=list[schemas.PersonOut])
def list_people(role: str | None = None, db: Session = Depends(get_db)):
    q = db.query(models.Person)
    if role:
        q = q.filter(models.Person.role == role)
    return q.order_by(models.Person.full_name).all()


@router.get("/{person_id}", response_model=schemas.PersonOut)
def get_person(person_id: int, db: Session = Depends(get_db)):
    p = db.get(models.Person, person_id)
    if not p:
        raise HTTPException(404, "Pessoa não encontrada")
    return p


@router.post("", response_model=schemas.PersonOut, status_code=201)
def create_person(
    payload: schemas.PersonCreate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    p = models.Person(**payload.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    audit.log_action(db, actor, "Usuário", p.id, models.AuditAction.CRIACAO,
                      f"Cadastro de usuário criado: {p.full_name} ({p.role.value}).", entity_label=p.full_name)
    return p


@router.put("/{person_id}", response_model=schemas.PersonOut)
def update_person(
    person_id: int, payload: schemas.PersonUpdate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    p = db.get(models.Person, person_id)
    if not p:
        raise HTTPException(404, "Pessoa não encontrada")
    changes = payload.model_dump(exclude_unset=True)
    was_active = p.active
    for key, value in changes.items():
        setattr(p, key, value)
    db.commit()
    db.refresh(p)

    if "active" in changes and changes["active"] != was_active:
        action = models.AuditAction.REATIVACAO if changes["active"] else models.AuditAction.INATIVACAO
        audit.log_action(db, actor, "Usuário", p.id, action,
                          f"Usuário {p.full_name} {'reativado' if changes['active'] else 'inativado'}.",
                          entity_label=p.full_name)
    elif changes:
        audit.log_action(db, actor, "Usuário", p.id, models.AuditAction.ALTERACAO,
                          f"Cadastro de {p.full_name} alterado: {', '.join(changes.keys())}.", entity_label=p.full_name)
    return p


@router.post("/{person_id}/photo", response_model=schemas.PersonOut)
def upload_person_photo(person_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    p = db.get(models.Person, person_id)
    if not p:
        raise HTTPException(404, "Pessoa não encontrada")
    old_asset_id = p.photo_asset_id
    p.photo_asset_id = _save_photo(db, file)
    _delete_photo_if_exists(db, old_asset_id)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{person_id}/photo", response_model=schemas.PersonOut)
def delete_person_photo(person_id: int, db: Session = Depends(get_db)):
    p = db.get(models.Person, person_id)
    if not p:
        raise HTTPException(404, "Pessoa não encontrada")
    _delete_photo_if_exists(db, p.photo_asset_id)
    p.photo_asset_id = None
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{person_id}", status_code=405)
def delete_person(person_id: int):
    # Por política do piloto (rastreabilidade/auditoria - ver docs/04, seção 8),
    # um usuário nunca é excluído: apenas inativado via PUT (`active: false`).
    raise HTTPException(405, "Usuários não podem ser excluídos, apenas inativados (PUT /people/{id} com active=false).")
