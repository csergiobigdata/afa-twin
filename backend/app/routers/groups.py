from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import audit, models, schemas, security
from ..database import get_db

router = APIRouter(
    prefix="/api/groups", tags=["grupos e equipes responsáveis"],
    dependencies=[Depends(security.get_current_user)],
)

aircraft_groups_router = APIRouter(
    prefix="/api/aircraft-groups", tags=["grupos e equipes responsáveis"],
    dependencies=[Depends(security.get_current_user)],
)


def _to_out(g: models.ResponsibleGroup) -> schemas.ResponsibleGroupOut:
    out = schemas.ResponsibleGroupOut.model_validate(g)
    out.aircraft_tail_numbers = [
        link.aircraft.tail_number for link in g.aircraft_links if link.end_date is None
    ]
    return out


@router.get("", response_model=list[schemas.ResponsibleGroupOut])
def list_groups(db: Session = Depends(get_db)):
    groups = db.query(models.ResponsibleGroup).options(
        selectinload(models.ResponsibleGroup.members).joinedload(models.GroupMembership.person),
        selectinload(models.ResponsibleGroup.aircraft_links).joinedload(models.AircraftGroupAssignment.aircraft),
    ).order_by(models.ResponsibleGroup.name).all()
    return [_to_out(g) for g in groups]


@router.get("/{group_id}", response_model=schemas.ResponsibleGroupOut)
def get_group(group_id: int, db: Session = Depends(get_db)):
    g = db.get(models.ResponsibleGroup, group_id)
    if not g:
        raise HTTPException(404, "Grupo não encontrado")
    return _to_out(g)


@router.post("", response_model=schemas.ResponsibleGroupOut, status_code=201)
def create_group(
    payload: schemas.ResponsibleGroupCreate, db: Session = Depends(get_db),
    actor: models.User = Depends(security.get_current_user),
):
    g = models.ResponsibleGroup(name=payload.name, description=payload.description)
    db.add(g)
    db.flush()
    for m in payload.members:
        if not db.get(models.Person, m.person_id):
            raise HTTPException(400, f"Pessoa #{m.person_id} não existe")
        db.add(models.GroupMembership(group_id=g.id, person_id=m.person_id, role_in_group=m.role_in_group))
    db.commit()
    db.refresh(g)
    audit.log_action(db, actor, "Grupo/Equipe", g.id, models.AuditAction.CRIACAO,
                      f"Grupo '{g.name}' criado.", entity_label=g.name)
    return _to_out(g)


@router.put("/{group_id}", response_model=schemas.ResponsibleGroupOut)
def update_group(group_id: int, payload: schemas.ResponsibleGroupUpdate, db: Session = Depends(get_db)):
    g = db.get(models.ResponsibleGroup, group_id)
    if not g:
        raise HTTPException(404, "Grupo não encontrado")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(g, key, value)
    db.commit()
    db.refresh(g)
    return _to_out(g)


@router.delete("/{group_id}", status_code=204, dependencies=[Depends(security.require_roles(
    models.PersonRole.GESTOR.value, models.PersonRole.ENGENHEIRO.value))])
def delete_group(group_id: int, db: Session = Depends(get_db)):
    g = db.get(models.ResponsibleGroup, group_id)
    if not g:
        raise HTTPException(404, "Grupo não encontrado")
    db.delete(g)
    db.commit()
    return None


@router.post("/{group_id}/members", response_model=schemas.ResponsibleGroupOut, status_code=201)
def add_member(group_id: int, payload: schemas.GroupMembershipCreate, db: Session = Depends(get_db)):
    g = db.get(models.ResponsibleGroup, group_id)
    if not g:
        raise HTTPException(404, "Grupo não encontrado")
    if not db.get(models.Person, payload.person_id):
        raise HTTPException(400, "Pessoa informada não existe")
    db.add(models.GroupMembership(group_id=group_id, person_id=payload.person_id, role_in_group=payload.role_in_group))
    db.commit()
    db.refresh(g)
    return _to_out(g)


@router.delete("/{group_id}/members/{membership_id}", response_model=schemas.ResponsibleGroupOut)
def remove_member(group_id: int, membership_id: int, db: Session = Depends(get_db)):
    m = db.get(models.GroupMembership, membership_id)
    if not m or m.group_id != group_id:
        raise HTTPException(404, "Vínculo de membro não encontrado")
    db.delete(m)
    db.commit()
    g = db.get(models.ResponsibleGroup, group_id)
    return _to_out(g)


# ---------------- Vínculo Grupo <-> Aeronave ----------------

@aircraft_groups_router.get("", response_model=list[schemas.AircraftGroupAssignmentOut])
def list_aircraft_groups(aircraft_id: int | None = None, group_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.AircraftGroupAssignment).options(
        joinedload(models.AircraftGroupAssignment.group).selectinload(models.ResponsibleGroup.members).joinedload(models.GroupMembership.person),
        joinedload(models.AircraftGroupAssignment.group).selectinload(models.ResponsibleGroup.aircraft_links).joinedload(models.AircraftGroupAssignment.aircraft),
    )
    if aircraft_id:
        q = q.filter(models.AircraftGroupAssignment.aircraft_id == aircraft_id)
    if group_id:
        q = q.filter(models.AircraftGroupAssignment.group_id == group_id)
    items = q.all()
    out = []
    for link in items:
        o = schemas.AircraftGroupAssignmentOut.model_validate(link)
        o.group = _to_out(link.group)
        out.append(o)
    return out


@aircraft_groups_router.post("", response_model=schemas.AircraftGroupAssignmentOut, status_code=201)
def create_aircraft_group(payload: schemas.AircraftGroupAssignmentCreate, db: Session = Depends(get_db)):
    if not db.get(models.Aircraft, payload.aircraft_id):
        raise HTTPException(400, "Aeronave informada não existe")
    group = db.get(models.ResponsibleGroup, payload.group_id)
    if not group:
        raise HTTPException(400, "Grupo informado não existe")
    link = models.AircraftGroupAssignment(**payload.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    o = schemas.AircraftGroupAssignmentOut.model_validate(link)
    o.group = _to_out(group)
    return o


@aircraft_groups_router.delete("/{link_id}", status_code=204)
def delete_aircraft_group(link_id: int, db: Session = Depends(get_db)):
    link = db.get(models.AircraftGroupAssignment, link_id)
    if not link:
        raise HTTPException(404, "Vínculo não encontrado")
    db.delete(link)
    db.commit()
    return None
