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

## 2. Topologia adotada (testada de ponta a ponta)

```
┌─────────────────────────┐        ┌──────────────────────────┐        ┌───────────────────────┐
│   Frontend (estático)     │──/api→│    Backend (API)           │──────▶│   Postgres gerenciado    │
│   Vercel (arquivos)       │  proxy │    Vercel (função Python)  │       │   Neon                    │
│   camada gratuita             │       │   camada gratuita             │       │   camada gratuita          │
└─────────────────────────┘        └──────────────────────────┘        └───────────────────────┘
```

> Até 2026-09-25 o frontend era publicado no Netlify; a conta em uso excedeu a cota de créditos do
> plano gratuito e passou a recusar novos deploys (HTTP 403 "Account credit usage exceeded"). Migrado
> para um segundo projeto Vercel (`afa-twin-web`), reaproveitando o mesmo token já usado no backend -
> ver `write_vercel_rewrites` em `tools/deploy_cloud.py` para o equivalente ao antigo `_redirects`.

**Por que Vercel para o backend, e não Render/Railway/Fly (containers Docker "sempre ligados")?**
Na prática, ao publicar este piloto, o **Render passou a exigir cartão de crédito cadastrado mesmo no
plano gratuito** (mensagem `"Payment information is required"` ao criar o serviço) — uma mudança de
política não documentada de forma consistente por eles. O **Vercel Hobby continua genuinamente
gratuito, sem cartão**, para uma função Python/FastAPI de tráfego moderado como este piloto — por isso
foi a escolha final, mesmo exigindo uma adaptação: funções do Vercel não têm disco persistente entre
chamadas, então **fotos enviadas pelo usuário (aeronave, perfil, inspeção fotográfica) são guardadas
como dado binário dentro do próprio Postgres** (`models.MediaAsset`), em vez de arquivo em disco - ver
[docs/03](03-modelo-de-dados.md), seção 3. Essa mudança vale tanto em nuvem quanto no piloto local.

> **Atenção:** condições de camada gratuita (limites de horas, "sleep" por inatividade, cota de créditos,
> exigência de cartão) mudam com frequência entre provedores, às vezes sem aviso — como aconteceu com o
> Render (exigência de cartão) e com o Netlify (bloqueio por cota excedida) durante a implantação deste
> próprio piloto. Confirme os termos atuais de Vercel e Neon diretamente no site de cada um antes de
> decidir.

## 3. Publicação automatizada (recomendado)

O repositório inclui [`tools/deploy_cloud.py`](../tools/deploy_cloud.py), um script que publica tudo de
ponta a ponta por API (sem precisar clicar em nenhum dashboard além de gerar 3 tokens):

1. Cria/atualiza um repositório público no GitHub com o código;
2. Cria/reaproveita um banco Postgres gratuito no Neon;
3. Cria/atualiza o projeto do backend no Vercel (função Python/FastAPI) com as variáveis de ambiente
   necessárias, e publica;
4. Compila o frontend (`npm run build`) e publica o resultado num segundo projeto Vercel (arquivos
   estáticos), já apontando para a URL do backend recém-publicado.

### Gerando os 3 tokens necessários

