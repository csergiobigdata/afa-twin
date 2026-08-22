# AFA-TWIN — Protocolos de Manutenção e Conformidade

Documento 4 de 6 — ver também: [01 - Contexto e Brainstorming](01-contexto-e-brainstorming.md),
[02 - Arquitetura da Solução](02-arquitetura-da-solucao.md), [03 - Modelo de Dados](03-modelo-de-dados.md),
[05 - Guia de Instalação e Execução](05-guia-instalacao-execucao.md), [06 - Implantação em Nuvem](06-implantacao-nuvem.md).

> **Aviso importante:** este documento descreve **conceitos gerais e amplamente conhecidos de
> engenharia de manutenção aeronáutica** (nomenclatura de programas de manutenção, tipos de
> documentação técnica, hierarquia de responsabilidade) para orientar o desenho do piloto. **Não é**,
> e não substitui, a documentação normativa oficial da FAB (Comando da Aeronáutica), da ANAC ou dos
> fabricantes. Antes de qualquer uso operacional real, os protocolos aqui descritos devem ser revisados
> e formalmente aprovados pela autoridade de manutenção competente de cada organização (FAB, ITA,
> Embraer), com base na documentação técnica oficial e atualizada de cada aeronave.

---

## 1. Conceitos de manutenção adotados no sistema

O piloto adota a nomenclatura consagrada internacionalmente (usada tanto na aviação civil regulada
pela ANAC/FAA/EASA quanto na aviação militar) para classificar como a vida de um componente é
controlada — refletida no campo `monitoring_type` de cada componente cadastrado:

- **Hard Time (vida limite):** o componente tem um número máximo de horas/ciclos definido pelo
  fabricante, após o qual deve ser obrigatoriamente removido/substituído, independentemente de sua
  condição aparente (ex.: pás de hélice, alguns componentes estruturais críticos).
- **On Condition (sob condição):** o componente permanece em serviço enquanto inspeções periódicas
  comprovarem que atende aos critérios de aceitação — não tem vida fixa, mas exige inspeção recorrente.
- **Condition Monitoring (monitorado):** o desempenho do componente é acompanhado ao longo do
  tempo (tendências, falhas) sem uma vida limite nem inspeções obrigatórias fixas — decisões de
  manutenção são orientadas por dados de confiabilidade da frota.

Essa classificação é a base para o **índice de saúde** calculado pelo sistema: apenas componentes
hard-time têm um "percentual de vida consumida" objetivo; os demais são sinalizados como
"monitorados", exigindo julgamento técnico do engenheiro/mecânico responsável.

## 2. Tipos de documentação técnica referenciados

O cadastro de Ordens de Serviço e Protocolos/Checklists inclui um campo de **referência técnica**,
alinhado aos tipos de documento citados no estudo de origem deste projeto:

| Sigla | Significado | Uso no sistema |
|---|---|---|
| **AMM** | *Aircraft Maintenance Manual* — manual de manutenção do fabricante | Referência de procedimento em Ordens de Serviço e Checklists |
| **ICA** | Documentação normativa/instrutiva da organização de manutenção | Referência de protocolo institucional |
| **MEL/CDL** | *Minimum Equipment List* / *Configuration Deviation List* — o que pode estar inoperante/ausente sem impedir o voo, e sob quais condições | Insumo conceitual para classificação de prioridade/criticidade de uma OS |
| **AD/SB** | *Airworthiness Directive* / *Service Bulletin* — diretriz de aeronavegabilidade obrigatória / boletim de serviço do fabricante | Tipo de manutenção `Boletim Técnico (AD/SB)` |

## 3. Hierarquia de responsabilidade modelada

O cadastro de pessoal e de vínculos pessoa↔aeronave reflete papéis amplamente reconhecidos em
organizações de manutenção aeronáutica, adaptados à convivência FAB/ITA/Embraer prevista no piloto:

- **Piloto Titular** — Piloto em Comando (*Pilot in Command*), responsável pelo livro de bordo, pela
  aceitação da aeronave (revisão do MEL/CDL e discrepâncias abertas antes do voo) e pelo reporte de
  novas discrepâncias.
