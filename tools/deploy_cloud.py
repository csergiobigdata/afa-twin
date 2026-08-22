#!/usr/bin/env python3
"""
AFA-TWIN — orquestrador de publicação em nuvem gratuita.

Cria/atualiza, de ponta a ponta, via API (sem navegador):
  1. Repositório GitHub (código-fonte, público)          -> github.com/<voce>/afa-twin
  2. Banco Postgres gratuito no Neon                       -> projeto "afa-twin"
  3. Backend (API) no Vercel, funções Python (FastAPI)       -> afa-twin-api.vercel.app
  4. Frontend (estático, já compilado) no Netlify              -> afa-twin.netlify.app

Vercel (não Render) hospeda o backend: o Render passou a exigir cartão
cadastrado mesmo no plano gratuito nesta conta, e o Vercel Hobby não exige -
ver docs/06-implantacao-nuvem.md, seção 4. Por rodar como função sem
servidor, o backend guarda uploads de foto no próprio banco (MediaAsset,
ver backend/app/models.py) em vez de disco local.

Uso:
  Defina as 4 variáveis de ambiente abaixo (tokens gerados nos respectivos
  painéis - ver docs/06-implantacao-nuvem.md) e rode:

    python tools/deploy_cloud.py

Variáveis de ambiente esperadas:
  GITHUB_TOKEN     - Personal Access Token do GitHub (escopo "repo")
  VERCEL_TOKEN     - Personal Access Token do Vercel (Account Settings -> Tokens)
  NEON_API_KEY     - API Key do Neon (Account -> API Keys)
  NETLIFY_TOKEN    - Personal Access Token do Netlify (User settings -> Applications)

Nenhum token é impresso no console nem gravado em nenhum arquivo do repositório.
O script é seguro para rodar mais de uma vez (reaproveita recursos já criados
quando possível, em vez de duplicar).
"""
import base64
import json
import os
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # .../afa-twin
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"

GITHUB_REPO_NAME = "afa-twin"
NEON_PROJECT_NAME = "afa-twin"
VERCEL_PROJECT_NAME = "afa-twin-api"
NETLIFY_SITE_NAME = "afa-twin"

# Diretórios/arquivos do backend que não fazem parte do código-fonte a
# publicar (banco local, ambiente virtual, cache de bytecode).
BACKEND_EXCLUDE_DIRS = {"data", ".venv", "__pycache__"}


def die(msg: str) -> None:
    print(f"\n[ERRO] {msg}")
    sys.exit(1)


def need_env(name: str) -> str:
    v = os.environ.get(name, "").strip()
    if not v:
        die(f"Variável de ambiente {name} não definida.")
    return v


