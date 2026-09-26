#!/usr/bin/env python3
"""
AFA-TWIN — orquestrador de publicação em nuvem gratuita.

Cria/atualiza, de ponta a ponta, via API (sem navegador):
  1. Repositório GitHub (código-fonte, público)          -> github.com/<voce>/afa-twin
  2. Banco Postgres gratuito no Neon                       -> projeto "afa-twin"
  3. Backend (API) no Vercel, funções Python (FastAPI)       -> afa-twin-api.vercel.app
  4. Frontend (estático, já compilado) no Vercel               -> afa-twin-web.vercel.app

Vercel (não Render) hospeda o backend: o Render passou a exigir cartão
cadastrado mesmo no plano gratuito nesta conta, e o Vercel Hobby não exige -
ver docs/06-implantacao-nuvem.md, seção 4. Por rodar como função sem
servidor, o backend guarda uploads de foto no próprio banco (MediaAsset,
ver backend/app/models.py) em vez de disco local.

O frontend também é publicado no Vercel (não mais no Netlify) desde
2026-09-25: a conta Netlify em uso excedeu a cota de créditos do plano
gratuito e passou a recusar novos deploys (HTTP 403 "Account credit usage
exceeded"). Reaproveita o mesmo VERCEL_TOKEN já usado para o backend, num
projeto Vercel separado ("afa-twin-web") - ver `write_vercel_rewrites`
(equivalente ao antigo `_redirects` do Netlify: proxy de `/api/*` para o
backend + fallback de SPA para `index.html`).

Uso:
  Defina as 3 variáveis de ambiente abaixo (tokens gerados nos respectivos
  painéis - ver docs/06-implantacao-nuvem.md) e rode:

    python tools/deploy_cloud.py

Variáveis de ambiente esperadas:
  GITHUB_TOKEN          - Personal Access Token do GitHub (escopo "repo")
  VERCEL_TOKEN          - Personal Access Token do Vercel, com acesso ao projeto do backend
                          (afa-twin-api)
  VERCEL_FRONTEND_TOKEN - opcional; só necessário se o token acima não enxergar também o
                          projeto do frontend (afa-twin-web) - ver nota acima sobre tokens
                          restritos a um único projeto nesta conta. Sem essa variável, usa
                          o mesmo valor de VERCEL_TOKEN.
  NEON_API_KEY          - API Key do Neon (Account -> API Keys)

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
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # .../afa-twin
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"

GITHUB_REPO_NAME = "afa-twin"
NEON_PROJECT_NAME = "afa-twin"
VERCEL_PROJECT_NAME = "afa-twin-api"
VERCEL_FRONTEND_PROJECT_NAME = "afa-twin-web"

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
    """Chama a API via `curl` (subprocesso), não `urllib.request` - motivo:
    detectamos nesta máquina um segfault reprodutível (STATUS_ACCESS_
    VIOLATION) da própria pilha SSL do Python (3.14.6 + OpenSSL 3.5.7) ao
    conectar especificamente a api.vercel.com (GitHub e Neon funcionavam
    normalmente; a mesma chamada isolada, sem nada deste script, também
    travava) - aparenta ser um bug do runtime, não deste código. `curl` é um
    binário separado, não usa o `ssl` do Python, e funciona normalmente para
    o mesmo host. O corpo da requisição vai por stdin (nunca como argumento
    de linha de comando), pois o deploy do backend envia todo o código-fonte
    em base64 no corpo - passaria do limite de tamanho de linha de comando
    do Windows."""
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

    fd, tmp_path = tempfile.mkstemp(prefix="afa-twin-deploy-")
    os.close(fd)
    try:
        cmd = ["curl", "-s", "-S", "--max-time", "150", "-X", method, "-o", tmp_path, "-w", "%{http_code}"]
        for k, v in hdrs.items():
            cmd += ["-H", f"{k}: {v}"]
        if data is not None:
            cmd += ["--data-binary", "@-"]
        cmd.append(url)
        result = subprocess.run(cmd, input=data, capture_output=True, timeout=170)
        if result.returncode != 0:
            die(f"curl falhou (código {result.returncode}) chamando {url}: {result.stderr.decode(errors='replace')}")
        status = int(result.stdout.decode().strip())
        raw = Path(tmp_path).read_bytes()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
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
            # Prefere o domínio estável e público do projeto
            # ("afa-twin-api.vercel.app") entre os aliases retornados - a
            # conta Vercel pode devolver também um alias de time/preview
            # (ex.: "afa-twin-api-<time>.vercel.app") que exige login/SSO da
            # Vercel e devolve 302 em vez da API, quebrando a app se
            # escolhido aqui (aconteceu em produção em 2026-09-24).
            preferred = f"{VERCEL_PROJECT_NAME}.vercel.app"
            if preferred in aliases:
                final_url = preferred
            elif aliases:
                final_url = aliases[0]
            else:
                final_url = d.get("url")
            print("  Deploy concluído com sucesso.")
            return f"https://{final_url}"
        if state in ("ERROR", "CANCELED"):
            die(f"Deploy do backend falhou no Vercel (status: {state}). "
                f"Verifique o painel do Vercel (Deployments) para o log completo.")
    print("  [aviso] Deploy ainda em andamento após o tempo de espera do script - "
          "confira o painel do Vercel para o status final.")
    return f"https://{final_url}" if final_url else ""


# ---------------------------------------------------------------------------
# 4. Vercel — frontend estático
# ---------------------------------------------------------------------------

def build_frontend() -> None:
    step("Frontend: instalando dependências e gerando build de produção")
    for args in (["npm", "install"], ["npm", "run", "build"]):
        result = subprocess.run(args, cwd=FRONTEND_DIR, shell=(os.name == "nt"))
        if result.returncode != 0:
            die(f"Comando '{' '.join(args)}' falhou.")
    if not DIST_DIR.exists():
        die("Pasta frontend/dist não foi gerada.")


def write_vercel_rewrites(backend_url: str) -> None:
    """Equivalente ao antigo `_redirects` do Netlify: proxy de `/api/*` para
    o backend (tem que vir ANTES do fallback de SPA na lista - o Vercel
    aplica rewrites na ordem, e o primeiro casamento vence) + fallback de
    SPA (qualquer rota que não bate um arquivo estático de verdade cai em
    `index.html`, para as rotas do React Router funcionarem em acesso
    direto/F5, não só navegação interna)."""
    config = {
        "rewrites": [
            {"source": "/api/:path*", "destination": f"{backend_url}/api/:path*"},
            {"source": "/(.*)", "destination": "/index.html"},
        ]
    }
    (DIST_DIR / "vercel.json").write_text(json.dumps(config, indent=2))
    print(f"  Arquivo vercel.json gerado apontando para {backend_url}")


def _collect_frontend_files() -> list[dict]:
    files = []
    for path in DIST_DIR.rglob("*"):
        if not path.is_file():
            continue
        rel_path = "/".join(path.relative_to(DIST_DIR).parts)
        content = path.read_bytes()
        files.append({
            "file": rel_path,
            "data": base64.b64encode(content).decode("ascii"),
            "encoding": "base64",
        })
    return files


def ensure_vercel_frontend_project(token: str) -> str:
    step("Vercel: verificando/criando o projeto do frontend")
    status, proj = http("GET", f"https://api.vercel.com/v10/projects/{VERCEL_FRONTEND_PROJECT_NAME}", token=token)
    if status == 200:
        print(f"  Projeto já existe: {proj['id']}")
        return proj["id"]

    status, created = http("POST", "https://api.vercel.com/v11/projects", token=token,
                            body={"name": VERCEL_FRONTEND_PROJECT_NAME, "framework": None})
    if status not in (200, 201):
        die(f"Falha ao criar o projeto de frontend no Vercel (status {status}): {created}")
    print(f"  Projeto criado: {created['id']}")
    return created["id"]


def deploy_frontend_to_vercel(token: str, project_id: str, files: list[dict]) -> str:
    step("Vercel: publicando o frontend (arquivos estáticos)")
    body = {
        "name": VERCEL_FRONTEND_PROJECT_NAME,
        "project": project_id,
        "target": "production",
        # `rootDirectory: None` sobrescreve a configuração salva no projeto
        # (ex.: "frontend", herdada da importação manual via GitHub feita
        # pelo dashboard) - aqui os `files` já SÃO o conteúdo pronto de
        # `frontend/dist/`, sem nenhuma subpasta, então uma Root Directory
        # configurada faz a Vercel procurar uma subpasta que não existe
        # neste upload (erro NOW_SANDBOX_WORKER_ROOTDIR_NOT_EXIST).
        "projectSettings": {"framework": None, "rootDirectory": None},
        "files": files,
    }
    status, deployment = http("POST", "https://api.vercel.com/v13/deployments", token=token, body=body)
    if status not in (200, 201):
        die(f"Falha ao criar o deploy do frontend no Vercel (status {status}): {deployment}")
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
            # Mesma preferência pelo domínio estável do projeto usada no
            # backend (ver deploy_to_vercel) - evita pegar um alias de
            # time/preview protegido por SSO por engano.
            preferred = f"{VERCEL_FRONTEND_PROJECT_NAME}.vercel.app"
            if preferred in aliases:
                final_url = preferred
            elif aliases:
                final_url = aliases[0]
            else:
                final_url = d.get("url")
            print("  Deploy concluído com sucesso.")
            return f"https://{final_url}"
        if state in ("ERROR", "CANCELED"):
            die(f"Deploy do frontend falhou no Vercel (status: {state}). "
                f"Verifique o painel do Vercel (Deployments) para o log completo.")
    print("  [aviso] Deploy ainda em andamento após o tempo de espera do script - "
          "confira o painel do Vercel para o status final.")
    return f"https://{final_url}" if final_url else ""


# ---------------------------------------------------------------------------

def main() -> None:
    github_token = need_env("GITHUB_TOKEN")
    vercel_token = need_env("VERCEL_TOKEN")
    # Token separado e opcional para o projeto do frontend: na prática, os
    # tokens gerados nesta conta Vercel (time "cs-ai-team") saíram
    # restritos a um único projeto cada, em vez de todo o time/conta -
    # então VERCEL_TOKEN (escopo afa-twin-api) e VERCEL_FRONTEND_TOKEN
    # (escopo afa-twin-web) precisam ser dois tokens diferentes por
    # enquanto. Se algum dia um único token cobrir os dois projetos, basta
    # não definir VERCEL_FRONTEND_TOKEN - cai no mesmo VERCEL_TOKEN.
    vercel_frontend_token = os.environ.get("VERCEL_FRONTEND_TOKEN", vercel_token)
    neon_key = need_env("NEON_API_KEY")

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
    write_vercel_rewrites(backend_url)
    frontend_project_id = ensure_vercel_frontend_project(vercel_frontend_token)
    frontend_files = _collect_frontend_files()
    print(f"  {len(frontend_files)} arquivo(s) do frontend preparados para publicação.")
    frontend_url = deploy_frontend_to_vercel(vercel_frontend_token, frontend_project_id, frontend_files)

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