- **Piloto Reserva / Sub-Piloto** — copiloto ou piloto reserva da tripulação/esquadrão, compartilhando
  a responsabilidade operacional quando escalado.
- **Piloto Instrutor** — responsável adicional em voos de instrução.
- **Mecânico Responsável** — o *crew chief*: mecânico de referência de uma aeronave (matrícula)
  específica, que coordena e acompanha toda a manutenção dela.
- **Chefe de Manutenção** — Oficial de Manutenção (*Maintenance Officer*), com autoridade para liberar
  a aeronave para voo após a execução e conferência das ordens de serviço.
- **Engenheiro de Confiabilidade** — análise de tendências de desgaste, apoio técnico a decisões de
  manutenção (ponte natural para o perfil de engenheiros do ITA/Embraer no piloto).
- **Inspetor de Qualidade** — *Quality Assurance* (QA): verificação independente de conformidade das
  ordens de serviço, sobretudo em reparos críticos/estruturais.
- **Comandante de Esquadrão** — autoridade operacional máxima sobre as aeronaves do esquadrão; a
  hierarquia imediata acima do piloto titular, com poder de decisão final sobre risco operacional.
- **Cientista Responsável (P&D)** — pesquisa aplicada, incluindo o desenvolvimento dos futuros módulos
  de inteligência artificial descritos no documento de origem.

Cada pessoa carrega um campo de **posto/graduação** (para militares) ou **cargo** (para civis de
ITA/Embraer), além de **especialidade** e **esquadrão/unidade**, selecionados a partir de **catálogos
editáveis** (Usuários → Cadastros Auxiliares) em vez de texto livre — o Gestor mantém essas listas
(ex.: Tenente-Coronel, Sargento, Engenheiro Sênior) alinhadas à nomenclatura real de cada organização,
sem precisar de uma nova versão do sistema para incluir um novo posto ou esquadrão. Já o campo
**Organização** permanece como texto sugerido (não uma lista fechada), para acomodar parceiros ainda
não previstos sem bloquear o cadastro. A padronização definitiva de postos/graduações para uso
institucional real ainda deve ser validada formalmente com a FAB antes de uma versão fora do piloto.

## 4. Regras de rigor e trilha de decisão

O objetivo central do sistema — declarado pelo usuário no briefing do projeto — é **evitar riscos de
desgaste de peças** e **seguir protocolos rigorosos e eficientes**. Isso se traduz nas seguintes regras
já implementadas no piloto:

1. Toda Ordem de Serviço tem **prioridade obrigatória** (Baixa/Média/Alta/Crítica) e **status controlado**
   (Aberta → Em Andamento/Aguardando Peça → Concluída/Cancelada) — sem estados livres.
2. Um componente hard-time gera **alerta automático** a partir de 85% da vida consumida (atenção) e
   100% (crítico — "substituição imediata requerida"); componentes com vigência por calendário geram o
   mesmo tipo de alerta ao se aproximar/ultrapassar a data de vencimento (`next_preventive_date`).
3. Uma OS crítica em aberto **degrada o índice de saúde da aeronave** e aparece destacada no painel de
   apoio à decisão — não fica "perdida" em uma lista.
4. **Uma Ordem de Serviço concluída ou cancelada é permanente**: não pode mais ser editada nem
   excluída — apenas consultada. Cancelar uma OS ainda em aberto exige registrar quem cancelou e por
   quê, e notifica automaticamente a equipe responsável.
5. **Exclusão de aeronave** é restrita a papéis de maior responsabilidade (Gestor/Engenheiro). **Pessoas
   nunca são excluídas** por ninguém, em nenhum papel — apenas inativadas, preservando o histórico de
   quem executou o quê mesmo após deixar a organização.
6. Todo cadastro de Ordem de Serviço permite registrar a **referência técnica** que fundamenta a ação —
   incentivando que a manutenção seja sempre rastreável a um documento formal, não apenas a
   "conhecimento tácito".
7. Toda criação, alteração, inativação e cancelamento relevante fica registrada em uma **trilha de
   auditoria** (quem, quando, o quê), consultável por qualquer usuário autenticado na tela "Auditoria".

