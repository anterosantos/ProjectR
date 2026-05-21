---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-05-07'
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/product-brief-sparta.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/planning-artifacts/research/technical-stack-tecnico-sparta-research-2026-05-01.md"
  - "_bmad-output/planning-artifacts/research/market-solucoes-gratuitas-gestao-performance-futebol-research-2026-05-01.md"
  - "_bmad-output/planning-artifacts/research/domain-metricas-desempenho-atletas-futebol-11-research-2026-05-01.md"
  - "_bmad-output/brainstorming/brainstorming-session-2026-05-01-1000.md"
  - "_bmad-output/brainstorming/brainstorming-session-2026-05-01-1100.md"
  - "docs/SPARTA.requirements.md"
workflowType: 'architecture'
project_name: 'SPARTA'
user_name: 'Antero'
date: '2026-05-07'
---

# Architecture Decision Document — SPARTA

**Author:** Antero
**Date:** 2026-05-07

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (59):** organizados em 8 áreas — Identity & Consent (11), Player & Squad (5), Calendar (4), Fatigue (6), Performance (5), Readiness (10), Notifications (4), Compliance & Audit (9), System Ops (5). MVP cobre ~50; Growth ~9.

**Non-Functional Requirements (60):**

- **Performance** (13): Painel ≤2s P95 para 40 jogadores; bundle ≤200KB; Lighthouse ≥85
- **Security** (17): TLS 1.3, RLS em todas as tabelas com dados pessoais, payload push opaco, GDPR Art. 9, residência UE
- **Scalability** (5): 1 clube × 40 jogadores MVP; 4 clubes em multi-tenant antes de Pro plan
- **Accessibility** (9): WCAG 2.1 AA pragmático; sub-14 language adaptation
- **Reliability** (8): ≥99% em janelas; offline absoluto; UUIDv7 idempotent; heartbeat ≤6 dias
- **Maintainability** (5): cobertura ≥80% em funções críticas; TypeScript estrito; provider-agnostic
- **Browser & Platform** (2): Chrome/Safari/Firefox/Edge/Samsung últimas 2; iOS 16.4+

### Scale & Complexity

**Complexidade global: medium-high.**

| Dimensão | Veredicto |
| --- | --- |
| Real-time | Limitado (Painel pré-sessão + dashboard analista) |
| Multi-tenancy | Preparação RLS dia 1; ativo em Phase 2 |
| Compliance | Alta (GDPR Art. 9 + menores) |
| Integração externa | Mínima (Resend, Supabase, Vercel) |
| User interaction | Alta (touchscreen reflexo, offline-first, 4 personas) |
| Volume de dados | Baixo-Médio (~100MB/clube × 5 épocas) |
| Performance budget | Apertado (≤2s painel, ≤200KB bundle) |

**Domínio técnico primário:** PWA full-stack BaaS (Next.js + Supabase).

**Componentes arquiteturais estimados:** 1 frontend PWA, 1 service worker, 1 local DB layer (Dexie), 1 sync engine, 1 Postgres backend (~15-20 tabelas), 3-5 Edge Functions, 1 cron schedule + GitHub Actions heartbeat, 1 email renderer.

### Technical Constraints & Dependencies

**Restrições inflexíveis:**

- Custo €0/mês estrito
- Stack PWA + Supabase + Vercel + Web Push VAPID
- Residência UE
- Provider-agnostic (sem `@vercel/*` exceto `next/*`)
- PT-PT only MVP

**Sub-processadores:** Supabase Inc. (DPA UE), Vercel Inc. (DPA UE, `fra1`, Hobby tem cláusula non-commercial), Resend Inc. (DPA UE, 3K/mês), GitHub Actions (heartbeat).

**Dependências de plataforma:**

- iOS Safari ≥16.4 (>95% market share)
- Add-to-Home-Screen obrigatório iOS para push e durabilidade
- Sem Background Sync iOS — drain por foreground
- Eviction IndexedDB ≤7 dias em iOS para sites não-instalados

**Restrições temporais:** MVP 4 semanas solo dev; dívida técnica aceite documentada (sem CI/CD avançado, sem Storybook, sem E2E, sem i18n, sem feature flags).

### Cross-Cutting Concerns

10 concerns transversais que vão moldar decisões arquiteturais:

1. **Idempotência de writes** — UUIDv7 client-generated em todas as mutations; `upsert` em todo o backend
2. **Offline-first** — outbox pattern aplicado a questionário e eventos; uma queue, uma drain function
3. **Auditoria e logs de acesso** — tabela própria com RLS; retenção 12 meses; endpoint para titular consultar
4. **Multi-tenant scoping** — `club_id` em todas as tabelas; RLS policies baseadas em `(club_id, role)`
5. **Permissões por papel** — 3 papéis ativos + EE; jogador NUNCA acede ao próprio painel processado
6. **Consentimento parental como gating** — `consent_status` por jogador; verificação em todos os endpoints com dados de menor
7. **Cálculos científicos server-side** — ACWR, sRPE, semáforo via vista materializada ou função SQL; cliente nunca calcula
8. **Linguagem dual** — versão sub-14 em política, questionário, prompts
9. **Retenção e anonimização automatizada** — permanência + 5 épocas; anonimização irreversível por pg_cron batch
10. **Telemetria interna** — `telemetry_events` em Postgres; sem GA/Mixpanel

## Starter Template Evaluation

### Primary Technology Domain

**PWA full-stack BaaS** — Next.js + Supabase. Não é frontend-only nem backend-only; é stack BaaS integrado com lógica em Edge Functions e RLS.

### Starter Options Considered

Três caminhos avaliados:

1. **`create-next-app` puro + adições manuais** ✅ **escolhido**
2. **Community boilerplates** (next-supabase-shadcn et al.) — rejeitado por bitrot, features irrelevantes (Stripe/SaaS) e overhead de remoção
3. **shadcn/ui CLI v4 com preset Next.js** (Mar 2026) — rejeitado por menos controlo sobre flags do create-next-app e adoção comunitária ainda em estabilização

### Selected Starter: create-next-app + setup manual sequencial

**Rationale:**

1. Controlo total sobre cada dependência (NFR58 — provider-agnostic)
2. Setup determinista, reproduzível, AI-implementável consistentemente
3. Sem overhead de remoção de features irrelevantes
4. Stack canónico oficial; adoção amadurecida; documentação Vercel oficial

### Initialization Commands

```bash
# 1. Scaffold Next.js
npx create-next-app@latest sparta \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm

cd sparta

# 2. shadcn/ui (Tailwind v4 + Radix primitives + lucide-react)
npx shadcn@latest init

# 3. Supabase + auth helpers
npm install @supabase/supabase-js @supabase/ssr

# 4. Service worker (PWA)
npm install @serwist/next

# 5. Local DB + sync
npm install dexie

# 6. State management
npm install @tanstack/react-query \
            @tanstack/react-query-persist-client \
            @tanstack/query-sync-storage-persister \
            zustand

# 7. Forms + validation
npm install react-hook-form zod @hookform/resolvers

# 8. Datas (PT-PT)
npm install date-fns

# 9. Charts (Phase 2 mas instalar agora)
npm install recharts

# 10. Testing infrastructure
npm install -D vitest @vitest/ui jsdom \
              @testing-library/react @testing-library/jest-dom \
              vitest-axe eslint-plugin-jsx-a11y
```

### Architectural Decisions Provided by Starter

**Language & Runtime:**

- TypeScript estrito (`strict: true`, `noUncheckedIndexedAccess: true` — NFR55)
- Node 22 LTS (runtime Vercel)
- ECMAScript target ES2022

**Build Tooling:**

- Webpack em dev via `next dev --webpack` (Serwist incompatível com Turbopack)
- Webpack em prod (Next.js 16 default; Turbopack para build em desenvolvimento ativo)
- Tailwind v4 com config CSS-first (`@theme` em `globals.css`)

**Styling Solution:**

- TailwindCSS v4 + CSS variables (light/dark via `prefers-color-scheme`)
- shadcn/ui copy-paste components em `src/components/ui/`
- lucide-react para ícones

**Testing Framework:**

- Vitest + `@testing-library/react` + `vitest-axe`
- Playwright adiado para Phase 2 (sem E2E no MVP — PRD)
- Cobertura ≥80% em funções críticas (NFR54): `lib/readiness/`, `lib/outbox/`

**Code Organization:**

```text
src/
├── app/                       # App Router com route groups (player) e (staff)
│   ├── (player)/              # jogador: home, questionario/[sessionId]
│   ├── (staff)/               # treinador + analista
│   ├── login/, consentimento/[token]/
│   ├── api/                   # route handlers
│   ├── layout.tsx, globals.css, sw.ts
├── components/
│   ├── ui/                    # shadcn copy-paste
│   ├── patterns/              # composições reutilizáveis (UX Step 11)
│   └── domain/                # ReadinessPanel, FatigueQuestionnaire, etc
├── lib/
│   ├── supabase/{client,server,middleware,service-role}.ts
│   ├── outbox/                # Dexie outbox + drain
│   ├── readiness/             # ACWR/sRPE mirror cliente
│   ├── tokens/, utils.ts
├── hooks/, stores/, types/, middleware.ts
__fixtures__/                  # substituto Storybook
__tests__/
supabase/
├── migrations/                # SQL migrations
├── functions/                 # Edge Functions (send-push, consent-validate, ...)
└── seed.sql
.github/workflows/
├── heartbeat.yml              # anti-pause Supabase
├── backup.yml                 # backup semanal SQL dump
└── ci.yml                     # lint + test + axe-core
```

**Architectural Patterns:**

- Server Components default; client components opt-in via `"use client"`
- Server Actions para mutations não-críticas; Edge Functions para fluxos especializados (send-push, consent-validate, exporta-csv, delete-cascade)
- Route handlers em `/api/*` apenas para webhooks/streams
- Middleware Next.js para refresh de sessão Supabase em rotas autenticadas
- Route groups `(player)` e `(staff)` para layouts diferenciados por papel

