# AFA-TWIN — Como Funciona a Ordem de Serviço (OS)

Documento complementar — ver também: [02 - Arquitetura da Solução](02-arquitetura-da-solucao.md),
[03 - Modelo de Dados](03-modelo-de-dados.md), [04 - Protocolos e Conformidade](04-protocolos-e-conformidade.md).

Este documento descreve, passo a passo, o ciclo de vida completo de uma Ordem de Serviço (OS) no
AFA-TWIN — desde a criação até a mudança automática de status da aeronave e o envio do boletim por
e-mail aos administradores. O código-fonte de referência é
[`backend/app/routers/maintenance.py`](../backend/app/routers/maintenance.py) e
[`backend/app/notifications.py`](../backend/app/notifications.py).

## Visão geral

```
Nova OS criada
      │
      ├─ Aeronave estava "Operacional"? ──► Sim ──► status induzido conforme o TIPO da OS
      │                                              (Em Manutenção / Em Inspeção / Em Modernização)
      │                                              │
      │                                              ├─► e-mail aos responsáveis vinculados (resumo)
      │                                              └─► e-mail aos 2 administradores (boletim completo)
      │
      ├─ Acompanhamento: Aberta → Em Andamento / Aguardando Peça
      │
      └─ Encerramento (Concluída ou Cancelada)
               │
               ├─► e-mail aos responsáveis vinculados (conclusão/cancelamento)
               │
               └─ Era a ÚLTIMA OS aberta da aeronave? ──► Sim ──► status volta a "Operacional"
                                                                    └─► e-mail aos responsáveis (mudança de status)
```

Toda transição relevante também fica registrada na trilha de auditoria (tela "Auditoria").

## 1. Criação de uma OS

Tela: **Manutenção → Ordem de Serviço → "+ Nova Ordem de Serviço"**.

Campos obrigatórios: **Aeronave**, **Tipo de Manutenção**, **Prioridade**, **Título**. Os demais —
Componente associado, Protocolo/Checklist aplicado, Responsável técnico, Horas de voo no evento,
Descrição, Referência técnica, Equipe envolvida — são opcionais.

**Componente associado** × **Protocolo/Checklist aplicado** são **mutuamente exclusivos** — representam
os dois escopos reais de uma OS:

- **Componente associado**: a OS é sobre uma peça específica (ex.: troca de bateria de emergência).
- **Protocolo/Checklist aplicado**: a OS é uma inspeção programada que cobre a **aeronave inteira**
  (ex.: "Inspeção de 100 horas"), seguindo um checklist reutilizável cadastrado em **Protocolos**. Se a
  OS não informar uma **Referência técnica** explícita, ela herda automaticamente a do protocolo
  escolhido (`checklist_template_id` → `ChecklistTemplate.reference_doc`).

O botão **"💡 Sugerir título e descrição"** monta um texto a partir do que já foi preenchido (aeronave,
componente ou protocolo, tipo, prioridade, horas de voo) — nunca sobrescreve sozinho, só quando clicado,
e o texto gerado continua livremente editável.

O número da OS (`order_number`, formato `AAAA/NNNN`) é gerado automaticamente a partir do maior número já
usado no ano corrente — nunca precisa ser digitado.

## 2. Indução automática do status da aeronave

Ao salvar a nova OS, se a aeronave estiver **"Operacional"**, o status dela muda **sozinho**, como
consequência direta da OS existir — não é um campo que alguém precisa lembrar de trocar à parte. O
status induzido depende do **tipo** da OS:

| Tipo da OS | Status induzido |
|---|---|
| Inspeção de Rotina | **Em Inspeção** |
| Modificação / Modernização | **Em Modernização** |
| Preventiva Programada, Corretiva, Boletim Técnico (AD/SB), Overhaul / Grande Reparo | **Em Manutenção** (genérico) |

Se a aeronave já estiver em qualquer outro status que não "Operacional" (Em Inspeção, Em Modernização,
Indisponível, Em Manutenção), a indução **não sobrescreve** — esse status já tem um motivo próprio, e
não cabe à nova OS decidir por ele.