## 5. O que este piloto conscientemente NÃO cobre ainda

Para manter o escopo do piloto viável e coerente com "zero custo nesta fase", os seguintes controles —
esperados em um sistema de manutenção aeronáutica de produção — **não** estão implementados e
devem ser tratados antes de qualquer uso operacional real:

- Assinatura digital/eletrônica qualificada de Ordens de Serviço (validade jurídica de "quem assinou o quê") —
  a trilha de auditoria (seção 4, item 7) registra *quem fez o quê e quando*, mas não é uma assinatura
  eletrônica com validade jurídica formal;
- Integração com MEL/CDL formal por matrícula/configuração de aeronave;
- Controle de estoque/rastreabilidade de peças por número de série ao longo de múltiplas instalações;
- Homologação formal junto à autoridade de aeronavegabilidade competente.

Esses itens estão listados como evolução no [Documento de Arquitetura](02-arquitetura-da-solucao.md), seção 6.

## 6. Módulos de Inteligência de Decisão (v0.2) — como cada um foi implementado

Esta seção detalha tecnicamente os 6 módulos do documento de referência, incorporados ao piloto na
versão 0.2 (ver resumo em [01-contexto-e-brainstorming.md](01-contexto-e-brainstorming.md), seção 6).
**Nenhum destes módulos usa um modelo de IA/ML treinado** - todos são cálculos determinísticos e
auditáveis sobre os dados já cadastrados, com a transparência explícita disso em cada resposta da API
(campo `confidence_note` / `method_note`).

### ① e ② Predição de Falhas e Confiabilidade — `backend/app/reliability.py`
Para cada aeronave, calcula-se a partir do histórico de Ordens de Serviço **corretivas concluídas**:
- **MTBF** (tempo médio entre falhas) = horas de voo acumuladas ÷ número de falhas corretivas;
- **MTTR** (tempo médio de reparo) = média de (`closed_at` − `opened_at`) das corretivas;
- **Taxa de falha (λ)** = 1/MTBF; **Confiabilidade R(100h)** = e^(−λ×100) (modelo exponencial, β≈1);
- **Disponibilidade Intrínseca** = MTBF/(MTBF+MTTR); **Disponibilidade Operacional** soma uma
  estimativa de atraso logístico.
Com amostra pequena (comum no início de um piloto), o sistema informa isso explicitamente em vez de
apresentar um número enganosamente preciso.

### ③ Diagnóstico Inteligente — `backend/app/diagnostics.py`
Busca por similaridade textual (`difflib.SequenceMatcher` + reforço por sobreposição de palavras-chave)
sobre título/descrição/constatações de todas as Ordens de Serviço da frota. Retorna as ocorrências mais
parecidas e a ação de reparo mais frequente entre elas, reproduzindo o formato do exemplo do
documento de origem ("nas últimas N ocorrências, X% foram resolvidas com..."). Os dados de
demonstração incluem um cenário deliberado sobre a luz **FUEL PRESS** para validar esta funcionalidade.

### ④ Visão Computacional (fundação manual) — Inspeção Fotográfica
O mecânico anexa uma foto (corrosão, trinca, vazamento, desgaste) e preenche manualmente localização,
severidade, extensão, causa provável e referência ao AMM. Cada registro fica associado à aeronave e,
opcionalmente, a um componente específico, formando um **histórico visual comparável ao longo do
tempo** — exatamente a estrutura de dados necessária para, no futuro, treinar ou conectar um modelo de
visão computacional que preencha esses campos automaticamente a partir da imagem.

### ⑤ Disponibilidade da Frota — `backend/app/planning.py`
Projeta, para os próximos 7/14/30 dias, quantas aeronaves estarão disponíveis, considerando o status
atual e as Ordens de Serviço abertas com prazo (`due_at`) definido. Também identifica a ordem de
serviço em aberto que, segundo prioridade e status da aeronave, mais compromete a disponibilidade da
frota se atrasar.

