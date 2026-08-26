# AFA-TWIN — Contexto e Brainstorming

**Sistema Inteligente de Gêmeo Digital para Manutenção Aeronáutica**
Documento 1 de 6 — ver também: [02 - Arquitetura da Solução](02-arquitetura-da-solucao.md), [03 - Modelo de Dados](03-modelo-de-dados.md), [04 - Protocolos e Conformidade](04-protocolos-e-conformidade.md), [05 - Guia de Instalação e Execução](05-guia-instalacao-execucao.md), [06 - Implantação em Nuvem](06-implantacao-nuvem.md).

---

## 1. Origem e problema

Este projeto nasce do documento de estudo `digital-twin-tcc.pdf`, que propõe o Digital Twin não como
uma simples representação 3D de uma aeronave, mas como o **núcleo de uma plataforma inteligente de
apoio à decisão em manutenção aeronáutica**, integrando:

- Aquisição de dados (livro de bordo, ordens de serviço, horas de voo, componentes, sensores, MEL/CDL,
  meteorologia, missões, estoque, manuais, boletins técnicos, AD/SB);
- Um modelo vivo por aeronave (gêmeo digital): configuração instalada, horas por sistema, histórico de
  substituições, inspeções, discrepâncias, tendências de desgaste, disponibilidade de peças, status de
  manutenção e índice de saúde por componente;
- Módulos inteligentes: predição de falhas, análise de confiabilidade (MTBF, MTTR, Weibull,
  disponibilidade), diagnóstico inteligente, visão computacional para inspeção, disponibilidade de
  frota e risco operacional;
- Um painel de apoio à decisão.

**Problema central a resolver nesta fase piloto:** hoje, o controle de manutenção de uma frota mista de
aeronaves militares depende de múltiplos registros dispersos (livros de bordo em papel/planilhas,
ordens de serviço isoladas, conhecimento tácito de mecânicos/engenheiros). Isso eleva o risco de:

1. Um componente ultrapassar seu limite de vida (hard-time) sem alerta;
2. Uma inspeção programada atrasar sem visibilidade do impacto operacional;
3. A responsabilidade técnica por uma aeronave não estar clara ou atualizada;
4. Protocolos de manutenção não serem seguidos de forma padronizada e auditável.

## 2. Objetivo do piloto

Construir um **piloto de testes** (não um sistema de produção final) que materialize a camada 1 e 2 da
arquitetura de 5 camadas descrita no documento de referência — **Aquisição de Dados** e **Gêmeo
Digital** — com um recorte inicial do **Apoio à Decisão** (painel, alertas, índice de saúde simplificado),
deixando a camada de **Inteligência Artificial** e **Simulação avançada** (predição de falhas com ML,
visão computacional, PLN sobre manuais, análise prospectiva de manutenção) como evolução planejada
e não implementada nesta fase (ver seção 6).

Público-alvo do teste: **militares da FAB (pilotos, mecânicos, oficiais de manutenção), engenheiros e
cientistas do ITA e da Embraer** — perfil multidisciplinar coerente com o próprio documento de origem,
que cita explicitamente aplicação em "operadores civis, MROs e organizações militares".

## 3. Brainstorming — o que o sistema precisa registrar e decidir

### 3.1 Entidades essenciais (o "quê")
- **Aeronave**: identidade (matrícula/tail number), fabricante, modelo, categoria (caça, ataque,
  transporte, treinamento, helicóptero…), configuração mecânica (motor, aviônicos, armamento),
  desempenho (velocidade, teto, alcance), lotação (esquadrão/base) e status operacional.
- **Componente**: peça ou sistema rastreável dentro de uma aeronave, com tipo de controle de vida
  (hard-time / on-condition / condition monitoring — nomenclatura padrão de programas de manutenção,
  ex.: metodologia MSG-3), horas acumuladas, limite de vida, criticidade e última inspeção.
- **Ordem de Serviço (OS)**: unidade de trabalho de manutenção — tipo (rotina, preventiva, corretiva,
  boletim AD/SB, overhaul, modificação), prioridade, status, referência técnica (AMM/ICA/boletim),
  responsável, constatações e ações.
- **Protocolo/Checklist**: modelo reutilizável de inspeção (ex.: inspeção de 50h, 100h, IAM) vinculado a
  um documento de referência.
- **Livro de bordo (voo)**: registro de horas voadas, missão e discrepâncias reportadas pelo piloto —
  disparador natural do acúmulo de horas em aeronave e componentes.

### 3.2 Entidades de pessoas (o "quem")
- **Piloto** — habilitação por tipo de aeronave, esquadrão.
- **Mecânico** — especialidade (célula/motor, aviônicos, hidráulica…), certificações/cursos.
- **Engenheiro** — confiabilidade, estruturas, suporte ao produto (perfil ITA/Embraer).
- **Cientista** — pesquisa aplicada (ex.: IA para manutenção preditiva — ponte direta com a evolução
  futura do sistema).
- **Gestor/Responsável Técnico** — chefia de manutenção, autoridade para aprovar exclusões de
  cadastro e liberar aeronaves.