Essa regra existe porque, na prática real da Aeronáutica, não há diferença de **processo** entre "Em
Manutenção" e "Em Inspeção" — os dois são formalizados por uma OS da mesma forma —, só de **natureza**
do trabalho (ver [docs/04](04-protocolos-e-conformidade.md), item 8).

## 3. Notificações disparadas na indução

Quando a indução do item 2 acontece, **dois e-mails diferentes** são disparados:

1. **Aos responsáveis vinculados à aeronave** (indivíduos + membros de grupos/equipes) — um resumo
   objetivo: "A aeronave X mudou de status de 'Operacional' para 'Em Manutenção'."
2. **Aos 2 administradores do sistema, sempre** (mesmo que já exista responsável vinculado) — um
   **boletim de indução** completo, no formato usado na prática real da aeronáutica/companhias aéreas,
   com dois blocos:
   - **ORDEM DE SERVIÇO**: número, tipo, prioridade, título, descrição, componente ou protocolo
     aplicado, referência técnica, quem abriu e quando (horário de Brasília).
   - **AERONAVE**: matrícula, fabricante/modelo, categoria, esquadrão, status (antes → depois), índice
     de saúde, risco operacional, horas de voo acumuladas — um retrato da aeronave no exato momento da
     indução.

Esses e-mails saem com layout HTML profissional (tabelas, badges coloridos de prioridade/risco,
identidade visual do AFA-TWIN) — ver [docs/02](02-arquitetura-da-solucao.md) para o template. O envio
real usa o Resend (ou SMTP como alternativa); sem nenhum dos dois configurado, a notificação fica
registrada no histórico como "Simulada", nunca falha silenciosamente nem trava a criação da OS.

## 4. Acompanhamento da OS

Status possíveis: **Aberta** (inicial) → **Em Andamento** / **Aguardando Peça** → **Concluída** /
**Cancelada** (terminais). Uma OS concluída ou cancelada se torna **imutável** — não pode mais ser
editada, nem mesmo o status.

## 5. Conclusão de uma OS

Ao mudar o status para **Concluída**:

- Se a OS estiver vinculada a um componente com intervalo de manutenção preventiva definido, a próxima
  data preventiva avança automaticamente.
- Os responsáveis vinculados à aeronave recebem um e-mail confirmando a conclusão (com o componente e a
  equipe envolvida, se informados).
- Fica registrada na Auditoria.

## 6. Cancelamento de uma OS

Cancelar exige informar **quem cancelou** (`cancelled_by_id`) — não é permitido cancelar sem essa
informação. Ao cancelar:

- Os responsáveis vinculados recebem um e-mail informando quem cancelou, quando (horário de Brasília) e
  o motivo, se informado.
- Fica registrada na Auditoria com o motivo.

## 7. Retorno automático a "Operacional"

Ao concluir ou cancelar uma OS, o sistema verifica se **ainda existe alguma outra OS aberta** (status
diferente de Concluída/Cancelada) para a mesma aeronave. Se não existir nenhuma — ou seja, se essa era a
**última** OS em aberto — e o status da aeronave ainda for um dos induzidos automaticamente (Em
Manutenção, Em Inspeção ou Em Modernização), o status volta sozinho para **"Operacional"**, e os
responsáveis vinculados recebem o e-mail de mudança de status novamente.

Se o status tiver sido trocado manualmente para "Indisponível" nesse meio-tempo, a OS **não mexe** nele
— esse status tem motivo próprio.

## 8. Trilha de auditoria

Cada etapa relevante deste fluxo gera uma entrada em **Auditoria**, sempre identificando quem fez o quê
e quando: criação da OS, indução automática de status, conclusão, cancelamento, e retorno automático a
"Operacional".

## Ver também

- [docs/04, item 8 e 9](04-protocolos-e-conformidade.md) — a justificativa de prática real por trás
  dessas regras.
- [docs/02](02-arquitetura-da-solucao.md) — arquitetura de notificações (Resend/SMTP, template HTML) e
  o job diário de alertas de desgaste (Vercel Cron), que também usa o status da aeronave para decidir
  quando parar de alertar.
- [docs/03](03-modelo-de-dados.md) — modelo de dados completo de `MaintenanceOrder`.
