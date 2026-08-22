# AFA-TWIN — Implantação em Nuvem Gratuita com Acesso Restrito

Documento 6 de 6 — ver também: [01 - Contexto e Brainstorming](01-contexto-e-brainstorming.md),
[02 - Arquitetura da Solução](02-arquitetura-da-solucao.md), [03 - Modelo de Dados](03-modelo-de-dados.md),
[04 - Protocolos e Conformidade](04-protocolos-e-conformidade.md), [05 - Guia de Instalação e Execução](05-guia-instalacao-execucao.md).

---

## 1. O que "acesso restrito a usuários definidos" já significa neste sistema

Antes de qualquer configuração de nuvem, é importante deixar claro: o AFA-TWIN **já nasceu sem
autocadastro**. Não existe tela de "criar conta" pública — só o perfil `Gestor / Responsável Técnico`
cria usuários (módulo Usuários), e uma conta nunca é excluída, apenas inativada. Isso já satisfaz, no
nível de aplicação, o pedido de "restringir a somente os usuários que definirmos": publicar o sistema
na internet não abre a porta para qualquer pessoa usá-lo, apenas para qualquer pessoa **ver a tela de
login**. As seções abaixo tratam de:

1. Publicar backend e frontend em serviços de nuvem com camada gratuita;
2. Reduzir a superfície de quem consegue *chamar a API*, além do login (CORS, e uma chave de acesso
   opcional extra);
3. Substituir o SQLite local por um banco persistente gratuito (necessário, pois a maioria dos hosts
   gratuitos não garante disco persistente entre deploys).

## 2. Visão geral da topologia recomendada

```
┌─────────────────────────┐        ┌──────────────────────────┐        ┌───────────────────────┐
│   Frontend (estático)     │──/api→│    Backend (API)           │──────▶│   Postgres gerenciado    │
│   Netlify ou Vercel        │  proxy │    Render / Railway / Fly  │       │   (Neon, Supabase, etc.) │
│   camada gratuita           │       │   camada gratuita           │       │   camada gratuita         │
└─────────────────────────┘        └──────────────────────────┘        └───────────────────────┘
```

Motivo de separar frontend (estático) do backend (API com estado): serviços de hospedagem estática
gratuita (Netlify/Vercel) são mais generosos e rápidos para servir o React/PWA já compilado, enquanto o
backend Python precisa de um serviço que rode um processo contínuo (uvicorn) — categoria coberta por
Render, Railway ou Fly.io nas respectivas camadas gratuitas.

> **Atenção:** condições de camada gratuita (limites de horas, "sleep" por inatividade, tempo de vida do
> banco, cartão de crédito exigido ou não) mudam com frequência entre provedores. Confirme os termos
> atuais de Render, Railway, Fly.io, Neon, Supabase, Netlify e Vercel diretamente no site de cada um antes
> de decidir — o que está descrito aqui é a arquitetura e os passos, não uma garantia comercial destes
> terceiros.

## 3. Passo 1 — Banco de dados: migrar de SQLite para Postgres gratuito

