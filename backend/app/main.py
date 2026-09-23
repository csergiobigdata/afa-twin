"""
AFA-TWIN - Gêmeo Digital para Apoio à Decisão em Manutenção Aeronáutica
Ponto de entrada da API (FastAPI).

Executar: uvicorn app.main:app --reload --port 8000
Documentação interativa: http://localhost:8000/docs
"""
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from .database import (
    Base, engine, SessionLocal, sync_postgres_enum_types, sync_missing_indexes, sync_missing_columns,
    reformat_order_numbers, migrate_availability_code_column,
)
from . import seed
from .routers import (
    aircraft, people, components, assignments, maintenance, checklists, flightlogs,
    dashboard, auth, inspections, diagnostics, planning, notifications, groups,
    lookups, audit, media, availability, admin, authorized_configs, configuration_codes,
    availability_codes,
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

# Compacta respostas JSON acima de 500 bytes (gzip) - a lista de frota, o
# resumo do painel e o pacote de detalhe de aeronave são textuais/repetitivos
# (nomes de campo, enums) e comprimem bem; reduz o tempo de download em
# conexões mais lentas (ex.: tablets em Wi-Fi de campo, ver docs/05-guia-
# instalacao-execucao.md) sem exigir nenhuma mudança no cliente HTTP (fetch descompacta
# automaticamente).
app.add_middleware(GZipMiddleware, minimum_size=500)

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
    # sync_postgres_enum_types/sync_missing_indexes/sync_missing_columns (ver
    # database.py) cada uma faz de 1 a ~15 round-trips ao banco (uma consulta
    # de introspecção por tipo enum, por índice, por tabela). Medido na
    # prática: as três juntas custam ~43s de um cold start de ~48s no Vercel,
    # porque cada round-trip paga a latência do Neon (Postgres gratuito)
    # ainda acordando de uma suspensão por inatividade - a chamada de
    # /api/health (que nem toca o banco) esperava por elas mesmo assim, pois
    # o startup do FastAPI roda inteiro antes de QUALQUER rota responder.
    # Como o próprio Vercel já não aplica essas sincronizações de forma
    # confiável no startup (ver nota em routers/admin.py e docs/06, seção 3),
    # rodá-las aqui automaticamente já não trazia garantia nenhuma - só
    # custo. Em Postgres, ficam então só sob demanda via
    # POST /api/admin/sync-schema (chamar manualmente depois de qualquer
    # deploy que altere models.py). Em SQLite local (sem latência de rede
    # nem suspensão), o custo é desprezível - mantidas automáticas aqui por
    # conveniência do desenvolvedor.
    if engine.dialect.name != "postgresql":
        sync_postgres_enum_types()
        sync_missing_indexes()
        sync_missing_columns()
    # Baratas (poucas linhas/uma consulta de introspecção; viram no-op depois
    # da primeira vez) - seguras no startup automático em qualquer dialeto,
    # ao contrário das três rotinas acima. Ver database.py para cada uma.
    reformat_order_numbers()
    migrate_availability_code_column()
    db = SessionLocal()
    try:
        seed.seed_if_empty(db)
        seed.seed_authorized_configurations_if_empty(db)
        seed.seed_configuration_codes_if_empty(db)
        seed.seed_availability_codes_if_empty(db)
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
app.include_router(admin.router)
app.include_router(authorized_configs.router)
app.include_router(configuration_codes.router)
app.include_router(availability_codes.router)
app.include_router(dashboard.router)


@app.get("/api/health", tags=["infra"])
def health_check():
    return {"status": "ok", "sistema": "AFA-TWIN"}
