# AFA-TWIN — Modelo de Dados

Documento 3 de 6 — ver também: [01 - Contexto e Brainstorming](01-contexto-e-brainstorming.md),
[02 - Arquitetura da Solução](02-arquitetura-da-solucao.md), [04 - Protocolos e Conformidade](04-protocolos-e-conformidade.md),
[05 - Guia de Instalação e Execução](05-guia-instalacao-execucao.md), [06 - Implantação em Nuvem](06-implantacao-nuvem.md).

Implementação de referência: [`backend/app/models.py`](../backend/app/models.py).

---

## 1. Diagrama entidade-relacionamento

```mermaid
erDiagram
    AIRCRAFT ||--o{ COMPONENT : possui
    AIRCRAFT ||--o{ ASSIGNMENT : "tem responsáveis"
    AIRCRAFT ||--o{ MAINTENANCE_ORDER : "gera OS"
    AIRCRAFT ||--o{ FLIGHT_LOG : "registra voos"
    AIRCRAFT ||--o{ INSPECTION_FINDING : "registra achados fotográficos"
    AIRCRAFT ||--o{ AIRCRAFT_GROUP_ASSIGNMENT : "tem grupos responsáveis"
    AIRCRAFT ||--o{ NOTIFICATION : "gera alertas sobre"
    AIRCRAFT ||--o{ AVAILABILITY_UPDATE : "recebe boletins de"
    PERSON ||--o{ AVAILABILITY_UPDATE : "registra"
    PERSON ||--o{ ASSIGNMENT : "assume papel em"
    PERSON ||--o{ MAINTENANCE_ORDER : "abre/responde por"
    PERSON ||--o{ FLIGHT_LOG : pilota
    PERSON ||--o{ INSPECTION_FINDING : registra
    PERSON ||--o{ GROUP_MEMBERSHIP : "participa de"
    PERSON ||--o{ NOTIFICATION : "recebe"
    PERSON |o--o| USER : "possui login"
    COMPONENT ||--o{ MAINTENANCE_ORDER : "associado a"
    COMPONENT ||--o{ INSPECTION_FINDING : "associado a"
    COMPONENT ||--o{ NOTIFICATION : "gera alertas sobre"
    RESPONSIBLE_GROUP ||--o{ GROUP_MEMBERSHIP : composto_por
    RESPONSIBLE_GROUP ||--o{ AIRCRAFT_GROUP_ASSIGNMENT : "responsável por"
    RESPONSIBLE_GROUP ||--o{ MAINTENANCE_ORDER : "equipe formal de"
    CHECKLIST_TEMPLATE }o..o{ MAINTENANCE_ORDER : "referencia (por tipo/modelo)"
    AUDIT_LOG }o..|| USER : "registra ação de (por nome de usuário)"
    AIRCRAFT |o--o| MEDIA_ASSET : "foto (estática/animada)"
    PERSON |o--o| MEDIA_ASSET : "foto de perfil"
    INSPECTION_FINDING ||--|| MEDIA_ASSET : "foto do achado"

    MEDIA_ASSET {
        int id PK
        string content_type "ex. image/png, image/svg+xml"
        binary data "conteúdo do arquivo, dentro do próprio banco"
        datetime created_at
    }
    AIRCRAFT {
        int id PK
        string tail_number "matrícula, único"
        string nickname
        string manufacturer
        string model
        enum category
        string squadron
        string base
        float total_flight_hours
        text engine_config
        text avionics_config
        text armament_config
        enum status
        string silhouette_key
        int photo_asset_id FK "nullable - foto real anexada (MediaAsset)"
        int photo_animated_asset_id FK "nullable - gif/webp animado (MediaAsset)"
        enum next_mission_risk "entrada manual - fator do risco ponderado"
        enum weather_risk "entrada manual - fator do risco ponderado"
    }
    INSPECTION_FINDING {
        int id PK
        int aircraft_id FK
        int component_id FK "nullable"
        int photo_asset_id FK "MediaAsset"
        enum defect_type "Corrosão/Trinca/Vazamento/Desgaste/Outro"
        string location
        enum severity
        string extent
        text probable_cause
        string amm_reference
        int recorded_by_id FK
        datetime recorded_at
    }
    COMPONENT {
        int id PK
        int aircraft_id FK
        string name
        enum category
        enum monitoring_type "hard-time / on-condition / condition-monitoring"
        enum criticality
        float life_limit_hours "nullable, hard-time"
        float hours_since_new
        float hours_since_overhaul
        float preventive_interval_days "vigência recorrente, em dias"
        date next_preventive_date "próximo vencimento por calendário"
    }
    PERSON {
        int id PK
        string full_name
        string organization "texto, sugerido pelo catálogo Organização (LookupItem)"
        enum role "Piloto/Mecânico/Engenheiro/Cientista/Gestor - fixo, define RBAC"
        string rank "Posto/Graduação/Cargo - catálogo LookupItem"
        string registration_number "matrícula / identidade funcional"
        string specialty "catálogo Especialidade (LookupItem)"
        string squadron "catálogo Esquadrão/Unidade (LookupItem)"
        text certifications
        string email "usado para alertas por e-mail"
        string phone_ddd "DDD, para alertas por SMS/WhatsApp"
        string phone_number
        int photo_asset_id FK "nullable - foto de perfil (MediaAsset)"
        bool active "nunca excluído - só inativado"
    }
    ASSIGNMENT {
        int id PK
        int person_id FK
        int aircraft_id FK
        enum role_in_aircraft
        date start_date
        date end_date
    }
    RESPONSIBLE_GROUP {
        int id PK
        string name "apelido do grupo, ex. Equipe Gripen Alpha"
        text description
    }
    GROUP_MEMBERSHIP {
        int id PK
        int group_id FK
        int person_id FK
        enum role_in_group "mesmo enum de ASSIGNMENT.role_in_aircraft"
        date joined_at
    }
    AIRCRAFT_GROUP_ASSIGNMENT {
        int id PK
        int aircraft_id FK
        int group_id FK
        date start_date
        date end_date
    }
    NOTIFICATION {
        int id PK
        enum channel "E-mail/SMS/WhatsApp"
        enum reason "Mudança de Status/Vencimento de Peça/Manutenção Registrada/Cancelamento de OS/Manual"
        enum status "Enviada/Simulada/Falha no Envio"
        int recipient_person_id FK
        int aircraft_id FK "nullable"
        int component_id FK "nullable"
        string subject
        text message
        text detail "resultado/erro do envio"
        datetime created_at
    }
    MAINTENANCE_ORDER {
        int id PK
        string order_number "OS-AAAA-NNNN"
        int aircraft_id FK
        int component_id FK "nullable"
        enum type
        enum priority
        enum status "Aberta/Em Andamento/Aguardando Peça/Concluída/Cancelada - terminal e imutável"
        string reference_doc "AMM/ICA/Boletim"
        int opened_by_id FK
        int responsible_id FK
        int team_group_id FK "nullable - equipe/grupo formal responsável"
        text team_members "nullable - observações livres complementares"
        datetime opened_at
        datetime due_at
        datetime closed_at
        int cancelled_by_id FK "nullable - obrigatório se status=Cancelada"
        datetime cancelled_at "nullable"
        text cancellation_reason "nullable - obrigatório se status=Cancelada"
    }
    LOOKUP_ITEM {
        int id PK
        enum category "Organização/Posto-Graduação-Cargo/Especialidade/Esquadrão/Componente Padrão/Tipo de Intervalo/Categoria de Alerta"
        string value "texto do item, ex. 'Tenente-Coronel'"
        bool active
        datetime created_at
    }
    AUDIT_LOG {
        int id PK
        string actor_username "nullable"
        string actor_person_name "nullable"
        string entity_type "ex. Aeronave/Usuário/Ordem de Serviço"
        int entity_id
        string entity_label "nullable - matrícula/nome, para exibição"
        enum action "Criação/Alteração/Inativação/Reativação/Cancelamento"
        text summary
        datetime created_at
    }
    CHECKLIST_TEMPLATE {
        int id PK
        string name
        string aircraft_model
        string interval_type "HORAS/DIAS/CICLOS"
        float interval_value
        text items_json
    }
    FLIGHT_LOG {
        int id PK
        int aircraft_id FK
        int pilot_id FK
        date date
        float duration_hours
        text discrepancies
    }
    USER {
        int id PK
        string username
        string password_hash
        string password_salt
        enum role
        int person_id FK "nullable"
    }
    AVAILABILITY_UPDATE {
        int id PK
        int aircraft_id FK
        date report_date
        enum code "DI, DO ou IN"
        string configuration "nullable, ex. LISO/ADA/EEXD/VENTRAL/CAA"
        bool has_subalares
        text reason "nullable, ex. TREM DE POUSO"
        int recorded_by_id FK "nullable"
        datetime created_at
    }
```

