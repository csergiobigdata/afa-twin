# AFA-TWIN — Documento de Arquitetura da Solução

Documento 2 de 6 — ver também: [01 - Contexto e Brainstorming](01-contexto-e-brainstorming.md),
[03 - Modelo de Dados](03-modelo-de-dados.md), [04 - Protocolos e Conformidade](04-protocolos-e-conformidade.md),
[05 - Guia de Instalação e Execução](05-guia-instalacao-execucao.md), [06 - Implantação em Nuvem](06-implantacao-nuvem.md).

---

## 1. Princípios de decisão

1. **Zero custo de infraestrutura na fase piloto.** Tudo roda localmente (notebook/servidor de borda na
   unidade), sem contas em nuvem pagas.
2. **Caminho de migração para nuvem sem reescrita.** Toda a persistência passa por um ORM
   (SQLAlchemy) — trocar SQLite por Postgres/MySQL gerenciado é uma troca de string de conexão.
3. **Tablet como dispositivo de campo.** Mecânicos e pilotos usam o app no hangar — a interface é
   responsiva e instalável como aplicativo (PWA), com alvo de toque grande e leitura em ambientes
   claros.
4. **Linguagens maduras, com forte adoção em engenharia/aeroespacial e grande base de
   desenvolvedores/segurança**, evitando tecnologias experimentais em um contexto militar:
   - **Python** para a API e a lógica de domínio (linguagem já usada em engenharia de confiabilidade,
     ciência de dados e prototipagem em institutos como o ITA; caminho direto para incorporar os
     módulos de IA/ML previstos na evolução do projeto);
   - **TypeScript + React** para a interface (tipagem estática reduz erros em formulários de cadastro
     críticos; React é o padrão de mercado para PWAs multi-dispositivo).
5. **Segurança desde o piloto, mesmo que simplificada.** Login obrigatório, senhas com hashing
   (PBKDF2-HMAC-SHA256), tokens de sessão assinados (HMAC) e controle de papéis (RBAC) — sem
   depender de serviços pagos de identidade nesta fase, mas com um caminho claro de evolução para
   OAuth2/JWT + MFA quando sair do piloto (seção 6).

## 2. Visão geral (C4 — nível de contexto)

```
┌───────────────────────────────────────────────────────────────────────┐
│                     Usuários (tablet / navegador)                      │
│   Piloto · Mecânico · Engenheiro · Cientista · Gestor/Responsável       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTPS/HTTP (rede local)
                                 ▼
                 ┌───────────────────────────────┐
                 │   AFA-TWIN Web App (PWA)        │
                 │   React + TypeScript + Vite     │
                 │   Instalável em tablets          │
                 └───────────────┬───────────────┘
                                 │ REST/JSON (fetch)
                                 ▼
                 ┌───────────────────────────────┐
                 │   AFA-TWIN API                   │
                 │   Python + FastAPI               │
                 │   Autenticação, regras de negócio,│
                 │   cálculo de índice de saúde      │
                 └───────────────┬───────────────┘
                                 │ SQLAlchemy ORM
                                 ▼
                 ┌───────────────────────────────┐
                 │   Banco de dados local          │
                 │   SQLite (arquivo único)         │
                 │   → migrável para Postgres/nuvem │
                 └───────────────────────────────┘
```

## 3. Stack tecnológica escolhida

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Tipagem estática, ecossistema maduro, build rápido, HMR |
| PWA | `vite-plugin-pwa` (Workbox) | Instalação em tablets (Android/iPadOS) sem loja de aplicativos, funcionamento parcialmente offline |
| Roteamento | React Router | Padrão de mercado para SPAs multi-tela |
| Backend/API | Python 3 + FastAPI | Tipagem via Pydantic, documentação automática (OpenAPI/Swagger), alta produtividade, mesma linguagem da futura camada de IA |
| ORM/Banco | SQLAlchemy 2.0 + SQLite | Zero custo, arquivo único, portável; troca de DSN migra para Postgres/MySQL em nuvem sem alterar o código de domínio |
| Autenticação | Hash PBKDF2-HMAC-SHA256 + token assinado por HMAC (stdlib) | Sem dependências binárias frágeis, zero custo, adequado ao piloto; caminho de evolução documentado abaixo |
| Hospedagem (piloto) | Execução local / rede interna (uvicorn + Vite build servido estaticamente) | Zero custo de nuvem nesta fase |

