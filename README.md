# AFA-TWIN

**Gêmeo Digital para Apoio à Decisão em Manutenção Aeronáutica** — piloto de testes para controle e
gerenciamento de manutenção de aeronaves militares, construído a partir do documento de estudo
`digital-twin-tcc.pdf` (Digital Twin como "cérebro" de apoio à decisão em manutenção aeronáutica).

Aplicativo web instalável em tablets (PWA) com identidade visual inspirada nas cores institucionais da
Força Aérea Brasileira, voltado ao uso conjunto por **pilotos, mecânicos, engenheiros, cientistas e
responsáveis técnicos** da FAB, do ITA e da Embraer.

## Leia primeiro

A documentação técnica cobre todo o contexto, as decisões de arquitetura e as funcionalidades
implementadas, nesta ordem:

1. [`docs/01-contexto-e-brainstorming.md`](docs/01-contexto-e-brainstorming.md) — origem do projeto, problema, brainstorming de entidades, governança e riscos.
2. [`docs/02-arquitetura-da-solucao.md`](docs/02-arquitetura-da-solucao.md) — stack tecnológica, decisões e justificativas, plano de evolução.
3. [`docs/03-modelo-de-dados.md`](docs/03-modelo-de-dados.md) — diagrama entidade-relacionamento e regras de negócio.
4. [`docs/04-protocolos-e-conformidade.md`](docs/04-protocolos-e-conformidade.md) — conceitos de manutenção aeronáutica adotados e o que fica para uma fase posterior.
5. [`docs/05-guia-instalacao-execucao.md`](docs/05-guia-instalacao-execucao.md) — **como rodar o projeto** localmente.
6. [`docs/06-implantacao-nuvem.md`](docs/06-implantacao-nuvem.md) — **como publicar em nuvem gratuita** com acesso restrito aos usuários definidos.

Também há um **manual do usuário ilustrado**, com telas de exemplo de cada módulo, em
[`docs/AFA-TWIN-Manual-do-Usuario.pdf`](docs/AFA-TWIN-Manual-do-Usuario.pdf).

## Estrutura

```
afa-twin/
  docs/        → documentação (leia acima) + manual do usuário (PDF e fonte HTML)
  backend/     → API em Python (FastAPI) + banco local SQLite (ou Postgres em nuvem)
  frontend/    → aplicativo web/PWA em React + TypeScript
  tools/       → scripts Playwright de captura de tela e geração do manual em PDF
```

## Início rápido

```powershell
# Terminal 1 — API
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — Aplicativo web
cd frontend
npm install
npm run dev
```

Acesse **http://localhost:5173** — contas de demonstração disponíveis na tela de login
(usuário `gestor`, `piloto`, `mecanico`, `engenheiro` ou `cientista`, senha `AfaTwin@2026`).

Detalhes completos, incluindo como instalar como aplicativo em um tablet: [`docs/05-guia-instalacao-execucao.md`](docs/05-guia-instalacao-execucao.md).

## Escopo desta fase (piloto)

- ✅ Cadastro de aeronaves (nome, marca, modelo, características e configurações mecânicas), com foto
  real (estática) e imagem animada opcional (GIF/WEBP) para inspeção de detalhes.
- ✅ Cadastro de pilotos, mecânicos, engenheiros, cientistas e responsáveis técnicos.
- ✅ Vínculo de responsabilidade entre pessoas e aeronaves, com papel e data.
- ✅ Cadastro de componentes com controle de vida (hard-time / on-condition / condition-monitoring).
- ✅ Ordens de serviço com prioridade, status, referência técnica e trilha de constatações/ações.
- ✅ Protocolos/checklists de manutenção reutilizáveis.
- ✅ Livro de bordo simplificado (voos, horas, discrepâncias) com propagação automática de horas.
- ✅ Painel de apoio à decisão: índice de saúde, risco operacional e alertas de desgaste/OS crítica.
- ✅ Módulo Aeronaves dividido em **Cadastro** (lista administrativa, editar/excluir) e **Pesquisa**
  (busca visual por foto/modelo, com filtro por digitação e navegação direta ao cadastro completo).