## 2. Enumerações de domínio

| Enum | Valores |
|---|---|
| `AircraftCategory` | Caça · Ataque · Transporte · Treinamento · Helicóptero · Patrulha Marítima · Reabastecimento em Voo |
| `AircraftStatus` | Operacional · Em Manutenção · Em Inspeção · Indisponível · Em Modernização |
| `PersonRole` | Piloto · Mecânico · Engenheiro · Cientista · Gestor / Responsável Técnico — **fixo no código** (não é um catálogo `LookupItem`), pois define diretamente as permissões (RBAC) do usuário |
| `ComponentCategory` | Motor/Grupo Motopropulsor · Trem de Pouso · Sistema Hidráulico · Aviônicos · Estrutura · Armamento · Sistema de Combustível · Sistema Elétrico · Oxigênio/Suporte à Vida · Outro |
| `MonitoringType` | Hard Time (vida limite) · On Condition (sob condição) · Condition Monitoring (monitorado) |
| `Criticality` | Baixa · Média · Alta · Crítica |
| `MaintenanceType` | Inspeção de Rotina · Preventiva Programada · Corretiva · Boletim Técnico (AD/SB) · Overhaul/Grande Reparo · Modificação/Modernização |
| `OrderStatus` | Aberta · Em Andamento · Aguardando Peça · Concluída · Cancelada — as duas últimas são **terminais** (ver seção 3) |
| `AssignmentRole` | Piloto Titular · Piloto Reserva/Sub-Piloto · Piloto Instrutor · Mecânico Responsável · Engenheiro de Confiabilidade · Chefe de Manutenção · Inspetor de Qualidade · Comandante de Esquadrão · Cientista Responsável (P&D) — usado tanto em `Assignment` (vínculo individual) quanto em `GroupMembership` (papel dentro de um grupo) |
| `RiskLevel` | Baixo · Médio · Alto (entrada manual de missão prevista/meteorologia no modelo de risco ponderado) |
| `DefectType` | Corrosão · Trinca · Vazamento · Desgaste · Outro (Inspeção Fotográfica) |
| `NotificationChannel` | E-mail · SMS · WhatsApp |
| `NotificationReason` | Mudança de Status da Aeronave · Vencimento de Peça · Manutenção Registrada · Cancelamento de Ordem de Serviço · Manual |
| `NotificationStatus` | Enviada · Simulada · Falha no Envio |
| `LookupCategory` | Organização · Posto/Graduação/Cargo · Especialidade · Esquadrão/Unidade · Componente Associado (padrão) · Tipo de Intervalo de Manutenção · Categoria de Alerta de Manutenção Preventiva · Configuração de Disponibilidade (asas/hardpoints) — cada uma vira uma aba editável em Usuários → Cadastros Auxiliares (ou em Manutenção → Cadastro de Manutenção, para as três últimas) |
| `AuditAction` | Criação · Alteração · Inativação · Reativação · Cancelamento |
| `AvailabilityCode` | DI · DO · IN — código do boletim de linha de voo do esquadrão (módulo Atualização de Disponibilidade); ver nota abaixo |