def http(method: str, url: str, token: str | None = None, body: dict | list | bytes | None = None,
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
        with urllib.request.urlopen(req, timeout=120) as resp:
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
        "tools/node_modules/", "tools/shots/", "tools/afa-twin-frontend.zip",
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
# 3. Vercel — backend (funções Python / FastAPI, sem servidor)
# ---------------------------------------------------------------------------

def ensure_vercel_project(token: str) -> str:
    step("Vercel: verificando/criando o projeto do backend")
    status, proj = http("GET", f"https://api.vercel.com/v10/projects/{VERCEL_PROJECT_NAME}", token=token)
    if status == 200:
        print(f"  Projeto já existe: {proj['id']}")
        return proj["id"]

    status, created = http("POST", "https://api.vercel.com/v11/projects", token=token,
                            body={"name": VERCEL_PROJECT_NAME, "framework": "fastapi"})
    if status not in (200, 201):
        die(f"Falha ao criar o projeto no Vercel (status {status}): {created}")
    print(f"  Projeto criado: {created['id']}")
    return created["id"]


def set_vercel_env(token: str, project_id: str, env: dict[str, str]) -> None:
    step("Vercel: configurando variáveis de ambiente")
    body = [
        {"key": k, "value": v, "type": "encrypted", "target": ["production", "preview", "development"]}
        for k, v in env.items()
    ]
    status, result = http("POST", f"https://api.vercel.com/v10/projects/{project_id}/env?upsert=true",
                           token=token, body=body)
    if status not in (200, 201):
        die(f"Falha ao configurar variáveis de ambiente no Vercel (status {status}): {result}")
    print(f"  {len(env)} variável(is) configurada(s).")


def _collect_backend_files() -> list[dict]:
    files = []
    for path in BACKEND_DIR.rglob("*"):
        if not path.is_file():
            continue
        rel_parts = path.relative_to(BACKEND_DIR).parts
        if rel_parts[0] in BACKEND_EXCLUDE_DIRS:
            continue
        if any(part == "__pycache__" for part in rel_parts):
            continue
        rel_path = "/".join(rel_parts)
        content = path.read_bytes()
        files.append({
            "file": rel_path,
            "data": base64.b64encode(content).decode("ascii"),
            "encoding": "base64",
        })
    return files


def deploy_to_vercel(token: str, project_id: str, files: list[dict]) -> str:
    step("Vercel: publicando o backend (build da função Python)")
    body = {
        "name": VERCEL_PROJECT_NAME,
        "project": project_id,
        "target": "production",
        "projectSettings": {"framework": "fastapi"},
        "files": files,
    }
    status, deployment = http("POST", "https://api.vercel.com/v13/deployments", token=token, body=body)
    if status not in (200, 201):
        die(f"Falha ao criar o deploy no Vercel (status {status}): {deployment}")
    deployment_id = deployment["id"]
    print("  Build iniciado. Acompanhando (pode levar 1-2 minutos)...")
    final_url = deployment.get("url")
    for _ in range(40):  # ~6-7 minutos
        time.sleep(10)
        status, d = http("GET", f"https://api.vercel.com/v13/deployments/{deployment_id}", token=token)
        state = d.get("readyState", "UNKNOWN")
        print(f"    status: {state}")
        if state == "READY":
            aliases = d.get("alias") or []
            final_url = aliases[0] if aliases else d.get("url")
            print("  Deploy concluído com sucesso.")
            return f"https://{final_url}"
        if state in ("ERROR", "CANCELED"):
            die(f"Deploy do backend falhou no Vercel (status: {state}). "
                f"Verifique o painel do Vercel (Deployments) para o log completo.")
    print("  [aviso] Deploy ainda em andamento após o tempo de espera do script - "
          "confira o painel do Vercel para o status final.")
    return f"https://{final_url}" if final_url else ""


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
    vercel_token = need_env("VERCEL_TOKEN")
    neon_key = need_env("NEON_API_KEY")
    netlify_token = need_env("NETLIFY_TOKEN")

    owner, repo_html_url = ensure_github_repo(github_token)
    push_code(owner, github_token)

    database_url = ensure_neon_database(neon_key)

    project_id = ensure_vercel_project(vercel_token)
    secret_key = secrets.token_hex(32)
    set_vercel_env(vercel_token, project_id, {
        "AFA_TWIN_DATABASE_URL": database_url,
        "AFA_TWIN_SECRET_KEY": secret_key,
        "AFA_TWIN_ALLOWED_ORIGINS": "*",
    })
    backend_files = _collect_backend_files()
    print(f"  {len(backend_files)} arquivo(s) do backend preparados para publicação.")
    backend_url = deploy_to_vercel(vercel_token, project_id, backend_files)

    build_frontend()
    write_redirects(backend_url)
    zip_path = zip_dist()
    site_id, frontend_url = ensure_netlify_site(netlify_token)
    deploy_to_netlify(netlify_token, site_id, zip_path)

    set_vercel_env(vercel_token, project_id, {"AFA_TWIN_ALLOWED_ORIGINS": frontend_url})
    print("\n  Origem liberada no backend atualizada para o frontend publicado; refazendo o deploy...")
    backend_url = deploy_to_vercel(vercel_token, project_id, backend_files)

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