**Development Experience:**

- ESLint flat config + `eslint-plugin-jsx-a11y`
- Prettier integrado via ESLint (sem ficheiro de config separado)
- Hot reload via Webpack dev (Turbopack incompatível com Serwist)
- Vitest watch mode para TDD

**Note:** Project initialization using these commands should be the first implementation story. Tailwind v4 CSS-first config (tokens em `globals.css` via `@theme`) é setup explícito alinhado com UX Spec Step 8.

## Core Architectural Decisions

### Decision Priority Analysis

**Já decidido (passos anteriores):** TypeScript estrito; Next.js 16 App Router; Tailwind v4 + shadcn/ui + Radix UI; TanStack Query + Zustand; React Hook Form + Zod; Supabase EU; Vercel Hobby `fra1`; Web Push (VAPID) via `web-push`; Resend EU; Supabase pg_cron; GitHub Actions heartbeat.

**Críticas (block implementation):** UUIDv7 generation; schema + RLS pattern; Server Actions vs Route Handlers vs Edge Functions; auth flow concreto; sync engine completo.

**Importantes (shape architecture):** telemetria schema; audit log schema; retenção/anonimização batch; real-time scoping; email rendering.

**Diferidas (Phase 2):** multi-tenant ativo (4º clube); E2E Playwright; Storybook; PDF generation; Capacitor wrap.

### Data Architecture

#### Postgres + UUIDv7 generation

Supabase corre **Postgres 17** (UUIDv7 nativo apenas em Postgres 18 — esperado em 2026 sem data firme). Decisão:

- **UUIDv7 client-generated** via biblioteca `uuid` v9+ (`v7()` built-in). Fonte de verdade.
- **Função PL/pgSQL `uuidv7()`** como fallback server-side (Edge Functions, batch jobs, seeds). Implementação publicada por Fabio Lima.
- **Migração indolor para nativo** quando Postgres 18 chegar a Supabase: `DROP FUNCTION uuidv7()` + uso da built-in. Sem alteração de schema.

#### Schema topology (~16 tabelas core)

```text
-- Identity & Multi-tenancy
clubs                  (id, name, country, created_at)
profiles               (id, club_id, role, full_name, ...)
parental_consents      (id, club_id, player_id, parent_email, token, ...)

-- Players & Squad
players                (id, club_id, profile_id?, jersey_num, name, age_group, ...)
player_metrics         (id, player_id, weight_kg, height_cm, recorded_at)
positions              (id, player_id, position, is_primary, sort_order)

-- Calendar & Sessions
seasons                (id, club_id, name, start_date, end_date)
sessions               (id, club_id, season_id, type, scheduled_at, ...)
match_lineups          (id, session_id, player_id, role, started_minute, ended_minute)
attendances            (id, session_id, player_id, status, ...)

-- Fatigue & Performance
fatigue_responses      (id, player_id, session_id, phase, dim1..5, srpe?, ...)
match_events           (id, session_id, player_id, action, zone, occurred_at)
session_metrics        (id, session_id, player_id, sRPE_value, duration_min, ...)

-- Readiness (derived)
readiness_snapshots    (player_id, session_id, state, acwr, ...)

-- Compliance
audit_logs             (id, club_id, actor_id, action, target_kind, target_id, ...)
data_decisions         (id, club_id, player_id, session_id, note, ...)  -- FR52
telemetry_events       (id, club_id, kind, payload_json, occurred_at)

-- Notifications
push_subscriptions     (id, profile_id, endpoint, keys_json, ...)
notification_log       (id, profile_id, kind, sent_at, status)
```

#### Multi-tenant pattern (RLS)

`club_id` em **todas** as tabelas com PII/saúde. Policies baseadas em JWT claim `club_id` + `role` injetado por Supabase Auth Hook.

```sql
create or replace function auth.club_id() returns uuid
language sql stable as $$
  select coalesce((auth.jwt() ->> 'club_id')::uuid, null);
$$;

create or replace function auth.user_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', '');
$$;

create index idx_players_club on players(club_id);  -- replicar para cada tabela

create policy "club isolation read" on players
  for select using (club_id = auth.club_id());

create policy "staff write own club" on players
  for all using (club_id = auth.club_id() and auth.user_role() in ('coach','analyst'))
  with check (club_id = auth.club_id() and auth.user_role() in ('coach','analyst'));

create policy "player sees own profile only" on players
  for select using (
    club_id = auth.club_id()
    and (auth.user_role() in ('coach','analyst') or profile_id = auth.uid())
  );
```

**Princípios invariantes:**

- RLS habilitada em todas as tabelas com PII/saúde — sem exceções (CI lint check)
- `club_id` em todas as tabelas com dados pessoais
- `with check` obrigatório em writes — prevenir cross-tenant insert
- Índice em `club_id` em todas as tabelas (NFR1 — performance ≤2s)
- Service-role client (Edge Functions) bypassa RLS — usar APENAS para fluxos com auth alternativa (token consentimento, batch jobs)

#### Migrations

- **Supabase CLI migrations** (`supabase/migrations/*.sql`) versionadas em git
- **Naming:** `YYYYMMDDHHMMSS_<description>.sql` (auto-gerado por `supabase migration new`)
- CI valida que `supabase db reset` corre sem erros antes de merge
- **Sem ORM** — SQL puro nas migrations; `supabase-js` query builder no código (provider-agnostic e zero-overhead)

---

## Data Model Expansion — Wellness & Analytics (Sprint 1.5)

### Fatigue Responses: Wellness Fields Addition

**New fields (não-breaking change):**
- `mood_score: int` (1–5, emoji scale, pré-sessão only)
- `muscle_pain_zones: jsonb` (array de zonas: ["joelho", "tornozelo"], pós-sessão only)
- `has_exams_this_week: boolean` (pré-sessão only, semanal contexto)

**Migração:**
```sql
ALTER TABLE fatigue_responses
ADD COLUMN mood_score int CHECK (mood_score BETWEEN 1 AND 5),
ADD COLUMN muscle_pain_zones jsonb,
ADD COLUMN has_exams_this_week boolean DEFAULT false;

CREATE INDEX idx_muscle_pain_zones ON fatigue_responses USING GIN(muscle_pain_zones);
CREATE INDEX idx_mood_by_date ON fatigue_responses(player_id, created_at) WHERE phase = 'pre';
```

**RLS:** Nenhuma mudança — `club_id` herança de `fatigue_responses` existente.

---

### Performance Events: Polymorphic JSON Context

**Redesign (não-breaking se `context` é novo campo):**

Tabela expandida para suportar **15+ tipos de eventos** (não apenas 7):
- Individual actions: loss, recovery, shot, pass, pressure, defensive_action, offensive_action
- Team actions: corner, entry_opp_area, entry_own_area
- Goal/discipline: goal, card
- Other: match_time_record

**Schema:**
```sql
-- Add to existing performance_events table
ALTER TABLE performance_events
ADD COLUMN field_zone field_zone_enum NOT NULL DEFAULT 'attack_center',
ADD COLUMN context jsonb;

-- Create enum for 6 universal zones
CREATE TYPE field_zone_enum AS ENUM (
  'defense_left', 'defense_center', 'defense_right',
  'attack_left', 'attack_center', 'attack_right'
);

-- Indexes
CREATE INDEX idx_perf_events_zone ON performance_events(field_zone, session_id);
CREATE INDEX idx_perf_events_context ON performance_events USING GIN(context);

-- Constraint: Eventos coletivos não têm player_id
ALTER TABLE performance_events ADD CONSTRAINT chk_player_for_individual
CHECK (
  CASE WHEN event_type IN ('corner','entry_opp_area','entry_own_area')
    THEN player_id IS NULL
    ELSE player_id IS NOT NULL
  END
);
```

**Context JSON Examples:**
```json
{
  "loss": { "construction_zone": "zone_1" },
  "corner": { "side": "left", "period": "H1" },
  "goal": { "play_type": "corner|open_play|free_kick", "period": "H2_min75", "team": "us" },
  "card": { "color": "yellow|red", "infraction": "word|foul" },
  "shot": { "on_target": true }
}
```

---

### Aggregation Views: Materialized Stats

**Nova view para % convocatórias e % minutos (não entra no Painel ≤2s):**

```sql
CREATE MATERIALIZED VIEW v_athlete_stats_per_season AS
SELECT
  p.id player_id,
  s.id season_id,
  COUNT(DISTINCT g.id) games_in_season,
  SUM(CASE WHEN ml.player_id IS NOT NULL THEN 1 ELSE 0 END) games_convoked,
  ROUND(100.0 * SUM(...) / COUNT(*), 1) convocation_percentage,
  SUM(ml.ended_minute - ml.started_minute) total_minutes,
  ROUND(100.0 * SUM(...) / (COUNT(*) * 90), 1) minutes_percentage
FROM players p
JOIN seasons s ON p.club_id = s.club_id
LEFT JOIN sessions g ON s.id = g.season_id
LEFT JOIN match_lineups ml ON g.id = ml.session_id AND p.id = ml.player_id
GROUP BY p.id, s.id;

-- Trigger refresh on substitution
CREATE TRIGGER trg_refresh_athlete_stats AFTER INSERT OR UPDATE ON match_lineups
FOR EACH STATEMENT EXECUTE FUNCTION refresh_athlete_stats_trigger();
```

**Clean sheet:**
```sql
CREATE MATERIALIZED VIEW v_clean_sheets AS
SELECT
  session_id,
  CASE WHEN COUNT(*) FILTER (WHERE context->>'team_scored' = 'opponent') = 0
    THEN 90 ELSE 0
  END minutes_without_goal
FROM performance_events
WHERE event_type = 'goal'
GROUP BY session_id;
```

---

### RLS Expansion: New Tables