> **Nota sobre `organization` em `Person`**: deixou de ser um enum fixo e passou a ser um campo de
> texto sugerido pelo catálogo `LookupItem` da categoria Organização — assim, novas organizações
> parceiras podem ser adicionadas pelo Gestor sem alterar código.

`MonitoringType` segue a nomenclatura consagrada em programas de manutenção baseados em MSG-3
(hard-time / on-condition / condition-monitoring), usada tanto na aviação civil quanto militar para
classificar como a vida de um componente é controlada.

> **Nota sobre `AvailabilityCode` (DI/DO/IN)**: o significado exato de cada código segue a convenção da
> própria unidade que emite o boletim de disponibilidade — não fixamos aqui um glossário autoritativo
> (ex. uma definição formal e diferenciada entre "DO" e "IN") por não termos confirmação direta do
> esquadrão sobre essa distinção; tratamos os três apenas como rótulos estáveis do boletim. O campo
> `configuration` (LISO/ADA/EEXD/VENTRAL/CAA) é, por isso, um `LookupItem` editável
> (`LookupCategory.CONFIGURACAO_DISPONIBILIDADE`) e não um enum fixo, para não travar um vocabulário
> específico de uma unidade/tipo de aeronave no código.

## 3. Regras de negócio embutidas no modelo

1. **Cascata de exclusão controlada**: excluir uma aeronave remove seus componentes, vínculos, ordens
   de serviço e registros de voo (`cascade="all, delete-orphan"`) — decisão deliberada para o piloto, já
   que manter órfãos sem aeronave não agrega valor num teste; **antes de produção**, recomenda-se
   substituir por exclusão lógica (soft delete) para preservar histórico.
2. **Numeração de OS**: gerada automaticamente no formato `OS-{ano}-{sequencial}` (ex.: `OS-2026-0001`).
3. **Percentual de desgaste (`wear_pct`)**: calculado sob demanda (`hours_since_overhaul / life_limit_hours`)
   apenas para componentes com controle hard-time; componentes on-condition/condition-monitoring não
   têm um percentual de vida linear por definição.
4. **Acúmulo de horas**: ao registrar um voo (livro de bordo), o backend soma `duration_hours` à
   aeronave **e a todos os seus componentes instalados** — reflete o conceito do documento de origem
   de "horas de voo por sistema".
