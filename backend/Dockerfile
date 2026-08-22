# AFA-TWIN — imagem de produção do backend (API FastAPI)
# Build:  docker build -t afa-twin-api ./backend
# Run:    docker run -p 8000:8000 --env-file .env afa-twin-api
#
# Pensada para hosts de nuvem gratuitos com deploy via Dockerfile (ex.: Render,
# Railway, Fly.io) - ver docs/06-implantacao-nuvem.md para o passo a passo.

FROM python:3.12-slim

WORKDIR /app

# Dependências do sistema mínimas (psycopg[binary] já traz o driver Postgres
# compilado, então não é necessário libpq-dev aqui).
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Diretório de dados (uploads e, se usado o SQLite do piloto, o arquivo .db).
# Em produção, monte um volume/disco persistente aqui (ver docs/06).
RUN mkdir -p /app/data

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD \
    curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Render/Railway/Fly injetam a porta via $PORT; localmente cai em 8000.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