**Nenhuma mudança de pattern — apenas replicar policies existentes:**

```sql
-- fatigue_responses RLS (jogador vê só se é dele, staff vê tudo)
ALTER TABLE fatigue_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fatigue_read" ON fatigue_responses FOR SELECT
USING (club_id = auth.club_id() AND 
       (auth.user_role() IN ('coach','analyst') OR player_id = auth.uid()));
CREATE POLICY "fatigue_write" ON fatigue_responses FOR INSERT
WITH CHECK (club_id = auth.club_id());

-- performance_events RLS (staff only)
ALTER TABLE performance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perf_read_write" ON performance_events
USING (club_id = auth.club_id() AND auth.user_role() IN ('coach','analyst'));
```

---

### Outbox Pattern: New Payloads

**Zero mudança em padrão.** Novos campos entram na payload existente:

```ts
// Exemplos de outbox items expandidos
{
  type: 'wellness_response',
  id: 'uuid-v7',
  payload: {
    sessionId, phase: 'post',
    // 5 dimensões originais
    energyScore: 4, concentrationScore: 4, ...
    // NOVOS
    moodScore: 3,
    musclePainZones: ['joelho'],
    hasExamsThisWeek: false
  }
}

{
  type: 'performance_event',
  id: 'uuid-v7',
  payload: {
    sessionId, playerId: 'uuid|null',
    eventType: 'goal|card|corner|...',
    fieldZone: 'attack_center',
    context: {play_type: 'corner', period: 'H2', ...}
  }
}
```

**Drain:** Sem mudança — `enqueue()` e `drain()` tratam novos campos transparentemente.

---

## Frontend Architecture Expansion

### New Components

```
src/components/domain/wellness/
├── BodyDiagram.tsx           (SVG interativo, 10 zonas)
├── MoodScale.tsx             (5 emoji buttons)
├── ExamsToggle.tsx           (boolean flag)
└── WellnessQuestionnaire.tsx (forma integrada)

src/components/domain/analytics/
├── TouchscreenRecorder.tsx   (3-ecrãs + 4º condicional)
├── MatchTimeRecorders.tsx    (pós-jogo: 2 inputs)
└── ContextScreen.tsx         (4º ecrã: golo/cartão contexto)
```

### BodyDiagram (SVG Custom)

**Constraints:** Offline, mobile (360px), sub-14 compreensível, sem npm dependency.

**Zonas (10 total):**
- Pescoço, Ombro, Cotovelo, Punho, Costas, Anca, Joelho, Tornozelo, Tendão de Aquiles, Outra

### Touchscreen V2: 4º Ecrã Condicional

**Fluxo:**
1. Ecrã 1: Seleção de jogador (11 botões) ou "Equipa" (para cantos, entradas)
2. Ecrã 2: Tipo de ação (loss, recovery, shot, ..., corner, goal, card)
3. Ecrã 3: Zona do campo (6 universais)
4. **Ecrã 4 (condicional):** Se goal/card, pede contexto (tipo de jogada, período, infração)

**Performance:** ≤1s por evento, zero aguardar servidor.

### RLS Enforcement (Frontend)

- Player: vê `fatigue_responses` (pré/pós), não vê aftermath
- Analyst: vê tudo; submete `performance_events`
- Coach: vê tudo; decision marking (FR52)

---

## Performance Validation

### Painel ≤2s: Confirmed

**Query:** `SELECT ... FROM v_readiness_panel WHERE club_id = ? AND session_id = ?`

Agregações (`% convocatórias`, `% minutos`, `clean sheet`) **não entram no Painel — dashboard secundário (Growth).**

### Sync Idempotência: Tested

UUIDv7 client-generated + outbox pattern suporta novos campos atomicamente. Retest em Sprint 1.5 com JSON payloads.

---

## Decisões Resolvidas — Sprint 1.5

| Q | Decisão | Resolução | Sprint |
|----|---------|-----------|--------|
| 4 | RLS wellness: Jogador vê respostas? | ✅ Sim — Player vê pré + pós-sessão (transparência total) | 1.5 |
| 17 | GDPR Art. 9: Novo consentimento? | ✅ Sim — Consentimento explícito Art. 9(2)(a) com anonimização automática (ver GDPR_LEGAL_REVIEW_WELLNESS_DATA.md) | 1.5 |

**Documentação:** Todas as decisões técnicas validadas. Pronto para implementação em Sprint 1.5.

#### Caching

- **TanStack Query** com `persistQueryClient` + IDB persister
- `staleTime` por entidade: players 5min; sessions 1min; readiness 30s pré-sessão / 5min fora; fatigue history 5min
- **Service Worker (Serwist)** com `StaleWhileRevalidate` para GETs read-only
- Sem CDN cache para dados Supabase (autenticados)

### Authentication & Security

#### Supabase Auth flow

- Email + password com email verification obrigatório (FR1)
- MFA TOTP opcional para staff no MVP; obrigatório a partir de Phase 2 (≥4 clubes)
- Session: access 1h, refresh 30d, `autoRefreshToken: true` (NFR17)
- Custom JWT claims (`club_id`, `role`) via Supabase Auth Hook (`custom-access-token`)

#### Next.js auth middleware

- `middleware.ts` na raiz: refresh sessão em rotas autenticadas; redirect `/login` se inválida
- Helpers `lib/supabase/{client,server,middleware,service-role}.ts` seguindo padrão `@supabase/ssr`
- Server-side enforcement em Server Actions e Route Handlers (RLS é segunda camada, primeira é JWT validado server-side)

#### Consentimento parental como gating

- `profiles.consent_status` enum: `not_required` (16+) | `pending` | `granted` | `revoked`
- Middleware bloqueia rotas de jogador menor com `pending` → redirect "aguarda consentimento"
- Token: UUID + secret hash; TTL 14 dias; tabela `parental_consents`; valida via Edge Function `consent-validate`

#### RLS hardening checklist

- Audit script SQL: listar tabelas sem RLS — CI fail se >0
- Audit: tabelas com `club_id` sem index — CI warn
- Test suite a executar policies com diferentes JWT claims
- Service-role secret apenas em Edge Functions e GitHub Actions secrets — nunca em frontend

#### Encryption at-rest

- Supabase default (AWS KMS) cobre Postgres + Storage — sem ação adicional
- Sem column-level encryption no MVP — overhead injustificado para 1 clube; revisitar se DPIA o exigir

#### Payload de push

- Sempre opaco: texto genérico + deep link autenticado
- Nunca dados Art. 9 no payload (NFR21)
- Encriptação ECE automática pela lib `web-push`

### API & Communication Patterns

#### Decision tree

| Tipo de operação | Mecanismo | Razão |
| --- | --- | --- |
| Mutation interna (criar jogador, submeter questionário, registar evento) | **Server Action** | Co-localizada; closure encriptada; UX otimista direto |
| Webhook externo | **Route Handler** | HTTP custom; GET/POST; sem encriptação de closure |
| Stream / export CSV | **Route Handler** | `Response` com streaming nativo |
| Trigger periódico (cron) | **Edge Function + pg_cron** | Edge na região Supabase; cron nativo; sem cold start cross-DC |
| Push notification fan-out | **Edge Function `send-push`** | `web-push` lib + iteração; isolado de Vercel |
| Validação token consentimento | **Edge Function `consent-validate`** | Service-role para criar registo sem JWT do EE |
| Cascade delete (right to erasure) | **Edge Function `delete-cascade`** | Operação destrutiva longa, idempotente, fora do request lifecycle |
| Read direto a tabela | **Supabase JS client** com RLS | Zero round-trip extra; RLS faz scoping |

#### Server Actions — convenções

```text
src/lib/actions/
├── players.ts          # createPlayer, updatePlayer, archivePlayer
├── sessions.ts         # createSession, updateLineup, recordSubstitution
├── fatigue.ts          # submitFatigueResponse (com outbox fallback)
├── events.ts           # recordMatchEvent (com outbox fallback)
├── readiness.ts        # markDataDrivenDecision (FR52)
├── consent.ts          # initiateParentalConsent
└── data-rights.ts      # requestExport, requestDeletion, withdrawConsent
```

**Padrões:**

- Cada action é `async function name(input: SchemaType)`; validação Zod no início
- `"use server"` no topo do ficheiro
- Retornam `Result<T, E>` (discriminated union); nunca throw para o cliente
- Auth check: `const { data: { user } } = await supabase.auth.getUser(); if (!user) ...`
- Rate limiting via Supabase Realtime channel ou middleware custom em Phase 2

#### Edge Functions — convenções

```text
supabase/functions/
├── send-push/index.ts          # POST { profileIds, title, body, deepLink }
├── consent-validate/index.ts   # GET ?token=xxx | POST → JSON
├── exporta-csv/index.ts        # POST { playerId } → streamed CSV
├── delete-cascade/index.ts     # POST { playerId, requesterId }
└── _shared/
    ├── supabase-admin.ts       # service-role client
    └── auth.ts                 # JWT validation helpers
```