5. **Índice de saúde e risco operacional**: calculados em tempo real (não persistidos) a partir do
   desgaste dos componentes e das ordens de serviço abertas — ver [`backend/app/compute.py`](../backend/app/compute.py)
   e a nota de transparência na seção 6 do documento de arquitetura.
6. **Confiabilidade, Risco ponderado, Diagnóstico e Disponibilidade da Frota são todos calculados sob
   demanda** a partir das tabelas existentes (`maintenance_orders`, `components`, `flight_logs`) - não
   possuem tabelas próprias, evitando duplicidade de dados (princípio "modelo único" do documento de
   referência). Ver `backend/app/reliability.py`, `diagnostics.py` e `planning.py`.
7. **Fotos (aeronave, perfil, inspeção fotográfica) ficam dentro do próprio banco**, não em disco:
   `Aircraft.photo_asset_id`/`photo_animated_asset_id`, `Person.photo_asset_id` e
   `InspectionFinding.photo_asset_id` referenciam um `MediaAsset` (id, `content_type`, `data` binário).
   Servidas em `/api/media/<id>` (ver `backend/app/routers/media.py`). Decisão deliberada para
   compatibilidade com hospedagem "serverless" (ex.: Vercel, usado em [docs/06](06-implantacao-nuvem.md)),
   que não garante disco persistente entre chamadas de função - ver a nota completa em `models.py`.
8. **Imutabilidade de Ordem de Serviço em status terminal**: uma vez `Concluída` ou `Cancelada`, a API
   rejeita qualquer alteração adicional (inclusive tentativa de exclusão, que retorna erro 405). A transição
   para `Cancelada` exige `cancelled_by_id` e `cancellation_reason` preenchidos, grava `cancelled_at`
   automaticamente e dispara uma `Notification` (motivo `Cancelamento de Ordem de Serviço`) para todos
   os responsáveis (individuais + grupos) da aeronave.
9. **Pessoas não são excluídas fisicamente**: a rota de exclusão (`DELETE /people/{id}`) retorna 405;
   a única forma de remover alguém do fluxo ativo é definir `active=false` via `PUT`, o que gera uma
   entrada `AuditLog` de `Inativação` (e `Reativação` no caminho inverso).
10. **Toda criação/alteração relevante gera uma entrada em `AuditLog`** (aeronaves, componentes,
    pessoas, ordens de serviço) — ver [`backend/app/audit.py`](../backend/app/audit.py) e o roteador
    `GET /api/audit-log`, consultável na tela "Auditoria" da interface.
11. **Retenção de notificações**: apenas as **20 notificações mais recentes** são mantidas na tabela
    `notifications` — a cada novo registro, entradas mais antigas além desse limite são removidas
    (`notifications._prune_old_notifications`), mantendo o histórico exibido no Painel enxuto e relevante.
12. **Destinatários de notificação são a união de vínculos individuais e de grupo**: ao decidir quem
    notificar sobre uma aeronave, o sistema soma os `Assignment` diretos com os membros de todo
    `ResponsibleGroup` vinculado via `AircraftGroupAssignment`, removendo duplicados por pessoa
    (`notifications.suggested_recipients_for_aircraft`).
13. **Atualização de Disponibilidade é complementar, não substitui, `Aircraft.status`**: o boletim de
    linha de voo (`AvailabilityUpdate`) reflete a leitura operacional do dia, informada manualmente pela
    própria unidade, e pode divergir do status de cadastro por um tempo (ex.: uma aeronave
    "Operacional" no cadastro pode aparecer "DO" no boletim de hoje por um problema pontual ainda não
    registrado como Ordem de Serviço). O quadro de disponibilidade (`GET /api/availability-updates/board`)
    usa apenas a **última** atualização de cada aeronave; os totais de configuração (LISO/ADA/EEXD/
    VENTRAL/CAA) somam só as aeronaves DI/DO (não as IN), e uma aeronave com `has_subalares=true` e
    sem `configuration` explícita não entra no total "LISO" (ver `backend/app/availability.py`).

## 4. Caminho de migração para nuvem

O modelo foi desenhado inteiramente sobre SQLAlchemy ORM. Migrar de SQLite para um banco em nuvem
(Postgres gerenciado, por exemplo) requer apenas:

```bash
export AFA_TWIN_DATABASE_URL="postgresql+psycopg://usuario:senha@host:5432/afa_twin"
```

Nenhuma alteração de código de domínio é necessária. Antes da migração, recomenda-se rodar as
migrações de schema com uma ferramenta como Alembic (não incluída no piloto para manter o escopo
enxuto) e validar os testes unitários/integrados mencionados no escopo do projeto.

O passo a passo completo de publicação (incluindo qual serviço de Postgres gratuito usar e como apontar
`AFA_TWIN_DATABASE_URL` para ele) está em [docs/06-implantacao-nuvem.md](06-implantacao-nuvem.md).