Cada pessoa carrega **posto/graduação ou cargo** e **organização de origem** (FAB, ITA, Embraer, outra),
respeitando a convivência de militares e civis no mesmo ecossistema de manutenção — como já ocorre
hoje na prática entre FAB, ITA e a indústria nacional.

### 3.3 Vínculos (o "quem responde pelo quê")
Uma aeronave pode ter múltiplos responsáveis simultâneos com papéis distintos: piloto titular, piloto
instrutor, mecânico responsável, engenheiro de confiabilidade, chefe de manutenção, inspetor de
qualidade, cientista responsável por P&D. Isso é modelado como uma tabela de vínculos (many-to-many
com atributos), não como um campo fixo na aeronave — permitindo histórico e múltiplos papéis.

### 3.4 Indicadores e alertas (o "e daí?")
Do documento de origem, extraímos a necessidade mínima de um **índice de saúde** e um **nível de
risco operacional** por aeronave, com alertas automáticos quando:
- um componente hard-time se aproxima ou ultrapassa seu limite de vida;
- uma OS crítica permanece em aberto.

Esses cálculos são **deliberadamente simples e auditáveis** nesta fase (ver docs/02, seção "Evolução
para IA") — o objetivo do piloto é validar o **fluxo de dados e o processo de trabalho**, não entregar um
modelo estatístico/preditivo definitivo.

### 3.5 Governança do dado — o que o brainstorming revelou como igualmente crítico

Ao aprofundar o cadastro de pessoas e de ordens de serviço com usuários reais do piloto, ficou claro que
um sistema de manutenção aeronáutica precisa de **confiança no dado histórico** tanto quanto de bons
cálculos de saúde/risco. Isso levou a quatro decisões de governança incorporadas ao piloto (detalhadas
em [docs/03](03-modelo-de-dados.md) e [docs/04](04-protocolos-e-conformidade.md), seção 7):

- **Responsabilidade coletiva, não só individual**: uma aeronave raramente tem "um responsável" —
  tem uma tripulação, um chefe de manutenção, uma equipe de célula/motor. O sistema criou o conceito
  de **grupo/equipe responsável**, vinculável a uma ou mais aeronaves, que se soma (sem duplicar) aos
  vínculos individuais na hora de decidir quem recebe um alerta.
- **Histórico imutável de Ordens de Serviço**: uma vez concluída ou cancelada, uma OS nunca mais é
  alterada ou excluída — apenas uma nova OS é aberta. Cancelamentos exigem registrar quem cancelou,
  quando e por quê, com notificação automática à equipe responsável.
- **Pessoas nunca são excluídas, apenas inativadas**: preserva a rastreabilidade de "quem fez o quê" em
  todo o histórico, mesmo após alguém deixar a unidade/organização.
- **Trilha de auditoria** (quem criou/alterou/inativou/cancelou o quê, e quando) como recurso transversal,
  consultável por qualquer usuário autenticado — em vez de um controle "de bastidores" só visível ao
  desenvolvedor.

Esse conjunto de decisões também simplificou os cadastros auxiliares (organização, posto/graduação,
especialidade, esquadrão, tipos de componente/intervalo/alerta): em vez de listas fixas no código, viraram
**catálogos editáveis** pelo próprio Gestor, sem exigir uma nova versão do sistema para adicionar, por
exemplo, um novo esquadrão.

## 4. Riscos identificados e como o piloto os mitiga

| Risco | Mitigação no piloto |
|---|---|
| Componente ultrapassar vida limite sem ser notado | Cálculo automático de `% de vida consumida` e alerta a partir de 85%/100% |
| OS crítica esquecida | Alertas de dashboard para OS com prioridade "Crítica" em aberto |
| Responsabilidade técnica difusa | Vínculos individuais pessoa↔aeronave **e** grupos/equipes responsáveis, ambos com papel e data |
| Falta de padronização de inspeções | Protocolos/checklists reutilizáveis vinculados a documento de referência |
| Perda de rastreabilidade de horas | Livro de bordo simplificado incrementa automaticamente horas da aeronave e de todos os componentes instalados |
| Uso fora de contexto autorizado | Login obrigatório, papéis (roles) diferenciados, sem autocadastro (só o Gestor cria contas) |
| Alteração indevida de histórico de manutenção | Ordens de Serviço concluídas/canceladas ficam travadas; pessoas nunca são excluídas, só inativadas |
| Falta de rastreabilidade de "quem mexeu no quê" | Trilha de auditoria de criações, alterações, inativações e cancelamentos, consultável na interface |

## 5. Por que "piloto de testes" e não produção

Por decisão explícita do escopo: **sem custos de armazenamento/processamento nesta fase**. Isso leva a:
- banco de dados **local em arquivo** (SQLite) em vez de um serviço de nuvem gerenciado;
- hospedagem local/rede interna (sem provisionar servidores pagos);
- autenticação simplificada por usuário/senha (sem custo de provedor de identidade externo);
- entrega como **aplicativo web progressivo (PWA)**, instalável em tablets Android/iPadOS sem custo de
  lojas de aplicativo nem processo de homologação de app store — adequado a um teste conduzido
  entre instituições (FAB, ITA, Embraer) antes de qualquer decisão de investimento maior.

Quando o teste precisar sair do notebook/rede local e ficar acessível a mais pessoas remotamente (sem
deixar de ser um piloto de custo zero), o caminho recomendado usa exclusivamente camadas gratuitas de
provedores de nuvem (backend, banco Postgres e hospedagem estática do frontend), mantendo o acesso
restrito às contas que o Gestor cadastrar — ver [docs/06-implantacao-nuvem.md](06-implantacao-nuvem.md).

## 6. Revisão de aderência aos 6 módulos do documento de referência (v0.2)

Após uma revisão completa do documento de origem contra a v0.1 do piloto, os 6 módulos inteligentes
citados na seção "Módulos Inteligentes de Análise" passaram a ter uma **fundação real e funcional**
(não apenas planejada) na v0.2, implementada com dados de verdade e fórmulas determinísticas
auditáveis - sem depender de nenhum modelo de IA/ML treinado nesta fase. Ver
[docs/04-protocolos-e-conformidade.md](04-protocolos-e-conformidade.md), seção 6, para o detalhamento técnico de cada um.

| # | Módulo do documento | Status na v0.2 | Limite atual (evolução futura) |
|---|---|---|---|
| ① | Predição de Falhas | Estimativa exponencial de confiabilidade (β≈1) a partir do histórico real de corretivas | Falta ajuste completo de Weibull (β variável) e modelos de ML de séries temporais |
| ② | Análise de Confiabilidade | MTBF, MTTR, taxa de falha, Disponibilidade Intrínseca/Operacional calculados por aeronave | Amostra pequena no piloto - números tendem a estabilizar com mais uso real |
| ③ | Diagnóstico Inteligente | Busca por similaridade textual sobre o histórico de OS da frota, com estatística de ação mais comum | Não é um modelo de linguagem treinado - é heurística de texto (`difflib`) |
| ④ | Visão Computacional | Módulo de Inspeção Fotográfica: mecânico anexa foto e preenche localização/severidade/causa/AMM manualmente | A extração automática (localização/severidade a partir da imagem) ainda não existe |
| ⑤ | Disponibilidade da Frota | Projeção de disponibilidade por dia (7/14/30 dias) e ranking da OS de maior impacto | Baseada em datas de OS cadastradas, não em otimização de escala real |
| ⑥ | Análise de Risco Operacional | Modelo ponderado com os 6 fatores e pesos exatos do documento (25/20/15/15/15/10%) | 2 dos 6 fatores (missão prevista, meteorologia) são inseridos manualmente, sem integração automática |

Também foi implementada a **Análise Prospectiva de Manutenção** ("e se eu adiar esta inspeção?"),
citada no documento como "uma funcionalidade que ainda não existe de forma integrada" - um simulador
que projeta o impacto de um adiamento na saúde, disponibilidade, risco e custo estimado, usando os
dados já cadastrados.

### 6.1 Novo na v0.3 — Atualização de Disponibilidade

Complementando o item ⑤ acima (que projeta disponibilidade futura a partir de status/OS cadastrados),
a v0.3 acrescenta o módulo **Atualização de Disponibilidade**: o registro do boletim diário/por turno de
linha de voo do próprio esquadrão (código DI/DO/IN por aeronave + configuração de asas/hardpoints -
LISO/ADA/EEXD/VENTRAL/CAA - e cargas subalares), no mesmo formato usado pela unidade. Inclui uma
tela para colar o boletim em texto livre (ex.: "5906 - DO (EEXD TREM DE POUSO)") com reconhecimento
heurístico revisável linha a linha antes de salvar, além do lançamento manual aeronave a aeronave. Ver
[docs/03-modelo-de-dados.md](03-modelo-de-dados.md) (`AvailabilityUpdate`) e `backend/app/availability.py`.

## 7. Evolução ainda planejada (fora do escopo deste piloto)

1. **Modelos de Machine Learning** de fato treinados para predição de falhas (substituindo a
   aproximação exponencial atual por um ajuste de Weibull ou modelos de sobrevivência mais robustos).
2. **Visão computacional automática** (rede neural para classificar severidade/extensão a partir da
   própria foto, em vez do preenchimento manual atual).
3. **Processamento de linguagem natural** mais sofisticado no Diagnóstico Inteligente (embeddings
   semânticos em vez de similaridade textual literal), incluindo consulta direta a manuais (AMM) em
   linguagem natural.
4. **Integração automática** com sistemas de planejamento de missão e meteorologia (hoje inseridos
   manualmente no cadastro da aeronave).
5. **Migração de dados para nuvem** (a ser definida após testes unitários e integrados) — o modelo de
   dados já foi desenhado com um ORM (SQLAlchemy) para tornar essa migração uma troca de
   configuração, não uma reescrita.

## 8. Nome do projeto

**AFA-TWIN** — Gêmeo Digital para Apoio à Decisão em Manutenção Aeronáutica — nome adotado para o
piloto (substituindo o nome de trabalho inicial "SISGEMA"), reforçando a ligação do projeto com a
formação de oficiais e pesquisa aeronáutica brasileira.