- Deno + `import * from 'npm:...'`
- Service-role via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`
- Logs JSON estruturado (Supabase capture automático)
- Operações idempotentes (cold start aceite ≤300ms em EU)

#### Error handling

```ts
type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };
```

- `AppError` discriminated union: `ValidationError | NotFoundError | UnauthorizedError | ConflictError | NetworkError | UnknownError`
- Mensagens em PT-PT B1 prontas para UI (UX Spec — feedback patterns)
- Logs JSON estruturado com `requestId`, `userId`, `clubId`, `actionName`

### Frontend Architecture

#### State management split

| Estado | Tool | Exemplos |
| --- | --- | --- |
| Server state | TanStack Query | Lista jogadores, sessões, readiness snapshot |
| Persistent client (sobrevive refresh) | Zustand + localStorage middleware | Vista preferida (Lista/Formação) |
| Ephemeral client | Zustand sem persist | Sticky player do touchscreen, drill-down aberto |
| Local DB (offline) | Dexie | Outbox de questionários e eventos |
| Form state | React Hook Form | Todos os formulários |

#### Routing strategy

- App Router com route groups `(player)` e `(staff)`
- Server Components default; client opt-in com `"use client"`
- Parallel routes para drill-down em desktop (Phase 2)
- Intercepting routes não usadas no MVP — `<Sheet>` é mais leve
- Middleware para auth refresh + consent gating

#### Performance optimization

- Server Components sempre que possível
- Streaming via `loading.tsx` em rotas com dados lentos
- `use cache` directive (Next.js 16.2+) em queries idempotentes server-side
- Image optimization via `next/image` com `placeholder="blur"`
- Font optimization via `next/font` (Inter Google Fonts) `display=swap`
- Bundle analysis via `@next/bundle-analyzer` em CI — falha se inicial >200KB gzipped (NFR11)

#### Sync engine

```text
src/lib/outbox/
├── db.ts              # Dexie schema (outbox, cache stores)
├── enqueue.ts         # adicionar mutation à outbox
├── drain.ts           # processar outbox (online + visibilitychange + manual)
├── triggers.ts        # event listeners
└── status.ts          # hook useOutboxStatus()
```

```ts
// db.ts
const db = new Dexie('sparta')
db.version(1).stores({
  outbox: 'id, kind, status, createdAt, retryCount',
  cache: 'key, payload, updatedAt',
})
```

**Drain ladder (UX Spec Step 10):**

1. Listener `online` event
2. `visibilitychange:visible`
3. Route change (mais agressivo durante uso ativo)
4. Botão manual "Sincronizar agora"
5. Background Sync registration (best-effort em Chromium; ignorado em iOS)

**Idempotência:** UUIDv7 client-generated em `id`; server `upsert` com `onConflict: 'id'`; após ack `status = 'synced'`; cleanup após 24h.

### Infrastructure & Deployment

#### Environment topology

| Ambiente | Frontend | Backend |
| --- | --- | --- |
| Development local | `next dev --webpack` (porta 3000) | `supabase start` (Docker) ou shared dev project |
| Preview (PR branches) | Vercel preview deploys | Shared Supabase dev project |
| Production | Vercel `fra1` | Supabase EU production |

#### Deployment pipeline

- Vercel auto-deploy em push para `main`
- Preview deploys em PRs (Vercel default)
- Sem staging dedicado no MVP — preview deploys cumprem o papel
- Rollback: Vercel one-click revert; Supabase migrations forward-only (rollback manual via nova migration)

#### CI/CD (.github/workflows/)

```yaml
# heartbeat.yml — anti-pause Supabase
schedule: cron: "0 12 */6 * *"  # a cada 6 dias
job: query trivial via service-role; alert em duas falhas consecutivas

# backup.yml — backup semanal
schedule: cron: "0 3 * * 0"
job: pg_dump → encriptar com chave separada → push para repo privado

# ci.yml — lint + test + build
trigger: pull_request, push:main
steps:
  - lint (ESLint + Prettier)
  - typecheck (tsc --noEmit)
  - test (vitest run --coverage)
  - axe-core (vitest-axe)
  - build (next build)
  - bundle-size check (≤200KB gzipped initial)
  - lighthouse-ci (Performance ≥85, A11y ≥90, BP ≥95, PWA ≥100)
  - migration-validate (supabase db reset --no-seed)
```

#### Secrets management

- Vercel project env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`
- Supabase Edge Functions secrets: `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `RESEND_API_KEY`
- GitHub Actions secrets: `SUPABASE_DB_URL` (heartbeat + backup), `BACKUP_ENCRYPTION_KEY`
- Sem secrets em git — `.gitignore` cobre `.env*` exceto `.env.example`

#### Domain

- MVP serve em `sparta.vercel.app` (subdomínio gratuito)
- Domain próprio (`SPARTA.pt` ~12€/ano) fora de scope MVP — adição trivial via Vercel DNS

#### Monitoring & Observability

- Logs JSON estruturado em Vercel + Supabase (NFR56)
- Telemetria interna em Postgres `telemetry_events` (NFR57)
  - `kind`: `survey_submitted`, `panel_viewed`, `decision_marked`, `pwa_installed`, `app_uninstall`, etc.
  - Server Action `logTelemetry()` em momentos-chave
- Sem analytics third-party (NFR22)
- Heartbeat externo via UptimeRobot/healthchecks.io free — ping a `/api/health` a cada 5 min (Phase 2)
- Error tracking — sem Sentry no MVP; logs Vercel + filtros suficientes; Sentry como Phase 2 se volume justificar

#### Scaling triggers

| Sinal | Ação |
| --- | --- |
| 4-5º clube ativo | Pro plan ($25/mês) ou self-host Supabase |
| iOS install rate <40% no mês 2 | Sprint Capacitor wrap |
| Primeiro pagamento (donativo > revenue) | Migrar Vercel Pro ou Netlify/Cloudflare |
| Volume push >2M mensagens/mês | Reavaliar VAPID vs FCM |
| BD >400 MB | Política de arquivamento de épocas antigas |
| Realtime conexões pico >150 | Polling on-demand onde possível |

### Decision Impact Analysis

#### Implementation sequence (Sprint 1)

1. Project init (`create-next-app` + sequência do Step 3)
2. Supabase project (EU) + DPA + DPIA documentação iniciada
3. Schema migrations — tabelas core, depois RLS policies, depois funções derivadas
4. Auth setup — middleware Next.js + helpers `lib/supabase/`
5. JWT custom claims hook (Supabase Auth Hook)
6. Outbox + sync engine (`lib/outbox/`)
7. Telemetry + audit_logs + data_decisions tables + Server Action helpers
8. CI/CD — heartbeat.yml, backup.yml, ci.yml

#### Cross-component dependencies

- JWT claims (`club_id`, `role`) → pré-condição para RLS policies; auth hook deployed antes de qualquer policy testável
- UUIDv7 → pré-condição para outbox idempotente; lib cliente antes de qualquer mutation Server Action
- Service worker (Serwist) → pré-condição para PWA install + push; `app/sw.ts` deployed antes do A2HS onboarding
- Supabase Auth Hook → depende de `profiles` table com `club_id` e `role`; migration antes do hook

## Implementation Patterns & Consistency Rules

### Naming Patterns

#### Database

```text
✅ Tables:        snake_case plural          fatigue_responses, match_events
✅ Columns:       snake_case singular        player_id, submitted_at
✅ FKs:           {referenced}_id            club_id, session_id, profile_id
✅ Indexes:       idx_{table}_{column}       idx_players_club, idx_match_events_session
✅ Enums:         snake_case singular        consent_status, age_group
✅ Functions:     snake_case verb_noun       calculate_acwr(), refresh_readiness()
✅ Views:         snake_case + _view         player_readiness_view
✅ Materialized:  snake_case + _mat          readiness_snapshots_mat
✅ Migrations:    YYYYMMDDHHMMSS_kebab.sql   20260507093000_add_consent_status.sql

❌ camelCase em qualquer lugar do schema
❌ Plurais inconsistentes
❌ Prefixos genéricos como tbl_, fk_
```

**Regra invariante:** schema é snake_case; código TS é camelCase. PostgREST + tipos gerados convertem no boundary.

#### Code (TypeScript/React)

```text
✅ Components:    PascalCase                 ReadinessPanel, FatigueSlider
✅ Files:         kebab-case .tsx            readiness-panel.tsx, fatigue-slider.tsx
✅ Hooks:         camelCase com use-prefix   useReadinessData, useOutboxStatus
✅ Server Actions:camelCase verbo            submitFatigueResponse
✅ Functions:     camelCase verbo            calculateAcwr, formatDate
✅ Variables:     camelCase                  playerId, isLoading
✅ Constants:     UPPER_SNAKE                MAX_PLAYERS, CONSENT_TOKEN_TTL_DAYS
✅ Types:         PascalCase                 Player, FatigueResponse, AppError
✅ Enums (TS):    PascalCase / UPPER         AgeGroup.U14, ConsentStatus.Pending
✅ Zod schemas:   PascalCase + Schema sufix  PlayerSchema, FatigueResponseSchema
✅ Test files:    {target}.test.ts(x)        readiness-panel.test.tsx

❌ snake_case em código TS
❌ Default exports — usar named exports (exceção: páginas Next.js)
❌ Barrel files (index.ts re-exports) — degradam tree-shaking
```

#### Routes (Next.js — em PT)

```text
✅ Top-level:        PT, kebab-case            /prontidao, /calendario, /sessoes
✅ Dynamic params:   [paramName]               /plantel/[id], /sessoes/[id]
✅ Route groups:     (group-name)              (player), (staff)
✅ API routes:       /api/{resource} EN        /api/health, /api/export
✅ Public tokenized: /{action}/[token]         /consentimento/[token]

❌ Mistura PT/EN em rotas user-facing
❌ Slugs com nomes pessoais (privacidade — sempre UUID)
```

#### Edge Functions

```text
✅ Function names:  kebab-case                send-push, consent-validate, exporta-csv
✅ Endpoint paths:  /functions/v1/{name}      /functions/v1/send-push
```

### Structure Patterns

#### Project organization

```text
src/
├── app/                              # rotas Next.js
├── components/
│   ├── ui/                           # shadcn — NUNCA importa de patterns/ ou domain/
│   ├── patterns/                     # composições — pode importar de ui/ apenas
│   └── domain/                       # lógica de negócio — pode importar de patterns/ e ui/
├── lib/
│   ├── actions/                      # Server Actions (uma actions.ts por área)
│   ├── supabase/                     # client/server/middleware/service-role
│   ├── outbox/                       # Dexie outbox + drain
│   ├── readiness/                    # cálculos ACWR/sRPE (mirror cliente)
│   ├── tokens/                       # design tokens em TS
│   ├── schemas/                      # Zod schemas partilhados client/server
│   └── utils.ts
├── hooks/, stores/, types/, middleware.ts
__tests__/                            # mirror de src/ (não co-located)
__fixtures__/                         # data fixtures por componente Domain
supabase/
├── migrations/, functions/, seed.sql
```

**Regras de dependência (camadas):**

```text
domain → patterns → ui
domain, patterns, ui  →  lib, hooks, stores, types
                lib  →  types (apenas)
