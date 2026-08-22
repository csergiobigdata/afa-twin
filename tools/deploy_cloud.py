#!/usr/bin/env python3
"""
AFA-TWIN — orquestrador de publicação em nuvem gratuita.

Cria/atualiza, de ponta a ponta, via API (sem navegador):
  1. Repositório GitHub (código-fonte, público)          -> github.com/<voce>/afa-twin
  2. Banco Postgres gratuito no Neon                       -> projeto "afa-twin"
  3. Backend (API) no Render, a partir do Dockerfile        -> afa-twin-api.onrender.com
  4. Frontend (estático, já compilado) no Netlify            -> afa-twin.netlify.app

Uso:
  Defina as 4 variáveis de ambiente abaixo (tokens gerados nos respectivos
  painéis - ver docs/06-implantacao-nuvem.md) e rode:

    python tools/deploy_cloud.py

Variáveis de ambiente esperadas:
  GITHUB_TOKEN     - Personal Access Token do GitHub (escopo "repo")
  RENDER_API_KEY   - API Key do Render (Account Settings -> API Keys)
  NEON_API_KEY     - API Key do Neon (Account -> API Keys)
  NETLIFY_TOKEN    - Personal Access Token do Netlify (User settings -> Applications)

Nenhum token é impresso no console nem gravado em nenhum arquivo do repositório.
O script é seguro para rodar mais de uma vez (reaproveita recursos já criados
quando possível, em vez de duplicar).
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # .../afa-twin
FRONTEND_DIR = ROOT / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"

GITHUB_REPO_NAME = "afa-twin"
NEON_PROJECT_NAME = "afa-twin"
RENDER_SERVICE_NAME = "afa-twin-api"
NETLIFY_SITE_NAME = "afa-twin"


def die(msg: str) -> None:
    print(f"\n[ERRO] {msg}")
    sys.exit(1)


def need_env(name: str) -> str:
    v = os.environ.get(name, "").strip()
    if not v:
        die(f"Variável de ambiente {name} não definida.")
    return v


def http(method: str, url: str, token: str | None = None, body: dict | bytes | None = None,
         headers: dict | None = None, token_scheme: str = "Bearer"):
    hdrs = {"User-Agent": "afa-twin-deploy-script"}
    if headers:
        hdrs.update(headers)
    if token:
        hdrs["Authorization"] = f"{token_scheme} {token}"
    data = None
    if isinstance(body, (dict, list)):
        data = json.dumps(body).encode()
        hdrs.setdefault("Content-Type", "application/json")
    elif isinstance(body, bytes):
        data = body
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            status = resp.status
    except urllib.error.HTTPError as e:
        raw = e.read()
        status = e.code
    text = raw.decode(errors="replace") if raw else ""
    try:
        parsed = json.loads(text) if text else {}
    except json.JSONDecodeError:
        parsed = {"_raw": text}
    return status, parsed


def step(title: str) -> None:
    print(f"\n=== {title} ===")


# ---------------------------------------------------------------------------
# 1. GitHub — repositório de código-fonte
# ---------------------------------------------------------------------------

def ensure_github_repo(token: str) -> tuple[str, str]:
    step("GitHub: verificando conta e repositório")
    status, me = http("GET", "https://api.github.com/user", token=token,
                       headers={"Accept": "application/vnd.github+json"})
    if status != 200:
        die(f"Falha ao autenticar no GitHub (status {status}): {me}")
    owner = me["login"]
    print(f"  Autenticado como: {owner}")

    status, repo = http("GET", f"https://api.github.com/repos/{owner}/{GITHUB_REPO_NAME}",
                         token=token, headers={"Accept": "application/vnd.github+json"})
    if status == 200:
        print(f"  Repositório já existe: {repo['html_url']}")
        return owner, repo["html_url"]

    status, repo = http("POST", "https://api.github.com/user/repos", token=token,
                         headers={"Accept": "application/vnd.github+json"},
                         body={"name": GITHUB_REPO_NAME, "private": False,
                               "description": "AFA-TWIN - Gemeo Digital para Apoio a Decisao em Manutencao Aeronautica (piloto)"})
    if status not in (200, 201):
        die(f"Falha ao criar repositório no GitHub (status {status}): {repo}")
    print(f"  Repositório criado: {repo['html_url']}")
    return owner, repo["html_url"]


def push_code(owner: str, token: str) -> None:
    step("GitHub: preparando e enviando o código")

    def run(*args, check=True):
        result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
        if check and result.returncode != 0:
            safe_err = result.stderr.replace(token, "***")
            die(f"Comando 'git {' '.join(args)}' falhou:\n{safe_err}")
        return result

    if not (ROOT / ".git").exists():
        run("init")
        run("branch", "-M", "main")

    # Identidade de commit local ao repositório (não mexe na config --global
    # do usuário) - necessária para o 'git commit' funcionar nesta máquina.
    if run("config", "user.email", check=False).returncode != 0:
        run("config", "user.email", "carlossergio631@yahoo.com.br")
    if run("config", "user.name", check=False).returncode != 0:
        run("config", "user.name", "Carlos Sérgio")

    gitignore = ROOT / ".gitignore"
    wanted = [
        ".venv/", "backend/.venv/", "__pycache__/", "**/__pycache__/",
        "backend/data/afa_twin.db", "backend/data/uploads/",
        "frontend/node_modules/", "frontend/dist/",
        "tools/node_modules/", "tools/shots/",
        ".env", ".env.*", "*.pyc",
    ]
    existing = gitignore.read_text().splitlines() if gitignore.exists() else []
    merged = existing + [w for w in wanted if w not in existing]
    gitignore.write_text("\n".join(merged) + "\n")

    run("add", "-A")
    diff = run("diff", "--cached", "--quiet", check=False)
    if diff.returncode == 0:
        print("  Nada novo para commitar.")
    else:
        run("commit", "-m",
            "AFA-TWIN - piloto de testes (deploy automatizado)\n\n"
            "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>")
        print("  Commit criado.")

    remote_url = f"https://github.com/{owner}/{GITHUB_REPO_NAME}.git"
    existing_remote = run("remote", "get-url", "origin", check=False)
    if existing_remote.returncode != 0:
        run("remote", "add", "origin", remote_url)
    else:
        run("remote", "set-url", "origin", remote_url)

    push_url = f"https://{token}@github.com/{owner}/{GITHUB_REPO_NAME}.git"
    result = run("push", push_url, "main", "--force", check=False)
    if result.returncode != 0:
        safe_err = result.stderr.replace(token, "***")
        die(f"Falha ao enviar (push) o código para o GitHub:\n{safe_err}")
    print("  Código enviado para o GitHub com sucesso.")


# ---------------------------------------------------------------------------
# 2. Neon — Postgres gratuito
# ---------------------------------------------------------------------------

def ensure_neon_database(api_key: str) -> str:
    step("Neon: verificando/criando banco Postgres gratuito")

    # Contas Neon criadas dentro de uma organização exigem org_id nas
    # chamadas de listagem/criação de projeto (não na de connection_uri,
    # que já é escopada pelo project_id na própria URL).
    status, orgs = http("GET", "https://console.neon.tech/api/v2/users/me/organizations", token=api_key)
    if status != 200:
        die(f"Falha ao consultar organizações Neon (status {status}): {orgs}")
    org_id = orgs["organizations"][0]["id"] if orgs.get("organizations") else None

    list_url = "https://console.neon.tech/api/v2/projects"
    if org_id:
        list_url += f"?org_id={org_id}"
    status, projects = http("GET", list_url, token=api_key)
    if status != 200:
        die(f"Falha ao listar projetos Neon (status {status}): {projects}")

    existing = next((p for p in projects.get("projects", []) if p["name"] == NEON_PROJECT_NAME), None)
    if existing:
        project_id = existing["id"]
        print(f"  Projeto já existe: {project_id} (região: {existing.get('region_id')})")
        status, conn = http("GET", f"https://console.neon.tech/api/v2/projects/{project_id}/connection_uri"
                                    f"?database_name=neondb&role_name=neondb_owner&pooled=true",
                             token=api_key)
        if status != 200:
            die(f"Falha ao obter connection string do Neon (status {status}): {conn}")
        uri = conn["uri"]
    else:
        project_body = {"name": NEON_PROJECT_NAME, "region_id": "aws-sa-east-1"}
        if org_id:
            project_body["org_id"] = org_id
        status, created = http("POST", "https://console.neon.tech/api/v2/projects", token=api_key,
                                body={"project": project_body})
        if status not in (200, 201):
            die(f"Falha ao criar projeto Neon (status {status}): {created}")
        uri = created["connection_uris"][0]["connection_uri"]
        print("  Projeto Neon criado (região: aws-sa-east-1 - São Paulo).")

    if uri.startswith("postgresql://"):
        uri = "postgresql+psycopg://" + uri[len("postgresql://"):]
    if "sslmode=" not in uri:
        sep = "&" if "?" in uri else "?"
        uri = f"{uri}{sep}sslmode=require"
    print("  Connection string pronta (Postgres gerenciado, gratuito).")
    return uri


# ---------------------------------------------------------------------------
# 3. Render — backend (Docker)
# ---------------------------------------------------------------------------

def ensure_render_service(api_key: str, github_repo_url: str, database_url: str) -> tuple[str, str]:
    step("Render: verificando/criando o serviço de backend")
    status, owners = http("GET", "https://api.render.com/v1/owners", token=api_key)
    if status != 200:
        die(f"Falha ao listar workspaces do Render (status {status}): {owners}")
    if not owners:
        die("Nenhum workspace encontrado na conta Render.")
    owner_id = owners[0]["owner"]["id"]

    status, services = http("GET", f"https://api.render.com/v1/services?name={RENDER_SERVICE_NAME}&limit=20",
                             token=api_key)
    existing = None
    if status == 200:
        for item in services:
            if item["service"]["name"] == RENDER_SERVICE_NAME:
                existing = item["service"]
                break

    import secrets
    secret_key = secrets.token_hex(32)

    if existing:
        service_id = existing["id"]
        service_url = existing.get("serviceDetails", {}).get("url") or f"https://{RENDER_SERVICE_NAME}.onrender.com"
        print(f"  Serviço já existe: {service_url}")
    else:
        body = {
            "type": "web_service",
            "name": RENDER_SERVICE_NAME,
            "ownerId": owner_id,
            "repo": github_repo_url,
            "branch": "main",
            "rootDir": "backend",
            "autoDeploy": "no",
            "plan": "free",
            "region": "oregon",
            "envVars": [
                {"key": "AFA_TWIN_DATABASE_URL", "value": database_url},
                {"key": "AFA_TWIN_SECRET_KEY", "value": secret_key},
                {"key": "AFA_TWIN_ALLOWED_ORIGINS", "value": "*"},
            ],
            "serviceDetails": {
                "runtime": "docker",
                "envSpecificDetails": {"dockerfilePath": "./Dockerfile", "dockerContext": "."},
                "healthCheckPath": "/api/health",
            },
        }
        status, created = http("POST", "https://api.render.com/v1/services", token=api_key, body=body)
        if status not in (200, 201):
            die(f"Falha ao criar o serviço no Render (status {status}): {created}")
        service_id = created["service"]["id"]
        service_url = created["service"].get("serviceDetails", {}).get("url") \
            or f"https://{RENDER_SERVICE_NAME}.onrender.com"
        print(f"  Serviço criado: {service_url}")

    return service_id, service_url.rstrip("/")


def trigger_render_deploy(api_key: str, service_id: str) -> None:
    step("Render: iniciando o deploy (build da imagem Docker)")
    status, deploy = http("POST", f"https://api.render.com/v1/services/{service_id}/deploys", token=api_key, body={})
    if status not in (200, 201):
        die(f"Falha ao iniciar deploy no Render (status {status}): {deploy}")
    deploy_id = deploy["id"]
    print("  Build iniciado. Acompanhando (pode levar alguns minutos)...")
    for _ in range(40):  # ~10 minutos
        time.sleep(15)
        status, d = http("GET", f"https://api.render.com/v1/services/{service_id}/deploys/{deploy_id}", token=api_key)
        current = d.get("status", "desconhecido")
        print(f"    status: {current}")
        if current in ("live",):
            print("  Deploy concluído com sucesso.")
            return
        if current in ("build_failed", "update_failed", "canceled", "deactivated"):
            die(f"Deploy do backend falhou (status: {current}). Verifique o painel do Render para o log completo.")
    print("  [aviso] Deploy ainda em andamento após o tempo de espera do script - "
          "confira o painel do Render para o status final.")


def update_render_env(api_key: str, service_id: str, key: str, value: str) -> None:
    status, _ = http("PUT", f"https://api.render.com/v1/services/{service_id}/env-vars/{key}",
                      token=api_key, body={"value": value})
    if status not in (200, 201):
        die(f"Falha ao atualizar variável {key} no Render (status {status})")


# ---------------------------------------------------------------------------
# 4. Netlify — frontend estático
# ---------------------------------------------------------------------------

def build_frontend() -> None:
    step("Frontend: instalando dependências e gerando build de produção")
    for args in (["npm", "install"], ["npm", "run", "build"]):
        result = subprocess.run(args, cwd=FRONTEND_DIR, shell=(os.name == "nt"))
        if result.returncode != 0:
            die(f"Comando '{' '.join(args)}' falhou.")
    if not DIST_DIR.exists():
        die("Pasta frontend/dist não foi gerada.")


def write_redirects(backend_url: str) -> None:
    content = (
        f"/api/*    {backend_url}/api/:splat    200\n"
        f"/media/*  {backend_url}/media/:splat  200\n"
        f"/*        /index.html                 200\n"
    )
    (DIST_DIR / "_redirects").write_text(content)
    print(f"  Arquivo _redirects gerado apontando para {backend_url}")


def zip_dist() -> Path:
    zip_path = ROOT / "tools" / "afa-twin-frontend.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in DIST_DIR.rglob("*"):
            if file.is_file():
                zf.write(file, file.relative_to(DIST_DIR))
    return zip_path


def ensure_netlify_site(token: str) -> tuple[str, str]:
    step("Netlify: verificando/criando o site")
    status, sites = http("GET", "https://api.netlify.com/api/v1/sites?filter=all", token=token)
    if status != 200:
        die(f"Falha ao listar sites do Netlify (status {status}): {sites}")
    existing = next((s for s in sites if s["name"] == NETLIFY_SITE_NAME), None)
    if existing:
        print(f"  Site já existe: {existing['url']}")
        return existing["id"], existing["url"]

    status, created = http("POST", "https://api.netlify.com/api/v1/sites", token=token,
                            body={"name": NETLIFY_SITE_NAME})
    if status not in (200, 201):
        die(f"Falha ao criar site no Netlify (status {status}): {created}")
    print(f"  Site criado: {created['url']}")
    return created["id"], created["url"]


def deploy_to_netlify(token: str, site_id: str, zip_path: Path) -> None:
    step("Netlify: enviando o build (deploy de produção)")
    data = zip_path.read_bytes()
    status, result = http("POST", f"https://api.netlify.com/api/v1/sites/{site_id}/deploys",
                           token=token, body=data, headers={"Content-Type": "application/zip"})
    if status not in (200, 201):
        die(f"Falha ao enviar o deploy para o Netlify (status {status}): {result}")
    print("  Deploy enviado. O Netlify está processando (leva menos de um minuto).")


# ---------------------------------------------------------------------------

def main() -> None:
    github_token = need_env("GITHUB_TOKEN")
    render_key = need_env("RENDER_API_KEY")
    neon_key = need_env("NEON_API_KEY")
    netlify_token = need_env("NETLIFY_TOKEN")

    owner, repo_html_url = ensure_github_repo(github_token)
    push_code(owner, github_token)

    database_url = ensure_neon_database(neon_key)

    service_id, backend_url = ensure_render_service(render_key, repo_html_url, database_url)
    trigger_render_deploy(render_key, service_id)

    build_frontend()
    write_redirects(backend_url)
    zip_path = zip_dist()
    site_id, frontend_url = ensure_netlify_site(netlify_token)
    deploy_to_netlify(netlify_token, site_id, zip_path)

    update_render_env(render_key, service_id, "AFA_TWIN_ALLOWED_ORIGINS", frontend_url)
    print("\n  Origem liberada no backend atualizada para o frontend publicado; refazendo o deploy...")
    trigger_render_deploy(render_key, service_id)

    print("\n" + "=" * 70)
    print("PUBLICAÇÃO CONCLUÍDA")
    print("=" * 70)
    print(f"Repositório:        {repo_html_url}")
    print(f"Backend (API):      {backend_url}")
    print(f"Frontend (app):     {frontend_url}   <-- envie este link ao testador")
    print("=" * 70)
    print("\nContas de demonstração (troque as senhas assim que possível):")
    print("  gestor / piloto / mecanico / engenheiro / cientista  -  senha: AfaTwin@2026")


if __name__ == "__main__":
    main()
