"""
Camada de acesso a dados do AFA-TWIN.

Fase piloto: SQLite local (arquivo único, sem custo de infraestrutura).
Migração futura: basta trocar DATABASE_URL para um DSN Postgres/MySQL em
nuvem (ex.: "postgresql+psycopg://usuario:senha@host:5432/afa_twin") -
o restante do código (models/queries) não muda, pois usamos SQLAlchemy ORM
como camada de abstração. Ver docs/02-arquitetura-da-solucao.md.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "afa_twin.db")

# Permite sobrescrever via variável de ambiente quando migrar para nuvem.
DATABASE_URL = os.environ.get("AFA_TWIN_DATABASE_URL", f"sqlite:///{DB_PATH}")

# Só cria o diretório local quando ele de fato vai ser usado (SQLite do
# piloto). Hospedagens "serverless" (ex.: Vercel) rodam a função num sistema
# de arquivos somente leitura fora de /tmp - tentar criar esse diretório ali
# (mesmo sem nunca usá-lo, já que a nuvem usa Postgres via
# AFA_TWIN_DATABASE_URL) derrubava a função inteira na importação do módulo.
if DATABASE_URL.startswith("sqlite"):
    os.makedirs(DATA_DIR, exist_ok=True)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