```

**Lint rule (Phase 1 — manual; Phase 2 — `eslint-plugin-boundaries`):** `ui/` não pode importar de `patterns/` ou `domain/`; `patterns/` não pode importar de `domain/`.

#### Test location

- **Não co-located.** Tests em `__tests__/` espelhando estrutura de `src/`
- **Naming:** `{target-path}/{target-file}.test.tsx` — mirror exato

#### Static assets

```text
public/
├── icons/                  # PWA icons (192, 512, maskable)
├── manifest.webmanifest    # PWA manifest
├── animations/             # A2HS Lottie/MP4
└── favicon.ico
```

### Format Patterns

#### Server Action return shape

**Sempre `Result<T, E>` discriminated union.** Nunca throw para o cliente.

```ts
type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };
```

#### AppError shape

```ts
type AppError =
  | { kind: 'validation'; issues: ZodIssue[] }
  | { kind: 'not_found'; resource: string; id?: string }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden'; reason?: string }
  | { kind: 'conflict'; field?: string }
  | { kind: 'network'; retryable: boolean }
  | { kind: 'unknown'; message: string };
```

Mensagens user-facing são derivadas no cliente (PT-PT B1) a partir de `error.kind`.

#### Edge Function response

JSON com mesma forma `Result<T, E>`. HTTP status code reflete `ok`:

| Estado | HTTP |
| --- | --- |
| `ok: true` | 200 |
| `validation` | 400 |
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `conflict` | 409 |
| `network` / `unknown` | 500 |

#### Database column conventions

| Coluna | Type | Convenção |
| --- | --- | --- |
| `id` | `uuid` | UUIDv7, PK em todas as tabelas |
| `created_at` | `timestamptz` | Default `now()`, NOT NULL |
| `updated_at` | `timestamptz` | Default `now()`, trigger update on row change |
| `deleted_at` | `timestamptz` | Nullable; soft delete onde aplicável |
| `club_id` | `uuid` | FK obrigatório em tabelas com PII; NOT NULL |
| Booleans | `boolean` | NOT NULL com default; sem nullable booleans |
| Enums | enum type | Definido em SQL, espelhado em TS via `type` |
| Datas (sem hora) | `date` | Eg. `birth_date`, `season_start_date` |
| Datas (com hora) | `timestamptz` | TZ-aware; armazenado em UTC |
| JSON | `jsonb` | Não `json`; sempre indexável |

#### Datas em código

- **Library obrigatória:** `date-fns` com locale `ptPT`
- **`toLocaleString()` proibido** — inconsistente entre browsers
- Server armazena UTC; cliente renderiza `Europe/Lisbon`

#### JSON field naming

- Snake_case em payloads server (alinhado com Postgres)
- PostgREST converte automaticamente quando consumido via `supabase-js` typed client
- Em payloads custom (Server Actions / Edge Functions), camelCase com conversão no boundary

### Communication Patterns

#### Event vocabulary (telemetria interna)

```ts
type TelemetryEvent =
  | { kind: 'survey_submitted'; payload: { playerId, sessionId, durationMs, offline } }
  | { kind: 'panel_viewed'; payload: { sessionId?, view: 'list' | 'formation' } }
  | { kind: 'decision_marked'; payload: { playerId, sessionId, contradictedIntuition } }
  | { kind: 'pwa_installed'; payload: { platform: 'ios' | 'android' | 'desktop' } }
  | { kind: 'app_uninstall'; payload: { platform } }
  | { kind: 'consent_granted'; payload: { playerId, parentEmail } }
  | { kind: 'consent_revoked'; payload: { playerId, by: 'parent' | 'player' } }
  | { kind: 'event_recorded'; payload: { sessionId, action, zone } }
  | { kind: 'sync_drained'; payload: { count, durationMs } }
  | { kind: 'error_surfaced'; payload: { kind, where } };
```

**Regras:**

- Adicionar evento novo requer alterar o discriminated union (TS errors guiam o resto)
- `payload` schema validado com Zod na escrita
- Sem PII no payload — apenas IDs (UUIDs)
- Sem dados Art. 9 no payload (NFR21)

#### State updates

- **TanStack Query** para server state — invalidação por queryKey, nunca refetch global
- **Zustand** para client state — sempre via setters explícitos:

```ts
// ✅
useMatchSession.setState({ selectedPlayer: player });

// ❌ Mutação direta
useMatchSession.getState().selectedPlayer = player;
```

- **Optimistic updates:**
  - `onMutate`: atualizar cache TanStack
  - `onError`: rollback explícito (snapshot guardado em `onMutate`)
  - `onSettled`: invalidate queries afetadas

#### Logging

```ts
import { logger } from '@/lib/logger';
logger.info('survey_submitted', { playerId, sessionId, durationMs, offline });
```

**Regras:**

- 3 níveis apenas: `info`, `warn`, `error`. Sem `debug`/`trace`/`verbose`
- Estrutura: `(message: string, payload: object)` — mensagem é evento canónico
- `console.log` em produção proibido — ESLint rule a falhar build
- Sem PII em logs — apenas IDs

### Process Patterns

#### Loading states (UX Spec Step 12)

| Duração esperada | Pattern |
| --- | --- |
| <300ms | Sem indicator |
| 300ms–1s | `<Skeleton>` da estrutura final |
| 1s–3s | Skeleton + spinner discreto |
| >3s | Skeleton + spinner + mensagem |

**Implementação:** Server Components com `loading.tsx` em rotas Next.js (streaming nativo); Client Components: `useQuery` com `isPending` → render `<Skeleton>` consistente. Skeleton sempre prefere conteúdo final.

#### Empty states

```tsx
// ✅ Explica o próximo passo
<EmptyState
  icon={<UserPlus />}
  title="Sem jogadores ainda"
  description="Começa por registar o teu primeiro jogador"
  action={<Button onClick={onCreate}>Adicionar jogador</Button>}
/>