## 4. Por que não usar [outras opções]

- **Node.js/Express no backend**: descartado como escolha primária porque a evolução planejada do
  projeto (predição de falhas, visão computacional, PLN sobre manuais) é overwhelmingly Python
  (scikit-learn, PyTorch, OpenCV, spaCy/transformers) — manter a API e os futuros módulos de IA na
  mesma linguagem reduz fricção de integração.
- **MongoDB/NoSQL**: os dados são fortemente relacionais (aeronave → componentes → ordens de
  serviço → pessoas), com necessidade de integridade referencial (ex.: não permitir excluir uma pessoa
  vinculada); um banco relacional com ORM é mais aderente.
- **App nativo (Kotlin/Swift)**: exigiria duas bases de código (Android/iOS) e processo de homologação
  em lojas — incompatível com "zero custo" e com o caráter de piloto multi-instituição. Um PWA cobre
  tablets de ambos os ecossistemas com uma única base de código.

## 5. Modelo de segurança e papéis (RBAC simplificado)

Papéis: `Piloto`, `Mecânico`, `Engenheiro`, `Cientista`, `Gestor / Responsável Técnico`.

- Todas as rotas de API (exceto `/auth/login` e `/health`) exigem token válido.
- **Não existe autocadastro**: contas só são criadas pelo perfil `Gestor`, no módulo Usuários — a
  principal barreira de "acesso restrito a usuários definidos" já é estrutural, não uma configuração à parte.
- Exclusão de **aeronaves**: restrita a `Gestor` e `Engenheiro`.
- **Pessoas nunca são excluídas**, apenas inativadas (`active=false`) — a tentativa de exclusão via API
  retorna erro explícito (405); qualquer ativação/inativação fica registrada na trilha de auditoria (seção 6).
- **Ordens de Serviço nunca são excluídas nem alteradas depois de `Concluída`/`Cancelada`** — o
  cancelamento é a única transição permitida a partir de um status não-terminal, exige registrar quem
  cancelou e por quê, e notifica automaticamente a equipe responsável pela aeronave.
- Demais operações de cadastro/edição (aeronaves, componentes, ordens de serviço em andamento,
  protocolos, livro de bordo, vínculos, grupos, catálogos auxiliares) estão disponíveis a qualquer usuário
  autenticado nesta fase de piloto, para não travar o teste de usabilidade com múltiplos perfis — a
  granularidade fina de permissões por operação é um item de evolução (seção 6) a ser calibrado com o
  feedback real de uso.
- Em nuvem, uma camada adicional **opcional** de chave de acesso compartilhada pode ser ligada via
  variável de ambiente, como reforço contra tráfego automatizado — ver
  [docs/06-implantacao-nuvem.md](06-implantacao-nuvem.md), seção 5.1.

## 6. Evolução recomendada após o piloto

| Item | Estado no piloto | Evolução recomendada |
|---|---|---|
| Banco de dados | SQLite local (ou Postgres gratuito, se implantado em nuvem — [docs/06](06-implantacao-nuvem.md)) | Postgres gerenciado com plano pago e backup formal, quando sair da fase de piloto |
| Autenticação | Usuário/senha + token HMAC próprio; sem autocadastro | OAuth2/OpenID Connect institucional (ex.: integração com diretório da FAB/ITA/Embraer) + MFA |
| Auditoria | **Implementada** (v0.3 - `audit.py`, tela "Auditoria"): registra criação/alteração/inativação/cancelamento com autor e data/hora | Retenção configurável de longo prazo e exportação para sistemas de conformidade institucionais |
| Responsabilidade por aeronave | **Implementada** (v0.3): vínculos individuais **e** grupos/equipes responsáveis, unidos no cálculo de notificação | Sincronização com o organograma oficial de esquadrões da FAB, em vez de cadastro manual |
| Cadastros auxiliares (organização, posto, especialidade, esquadrão, tipos) | **Implementados como catálogos editáveis** (v0.3 - `LookupItem`), sem exigir nova versão do sistema | Sincronização com um diretório institucional oficial (evita divergência entre bases) |
| Índice de saúde/risco | Fórmula determinística + modelo de risco ponderado (6 fatores) e MTBF/MTTR reais (v0.2 - `compute.py`, `reliability.py`) | Modelos estatísticos completos (Weibull com β variável) e de ML descritos no documento de origem |
| Inspeção | Inspeção Fotográfica manual com histórico visual por componente (v0.2) | Visão computacional automática (classificação de severidade/extensão a partir da imagem) |
| Diagnóstico | Busca heurística por similaridade textual sobre o histórico de OS da frota (v0.2 - `diagnostics.py`) | Módulo de PLN/embeddings semânticos para consulta a manuais (AMM) e boletins técnicos |
| Hospedagem | Local/rede interna, com caminho documentado para nuvem gratuita ([docs/06](06-implantacao-nuvem.md)) | Nuvem governamental ou privada homologada, com backup e alta disponibilidade contratual |
| Testes | Smoke tests manuais (curl/Playwright) durante o desenvolvimento | Suíte de testes unitários e de integração automatizados antes de qualquer decisão de nuvem definitiva |

