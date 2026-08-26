"""
Camada de acesso a dados do AFA-TWIN.

Fase piloto: SQLite local (arquivo único, sem custo de infraestrutura).
Migração futura: basta trocar DATABASE_URL para um DSN Postgres/MySQL em
nuvem (ex.: "postgresql+psycopg://usuario:senha@host:5432/afa_twin") -
o restante do código (models/queries) não muda, pois usamos SQLAlchemy ORM
como camada de abstração. Ver docs/02-arquitetura-da-solucao.md.
"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.types import Enum as SAEnum

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


def sync_postgres_enum_types() -> None:
    """Corrige um problema real encontrado ao publicar a v0.3 em nuvem:
    `Base.metadata.create_all()` cria TABELAS e TIPOS ENUM que ainda não
    existem, mas nunca ALTERA um tipo ENUM nativo do Postgres já existente
    para adicionar um valor novo (ex.: ao acrescentar `CONFIGURACAO_
    DISPONIBILIDADE` a `LookupCategory` depois que o tipo `lookupcategory`
    já existia em produção) - qualquer consulta com esse valor novo falha
    com erro do Postgres (valor inválido para o tipo), sem que o SQLite do
    piloto local (que não valida enum no banco) jamais acuse o problema.

    Roda uma vez no startup, só em Postgres, e só ACRESCENTA rótulos que
    faltam a tipos que já existem (nunca remove nem recria) - operação
    aditiva e segura para rodar a cada deploy."""
    if engine.dialect.name != "postgresql":
        return

    wanted_by_type: dict[str, set[str]] = {}
    for table in Base.metadata.tables.values():
        for column in table.columns:
            if isinstance(column.type, SAEnum) and column.type.name:
                wanted_by_type.setdefault(column.type.name, set()).update(column.type.enums)

    with engine.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        for pg_type_name, wanted_values in wanted_by_type.items():
            existing = {
                row[0] for row in conn.execute(text(
                    "SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid "
                    "WHERE t.typname = :name"
                ), {"name": pg_type_name})
            }
            if not existing:
                continue  # tipo ainda não existe - create_all acabou de criá-lo já com os valores atuais
            for value in sorted(wanted_values - existing):
                # ALTER TYPE ... ADD VALUE não aceita bind parameter para o
                # rótulo (é DDL, não DML) - pg_type_name e value vêm só das
                # nossas próprias definições de enum (models.py), nunca de
                # entrada do usuário, então o escape manual de aspas simples
                # é suficiente e seguro aqui.
                escaped_value = value.replace("'", "''")
                conn.execute(text(f"ALTER TYPE {pg_type_name} ADD VALUE IF NOT EXISTS '{escaped_value}'"))