### ⑥ Risco Operacional ponderado — `backend/app/compute.py`
Reproduz os 6 fatores e pesos exatos do documento de origem: Histórico de falhas (25%), Missão
prevista (20%), Condições meteorológicas (15%), Horas desde a última inspeção (15%), Componentes
críticos próximos do limite (15%) e Disponibilidade logística (10%). Os quatro primeiros/últimos fatores
são calculados automaticamente a partir dos dados cadastrados; missão prevista e condições
meteorológicas são, nesta fase, campos de entrada manual no cadastro da aeronave (`next_mission_risk`,
`weather_risk`), documentados como tal na interface.

### Análise Prospectiva de Manutenção — `backend/app/planning.py`
Simulador do cenário "e se eu adiar esta manutenção por N dias?": projeta horas de voo extras (a partir
da média de uso recente da aeronave), recalcula o desgaste do componente afetado e o índice de saúde/
risco resultante, e estima o impacto na disponibilidade da frota e um custo financeiro ilustrativo
(parâmetro configurável, não um valor orçamentário real da FAB/ITA/Embraer).

## 7. Responsabilidade coletiva por uma aeronave: grupos e equipes

**Por que uma única pessoa não é o "responsável" por uma aeronave.** Na prática de manutenção
aeronáutica (civil e militar), a responsabilidade por uma aeronave é sempre compartilhada entre papéis
distintos, cada um com uma autoridade específica - nunca concentrada em uma única pessoa:

| Papel | Responsabilidade típica | No AFA-TWIN |
|---|---|---|
| Piloto em Comando (*Pilot in Command*) | Aceita a aeronave antes do voo (revisa MEL/CDL e discrepâncias), decide quanto à segurança em voo | `Piloto Titular` |
| Copiloto / piloto reserva | Compõe a tripulação, compartilha responsabilidade operacional quando escalado | `Piloto Reserva / Sub-Piloto` |
| *Crew Chief* (mecânico de aeronave dedicada) | Mecânico de referência de uma matrícula específica; coordena e acompanha toda a manutenção dela ao longo do tempo | `Mecânico Responsável` |
| Oficial/Chefe de Manutenção (*Maintenance Officer*) | Autoridade para liberar a aeronave para voo após a conferência das ordens de serviço | `Chefe de Manutenção` |
| Engenharia (confiabilidade/estruturas) | Autoridade técnica sobre o programa de manutenção e análise de tendências | `Engenheiro de Confiabilidade` |
| Inspeção de Qualidade (QA) | Verificação independente, sobretudo em reparos críticos/estruturais | `Inspetor de Qualidade` |
| Comandante de Esquadrão | Autoridade operacional máxima sobre as aeronaves do esquadrão - a hierarquia imediata acima do piloto | `Comandante de Esquadrão` |

Além disso, a manutenção real é organizada em **turmas/equipes** (turnos, especialidades por sistema -
célula/motor, aviônicos, armamento), não em atribuições individuais soltas. Uma mesma aeronave
frequentemente responde a mais de uma equipe (ex.: uma turma de célula/motor e uma de aviônicos), e
uma mesma equipe pode ser responsável por várias aeronaves do mesmo esquadrão/frota.

**Como isso foi implementado (v0.3).** O modelo de dados ganhou três novas entidades
(`ResponsibleGroup`, `GroupMembership`, `AircraftGroupAssignment` - ver
[docs/03-modelo-de-dados.md](03-modelo-de-dados.md)) que permitem:

1. Criar **grupos nomeados** (apelido livre, ex.: "Equipe Gripen Alpha"), com uma composição de
   membros e seus papéis (usando o mesmo conjunto de papéis da tabela acima).
2. Vincular **um ou mais grupos** a uma mesma aeronave (e um mesmo grupo a mais de uma aeronave).
3. Ao calcular quem deve ser notificado sobre uma aeronave (mudança de status, peça vencendo), o
   sistema soma automaticamente os **vínculos individuais diretos** e os **membros de todos os grupos**
   vinculados àquela aeronave, sem duplicar destinatários (`notifications.suggested_recipients_for_aircraft`).

Isso coexiste com os vínculos individuais diretos já existentes (`Assignment`) - úteis para papéis
pontuais que não fazem sentido formalizar como uma equipe permanente (ex.: um cientista responsável
por um projeto de P&D específico em uma aeronave).
