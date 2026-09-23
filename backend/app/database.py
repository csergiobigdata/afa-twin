"""
Camada de acesso a dados do AFA-TWIN.

Fase piloto: SQLite local (arquivo único, sem custo de infraestrutura).
Migração futura: basta trocar DATABASE_URL para um DSN Postgres/MySQL em
nuvem (ex.: "postgresql+psycopg://usuario:senha@host:5432/afa_twin") -
o restante do código (models/queries) não muda, pois usamos SQLAlchemy ORM
como camada de abstração. Ver docs/02-arquitetura-da-solucao.md.
"""
import enum
import os
import re
from sqlalchemy import create_engine, inspect, text
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
# pool_pre_ping/pool_recycle só se aplicam ao Postgres em nuvem: o Neon
# (camada gratuita) fecha conexões ociosas por trás do SQLAlchemy sem avisar
# a aplicação; sem pre_ping, a função serverless tenta reusar essa conexão
# morta e trava até o SO estourar o timeout de socket - na prática, isso
# aparecia como 504 (Gateway Timeout) intermitente no frontend, mesmo com o
# backend/banco saudáveis. pre_ping testa a conexão com um SELECT 1 leve
# antes de cada uso e reconecta se necessário; recycle descarta conexões mais
# velhas que 5 min preventivamente (mesma janela de auto-suspensão do Neon).
engine_kwargs = {} if DATABASE_URL.startswith("sqlite") else {"pool_pre_ping": True, "pool_recycle": 280}
engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
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


def sync_missing_indexes() -> None:
    """`Base.metadata.create_all()` só cria índices ao criar uma tabela nova -
    se um índice é adicionado depois a uma coluna de uma tabela que já existe
    (ex.: `index=True` acrescentado às chaves estrangeiras na v0.3, para
    evitar table scan nos filtros `?aircraft_id=`/`?component_id=` usados em
    quase todo router), ele nunca aparece sozinho num banco já existente
    (local SQLite ou o Postgres de produção). Roda uma vez no startup e só
    ACRESCENTA índices que faltam (`checkfirst=True` faz o SQLAlchemy pular
    os que já existem) - operação aditiva e segura para rodar a cada deploy,
    em qualquer dialeto (SQLite localmente, Postgres em nuvem)."""
    for table in Base.metadata.sorted_tables:
        for index in table.indexes:
            index.create(bind=engine, checkfirst=True)


def _column_default_literal(column) -> str | None:
    """Literal SQL do valor default Python de uma coluna (ex.: `default=
    ConfigDispStatus.INATIVO`), para popular linhas já existentes ao
    acrescentar uma coluna NOT NULL via ALTER TABLE ADD COLUMN - sem isso, o
    ADD COLUMN falha tanto no SQLite quanto no Postgres quando a tabela já
    tem linhas (não há valor pra elas). Retorna None se não houver default
    "escalar" simples (ex.: default é uma função/callable) - nesse caso a
    coluna continua sendo pulada, como já documentado abaixo."""
    default = column.default
    if default is None or not getattr(default, "is_scalar", False):
        return None
    value = default.arg
    if isinstance(value, enum.Enum):
        # SQLAlchemy Enum grava o NOME do membro Python (ex.: "INATIVO"),
        # não o `.value` (ex.: "I") - mesma convenção usada pelo restante
        # do app (ver ConfigDispStatus/status_disp).
        value = value.name
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    escaped = str(value).replace("'", "''")
    return f"'{escaped}'"