| Serviço | Onde gerar | Escopo/observação |
|---|---|---|
| **GitHub** | [github.com/settings/tokens/new](https://github.com/settings/tokens/new) → *Generate new token (classic)* | Marque o escopo `repo` |
| **Vercel** | Conta → *Settings* → *Tokens* → *Create Token* | Sem escopo especial necessário - usado tanto para o backend quanto para o frontend |
| **Neon** | Console → *Account settings* → *API keys* → *Generate new API key* | — |

Nenhuma dessas três contas pede cartão de crédito nas camadas gratuitas usadas aqui.

### Rodando o script

```bash
cd afa-twin/tools
# defina as 3 variáveis de ambiente com os tokens gerados acima, depois:
python deploy_cloud.py
```

O script é seguro para rodar mais de uma vez: ele reaproveita o repositório, o banco e os dois projetos
Vercel (backend e frontend) já criados (por nome), em vez de duplicá-los — útil para publicar uma nova
versão depois de alterações no código.

> **Importante ao adicionar/alterar uma tabela, um tipo enum (`SAEnum`), um índice ou uma coluna em
> `models.py`:** em Postgres (nuvem), as rotinas `sync_postgres_enum_types()`/`sync_missing_indexes()`/
> `sync_missing_columns()` (`backend/app/database.py`) **não rodam mais sozinhas** no startup da API -
> por dois motivos: (1) confirmamos na prática que esse hook não era confiável no runtime serverless do
> Vercel para esse fim (alteração de esquema publicada não aparecia no Postgres de produção até ser
> aplicada manualmente); (2) medimos que as três juntas custam dezenas de round-trips de introspecção
> ao banco - **~43 segundos de um cold start de ~48s**, pois cada round-trip paga a latência do Neon
> (gratuito) ainda acordando de uma suspensão por inatividade. `Base.metadata.create_all()` (criação de
> tabelas/tipos novos) continua automática; só as alterações a algo que já existe ficam manuais. Por
> isso, depois de todo deploy que altera `models.py`, chame explicitamente (autenticado como Gestor):
> ```bash
> curl -X POST https://SEU-BACKEND.vercel.app/api/admin/sync-schema \
>   -H "Authorization: Bearer <token do login como gestor>"
> ```
> A rotina é aditiva e idempotente (nunca remove nada) - segura de chamar quantas vezes forem
> necessárias, inclusive sem nenhuma alteração pendente.

## 4. Publicação manual (alternativa, se preferir não gerar tokens de API)

### 4.1 Banco de dados (Neon)

1. Crie um projeto gratuito em [neon.tech](https://neon.tech) e copie a *connection string*.
2. Transforme o prefixo `postgresql://` em `postgresql+psycopg://` e garanta `?sslmode=require` no final.
3. Guarde esse valor para a variável `AFA_TWIN_DATABASE_URL` do passo seguinte.

### 4.2 Backend (Vercel)

1. Crie uma conta em [vercel.com](https://vercel.com) (sem cartão).
2. *Add New* → *Project* → conecte o repositório GitHub (ou use `vercel deploy` pela CLI a partir da
   pasta `backend/`) — o Vercel detecta automaticamente que é uma aplicação FastAPI (arquivo
   `app/main.py` expondo um objeto `app`) e usa `requirements.txt` para instalar as dependências
   (já inclui o driver Postgres `psycopg`).
3. Em *Project Settings → Environment Variables*, defina:

   | Variável | Valor |
   |---|---|
   | `AFA_TWIN_DATABASE_URL` | connection string do Neon (passo 4.1) |
   | `AFA_TWIN_SECRET_KEY` | valor aleatório longo e secreto (`python -c "import secrets;print(secrets.token_hex(32))"`) |
   | `AFA_TWIN_ALLOWED_ORIGINS` | URL exata do frontend publicado, ex.: `https://afa-twin-web.vercel.app` |
   | `AFA_TWIN_ACCESS_KEY` | *(opcional, seção 6)* uma chave extra de acesso |
   | `AFA_TWIN_SMTP_HOST`, `_PORT`, `_USER`, `_PASSWORD`, `_FROM` | *(opcional)* para e-mails reais de alerta |
   | `AFA_TWIN_TWILIO_ACCOUNT_SID`, `_AUTH_TOKEN`, `_FROM_NUMBER` | *(opcional)* para SMS reais de alerta via Twilio - conta trial grátis com crédito inicial (depois, pago por mensagem); numa conta trial, o destino precisa estar verificado em console.twilio.com → Phone Numbers → Verified Caller IDs |

4. Deploy. Anote a URL pública gerada (ex.: `https://afa-twin-api.vercel.app`).

### 4.3 Frontend (Vercel, arquivos estáticos)

1. Rode `npm run build` dentro de `frontend/` (gera a pasta `frontend/dist/`).
2. Dentro de `frontend/dist/`, crie um arquivo `vercel.json` com:
   ```json
   {
     "rewrites": [
       { "source": "/api/:path*", "destination": "https://SUA-URL-DO-BACKEND.vercel.app/api/:path*" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   (troque pela URL real do passo 4.2; a primeira regra tem que vir antes da segunda - o Vercel aplica
   a primeira que casar, e a segunda é o fallback de SPA para as rotas do React Router).
3. Crie um **segundo** projeto no mesmo Vercel (*Add New → Project*), desta vez apontando para a pasta
   `frontend/dist/` já compilada (ou use `vercel deploy` pela CLI a partir dessa pasta) - sem framework
   detectado, o Vercel serve os arquivos como estão.
4. Deploy. Anote a URL pública gerada (ex.: `https://afa-twin-web.vercel.app`).
5. Volte ao projeto do backend (passo 4.2) e confirme que `AFA_TWIN_ALLOWED_ORIGINS` está com essa URL
   exata do frontend.

## 5. Alternativa para o backend: Render/Railway/Fly com Docker (exige cartão)

O repositório também inclui um [`backend/Dockerfile`](../backend/Dockerfile) pronto, caso você prefira
um container "sempre ligado" (sem os limites de execução de função sem servidor) e não se importe em
cadastrar um cartão de crédito (a cobrança não ocorre enquanto o uso ficar dentro do plano gratuito
declarado por esses provedores - mas o cadastro em si é exigido). O procedimento é o mesmo do Vercel
(variáveis de ambiente idênticas), apontando o serviço para `backend/Dockerfile`. Como esse caminho não
precisa do armazenamento de fotos em banco (o container tem disco, mesmo que efêmero entre deploys),
ele funciona tanto com a versão atual (fotos no banco) quanto seria compatível com um esquema de disco
caso reintroduzido no futuro.

## 6. Camada extra opcional: chave de acesso compartilhada

Além do login (que já restringe **uso**), é possível reduzir quem consegue sequer **chamar a API** —
útil para dificultar varreduras automáticas de bots contra o endpoint de login assim que o sistema está
na internet pública. Isso é **opcional e desligado por padrão**, para não complicar chamadas de API
durante o piloto:

1. No backend (Vercel), defina `AFA_TWIN_ACCESS_KEY` com um valor secreto.
2. No frontend, defina a variável de build `VITE_ACCESS_KEY` com o **mesmo valor**, antes de rodar
   `npm run build` (ou como variável de ambiente de build no projeto Vercel do frontend).
3. A partir daí, toda chamada à API (exceto `/api/health` e `/api/media/*`, que precisam ficar acessíveis
   para as tags `<img>` do navegador exibirem fotos) exige o cabeçalho `X-AFA-TWIN-Key` com esse valor —
   o cliente HTTP do frontend (`frontend/src/api/client.ts`) já envia esse cabeçalho automaticamente
   quando a variável está definida.

**Importante sobre o limite real desta camada:** como o valor fica embutido no JavaScript entregue ao
navegador, ele não é secreto de quem já abre o site (não é uma senha de usuário) — é apenas uma
barreira simples contra tráfego automatizado que não passa pelo frontend oficial. A restrição de acesso
por **pessoa** continua sendo o login (seção 1); esta camada é só um reforço adicional.

## 7. Antes de considerar o ambiente "pronto para os usuários reais"

- [ ] Confirmar que os dados de demonstração fictícios foram removidos ou claramente identificados como
      tal (ver aviso em [docs/01](01-contexto-e-brainstorming.md)) - ou apague-os e rode o backend uma vez
      com um banco Postgres vazio para começar do zero.
- [ ] Trocar `AFA_TWIN_SECRET_KEY` por um valor único gerado aleatoriamente (nunca o valor padrão de
      desenvolvimento) - o script automatizado já faz isso.
- [ ] Definir `AFA_TWIN_ALLOWED_ORIGINS` com a URL exata do frontend (não deixar `*` em produção) - o
      script automatizado já faz isso no segundo deploy.
- [ ] Criar as contas reais de usuário (módulo Usuários, perfil Gestor) e desativar/trocar a senha das
      contas de demonstração (`gestor`, `piloto`, `mecanico`, `engenheiro`, `cientista`).
- [ ] Configurar `AFA_TWIN_SMTP_*` se o envio real de e-mail de alerta for necessário nesta fase.
- [ ] Configurar `AFA_TWIN_TWILIO_*` se o envio real de SMS de alerta for necessário nesta fase.
- [ ] Decidir se a camada extra opcional de chave de acesso (seção 6) será usada.
- [ ] Confirmar com a área de segurança da informação de cada organização (FAB/ITA/Embraer) que o
      provedor de nuvem escolhido atende às políticas aplicáveis, especialmente antes de inserir
      qualquer dado real (não fictício) de aeronaves ou pessoal.
- [ ] Definir rotina de backup do Postgres gerenciado (o plano gratuito do Neon tem retenção de
      histórico limitada - verificar a política atual).
- [ ] Acompanhar o uso do plano gratuito do Vercel (execuções/tráfego) e do Neon (0,5 GB de
      armazenamento, já incluindo as fotos enviadas) para saber quando será necessário um plano pago.

## 8. Resumo dos arquivos de apoio incluídos no repositório

| Arquivo | Finalidade |
|---|---|
| [`tools/deploy_cloud.py`](../tools/deploy_cloud.py) | Publica tudo (GitHub, Neon, Vercel backend, Vercel frontend) automaticamente via API |
| [`backend/requirements.txt`](../backend/requirements.txt) | Já inclui o driver Postgres (`psycopg`) usado tanto localmente (se configurado) quanto em nuvem |
| `frontend/dist/vercel.json` | Gerado automaticamente pelo script (`write_vercel_rewrites`) - proxy de `/api` para o backend + fallback de SPA |
| [`backend/Dockerfile`](../backend/Dockerfile) | Alternativa em container p/ Render/Railway/Fly (seção 5, exige cartão) |
| [`backend/.dockerignore`](../backend/.dockerignore) | Evita empacotar banco local/segredos na imagem Docker |

Nenhum desses arquivos afeta a execução local descrita em [docs/05](05-guia-instalacao-execucao.md) —
são usados apenas quando o respectivo serviço de nuvem é configurado.