## 7. Estrutura de pastas

```
afa-twin/
  docs/                      # esta documentação
    manual/                   # capturas de tela + fonte HTML do manual do usuário (docs/06 e tools/make-pdf.mjs)
  backend/
    app/
      main.py                # ponto de entrada FastAPI (CORS, chave de acesso opcional)
      database.py             # engine/sessão SQLAlchemy
      models.py               # entidades ORM
      schemas.py               # contratos Pydantic (entrada/saída da API)
      security.py              # hashing de senha + tokens de sessão
      audit.py                  # registro da trilha de auditoria
      notifications.py           # envio/simulação de notificações + retenção das últimas 20
      compute.py                # índice de saúde / risco operacional ponderado / alertas
      reliability.py             # MTBF / MTTR / taxa de falha / disponibilidade
      diagnostics.py              # diagnóstico inteligente (busca por similaridade textual)
      planning.py                  # disponibilidade da frota / análise prospectiva de manutenção
      seed.py                       # dados de demonstração
      routers/                       # um arquivo por recurso da API (inclui groups, lookups, audit)
    requirements.txt
    requirements-cloud.txt          # driver Postgres adicional para deploy em nuvem (docs/06)
    Dockerfile                      # imagem de produção do backend (docs/06)
    data/
      afa_twin.db                    # banco local (gerado em tempo de execução)
      uploads/aircraft/                # fotos reais das aeronaves (estática + animada)
      uploads/inspections/              # fotos da Inspeção Fotográfica
      uploads/people/                    # fotos de perfil dos usuários
  frontend/
    src/
      api/                        # cliente HTTP + tipos TypeScript + hook de cadastros auxiliares
      auth/                        # contexto de autenticação
      components/                  # layout, badges, ilustrações, pôsteres de aeronaves, gerenciador de catálogos
      pages/                        # telas da aplicação
    vite.config.ts                 # inclui configuração do PWA
    netlify.toml / vercel.json      # configuração de deploy do frontend estático (docs/06)
    public/icons/                   # ícones do aplicativo instalável
    public/aircraft-art/             # ilustrações "pôster" (estática + animada) de exemplo por modelo
  tools/                       # scripts de apoio (Playwright): capturas de tela e geração do manual em PDF
```

## 8. Identidade visual

Paleta baseada nas cores da bandeira/institucionais da Força Aérea Brasileira — verde, amarelo e azul —
combinada com a semântica universal de aviação para status (verde = operacional/normal, amarelo =
atenção, vermelho = crítico). O ícone do aplicativo (`frontend/public/icons/`) é um desenho original: um
caça estilizado em ascensão sobre um losango nas cores da bandeira do Brasil, dentro de um círculo
azul-marinho — substituindo o emblema em formato de roldana usado na v0.1.

As ilustrações de aeronaves exibidas por padrão na listagem/detalhe (`frontend/public/aircraft-art/`) são
**pôsteres vetoriais originais** (estáticos e animados em SVG, com hélices/rotores girando ou motores
"acesos" via SMIL) associados a cada categoria de aeronave - usados apenas enquanto nenhuma foto real
for anexada ao cadastro. O cadastro de aeronaves permite **anexar uma foto real** (estática, em
JPG/PNG/WEBP) e uma **imagem animada opcional** (GIF/WEBP) para inspeção de detalhes; quando
presentes, essas fotos reais têm prioridade sobre a ilustração de exemplo em toda a interface. Isso evita
qualquer questão de direito de imagem enquanto não há fotos reais cadastradas, sem impedir o uso de
fotografias oficiais da própria frota assim que disponíveis.