def sync_missing_columns() -> None:
    """`Base.metadata.create_all()` só cria COLUNAS ao criar uma tabela nova -
    se uma coluna é acrescentada depois a um modelo cuja tabela já existe
    (ex.: `AvailabilityUpdate.location`, `ConfigurationCode.status_disp`),
    ela nunca aparece sozinha num banco já existente (local SQLite ou o
    Postgres de produção), pelo mesmo motivo documentado em
    sync_missing_indexes/sync_postgres_enum_types acima. Roda uma vez no
    startup e só ACRESCENTA colunas que faltam - nunca quebrando linhas já
    existentes - operação aditiva segura para rodar a cada deploy, em
    qualquer dialeto.

    Colunas NOT NULL com um default Python "escalar" (`default=X`, não uma
    função) levam um `DEFAULT` literal na própria DDL, pra popular linhas já
    existentes (ex.: status_disp="INATIVO") - sem isso, tanto SQLite quanto
    Postgres recusam acrescentar NOT NULL numa tabela não-vazia. Colunas NOT
    NULL sem nenhum default utilizável (Python escalar OU server_default)
    são puladas propositalmente (não há um valor seguro pra preencher linhas
    já existentes sem uma decisão de negócio) - seria um passo de migração
    manual, não automático."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue  # tabela nova - create_all() já cuidou dela inteira
            existing_columns = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing_columns:
                    continue
                default_literal = _column_default_literal(column)
                if not column.nullable and default_literal is None and column.server_default is None:
                    continue
                ddl_type = column.type.compile(dialect=engine.dialect)
                default_clause = f" DEFAULT {default_literal}" if default_literal is not None else ""
                nullability = "" if column.nullable else " NOT NULL"
                conn.execute(text(
                    f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" '
                    f'{ddl_type}{default_clause}{nullability}'
                ))


_OLD_ORDER_NUMBER_PATTERN = re.compile(r"^OS-(\d{4})-(\d+)$")


def reformat_order_numbers() -> None:
    """Migra números de OS do formato antigo "OS-AAAA-NNNN" (ex.:
    "OS-2026-0002") para "AAAA/NNNN" (ex.: "2026/0002") - sigla "OS-"
    removida e "-" entre ano e sequência virou "/", a pedido do usuário. Ver
    o gerador atual em routers/maintenance.py::_next_order_number. Barata
    (uma consulta com LIKE + updates só das linhas ainda no formato antigo,
    nenhuma depois da primeira vez) - roda automaticamente no startup, em
    qualquer dialeto; idempotente."""
    with engine.begin() as conn:
        rows = conn.execute(text(
            "SELECT id, order_number FROM maintenance_orders WHERE order_number LIKE 'OS-%'"
        )).fetchall()
        for row_id, order_number in rows:
            m = _OLD_ORDER_NUMBER_PATTERN.match(order_number)
            if not m:
                continue
            conn.execute(
                text("UPDATE maintenance_orders SET order_number = :new WHERE id = :id"),
                {"new": f"{m.group(1)}/{m.group(2)}", "id": row_id},
            )


def cap_max_speed_values() -> None:
    """`aircraft.max_speed_kmh` (exibido como "kcas") passou a ter no máximo 3
    dígitos (ver schemas.py::AircraftBase, `le=999`) - corrige em lote
    valores já cadastrados que excediam isso (ex.: erro de digitação virando
    um valor absurdo), limitando ao teto em vez de apagar o dado. Barata
    (um UPDATE condicional; sem linhas depois da primeira vez) e idempotente,
    segura no startup automático em qualquer dialeto."""
    with engine.begin() as conn:
        conn.execute(text("UPDATE aircraft SET max_speed_kmh = 999 WHERE max_speed_kmh > 999"))


def migrate_availability_code_column() -> None:
    """`availability_updates.code` era um tipo ENUM nativo do Postgres fixo
    (DI/DO/IN definidos em código) - passou a ser VARCHAR(2) livre, validado
    contra o cadastro editável `availability_codes` (ver
    routers/availability_codes.py), para permitir acrescentar um código novo
    (ex.: "IS") sem depender de alterar um tipo nativo do banco a cada vez.
    Só age em Postgres (SQLite nunca teve tipo enum nativo aqui) e só quando
    a coluna ainda está no tipo antigo - barata (uma consulta de
    introspecção; o ALTER TYPE só roda uma vez) e idempotente, segura no
    startup automático."""
    if engine.dialect.name != "postgresql":
        return
    with engine.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        current_type = conn.execute(text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'availability_updates' AND column_name = 'code'"
        )).scalar()
        if current_type != "USER-DEFINED":
            return  # já migrada (VARCHAR), ou tabela/coluna ainda não existe
        conn.execute(text(
            "ALTER TABLE availability_updates ALTER COLUMN code TYPE VARCHAR(2) USING code::text"
        ))