O SQLite do piloto é um arquivo local; a maioria dos hosts gratuitos de aplicação **não preserva disco
entre deploys/reinícios**, o que apagaria os dados. Antes de publicar, migre para um Postgres gerenciado
gratuito (ex.: [Neon](https://neon.tech) ou [Supabase](https://supabase.com) — ambos oferecem um banco
Postgres gratuito persistente com criação em poucos minutos, sem necessidade de servidor próprio).

1. Crie um projeto/banco gratuito no provedor escolhido e copie a *connection string*.
2. No backend, instale o driver adicional:
   ```bash
   pip install -r requirements.txt -r requirements-cloud.txt
   ```
3. Defina a variável de ambiente do backend:
   ```bash
   AFA_TWIN_DATABASE_URL=postgresql+psycopg://usuario:senha@host:5432/banco?sslmode=require
   ```
4. Nenhuma alteração de código é necessária — o projeto já usa SQLAlchemy como camada de abstração
   (ver [docs/03](03-modelo-de-dados.md), seção 4). Ao subir o backend, `Base.metadata.create_all` cria as
   tabelas automaticamente no Postgres na primeira execução, e `seed.py` popula os dados de
   demonstração se o banco estiver vazio — **apague essa chamada de seed antes de ir a público** se não
   quiser os dados fictícios de exemplo em produção (ver seção 6).

## 4. Passo 2 — Backend (API): publicar como container

O backend já inclui um `backend/Dockerfile` pronto para hosts que fazem deploy a partir de um
Dockerfile (Render, Railway, Fly.io — todos com camada gratuita para um serviço pequeno).

**Usando o Render (exemplo mais simples, com free tier de Web Service):**

1. Suba o projeto para um repositório Git (GitHub/GitLab).
2. No Render, crie um **Web Service** → "Build and deploy from a Dockerfile" → aponte para a pasta
   `backend/`.
3. Configure as variáveis de ambiente do serviço (Render → Environment):

   | Variável | Valor |
   |---|---|
   | `AFA_TWIN_DATABASE_URL` | connection string do Postgres (passo 1) |
   | `AFA_TWIN_SECRET_KEY` | valor aleatório longo e secreto (`python -c "import secrets;print(secrets.token_hex(32))"`) |
   | `AFA_TWIN_ALLOWED_ORIGINS` | URL exata do frontend publicado, ex.: `https://afa-twin.netlify.app` |
   | `AFA_TWIN_ACCESS_KEY` | *(opcional, seção 5)* uma chave extra de acesso |
   | `AFA_TWIN_SMTP_HOST`, `_PORT`, `_USER`, `_PASSWORD`, `_FROM` | *(opcional)* para e-mails reais de alerta |

4. Deploy. O Render injeta `$PORT` automaticamente — o `Dockerfile` já lê essa variável.
5. Anote a URL pública gerada (ex.: `https://afa-twin-api.onrender.com`) — ela será usada no passo 3.

Railway e Fly.io seguem o mesmo princípio (deploy via `backend/Dockerfile` + as mesmas variáveis de
ambiente); consulte a documentação de cada um para o passo específico da interface.

## 5. Passo 3 — Frontend: publicar como site estático

O frontend é uma SPA compilada (`npm run build` gera `frontend/dist/`), publicável em qualquer host
estático gratuito. O projeto já inclui um arquivo de configuração pronto para os dois candidatos mais
usados:

- **Netlify** → [`frontend/netlify.toml`](../frontend/netlify.toml)
- **Vercel** → [`frontend/vercel.json`](../frontend/vercel.json)

**Antes de publicar, edite o arquivo escolhido** e troque
`https://SUBSTITUA-PELA-URL-DO-BACKEND.onrender.com` pela URL real do backend obtida no passo 2 —
isso faz o frontend continuar chamando caminhos relativos (`/api/...`, `/media/...`), exatamente como em
desenvolvimento, enquanto a hospedagem estática encaminha essas chamadas para o backend por trás
dos panos (evita qualquer configuração adicional de CORS no navegador do usuário final).

Passos (exemplo Netlify):
1. Conecte o repositório no Netlify, apontando a pasta base para `frontend/`.
2. Build command: `npm run build` · Publish directory: `dist` (já definidos em `netlify.toml`).
3. *(Opcional, seção 5.1)* Defina a variável de ambiente de build `VITE_ACCESS_KEY` se for usar a chave
   extra de acesso.
4. Deploy. Anote a URL pública (ex.: `https://afa-twin.netlify.app`).
5. Volte ao backend (passo 2) e confirme que `AFA_TWIN_ALLOWED_ORIGINS` está com essa URL exata.

### 5.1 Camada extra opcional: chave de acesso compartilhada

Além do login (que já restringe **uso**), é possível reduzir quem consegue sequer **chamar a API** —
útil para dificultar varreduras automáticas de bots contra o endpoint de login assim que o sistema está
na internet pública. Isso é **opcional e desligado por padrão**, para não complicar chamadas de API
durante o piloto:

1. No backend, defina `AFA_TWIN_ACCESS_KEY` com um valor secreto.
2. No frontend, defina a variável de build `VITE_ACCESS_KEY` com o **mesmo valor**, antes de rodar
   `npm run build` (ou como variável de ambiente de build no Netlify/Vercel).
3. A partir daí, toda chamada à API (exceto `/api/health`) exige o cabeçalho `X-AFA-TWIN-Key` com esse
   valor — o cliente HTTP do frontend (`frontend/src/api/client.ts`) já envia esse cabeçalho
   automaticamente quando a variável está definida.

**Importante sobre o limite real desta camada:** como o valor fica embutido no JavaScript entregue ao
navegador, ele não é secreto de quem já abre o site (não é uma senha de usuário) — é apenas uma
barreira simples contra tráfego automatizado que não passa pelo frontend oficial. A restrição de acesso
por **pessoa** continua sendo o login (seção 1); esta camada é só um reforço adicional.

## 6. Antes de considerar o ambiente "pronto para os usuários reais"

- [ ] Rodar a migração do banco (seção 3) e confirmar que os dados de demonstração fictícios foram
      removidos ou claramente identificados como tal (ver aviso em [docs/01](01-contexto-e-brainstorming.md)).
- [ ] Trocar `AFA_TWIN_SECRET_KEY` por um valor único gerado aleatoriamente (nunca o valor padrão de
      desenvolvimento).
- [ ] Definir `AFA_TWIN_ALLOWED_ORIGINS` com a URL exata do frontend (não deixar `*` em produção).
- [ ] Criar as contas reais de usuário (módulo Usuários, perfil Gestor) e desativar/trocar a senha das
      contas de demonstração (`gestor`, `piloto`, `mecanico`, `engenheiro`, `cientista`).
- [ ] Configurar `AFA_TWIN_SMTP_*` se o envio real de e-mail de alerta for necessário nesta fase.
- [ ] Decidir se a camada extra opcional de chave de acesso (seção 5.1) será usada.
- [ ] Confirmar com a área de segurança da informação de cada organização (FAB/ITA/Embraer) que o
      provedor de nuvem escolhido atende às políticas aplicáveis, especialmente antes de inserir
      qualquer dado real (não fictício) de aeronaves ou pessoal.
- [ ] Definir rotina de backup do Postgres gerenciado (a maioria dos planos gratuitos tem backup
      automático limitado — verificar a política do provedor escolhido).

## 7. Resumo dos arquivos de apoio incluídos no repositório

| Arquivo | Finalidade |
|---|---|
| [`backend/Dockerfile`](../backend/Dockerfile) | Imagem de produção do backend, pronta para Render/Railway/Fly.io |
| [`backend/.dockerignore`](../backend/.dockerignore) | Evita empacotar banco local/uploads/segredos na imagem |
| [`backend/requirements-cloud.txt`](../backend/requirements-cloud.txt) | Driver Postgres (`psycopg`) adicional para nuvem |
| [`frontend/netlify.toml`](../frontend/netlify.toml) | Configuração de build + proxy de `/api` e `/media` para o Netlify |
| [`frontend/vercel.json`](../frontend/vercel.json) | Equivalente para Vercel |

Nenhum desses arquivos afeta a execução local descrita em [docs/05](05-guia-instalacao-execucao.md) —
são usados apenas quando o respectivo serviço de nuvem é configurado.