// ❌ Apologético, sem ação
<EmptyState message="Lamentamos, não há resultados." />
```

#### Error recovery

| Tipo de erro | Pattern |
| --- | --- |
| Validação | `<Alert>` inline no campo |
| Save | `<CalmConfirmation>` honesto sobre estado dos dados |
| Carregamento | `<EmptyState>` com retry button |
| 404 | Página dedicada simples |
| 500 | Página dedicada honesta |

**Regra universal:** error message **explica o que aconteceu aos dados**. Nunca "erro inesperado".

#### Authentication flows

- **Login:** form → Server Action → `redirect('/prontidao')` ou `redirect('/(player)/home')` consoante role
- **Logout:** Server Action → `signOut()` → `redirect('/login')`
- **Sessão expirada:** middleware deteta → preserva deep link em `?next=` → redirect `/login`
- **Pós-login retorna ao `next`:** sempre validar `next` é caminho relativo (security)

#### Validation timing

| Lugar | Quando |
| --- | --- |
| Form input | On-blur (não on-change — Step 12 UX) |
| Server Action | Imediatamente, antes de qualquer side-effect |
| Edge Function | Imediatamente, antes de qualquer DB call |
| DB constraint | Última linha de defesa (CHECK, NOT NULL, FK) |

**Zod schemas partilhados** entre client e server (`src/lib/schemas/`):

```ts
// src/lib/schemas/fatigue.ts
export const FatigueInputSchema = z.object({
  playerId: z.string().uuid(),
  sessionId: z.string().uuid(),
  phase: z.enum(['pre', 'post']),
  muscularEnergy: z.number().int().min(1).max(5),
  concentration: z.number().int().min(1).max(5),
  sleep: z.number().int().min(1).max(5),
  discomfort: z.number().int().min(1).max(5),
  emotional: z.number().int().min(1).max(5),
});
export type FatigueInput = z.infer<typeof FatigueInputSchema>;
```

### Enforcement Guidelines

**All AI agents implementing on this project MUST:**

1. Run `tsc --noEmit` before commit — TypeScript erros bloqueiam merge
2. Run `vitest run` before commit — testes têm de passar
3. Validar com Zod no início de Server Actions/Edge Functions — nunca confiar em entrada não validada
4. Usar `Result<T, E>` em Server Actions — nunca throw cross-boundary
5. Snake_case em SQL/DB; camelCase em TS — sem mistura
6. Importar do ficheiro direto — sem barrel files (`index.ts` re-exports)
7. Respeitar camadas: `ui/` não importa `patterns/` ou `domain/`; `patterns/` não importa `domain/`
8. `logger.{info|warn|error}` em vez de `console.log` — ESLint enforcement
9. `date-fns` com locale `ptPT` — nunca `toLocaleString()`
10. Escrever migration nova para alterações de schema; nunca editar migrations já merged
11. Adicionar índice em `club_id` sempre que adicionar tabela com `club_id`
12. Habilitar RLS em qualquer tabela nova com PII/saúde — sem exceção
13. Verificar com `axe-core` em testes de componentes user-facing
14. PT-PT em rotas user-facing, EN em `/api/*` e em código

**Pattern enforcement:**

- ESLint flat config + plugins (`eslint-plugin-jsx-a11y`, custom rules)
- TypeScript strict + `noUncheckedIndexedAccess`
- Vitest + `vitest-axe` em CI
- Manual: PR checklist (UX Spec Step 12 + estes patterns)
- Periódico: SQL audit script para tabelas sem RLS, sem index em `club_id`, etc.

**Pattern violations:**

- Documentar em `docs/architecture/violations.md` com data, contexto, próximos passos
- Reavaliar pattern se mesma violação recorre 2+ vezes (sinal que a regra está mal calibrada)

### Anti-Patterns Examples

```ts
// ❌ Default export inconsistente
export default function ReadinessPanel() { ... }
// vez
export function ReadinessPanel() { ... }  // ✅

// ❌ Throw em Server Action
'use server';
export async function createPlayer(input: PlayerInput) {
  if (!input.name) throw new Error('Missing name');  // ❌
}
// vez
'use server';
export async function createPlayer(input: PlayerInput): Promise<Result<Player, AppError>> {
  const parsed = PlayerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: 'validation', issues: parsed.error.issues } };  // ✅
  // ...
}

// ❌ console.log em produção
console.log('Player created:', player);  // ESLint fail
// vez
logger.info('player_created', { playerId: player.id });  // ✅

// ❌ Toast celebratório
toast.success('🎉 Sucesso!');  // viola tom calmo
// vez
<CalmConfirmation message="Registado, bom treino" />  // ✅
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
sparta/
├── README.md                              # setup local + arquitetura overview
├── package.json
├── tsconfig.json                          # strict + noUncheckedIndexedAccess
├── next.config.ts                         # Serwist + headers + domains
├── eslint.config.mjs                      # flat config + jsx-a11y + custom layer rules
├── .prettierrc.json
├── .editorconfig
├── .gitignore
├── .nvmrc                                 # node 22
├── .env.example
├── components.json                        # shadcn/ui config
├── postcss.config.mjs                     # Tailwind v4
│
├── docs/
│   ├── architecture/
│   │   ├── README.md
│   │   ├── violations.md                  # log de pattern violations
│   │   ├── adr/                           # ADRs futuros (Phase 2)
│   │   └── runbooks/
│   │       ├── heartbeat-failure.md
│   │       ├── outbox-stuck.md
│   │       └── consent-token-expired.md
│   ├── compliance/
│   │   ├── dpia.md                        # Data Protection Impact Assessment
│   │   ├── art-30-record.md               # Registo de atividades de tratamento
│   │   └── policies/
│   │       ├── privacy-policy.md          # versão "adulta"
│   │       └── privacy-policy-u15.md      # versão linguagem adaptada
│   └── SPARTA.requirements.md
│
├── .github/workflows/
│   ├── ci.yml                             # lint + typecheck + test + build + axe + lighthouse
│   ├── heartbeat.yml                      # anti-pause Supabase a cada 6 dias
│   └── backup.yml                         # backup semanal SQL dump encriptado
│
├── public/
│   ├── manifest.webmanifest                # PWA manifest
│   ├── favicon.ico
│   ├── icons/                              # icon-192, icon-512, icon-maskable
│   ├── animations/                         # ios-a2hs.mp4
│   └── illustrations/                      # SVGs neutros
│
├── src/
│   ├── middleware.ts                       # auth refresh + consent gating
│   ├── app/
│   │   ├── globals.css                     # Tailwind v4 @theme + design tokens
│   │   ├── layout.tsx, page.tsx, loading.tsx, error.tsx, not-found.tsx
│   │   ├── sw.ts                           # service worker (Serwist)
│   │   ├── login/                          # page.tsx, actions.ts, recuperar/
│   │   ├── consentimento/[token]/          # page.tsx, actions.ts (público)
│   │   ├── (player)/
│   │   │   ├── layout.tsx, home/, eu/, historico/
│   │   │   └── questionario/[sessionId]/   # page.tsx, actions.ts
│   │   ├── (staff)/
│   │   │   ├── layout.tsx
│   │   │   ├── prontidao/                  # Painel A "Lista" default
│   │   │   ├── plantel/                    # listar / [id] / novo
│   │   │   ├── sessoes/                    # listar / [id]/eventos|lineup / nova
│   │   │   ├── tendencias/                 # dashboard analista
│   │   │   ├── carga/, consentimentos/, configuracoes/
│   │   ├── dev/components/                 # showcase Domain (só dev — substituto Storybook)
│   │   └── api/                            # /health, /export
│   │
│   ├── components/
│   │   ├── ui/                             # shadcn copy-paste (Foundation)
│   │   ├── patterns/                       # SemaforoBadge, DrillDownSheet, PendingBadge,
│   │   │                                   # EmptyState, TooltipExplain, HapticButton, CalmConfirmation
│   │   └── domain/
│   │       ├── readiness/                  # ReadinessPanel, PlayerRow, FieldFormation, ...
│   │       ├── fatigue/                    # FatigueQuestionnaire, FatigueSlider, ...
│   │       ├── match/                      # MatchEventCapture, StickyPlayerCard, ...
│   │       ├── lineup/, consent/, trends/, onboarding/, data-rights/
│   │
│   ├── emails/                             # React Email templates (Resend)
│   │   ├── parental-consent.tsx, consent-confirmation.tsx
│   │   ├── consent-reminder-d7.tsx, consent-reminder-d14.tsx
│   │   ├── data-export-ready.tsx, data-deletion-confirmation.tsx
│   │   ├── password-reset.tsx
│   │   └── _components/                    # email primitives
│   │
│   ├── lib/
│   │   ├── supabase/                       # client, server, middleware, service-role
│   │   ├── actions/                        # players, sessions, fatigue, events, readiness,
│   │   │                                   # consent, data-rights, telemetry
│   │   ├── outbox/                         # db, enqueue, drain, triggers, status
│   │   ├── readiness/                      # acwr, srpe, thresholds, status (mirror cliente)
│   │   ├── push/                           # subscribe, unsubscribe, vapid
│   │   ├── pwa/                            # install-prompt, ios-detection, webview-detection
│   │   ├── schemas/                        # Zod schemas partilhados client/server
│   │   ├── tokens/                         # design tokens em TS
│   │   ├── i18n/pt-PT/                     # errors, fatigue (sénior+u14), consent
│   │   ├── logger.ts, result.ts, uuid.ts, dates.ts, plurals.ts, utils.ts
│   │
│   ├── hooks/                              # use-supabase, use-current-user, use-readiness-data,
│   │                                       # use-outbox-status, use-push-subscription, use-haptic, ...
│   ├── stores/                             # match-session, ui-preferences, outbox-ui (Zustand)
│   └── types/                              # database (gerado), domain, result
│
├── __fixtures__/                           # data fixtures por componente Domain
│   ├── players.ts, sessions.ts, fatigue-responses.ts, match-events.ts, readiness-snapshots.ts
│
├── __tests__/                              # mirror de src/
│   ├── lib/, components/, app/, _utils/
│
├── supabase/
│   ├── config.toml, seed.sql
│   ├── migrations/
│   │   ├── 000000_init_extensions.sql      # uuidv7 PL/pgSQL function
│   │   ├── 000010_clubs_profiles.sql
│   │   ├── 000020_players_squad.sql
│   │   ├── 000030_seasons_sessions.sql
│   │   ├── 000040_fatigue_responses.sql
│   │   ├── 000050_match_events.sql
│   │   ├── 000060_session_metrics.sql
│   │   ├── 000070_readiness_snapshots.sql  # mat. view + refresh function
│   │   ├── 000080_audit_logs.sql
│   │   ├── 000090_data_decisions.sql
│   │   ├── 000100_telemetry_events.sql
│   │   ├── 000110_push_subscriptions.sql
│   │   ├── 000120_parental_consents.sql
│   │   ├── 000130_rls_policies.sql         # todas as policies juntas
│   │   ├── 000140_jwt_custom_claims_hook.sql
│   │   ├── 000150_pg_cron_jobs.sql
│   │   └── 000160_audit_triggers.sql
│   │
│   └── functions/
│       ├── send-push/, consent-validate/, exporta-csv/
│       ├── delete-cascade/, schedule-handler/
│       └── _shared/                        # supabase-admin, auth, result, email
│
└── scripts/
    ├── audit-rls.sql                       # auditar tabelas sem RLS
    ├── audit-indexes.sql                   # tabelas com club_id sem index
    ├── seed-dev.sh
    └── lighthouse-check.mjs
```

### Architectural Boundaries

#### API Boundaries

| Boundary | Mecanismo | Auth |
| --- | --- | --- |
| Browser → Supabase REST/PostgREST | `supabase-js` client | JWT (anon ou user) + RLS |
| Browser → Server Action | Next.js RSC fetch | Cookie session validada server-side |
| Browser → Edge Function | `fetch('/functions/v1/...')` | JWT user OR token público (`/consent`) |
| Cron → Edge Function | Supabase pg_cron `net.http_post()` | Service-role |
| GitHub Actions → Supabase | `psql` direto | `SUPABASE_DB_URL` secret |
| Edge Function → Resend | `fetch('https://api.resend.com')` | `RESEND_API_KEY` |
| Edge Function → Browser Push services | `web-push` lib | VAPID keypair |
| External monitor → App | `GET /api/health` | None (rate-limited) |

#### Component Boundaries

```text
ui/         (shadcn primitives)
  ↓ used by
patterns/   (composições — SemaforoBadge, DrillDownSheet, etc.)
  ↓ used by
domain/     (ReadinessPanel, FatigueQuestionnaire, MatchEventCapture, ...)
  ↓ rendered in
app/        (rotas, server components, layouts)
```

**Regra invariante:** seta unidirecional. Phase 1 enforcement manual; Phase 2 com `eslint-plugin-boundaries`.

#### Service Boundaries

```text
Frontend (Next.js / Vercel fra1)
   ├── reads Supabase via supabase-js (RLS enforced)
   ├── writes via Server Actions (server-side validate + supabase-js)
   ├── calls Edge Functions: send-push, consent-validate, exporta-csv, delete-cascade, schedule-handler
   └── service worker (Serwist) caches shell + Supabase GET reads

Supabase (EU production project)
   ├── Postgres (RLS, materialized views, pg_cron)
   ├── Auth (JWT, custom claims hook)
   ├── Storage (player photos, ephemeral PDFs)
   ├── Realtime (Painel pre-session window only)
   └── Edge Functions (Deno; service-role secrets)

External
   ├── Resend (transactional email; EU region)
   ├── Browser push services (Apple/Mozilla/Google; mediated by browser)
   ├── GitHub Actions (heartbeat + backup)
   └── Vercel (hosting; fra1; auto-deploy from main)
```

#### Data Boundaries

```text
Tabelas com PII/saúde (RLS obrigatório):
  clubs, profiles, players, player_metrics, positions, attendances,
  fatigue_responses, match_events, session_metrics, readiness_snapshots,
  audit_logs, data_decisions, parental_consents, push_subscriptions,
  notification_log

Tabelas sem PII (RLS recomendado):
  seasons, sessions, match_lineups, telemetry_events

Tabelas system (sem RLS — service-role only):
  schema_migrations (Supabase managed)
```

### Requirements to Structure Mapping

| Área (FRs PRD) | Componentes | Server Actions | Tabelas | Edge Functions |
| --- | --- | --- | --- | --- |
| Identity, Access & Consent (FR1–FR11) | `consent/`, `onboarding/` | `consent.ts` | `profiles`, `parental_consents` | `consent-validate` |
| Player & Squad (FR12–FR16) | `readiness/player-row.tsx`, `readiness/player-drilldown.tsx` | `players.ts` | `players`, `player_metrics`, `positions` | — |
| Calendar & Sessions (FR17–FR20) | `lineup/`, `match/` | `sessions.ts` | `seasons`, `sessions`, `match_lineups`, `attendances` | — |
| Fatigue & Wellness (FR21–FR26) | `fatigue/` | `fatigue.ts` | `fatigue_responses` | — |
| Performance Recording (FR27–FR31) | `match/` | `events.ts` | `match_events`, `session_metrics` | — |
| Readiness Intelligence (FR32–FR41) | `readiness/`, `trends/` | `readiness.ts` (FR52) | `readiness_snapshots` (mat. view) | — |
| Notifications (FR42–FR45) | `onboarding/push-permission-request.tsx` | (subscription mgmt em `lib/push/`) | `push_subscriptions`, `notification_log` | `send-push`, `schedule-handler` |
| Compliance & Audit (FR46–FR54) | `data-rights/`, `consent/` | `data-rights.ts` | `audit_logs`, `data_decisions` | `exporta-csv`, `delete-cascade` |
| System Ops (FR55–FR59) | (PDF Phase 2) | — | — | `backup.yml` + `heartbeat.yml` |

#### Cross-cutting concerns localização

| Concern | Implementação |
| --- | --- |
| Idempotência (UUIDv7) | `lib/uuid.ts`; cliente em todas as mutations; server `upsert` |
| Offline-first (outbox) | `lib/outbox/*` |
| Auditoria & access logs | `migrations/000080_audit_logs.sql` + triggers em `000160` |
| Multi-tenant scoping | RLS policies `migrations/000130`; `auth.club_id()` helper |
| Permissões por papel | RLS policies + `auth.user_role()` helper + middleware |
| Consentimento gating | `middleware.ts` + `profiles.consent_status` enum |
| Cálculos científicos | `migrations/000070` (mat. view + função `refresh_readiness()`); mirror cliente em `lib/readiness/` |
| Linguagem dual (sub-14) | `lib/i18n/pt-PT/*.ts` com chaves `senior` / `u14` |
| Retenção & anonimização | `migrations/000150_pg_cron_jobs.sql`; pg_cron mensal |
| Telemetria | `lib/actions/telemetry.ts` + `migrations/000100_telemetry_events.sql` |

### Integration Points

#### Internal communication

```text
Browser (Server Component)
   ↓ fetch SSR direta a Postgres via supabase/server.ts (RLS via JWT cookie)
Browser (Client Component)
   ↓ supabase/client.ts (JWT)
   ↓ Server Action (form / button)
   ↓ Edge Function (push, consent-validate, exporta-csv, delete-cascade)

Server Action
   ↓ supabase/server.ts (auth.getUser() server-side)
   ↓ writes via supabase-js typed query builder
   ↓ logger → JSON estruturado a stdout (Vercel captura)
   ↓ logTelemetry() → INSERT em telemetry_events

Edge Function
   ↓ Deno; service-role OR JWT-validated user client
   ↓ supabase-js
   ↓ console.log JSON estruturado (Supabase capture)
```

#### External integrations

| External | Direction | Protocol | Auth | Failure mode |
| --- | --- | --- | --- | --- |
| Resend | App → Resend | HTTPS POST | API key (Supabase secret) | Email retry; log + audit |
| Browser push services | Edge Function → push svc | HTTPS POST (RFC 8030) | VAPID JWT signed per request | 410 → delete sub; 5xx → retry |
| Browser (push receive) | Push svc → browser | Web Push proto | Browser-managed | SW handles |
| GH Actions (heartbeat) | GHA → Supabase | psql via `SUPABASE_DB_URL` | DB password | 2 falhas → alert email |
| GH Actions (backup) | GHA → Supabase | `pg_dump` | DB password | Falha → alert + retry next week |
| External uptime (Phase 2) | Monitor → App | HTTPS GET `/api/health` | None | Logs apenas |

#### Data flow exemplos

**Submissão de questionário (online):**

```text
Player tap "Submeter"
  → Server Action submitFatigueResponse(input)
  → Zod validation
  → uuidv7 client-generated id (já em input)
  → supabase.from('fatigue_responses').upsert({ id, ...input })
  → RLS: player_id = auth.uid() AND profile.consent_status='granted'
  → DB trigger: insert audit_logs row
  → DB trigger: refresh readiness_snapshots_mat (debounced)
  → Server Action returns { ok: true, data: row }
  → Component shows <CalmConfirmation>
  → logTelemetry('survey_submitted', { ..., offline: false })
```

**Submissão de questionário (offline):**

```text
Player tap "Submeter"
  → Server Action falha com network error
  → Component intercepta; enqueueMutation({ kind: 'fatigue_response', payload })
  → Dexie outbox: insert { id, kind, status: 'pending', payload }
  → <PendingBadge count++>
  → ... (offline)
  → Browser online event
  → drainOutbox():
     → for each pending: supabase upsert (idempotent UUIDv7)
     → success: status 'synced'; cleanup após 24h
  → <PendingBadge count--> via useOutboxStatus()
  → logTelemetry('sync_drained', { count, durationMs })
```

**Push notification:**

```text
pg_cron tick (every minute)
  → schedule-handler Edge Function
  → SELECT sessions WHERE scheduled_at BETWEEN NOW()+(X-1)min AND NOW()+(X+1)min
  → For each player in session: SELECT push_subscriptions
  → Call send-push Edge Function with profileIds, opaque payload, deep link
  → For each subscription: web-push.sendNotification()
  → On 410/404: delete row from push_subscriptions
  → On success: insert notification_log row
```

### File Organization Patterns

**Configuration files (root):**

- `tsconfig.json` — strict + noUncheckedIndexedAccess, paths alias `@/*`
- `next.config.ts` — Serwist plugin, headers (CSP, security)
- `eslint.config.mjs` — flat config; jsx-a11y; custom layer rule
- `postcss.config.mjs` — Tailwind v4
- `components.json` — shadcn config (style: new-york; cssVariables: true; baseColor: zinc)
- `.env.example` — todas as variáveis com placeholder

**Source organization:** feature/área dentro de `app/(role)/`; components segregados por camada (ui → patterns → domain); domain agrupado por área; shared utilities em `lib/`; types gerados regenerados via `npm run gen:types`.

**Test organization:** mirror de `src/` em `__tests__/`; helpers em `__tests__/_utils/`; fixtures em `__fixtures__/` (também usadas por `/dev/components`); coverage threshold em `vitest.config.ts` para `lib/readiness/` e `lib/outbox/` (≥80%).

**Asset organization:** public assets em `/public` (servidos pelo Vercel); manifest e ícones em `/public/icons/`; animações em `/public/animations/`; sem imagens em `/src` (exceto SVGs inline).

### Development Workflow Integration

**Development server:**

```bash
npm run dev          # next dev --webpack -p 3000
supabase start       # Docker stack (DB, Auth, Storage, Edge runtime)
supabase functions serve   # Deno runtime local
npm run gen:types -- --watch
```

**Build process:**

```bash
npm run build, npm run start
# CI extras:
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run test         # vitest run --coverage
npm run test:axe     # vitest run com tag @axe
npm run lighthouse   # node scripts/lighthouse-check.mjs
```

**Deployment:**

- Vercel auto-deploys em push para `main`
- Preview deploys em PRs (URL `sparta-{hash}.vercel.app`)
- Edge Functions deploy via `supabase functions deploy {name}`
- Migrations via `supabase db push` (CI valida; deploy manual a produção até Phase 2)
- Env vars sync via Vercel CLI ou dashboard; nunca em código

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

- Next.js 16.2 + Tailwind v4 + shadcn/ui v4 — versões alinhadas (Mar 2026)
- Supabase Postgres 17 + UUIDv7 PL/pgSQL function — fallback até Postgres 18 nativo; migração indolor
- Serwist + Webpack mode em dev — incompatibilidade Turbopack documentada com flag explícito
- Web Push (VAPID) + iOS 16.4+ — Apple suporta standard end-to-end
- `@supabase/ssr` + Next.js middleware — padrão oficial; sessão via cookies HTTPOnly
- Vercel Hobby `fra1` + Supabase EU — mesma região (latência <50ms entre serviços)

Sem conflitos.

**Pattern Consistency:**

- Naming snake_case (DB) ↔ camelCase (TS) com conversão limpa via PostgREST/aliasing
- Routes em PT (`/prontidao`) + APIs em EN (`/api/*`) — coerente
- `Result<T, E>` em Server Actions + Edge Functions com mesma forma JSON
- Logger 3-níveis + JSON estruturado consistente em toda a app

**Structure Alignment:**

- Camadas `ui → patterns → domain` mapeiam diretamente para `src/components/{ui,patterns,domain}/`
- Server Actions agrupadas por área; Edge Functions agrupadas por função
- Cross-cutting concerns têm localização clara
- Migrations numeradas refletem ordem de dependência

### Requirements Coverage Validation ✅

**Functional Requirements (50/50 MVP):**

| Área | FR count | Cobertura |
| --- | --- | --- |
| Identity, Access & Consent (FR1–FR11) | 11 | ✅ Completa |
| Player & Squad (FR12–FR16) | 5 | ✅ Completa (FR16 anonimização via pg_cron) |
| Calendar & Sessions (FR17–FR20) | 4 | ✅ Completa |
| Fatigue & Wellness (FR21–FR26) | 6 | ✅ Completa (offline outbox; sub-14 i18n) |
| Performance Recording (FR27–FR31) | 5 | ✅ Completa |
| Readiness Intelligence (FR32–FR41) | 10 | ✅ MVP / FR39–FR41 Growth |
| Notifications (FR42–FR45) | 4 | ✅ Completa (schedule-handler + send-push) |
| Compliance & Audit (FR46–FR54) | 9 | ✅ Completa |
| System Ops (FR55–FR59) | 5 | ✅ MVP / FR59 PDF Phase 2 |

**Non-Functional Requirements (60/60):**

- Performance (NFR1–NFR13) — materialized view, Server Components, bundle analyzer, Lighthouse CI
- Security (NFR14–NFR30) — TLS 1.3, RLS dia 1, JWT custom claims, MFA TOTP, audit logs, payload opaco, residência UE
- Scalability (NFR31–NFR35) — RLS multi-tenant ready, scaling triggers documentados
- Accessibility (NFR36–NFR44) — shadcn+Radix, axe-core CI, redundância sensorial, sub-14 i18n
- Reliability (NFR45–NFR52) — outbox + UUIDv7, heartbeat, backup semanal
- Maintainability (NFR54–NFR58) — cobertura ≥80%, TS strict, JSON logs, telemetria interna, provider-agnostic
- Browser & Platform (NFR59–NFR60) — WebView block via `lib/pwa/webview-detection.ts`

**UX Spec coverage:**

- Filosofia "dados mediados" enforced via RLS (FR3, FR26)
- Painel A + B com toggle — `<ReadinessPanel view>`
- Touchscreen sticky player — `<MatchEventCapture>` + Zustand
- Sub-14 language — `lib/i18n/pt-PT/` chaves `senior` / `u14`
- 14 padrões transversais do UX Step 12 — todos têm correspondência arquitetural

### Implementation Readiness Validation ✅

**Decision Completeness:** versões verificadas (Next.js 16.2, shadcn v4, PG 17), stack completo com comandos exatos, 14 regras invariantes em enforcement guidelines, anti-patterns explícitos.

**Structure Completeness:** ~120+ ficheiros e diretórios mapeados, 4 boundaries com matrizes, 8 integrações externas com protocolo + auth + failure mode, mapping FR → estrutura.

**Pattern Completeness:** naming (DB + Code + Routes + Edge Functions), communication (TanStack/Zustand split, optimistic updates, logger), process (loading/empty/error, auth, validation timing).

### Gap Analysis Results

#### Critical Gaps

**Nenhum.** Todos os FRs MVP e NFRs têm suporte arquitetural.

#### Important Gaps (diferíveis para Sprint 1 ou Phase 2)

1. **DPIA execution plan** — placeholder em `docs/compliance/dpia.md` mas processo (quem/quando/cobertura) não definido. Mitigação: runbook em `docs/compliance/dpia-execution-plan.md` Sprint 1.
2. **Production monitoring de NFRs** — Lighthouse pré-merge mas não em produção. Mitigação: Vercel Analytics free tier (first-party, não viola NFR22) Phase 2.
3. **Disaster recovery runbook** — backup definido mas restore não runbookable. Mitigação: `docs/architecture/runbooks/disaster-recovery.md` Sprint 1.
4. **Secret rotation policy** — sem cadência para `SUPABASE_SERVICE_ROLE_KEY`, VAPID, `RESEND_API_KEY`. Mitigação: `docs/compliance/secrets-rotation.md` com cadência anual + processo VAPID rotation (force re-subscribe).
5. **Email deliverability monitoring** — Resend integrado mas sem plano para bounces, spam, domain reputation. Mitigação: revisar Resend dashboard mensal; SPF/DKIM/DMARC ao adicionar domain próprio.
6. **iOS install rate KPI denominator** — `pwa_installed` event existe mas formula KPI ≥40% sem denominador. Mitigação: `count(distinct user_id installed in 30d) / count(distinct iOS user_id in 30d)` em `docs/architecture/kpis.md`.
7. **Anonimização test harness** — pg_cron job com risco catastrófico se mal escrito. Mitigação: vitest test para função `anonymize_inactive_players()` com fixtures; dry-run mode obrigatório no Sprint que entregar.
8. **Rate limiting de login** — Supabase Auth tem 6 tentativas/h/IP built-in (confirmar e documentar); adicional middleware custom Phase 2.

#### Nice-to-Have Gaps

1. ADRs não iniciadas (placeholder folder)
2. Load testing plan (gatilho 4º clube)
3. Manual a11y testing cadence (mensal/por release)
4. iOS device matrix explícito em `docs/architecture/test-devices.md`
5. Performance budget por rota (Phase 2)

### Validation Issues Addressed

Todos os 8 important gaps são **diferíveis sem bloquear implementação**. Recomendação operacional: abrir issues no repo após setup do projeto, com prioridade marcada por gap.

### Architecture Completeness Checklist

#### Requirements Analysis

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

#### Architectural Decisions

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

#### Implementation Patterns

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

#### Project Structure

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

**Resultado:** 16/16 itens checked.

### Architecture Readiness Assessment

**Overall Status:** **READY WITH MINOR GAPS**

Todos os 16 itens da checklist `[x]` e nenhum gap crítico. Os 8 important gaps são diferíveis para Sprint 1 (DPIA, runbooks, KPI denominator, anonimização tests) e Phase 2 (production monitoring, secret rotation policy formal). Arquitetura pronta para AI agents começarem a implementar; gaps refletem documentação operacional/governance, não decisões técnicas em falta.

**Confidence Level:** **High**

Razões:

- 9 documentos de input contextualizam todas as decisões
- Stack validado em pesquisa formal independente (May 2026)
- Pattern enforcement automatizável (axe-core, ESLint, vitest, Lighthouse CI)
- Cobertura completa: 50/50 FRs MVP, 60/60 NFRs

**Key Strengths:**

1. **Filosofia coerente em todas as camadas** — "dados mediados", "Calma > Excitação", "Glance > Read", "Reflex > Read" enforced no schema (RLS), patterns (CalmConfirmation), e processos
2. **Multi-tenant ready desde dia 1 sem custo operacional** — RLS + `club_id` em todas as tabelas
3. **Offline-first como first-class** — outbox + UUIDv7 + drain ladder + UX explícita
4. **GDPR Art. 9 + menores tratado seriamente** — consentimento parental verificável, tokenizado, com lifecycle completo
5. **Provider-agnostic preserved** — sem lock-in Vercel além de `next/*`
6. **Custo €0/mês credível** — todos componentes free tier validados; pontos de inflexão documentados
7. **Performance budget realista** — agregações server-side, Server Components default, Lighthouse CI
8. **Telemetria interna sem third-party** — `telemetry_events` + Server Action helper

**Areas for Future Enhancement:**

1. DPIA, runbooks operacionais, KPI denominators (important gaps)
2. Production monitoring de Web Vitals (Phase 2)
3. ADR formal para decisões pós-MVP
4. Performance budget por rota (Phase 2)
5. Observability avançada — Sentry, distributed tracing — Phase 2
6. Secret rotation cadence documentada e exercitada
7. Capacitor wrap se iOS install <40% no mês 2
8. Multi-clube ativo com Pro plan ou self-host (Phase 2; gatilho 4º clube)

### Implementation Handoff

**AI Agent Guidelines:**

Todos os AI agents que implementem este projeto MUST:

1. Seguir as decisões deste documento literalmente — não substituir tecnologias sem proposta explícita
2. Usar os patterns de Step 5 — `Result<T, E>`, snake_case ↔ camelCase, sem barrel files, layer respect
3. Respeitar a estrutura de Step 6 — paths exatos, nomes de ficheiros, agrupamentos
4. Verificar a checklist de PR (UX Spec Step 12 + Implementation Patterns Step 5) antes de cada commit
5. Refrescar este documento quando alguma decisão mudar — único source of truth da arquitetura

**First Implementation Priority (Sprint 1 — primeira semana):**

```bash
# 1. Project init
npx create-next-app@latest sparta \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm
cd sparta

# 2. shadcn/ui + Supabase + offline + state + forms + dates + charts + tests
npx shadcn@latest init
npm install @supabase/supabase-js @supabase/ssr @serwist/next dexie \
            @tanstack/react-query @tanstack/react-query-persist-client \
            @tanstack/query-sync-storage-persister zustand \
            react-hook-form zod @hookform/resolvers \
            date-fns recharts uuid
npm install -D vitest @vitest/ui jsdom \
              @testing-library/react @testing-library/jest-dom \
              vitest-axe eslint-plugin-jsx-a11y

# 3. Supabase project (EU region) + DPA acceptance
supabase login
supabase init
supabase projects create sparta --region eu-west-1

# 4. Initial migrations (000000–000160)
# Ver supabase/migrations/ — sequência documentada em Step 6

# 5. CI/CD setup
# Copiar .github/workflows/{ci,heartbeat,backup}.yml

# 6. First feature: Login + Painel de Prontidão (defining experience)
# Sprint 2 do roadmap UX Step 11
```