- ✅ Listagem de aeronaves em **lista ou grade**, com visualização da foto/ilustração do modelo.
- ✅ **Confiabilidade** (MTBF, MTTR, taxa de falha, disponibilidade) por aeronave a partir do histórico real.
- ✅ **Risco Operacional ponderado** com os 6 fatores e pesos do documento de referência.
- ✅ **Inspeção Fotográfica** (fundação manual do módulo de visão computacional) com histórico visual.
- ✅ **Diagnóstico Inteligente** heurístico (busca por similaridade textual no histórico da frota).
- ✅ **Disponibilidade da Frota** projetada e **Análise Prospectiva de Manutenção** ("e se eu adiar?").
- ✅ **Vigência de peças**: tempo de uso, vigência por calendário e intervalo de manutenção preventiva
  por componente, com alerta automático no Painel quando o vencimento se aproxima ou já passou.
- ✅ **Histórico de manutenção por peça**: ordens de serviço, equipe envolvida, responsável e
  notificações emitidas, consultável por componente (aba Componentes → Histórico).
- ✅ **Notificações** (e-mail real via SMTP quando configurado; SMS/WhatsApp simulados nesta fase, sem
  custo) disparadas automaticamente na mudança de status de uma aeronave e sob demanda — pelo Painel
  ou diretamente no cadastro da aeronave — para peças próximas do vencimento, com histórico completo.
- ✅ **Meu Perfil**: cada usuário visualiza/edita sua própria foto, e-mail e telefone (DDD + número)
  usados para receber alertas.
- ✅ **Grupos/Equipes responsáveis**: cadastro de equipes nomeadas (piloto titular, piloto reserva,
  mecânicos, engenheiros, comandante de esquadrão) atribuíveis a uma ou mais aeronaves — a
  responsabilidade coletiva soma-se aos vínculos individuais no cálculo de quem deve ser notificado.
- ✅ **Cadastro de usuários completo**, com foto, organização, função, posto/graduação, matrícula,
  especialidade e esquadrão (estes três últimos por listbox), certificações, e-mail e telefone (DDD +
  número, com máscara e validação) — usuários nunca são excluídos, apenas inativados/reativados.
- ✅ **Cadastros Auxiliares**: catálogos editáveis (sem precisar de nova versão do sistema) para
  Organização, Posto/Graduação/Cargo, Especialidade e Esquadrão/Unidade.
- ✅ **Ordens de Serviço imutáveis em status terminal**: uma OS concluída ou cancelada não pode mais
  ser alterada nem excluída; cancelar exige registrar quem cancelou e por quê, com notificação
  automática à equipe responsável. Módulo Manutenção dividido em **Ordem de Serviço** e **Cadastro de
  Manutenção** (catálogos de Componente Associado e Tipo de Intervalo, mais a referência de Tipo de
  Manutenção).
- ✅ **Trilha de auditoria**: toda criação, alteração, inativação e cancelamento relevante fica registrada
  (quem, quando, o quê), consultável na tela "Auditoria".
- ✅ **Retenção de notificações**: histórico mantém sempre as 20 notificações mais recentes; botão para
  notificar todos os responsáveis pendentes de uma só vez, no Painel e por aeronave.
- ✅ **Gráfico de categorias de manutenção** no Painel (pizza/barras/linhas, alternável), a partir dos
  alertas ativos da frota.
- ✅ Aplicativo web instalável em tablets (PWA), identidade visual FAB, sem custo de infraestrutura.
- ✅ **Manual do usuário em PDF** com telas de exemplo de cada módulo ([`docs/AFA-TWIN-Manual-do-Usuario.pdf`](docs/AFA-TWIN-Manual-do-Usuario.pdf)).
- ✅ **Caminho documentado de implantação em nuvem gratuita** com acesso restrito aos usuários
  definidos ([docs/06](docs/06-implantacao-nuvem.md)): Dockerfile do backend, configuração de deploy
  estático do frontend (Netlify/Vercel), migração para Postgres gratuito e camada opcional de chave de
  acesso extra.
- ⏭️ Modelos de IA/ML treinados (Weibull completo, visão computacional automática, PLN semântico) e
  integração automática com sistemas de missão/meteorologia — evolução planejada (ver
  [docs/01](docs/01-contexto-e-brainstorming.md), seção 7, e [docs/02](docs/02-arquitetura-da-solucao.md), seção 6).

## Contato / autoria do teste

Piloto conduzido a partir da conta `carlossergio631@yahoo.com.br`. Consulte a documentação para os
critérios de segurança a revisar antes de expandir o teste a mais usuários.
