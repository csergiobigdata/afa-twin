"""
AFA-TWIN - Gêmeo Digital para Apoio à Decisão em Manutenção Aeronáutica
Ponto de entrada da API (FastAPI).

Executar: uvicorn app.main:app --reload --port 8000
Documentação interativa: http://localhost:8000/docs
"""
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .database import Base, engine, SessionLocal, sync_postgres_enum_types
from . import seed
from .routers import (
    aircraft, people, components, assignments, maintenance, checklists, flightlogs,
    dashboard, auth, inspections, diagnostics, planning, notifications, groups,
    lookups, audit, media, availability,
)

app = FastAPI(
    title="AFA-TWIN API",
    description="API do piloto de testes de gerenciamento e controle de manutenção de aeronaves militares.",
    version="0.3.0-piloto",
)

# Origens autorizadas a chamar a API. Em testes locais/rede interna (sem a
# variável definida), libera tudo ("*") para não travar o piloto. Em nuvem,
# defina AFA_TWIN_ALLOWED_ORIGINS com a(s) URL(s) exata(s) do frontend
# publicado (separadas por vírgula) - ver docs/06-implantacao-nuvem.md.
_allowed_origins_env = os.environ.get("AFA_TWIN_ALLOWED_ORIGINS", "").strip()
if _allowed_origins_env:
    _allowed_origins = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
else:
    _allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Camada opcional extra de restrição de acesso ("defesa em profundidade"),
# desligada por padrão. O controle de acesso principal já é o login (só o
# Gestor cria contas, não há autocadastro) - ver docs/06-implantacao-nuvem.md.
# Se AFA_TWIN_ACCESS_KEY estiver definida, toda chamada a /api/* (exceto
# /api/health e /api/media/*) deve enviar o cabeçalho X-AFA-TWIN-Key com o
# mesmo valor, útil para esconder a API de varreduras/bots quando publicada
# num host público antes mesmo de tentar logar. O frontend envia esse
# cabeçalho automaticamente quando publicado com VITE_ACCESS_KEY definida.
# /api/media/* fica sempre fora dessa trava porque tags <img src="..."> do
# navegador não conseguem enviar cabeçalhos customizados.
_ACCESS_KEY = os.environ.get("AFA_TWIN_ACCESS_KEY", "").strip()


@app.middleware("http")
async def optional_access_key_gate(request: Request, call_next):
    if (
        _ACCESS_KEY
        and request.method != "OPTIONS"
        and request.url.path.startswith("/api")
        and request.url.path != "/api/health"
        and not request.url.path.startswith("/api/media/")
    ):
        if request.headers.get("x-afa-twin-key") != _ACCESS_KEY:
            return JSONResponse(
                {"detail": "Acesso negado: chave de acesso ausente ou inválida."},
                status_code=401,
            )
    return await call_next(request)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    # Em Postgres (nuvem), create_all() cria tabelas/tipos novos mas nunca
    # altera um tipo ENUM nativo já existente para acrescentar um valor novo
    # (ex.: nova categoria de LookupItem) - ver nota completa em
    # database.py::sync_postgres_enum_types. Sem custo no SQLite local (a
    # função só age em Postgres).
    sync_postgres_enum_types()
    db = SessionLocal()
    try:
        seed.seed_if_empty(db)
    finally:
        db.close()


app.include_router(auth.router)
app.include_router(aircraft.router)
app.include_router(people.router)
app.include_router(components.router)
app.include_router(assignments.router)
app.include_router(maintenance.router)
app.include_router(checklists.router)
app.include_router(flightlogs.router)
app.include_router(inspections.router)
app.include_router(diagnostics.router)
app.include_router(planning.router)
app.include_router(notifications.router)
app.include_router(groups.router)
app.include_router(groups.aircraft_groups_router)
app.include_router(lookups.router)
app.include_router(audit.router)
app.include_router(media.router)
app.include_router(availability.router)
app.include_router(dashboard.router)


@app.get("/api/health", tags=["infra"])
def health_check():
    return {"status": "ok", "sistema": "AFA-TWIN"}
