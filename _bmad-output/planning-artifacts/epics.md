---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# SPARTA - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for SPARTA, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Identity, Access & Consent Management**

- FR1: Treinador, Analista e Jogador podem autenticar-se com email + password e recuperar password via email. [MVP]
- FR2: Sistema atribui um e apenas um papel (Treinador, Analista, Jogador) a cada conta autenticada. [MVP]
- FR3: Sistema enforça permissões por papel: Jogador acede apenas aos seus próprios dados; Analista e Treinador acedem a todos os dados do plantel; nenhum papel acede a dados de outros clubes (multi-tenant). [MVP]
- FR4: Sistema bloqueia acesso de jogador menor (13–15 anos) até confirmação parental verificável. [MVP]
- FR5: Encarregado de Educação pode confirmar consentimento parental através de link tokenizado por email, sem criar conta. [MVP]
- FR6: Sistema regista cada confirmação de consentimento com timestamp, IP de origem e versão da política aceite. [MVP]
- FR7: Sistema reenvia automaticamente o pedido de consentimento ao 7º e 14º dia se não recebido, e notifica staff após 14 dias. [MVP]
- FR8: Encarregado de Educação pode retirar consentimento, exportar ou apagar dados do menor a qualquer momento. [MVP]
- FR9: Jogador adulto (16+) pode retirar o seu próprio consentimento, exportar ou apagar dados sem mediação. [MVP]
- FR10: Sistema notifica titular ao atingir 18 anos para reconfirmar consentimento; sem reconfirmação em 90 dias, anonimiza automaticamente. [Growth]
- FR11: Sistema activa MFA opcional para Treinador e Analista no MVP, com possibilidade de tornar obrigatório por configuração. [MVP, escalonamento Growth]

**Player & Squad Management**

- FR12: Analista pode criar, editar e arquivar registos de jogadores (nome, idade, número, foto, escalão, posição principal e até 4 alternativas). [MVP]
- FR13: Analista pode registar múltiplas leituras de peso e altura por jogador formando série temporal. [MVP]
- FR14: Treinador e Analista podem consultar perfil consolidado de jogador (séries fadiga, peso, altura, ACWR, presenças, estatísticas). [Growth — perfil unificado]
- FR15: Analista pode marcar jogadores como inativos sem apagar histórico. [MVP]
- FR16: Sistema preserva histórico de jogadores que saem do clube por 5 épocas, depois anonimiza. [MVP — política; Growth — automatização]

**Calendar & Session Management**

- FR17: Treinador pode criar, editar e cancelar sessões (treino, jogo, jogo amigável) com data, hora e tipo. [MVP]
- FR18: Treinador pode definir convocados e equipa inicial para cada jogo. [MVP]
- FR19: Analista pode registar substituições durante o jogo; sistema deriva automaticamente minutos jogados. [MVP]
- FR20: Treinador e Analista podem criar e gerir épocas e visualizar dados filtrados por época ou cumulativos. [MVP]

**Fatigue & Wellness Tracking**

- FR21: Jogador responde a questionário de fadiga com 5 dimensões (energia muscular, concentração, sono, desconforto, estado emocional) antes/depois de cada sessão. [MVP]
- FR21a: Questionário pré-sessão inclui novo campo de **estado emocional/humor** (escala com emojis). [MVP]
- FR21b: Questionário pós-sessão inclui novo campo de **dores musculares específicas** com seleção de zona do corpo (pescoço, ombro, cotovelo, punho, costas, anca, joelho, tornozelo, tendão de aquiles, outra). [MVP]
- FR21c: Sistema regista **flag booleano "tem testes/exames esta semana?"** como contexto de carga. [MVP]
- FR22: Sistema apresenta versão linguisticamente adaptada do questionário aos jogadores sub-14 (incluindo escalas emocionais com pictogramas). [MVP]
- FR23: Jogador pode submeter o questionário em offline; sincroniza ao recuperar conectividade. [MVP]
- FR24: Sistema mostra contagem de submissões pendentes e permite forçar sincronização. [MVP]
- FR25: Treinador e Analista podem consultar respostas e tendências históricas de fadiga, bem-estar e dores musculares por jogador. [MVP]
- FR26: Jogador NÃO pode aceder ao seu Painel de Prontidão, Curva de Recuperação ou relatórios — entregues exclusivamente via staff. [MVP — decisão deliberada]

**Performance Recording**

- FR27: Analista pode registar eventos via touchscreen com 3 ecrãs sequenciais (jogador → ação → zona) cobrindo métricas individuais (perdas com zona de construção: Z1/Z2, recuperações com zona: Z1/Z2/Z3, remates totais e enquadrados com zona, passes completados, pressões defensivas, ações defensivas/ofensivas com sucesso) e métricas táticas (cantos defensivos/ofensivos com parte e lado do campo, entradas na área adversária vs. permitidas na nossa área). [MVP]
- FR27a: Sistema regista contexto completo de golos (parte, zona, período do jogo, tipo de jogada: canto/jogada corrida/livre direto/outro, atleta envolvido). [MVP]
- FR27b: Sistema regista cartões (amarelos e vermelhos) com tipo de infração (palavra/falta) e zona do campo. [MVP]
- FR27c: Sistema calcula e apresenta **clean sheet** (minutos sem sofrer golos) como agregação de jogo. [MVP]
- FR27d: Sistema oferece 2 relógios configuráveis para registar **tempo de jogo útil** (tempo total vs. tempo com bola em jogo). [MVP]
- FR28: Analista pode registar eventos em offline; sistema sincroniza sem perda de dados. [MVP]
- FR29: Analista pode editar ou apagar eventos registados por engano dentro de janela configurável após sessão. [MVP]
- FR30: Analista pode registar presença e ausência de jogadores em sessões de treino. [MVP]
- FR31: Analista pode registar Session-RPE (1–10 × duração) para cada jogador no fim de cada sessão. [MVP]
- FR31a: Sistema calcula automaticamente **% de convocatórias por atleta** (época/carreira) e **% minutos por atleta** (época/carreira). [MVP]

**Readiness Intelligence & Analytics Dashboards**

- FR32: Sistema calcula automaticamente o ACWR (rácio carga aguda 7d / crónica 28d) por jogador com limiares por escalão etário. [MVP]
- FR33: Sistema calcula sRPE (Session-RPE × duração) por sessão e mantém histórico cumulativo. [MVP]
- FR34: Treinador pode consultar Painel de Prontidão com semáforo verde/amarelo/vermelho por jogador. [MVP]
- FR35: Treinador pode fazer drill-down a partir do Painel para detalhe individual com séries de fadiga e ACWR das últimas 4 semanas. [MVP]
- FR36: Sistema atualiza Painel em tempo real durante a janela de 4 horas anterior a sessão agendada. [MVP]
- FR37: Analista pode consultar dashboard de tendências individuais de fadiga das últimas 4 semanas. [MVP]
- FR37a: Analista pode consultar dashboard de tendências de bem-estar (humor, sono, dores musculares) com correlação a performance ou carga. [Growth]
- FR38: Analista pode consultar dashboard de carga acumulada por jogador na época atual. [MVP]
- FR38a: Analista pode consultar dashboard de estatísticas por jogador (ações históricas com filtros: época, tipo de ação, zona do campo). [Growth]
- FR38b: Analista pode consultar dashboard de análise tática (agregações de cantos, entradas na área, clean sheets, cartões, tempo de jogo útil). [Growth]
- FR38c: Analista pode consultar dashboard de eficiência de zona (onde a equipa perde/recupera bola, onde remata, onde sofre golos, com heatmaps). [Growth]
- FR38d: Analista pode consultar dashboard de disciplina (histórico de cartões com tipo de infração, zona, e identificação de tendências). [Growth]
- FR38e: Analista pode consultar dashboard de golos (detalhe de golos marcados e sofridos com tipo de jogada, período, zona, atleta envolvido). [Growth]
- FR39: Sistema deteta correlações individuais entre fadiga e desempenho estatístico. [Growth]
- FR40: Sistema gera Curva de Recuperação Individual mostrando trajectória de fadiga após sessão intensa. [Growth]
- FR41: Treinador pode consultar Dashboard de Equipa Agregado (média fadiga, presença, estatísticas agregadas, índices de disciplina). [Growth]

**Notifications & Reminders**

- FR42: Sistema envia push notification ao Jogador X minutos antes e Y minutos depois de cada sessão (X/Y configuráveis pelo staff). [MVP]
- FR43: Sistema envia push com payload opaco (texto genérico, sem dados de saúde) e deep link autenticado. [MVP]
- FR44: Jogador pode subscrever ou cancelar push notifications a qualquer momento; cancelamento não bloqueia acesso. [MVP]
- FR45: Sistema envia email transacional para consentimento parental e para confirmações de exportação/apagamento. [MVP]

**Compliance, Audit & Data Rights**

- FR46: Titular pode solicitar exportação de dados em CSV estruturado (todos os dados pessoais e biométricos). [MVP]
- FR47: Titular pode solicitar apagamento; sistema executa em cascata em ≤30 dias. [MVP]
- FR48: Titular pode solicitar retificação de dados pessoais; staff regista alteração com log auditável. [MVP]
- FR49: Titular pode marcar conta como "tratamento limitado" — sistema congela operações sem apagar histórico. [MVP]
- FR50: Sistema regista log auditável de cada acesso a dados de saúde por staff (quem, o quê, quando), retido por 12 meses. [MVP]
- FR51: Titular pode consultar quem acedeu aos seus dados de saúde nos últimos 12 meses. [MVP]
- FR52: Treinador e Analista podem documentar uma "decisão data-driven" no perfil do jogador (nota livre + flag boolean). [MVP — KPI de validação]
- FR53: Sistema apresenta versão linguisticamente adaptada da política de privacidade a titulares 13–15 anos. [MVP]
- FR54: Sistema mantém versão histórica de cada política aceite, ligada ao registo de consentimento. [MVP]

**System Operations & Resilience**

- FR55: Sistema mantém heartbeat externo automático para impedir pausa por inatividade da BD. [MVP]
- FR56: Sistema gera backup completo da BD com periodicidade semanal, retido por 12 semanas. [MVP]
- FR57: Sistema apresenta página de erro amigável para browsers não suportados, com instruções. [MVP]
- FR58: Sistema bloqueia uso em WebView in-app (Facebook, Instagram, WhatsApp) com mensagem para abrir no browser nativo. [MVP]
- FR59: Treinador e Analista podem gerar e partilhar relatórios PDF individuais; partilha mediada pelo staff. [Growth]

### NonFunctional Requirements

**Performance**

- NFR1: Painel de Prontidão carrega em ≤2s (P95) para 40 jogadores, incluindo agregações ACWR/sRPE.
- NFR2: Submissão de questionário completa em ≤500ms (P95) em conexão online normal.
- NFR3: Drain completo da outbox offline em ≤5s para até 50 eventos pendentes em 4G.
- NFR4: Dashboard de tendências 4 semanas — primeiro paint ≤1s; dados completos ≤3s (P95).
- NFR5: Recálculo de ACWR para grupo de 18 convocados em ≤3s após registo de sessão.
- NFR6: Time to Interactive (TTI) ≤3s em 4G normal mobile.
- NFR7: First Contentful Paint (FCP) ≤1,5s em 4G normal.
- NFR8: Largest Contentful Paint (LCP) ≤2,5s.
- NFR9: Cumulative Layout Shift (CLS) ≤0,1.
- NFR10: Total Blocking Time (TBT) ≤200ms.
- NFR11: Bundle inicial ≤200KB gzipped (shell PWA + auth).
- NFR12: Cold start em modo offline (PWA instalada) ≤2s.
- NFR13: Lighthouse mínimo em CI: Performance ≥85, Accessibility ≥90, Best Practices ≥95, PWA ≥100.

**Security**

- NFR14: Toda comunicação cliente-servidor usa TLS 1.3+.
- NFR15: Dados em repouso encriptados (Postgres at-rest encryption Supabase).
- NFR16: Row-Level Security (RLS) ativada em todas as tabelas com dados pessoais ou de saúde.
- NFR17: Sessões de autenticação expiram após 1h inatividade (access token); refresh token expira após 30 dias.
- NFR18: Logout forçado após mudança de password; tokens anteriores invalidados.
- NFR19: MFA disponível para Treinador/Analista no MVP, obrigatório a partir da Growth phase.
- NFR20: Logs de acesso a dados de saúde retêm-se por 12 meses, auditáveis pelo titular.
- NFR21: Push notifications nunca contêm dados de Art. 9 RGPD; texto opaco com deep link autenticado.
- NFR22: Sistema não usa analytics third-party (Google Analytics, Mixpanel, etc.).
- NFR23: UUIDs como chaves primárias; nomes apenas em UI autenticada.
- NFR24: Recolha de dados de saúde requer base jurídica documentada (RGPD Art. 9(2)(a)) e DPIA assinada antes do release.
- NFR25: Dados de jogadores 13–15 anos exigem consentimento parental verificável (token, IP, timestamp, política aceite).
- NFR26: Direito ao apagamento processado em ≤30 dias com cascata.
- NFR27: Direito de acesso/portabilidade processado em ≤30 dias em CSV estruturado.
- NFR28: Direito de retificação processado em ≤7 dias com log auditável.
- NFR29: Direito de oposição/retirada de consentimento processado de forma imediata.
- NFR30: Toda infraestrutura em regiões UE (Supabase EU, Vercel `fra1`, Resend EU).

**Scalability**

- NFR31: Sistema suporta 1 clube com 40 jogadores + 5 staff no MVP, com 100% de funcionalidades.
- NFR32: Arquitetura suporta até 3 clubes em multi-tenancy partilhada sem alteração de código, dentro do free tier (DB ≤500MB; Realtime ≤200 conexões).
- NFR33: Sistema dispara revisão automática de tier ao atingir 4 clubes ativos ou 80% de qualquer limite gratuito Supabase.
- NFR34: Operações concorrentes em pico de matchday (até 50 conexões Realtime) não degradam performance.
- NFR35: Volume ≤100MB por clube; arquiva épocas com >5 anos para tabelas comprimidas.

**Accessibility**

- NFR36: Sistema cumpre WCAG 2.1 nível AA pragmático em fluxos críticos (login, questionário, painel, consentimento).
- NFR37: Contraste de texto ≥4,5:1 (normal); ≥3:1 (texto grande). Validado por axe-core no CI.
- NFR38: Fluxos críticos navegáveis por teclado, com focus rings visíveis.
- NFR39: Controlos interativos com rótulos ARIA, roles semânticos e headings hierárquicos.
- NFR40: Botões e controlos interativos com tamanho de toque ≥44×44px.
- NFR41: Sistema respeita `prefers-reduced-motion` para todas as animações.
- NFR42: Linguagem de UI usa CEFR ≤B1 como teto; tooltips para terminologia técnica (ACWR).
- NFR43: Versão linguisticamente adaptada existe para política, questionário e prompts dirigidos a menores 13–15.
- NFR44: Imagens têm sempre `alt` text; fotos de jogadores usam o nome como alt.

**Reliability & Availability**

- NFR45: Disponibilidade ≥99% em janelas de jogo e treino.
- NFR46: Modo offline cobre indisponibilidade transitória — questionários e eventos funcionam sem rede; sincronização garantida.
- NFR47: Submissão offline chega ao servidor após reconexão em ≤24h.
- NFR48: Sistema não permite submissões duplicadas — UUIDv7 client-generated + upsert idempotente.
- NFR49: Heartbeat externo automático com periodicidade ≤6 dias.
- NFR50: Sistema dispara alerta após 2 falhas consecutivas do heartbeat.
- NFR51: Backups completos semanais, retidos por 12 semanas.
- NFR52: Sistema suporta perda de telemóvel sem perda de dados — outbox órfã detetada e utilizador avisado.

**Integration**

- NFR53: Sistema não tem integrações externas obrigatórias para a lógica de negócio no MVP.

**Maintainability & Observability**

- NFR54: Cobertura de testes ≥80% nas funções críticas (ACWR, sRPE, Painel, mutations da outbox).
- NFR55: TypeScript estrito (`"strict": true`, `"noUncheckedIndexedAccess": true`); sem `any` exceto fronteiras documentadas.
- NFR56: Logs estruturados (JSON) para eventos críticos: auth, mutations de saúde, exportações, apagamentos, sync.
- NFR57: Sistema mantém telemetria interna (Postgres) dos KPIs de produto.
- NFR58: Código provider-agnostic em fronteiras críticas — zero imports `@vercel/*` para além de `next/*`.

**Browser & Platform Compatibility**

- NFR59: Sistema funciona em Chrome (últimas 2), Safari iOS 16.4+, Safari macOS (últimas 2), Firefox (últimas 2), Edge (últimas 2), Samsung Internet (últimas 2).
- NFR60: Sistema bloqueia WebView in-app e browsers sem Service Worker (Opera Mini, UC Browser, IE 11).

---

## Implementation Stories — Sprint 1.5: Wellness & Analytics Expansion

### Technical Infrastructure Stories

**T1.5.1 — Database Schema Expansion: Wellness + Analytics**
- [ ] Apply migration `20260509_wellness_analytics_expansion.sql`
- [ ] Verify all indexes created (performance validation)
- [ ] Add RLS policies for new tables (fatigue_responses, performance_events)
- [ ] Test data integrity constraints (muscle_pain_zones required on post-session, player_id checks for team events)
- [ ] Estimate: 2 days backend

**T1.5.2 — Materialized Views: Athlete Stats & Clean Sheet Aggregations**
- [ ] Implement `v_athlete_stats_per_season` (% convocations, % minutes, per season per player)
- [ ] Implement `v_clean_sheets` (goals analysis, minutes without conceding)
- [ ] Add triggers for incremental refresh on substitution/goal record
- [ ] Performance benchmark: query <500ms for 40 players
- [ ] Estimate: 1 day backend

**T1.5.3 — RLS Validation & Testing**
- [ ] Audit: CI lint check for all new queries with `club_id` scoping
- [ ] Test suite: RLS policies with different JWT claims (player, analyst, coach)
- [ ] Validate: jogador never sees wellness data post-submission
- [ ] Validate: jogador cannot INSERT performance_events
- [ ] Estimate: 1 day backend

**T1.5.4 — Sync & Outbox Tests (Idempotência)**
- [ ] Test outbox with new fields (mood, muscle_pain_zones, has_exams_this_week, context JSON)
- [ ] Test replay idempotent with UUIDv7 client-generated IDs
- [ ] Test JSON null fields handling (muscle_pain_zones in pre-session)
- [ ] Test performance_events with polymorphic context
- [ ] Estimate: 1.5 days backend/frontend

**T1.5.5 — Performance Benchmarking & Tuning**
- [ ] Benchmark: Painel ≤2s confirmed with 40 jogadores (real or synthetic data)
- [ ] Benchmark: aggregation queries <500ms
- [ ] Validate: GIN indexes on context JSONB performant
- [ ] Lighthouse CI: Performance ≥85, bundle ≤200KB
- [ ] Estimate: 1 day devops/backend

### Frontend Components Stories

**T1.5.6 — Body Diagram Component (SVG Custom)**
- [ ] Implement `BodyDiagram.tsx` with 10 muscle pain zones (SVG custom, zero npm dependency)
- [ ] Offline functional (DOM only, no external assets)
- [ ] Accessibility: aria-labels for each zone
- [ ] UX test with sub-14: zone comprehension, touch targets ≥44px
- [ ] Estimate: 1.5 days frontend

**T1.5.7 — Mood Scale Component (Emoji)**
- [ ] Implement `MoodScale.tsx` with 5 emoji buttons (😢 😐 😊 😄 😃)
- [ ] Integration with React Hook Form
- [ ] Accessibility: aria-labels in PT-PT
- [ ] Estimate: 0.5 days frontend

**T1.5.8 — Exams Toggle**
- [ ] Implement `ExamsToggle.tsx` (boolean flag, weekly context)
- [ ] Layout: explanatory note "Impacta o treino da semana"
- [ ] Estimate: 0.25 days frontend

**T1.5.9 — Wellness Questionnaire Integration**
- [ ] Integrate BodyDiagram + MoodScale + ExamsToggle in pré/pós-questionnaire
- [ ] Update questionnaire layout for 3 new fields
- [ ] Verify: completion time ≤2.5 min (P95)
- [ ] Offline sync test: outbox with new fields
- [ ] Estimate: 1.5 days frontend

**T1.5.10 — Touchscreen Recorder V2: 4º Ecrã Condicional**
- [ ] Refactor `TouchscreenRecorder.tsx` for conditional 4th screen
- [ ] Screen 1: 11 players + "Equipa" button (sticky for collective events)
- [ ] Screen 2: Expanded actions (7 original + corner, card, goal, entry_*)
- [ ] Screen 3: 6 universal zones (field_zone_enum)
- [ ] Screen 4: Context screen ONLY for goal/card (play_type, period, infraction)
- [ ] Performance: ≤1s per event (heuristic)
- [ ] Offline: outbox with new event_type + context JSON
- [ ] Estimate: 3 days frontend

**T1.5.11 — Match Time Recorders (Pós-Jogo)**
- [ ] Implement `MatchTimeRecorders.tsx` (2 inputs: total_minutes, useful_minutes)
- [ ] Validation: 0–90 range
- [ ] Storage: `performance_events` with `event_type='match_time_record'` + context JSON
- [ ] Estimate: 0.5 days frontend

### Documentation & Testing

**T1.5.12 — Documentation Update**
- [ ] Update API docs with new event_types (corner, goal, card, entry_opp_area, entry_own_area)
- [ ] Update schema diagram (new field_zone_enum, performance_events context)
- [ ] Update migration guide (apply migration, refresh views, test RLS)
- [ ] Estimate: 0.5 days documentation

---

### Sprint 1.5 Totals
- **Estimated effort:** 40–45 hours (5–6 days, one full-time backend + one full-time frontend)
- **Dependencies:** None (architecture independent)
- **Go/No-Go Criteria:** All performance benchmarks pass, all RLS tests pass, no integration blockers from GDPR review

### Growth Features (Post-MVP, meses 2–6)

Analytics Dashboards & Reporting:

### Additional Requirements

**Starter Template & Initialization (Architecture Step 3)**

- AR1: Inicialização via `create-next-app` com flags fixas (`--typescript`, `--tailwind`, `--eslint`, `--app`, `--src-dir`, `--import-alias "@/*"`, `--use-npm`) seguida de setup manual sequencial — registado como história Sprint 1, Story 1.
- AR2: Stack instalado por sequência determinista: shadcn/ui (init), `@supabase/supabase-js` + `@supabase/ssr`, `@serwist/next`, `dexie`, `@tanstack/react-query` + persist-client + sync-storage-persister, `zustand`, `react-hook-form` + `zod` + `@hookform/resolvers`, `date-fns`, `recharts`, infra de testes (`vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `vitest-axe`, `eslint-plugin-jsx-a11y`).
- AR3: Build dev e prod via Webpack (Serwist incompatível com Turbopack). Tailwind v4 CSS-first via `@theme` em `globals.css`.

**Data Architecture & Persistence**

- AR4: UUIDv7 client-generated via `uuid` v9+ (`v7()`) como source of truth; função PL/pgSQL `uuidv7()` como fallback server-side (Edge Functions, batch jobs, seeds).
- AR5: Schema topológico de ~16 tabelas core: `clubs`, `profiles`, `parental_consents`, `players`, `player_metrics`, `positions`, `seasons`, `sessions`, `match_lineups`, `attendances`, `fatigue_responses`, `match_events`, `session_metrics`, `readiness_snapshots`, `audit_logs`, `data_decisions`, `telemetry_events`, `push_subscriptions`, `notification_log`.
- AR6: Migrations via Supabase CLI (`supabase/migrations/*.sql`) versionadas em git, naming `YYYYMMDDHHMMSS_<description>.sql`, sem ORM (SQL puro).
- AR7: CI valida que `supabase db reset` corre sem erros antes de merge (job `migration-validate`).
- AR8: RLS habilitada em todas as tabelas com PII/saúde — sem exceções, lint check no CI.
- AR9: `club_id` em todas as tabelas com dados pessoais; índice `club_id` em todas as tabelas para NFR1.
- AR10: `with check` obrigatório em writes RLS — prevenir cross-tenant insert.

**Auth & Security Plumbing**

- AR11: JWT custom claims (`club_id`, `role`) injetados via Supabase Auth Hook; pré-condição para todas as RLS policies.
- AR12: Helpers `auth.club_id()` e `auth.user_role()` em PL/pgSQL para uso nas policies.
- AR13: Service-role client (Edge Functions) bypassa RLS — usar APENAS para fluxos com auth alternativa (token consentimento, batch jobs).
- AR14: Middleware Next.js para refresh de sessão Supabase em rotas autenticadas.
- AR15: Helpers `lib/supabase/{client,server,middleware,service-role}.ts` provider-agnostic.

**API & Edge Functions**

- AR16: Server Actions para mutations não-críticas; Edge Functions para fluxos especializados: `send-push`, `consent-validate`, `exporta-csv`, `delete-cascade`.
- AR17: Route handlers em `/api/*` apenas para webhooks/streams.

**Offline Sync Engine**

- AR18: Outbox em IndexedDB (Dexie) em `lib/outbox/` com drain por foreground; UUIDv7 idempotente; upsert no servidor.
- AR19: Service worker via Serwist (`app/sw.ts`) — pré-condição para PWA install + push.
- AR20: Detecção e aviso de outbox órfã antes de logout (NFR52).

**Compliance Plumbing**

- AR21: Tabela `audit_logs` com triggers para registo automático de acessos a dados de saúde (FR50).
- AR22: Tabela `data_decisions` para FR52 (KPI auditável de decisões data-driven).
- AR23: pg_cron jobs mensais para retenção e anonimização (5 épocas, NFR16, FR16, FR10).
- AR24: DPA assinado com Supabase + DPIA documentado antes do release ao plantel-piloto.

**Notifications**

- AR25: Web Push (VAPID) via biblioteca `web-push`; subscriptions em tabela `push_subscriptions`.
- AR26: Resend EU para emails transacionais (consentimento parental, confirmações exportação/apagamento) com templates React Email server-rendered.

**CI/CD & Operations**

- AR27: GitHub Actions workflow `heartbeat.yml` cron `0 12 */6 * *` consultando service-role; alerta em duas falhas consecutivas.
- AR28: GitHub Actions workflow `backup.yml` cron `0 3 * * 0` (semanal) — `pg_dump` + encriptação com chave separada + push para repo privado, retido 12 semanas.
- AR29: GitHub Actions workflow `ci.yml` em `pull_request` e `push:main` — lint (ESLint+Prettier), typecheck (`tsc --noEmit`), test (`vitest run --coverage`), axe-core (`vitest-axe`), build (`next build`), bundle-size check (≤200KB gzipped initial), lighthouse-ci (P≥85, A11y≥90, BP≥95, PWA≥100), `migration-validate`.
- AR30: Secrets management via Vercel env vars, Supabase Edge Functions secrets e GitHub Actions secrets — `.env*` excluídos do git exceto `.env.example`.

**Telemetry & Observability**

- AR31: Tabela `telemetry_events` + Server Action helper `logTelemetry()` em momentos-chave (`survey_submitted`, `panel_viewed`, `decision_marked`, `pwa_installed`, `app_uninstall`, etc.) — sem analytics third-party (NFR22, NFR57).
- AR32: Logs JSON estruturados em Vercel + Supabase para eventos críticos (NFR56).

**Implementation Sequence (Sprint 1 hard order)**

- AR33: Ordem obrigatória de implementação Sprint 1: (1) Project init, (2) Supabase project EU + DPA + DPIA inicial, (3) Schema migrations (tabelas core → RLS policies → funções derivadas), (4) Auth setup + middleware + helpers `lib/supabase/`, (5) JWT custom claims hook, (6) Outbox + sync engine, (7) Telemetry + audit_logs + data_decisions tables + Server Action helpers, (8) CI/CD workflows.

### Visual Design Reference (Obrigatório em todas as stories de UI)

**DIRECTIVA GLOBAL:** Todas as stories que implementem ecrãs visíveis ao utilizador DEVEM referenciar e respeitar os mockups em `docs/ux-design/`. O sistema visual é definido por `docs/ux-design/profile-shared.jsx` (tokens `PR_TOKENS_LIGHT`/`PR_TOKENS_DARK`) e pelos ficheiros PNG de cada ecrã. Suporte a **modo claro e escuro** é obrigatório em todos os ecrãs, activado exclusivamente via `prefers-color-scheme` (sem toggle de utilizador).

| Mockup | Ecrã | Story |
|--------|------|-------|
| `profile-mobile-a/b.jsx`, `profile-desktop.jsx` | Perfil Unificado de Jogador | Epic 7, Story 7-2 |
| `Variação A Linear` (3 PNGs) | Touchscreen: Jogador → Ação → Zona | Epic 6, Stories 6-1/6-2/6-3 |
| `Variação A Emoji Daylio` (2 PNGs) | Questionário de Fadiga — versão sub-14 | Epic 4, Story 4-3 |
| `Variação B Slider Numérico` (PNG) | Questionário de Fadiga — versão sénior | Epic 4, Story 4-2 |
| `Variação A Semana + Variação B Mês` (2 PNGs) | Calendário (semana + mês) | Story 2-11 |
| `Reports Viewer 3 tabs` (PNG) | Relatórios PDF/visualização | Epic 7, Story 7-6 |
| `Workload Manager Cards + Graphs` (PNG) | Gestão de Carga / Painel | Epic 5, Stories 5-4/5-8/5-9 |

**Tipografia obrigatória (a partir de Story 1-17):**
- UI principal: `Inter Tight` (400/500/600/700)
- Numerics/stats/mono: `JetBrains Mono` (400/500/600)

**Paleta de tokens obrigatória (a partir de Story 1-17):** Ver `globals.css` — tokens `--color-ink-*`, `--color-surface-*`, `--color-hairline-*`, `--color-field`, `--color-signal-*-bg`, `--color-signal-*-ink`.

---

### UX Design Requirements

**Design Tokens & Foundation (UX Step 8 + 11)**

- UX-DR1: Tokens de cor estabilizados em `globals.css` — paleta semântica completa com `signal/` (verde `#16A34A`/`#22C55E`, amarelo `#CA8A04`/`#EAB308`, vermelho `#DC2626`/`#EF4444`, azul info `#2563EB`/`#3B82F6`), `ink/` (4 níveis), `surface/` (2 níveis), `hairline/` (normal+forte), `field` (#10B981 para SVGs de campo), signal background/foreground pairs; light/dark via `prefers-color-scheme` apenas (sem toggle utilizador). Baseline em Story 1-17.
- UX-DR2: Tokens de tipografia: `font/sans` **Inter Tight** via `next/font/google`, `font/mono` **JetBrains Mono** via `next/font/google`; type scale 10/12/14/16/18/20/24/30 + `display-1` 48px, `display-2` 64px; pesos 400/500/600/700. Baseline em Story 1-17.
- UX-DR3: Tokens de espaçamento Tailwind base 4px; touch targets ≥44px (≥60px no touchscreen em jogo); border-radius 2/6/12/full; sombras só `sm` e `md`; animação 150ms ease-out (200ms modal enter; 0ms touchscreen em jogo); breakpoints sm 360 / md 414 / lg 768 / xl 1024 / 2xl 1280; z-index escala fixa 0/10/20/30/40/50.
- UX-DR4: Tokens de iconografia: lucide-react com tamanhos 16/20/24/32px, stroke 1.5 default e 2 em ações primárias, cor `currentColor`, ícones específicos do semáforo (`check-circle-2`, `alert-triangle`, `alert-octagon`, `circle-dashed`).

**Pattern Components (`src/components/patterns/`)**

- UX-DR5: `<SemaforoBadge>` — indicador semafórico universal (ready/caution/alert/neutral) com redundância sensorial cor + ícone + forma; variantes sm/md/lg.
- UX-DR6: `<DrillDownSheet>` — sheet ascendente padrão sobre `Sheet` shadcn com swipe-down nativo iOS, focus trap, ESC fecha, restore focus on close.
- UX-DR7: `<PendingBadge>` — indicador "X pendentes" persistente para outbox offline, cor `signal/info`, `aria-live="polite"`.
- UX-DR8: `<EmptyState>` — estado vazio explicativo (ícone + título + descrição + CTA opcional), nunca apologético.
- UX-DR9: `<TooltipExplain>` — tooltip pedagógico para termos técnicos (ACWR, sRPE) com termo sublinhado pontilhado + popover com definição B1 + opcional fórmula em mono.
- UX-DR10: `<HapticButton>` — wrapper sobre `<Button>` com `navigator.vibrate()` e fallback silencioso.
- UX-DR11: `<CalmConfirmation>` — confirmação não-celebratória (banner discreto fade-in 200ms, auto-dismiss 1500ms) substituindo toasts "🎉".

**Domain Components (`src/components/domain/`)**

- UX-DR12: `<ReadinessPanel>` — ecrã principal do treinador com glance value (3 números agregados typography 48px) + lista por posição (default) OU formação via toggle; `view: "list" | "formation"`; performance ≤2s para 40 jogadores (NFR1).
- UX-DR13: `<PlayerRow>` — linha individual de jogador (nome, número, escalão, ACWR, semáforo); variantes `compact` (default) e `expanded` (Phase 2).
- UX-DR14: `<GlanceCard>` + `<PositionGroup>` — cards de agregados no header e agrupamento por posição (GR/DEF/MED/AVA) no Painel.
- UX-DR15: `<FieldFormation>` — SVG do campo 2D com 11 titulares posicionados; Phase 1 apenas 4-3-3.
- UX-DR16: `<FatigueQuestionnaire>` — questionário 5 dimensões com autosave debounce 800ms por slider, recovery de respostas parciais via IndexedDB, UUIDv7 idempotente.
- UX-DR17: `<FatigueSlider>` — slider 1–5 com snap discreto (sem ajuste contínuo), extremos rotulados ("Esgotado | Pleno"), adaptação `ageGroup="u14"` que simplifica copy ("Cansado | Cheio de energia"); `role="slider"`, navegação por teclado, `aria-valuetext` legível.
- UX-DR18: `<MatchEventCapture>` (touchscreen B sticky player + stack) orquestrando `<PlayerGrid>` + `<ActionList>` + `<ZoneSelectorSheet>`; estado global em Zustand; outbox em IndexedDB; alvos ≥60×60px; zero animações em fluxo reflexo independentemente de OS preference.
- UX-DR19: `<PlayerGrid>` — grid 4×3 de 11 titulares para seleção rápida com `aria-label` por jogador (nome + número + posição + escalão).
- UX-DR20: `<ActionList>` — grid 2×4 de 8 ações com border esquerda colorida (`signal/ready` para positivas, `signal/alert` para negativas).
- UX-DR21: `<ZoneSelectorSheet>` — modal ascendente com SVG meio-campo + grelha 3×3 tappable, `role="grid"` + ARIA labels.
- UX-DR22: `<RecentEventsRing>` — footer com últimos 6 eventos do touchscreen para auditoria mental rápida.
- UX-DR23: `<ParentalConsentEmail>` — template HTML server-rendered via Resend, ≤50KB, inline-CSS, fallback plain-text, B1, ≤200 palavras.
- UX-DR24: `<ConsentLandingPage>` — página `/consentimento/[token]` server-rendered, progressively enhanced (funciona sem JS); estados `valid` / `expired` / `invalid`.
- UX-DR25: `<DataDrivenDecisionInput>` — UI discreta para FR52 (botão pequeno no rodapé do drill-down → expande para textarea + checkbox), opcional, sem nudge persistente.

**Navegação & Estrutura**

- UX-DR26: Bottom tab bar fixa em mobile sem hamburger menu, ícone lucide + label `text-2xs`; estrutura por papel (Treinador: Prontidão · Calendário · Plantel · Eu; Analista: Sessões · Plantel · Tendências · Eu; Jogador: Hoje · Histórico · Eu).
- UX-DR27: Header sticky com título + meta contextual ("Painel · Sáb 16:00"); sem breadcrumbs em mobile (em desktop staff ≥1024px breadcrumb em rotas profundas); back button via gesture nativo.
- UX-DR28: URLs em PT — `/prontidao`, `/calendario`, `/plantel/[id]`, `/sessoes`, `/sessoes/[id]`, `/tendencias`, `/configuracoes`, `/consentimento/[token]`; `/api/*` em inglês; slugs nunca com nomes pessoais — sempre UUID.
- UX-DR29: Route groups Next.js `(player)` e `(staff)` para layouts diferenciados por papel.

**Padrões Transversais & Consistency**

- UX-DR30: Apenas 3 variantes de Button — primary (`bg-accent-primary` + texto branco), ghost/secondary (border + texto), destructive (`bg-signal-alert` + texto branco); 1 primary por ecrã; destructive sempre confirmação modal; tamanhos 32/40/48px; loading state com spinner inline + texto preserved + disabled.
- UX-DR31: Form validation inline on-blur, mensagem junto ao campo em `signal/alert` text + `<AlertCircle>` ícone, submit mostra todos os erros simultaneamente; Zod schema partilhado client/server; labels sempre visíveis (sem floating); placeholder é exemplo ("ex: João Silva"); required `*` em `signal/alert`.
- UX-DR32: Adaptação sub-14 em forms — labels em frase completa ("Quantos anos tens?"), sem termos médicos, help text com exemplo, tom encorajador no submit ("Pronto, terminámos").
- UX-DR33: Modal `<Dialog>` apenas para destructive ou erro crítico ou onboarding único (A2HS); `<Sheet>` para drill-downs, filtros, edição inline e ZoneSelector; ESC fecha sempre, focus trap em modal, restore focus ao fechar.
- UX-DR34: Empty states padronizados via `<EmptyState>`, loading states (≤300ms sem indicator; 300ms–1s skeleton; 1–3s skeleton+spinner; >3s skeleton+spinner+mensagem), error states que explicam o que aconteceu aos dados.
- UX-DR35: Search palette `⌘K`/`Ctrl+K` apenas em desktop staff; search inline em listas >20 itens com debounce 200ms; filtros em `<Sheet>` lateral/ascendente com chips removíveis; ordenação default por estado de prontidão no Painel (vermelho → amarelo → verde).
- UX-DR36: Datas via `date-fns` com locale `pt-PT` (formatos: data completa `7 de maio de 2026`, curta `07/05/2026`, data+hora `07/05 às 16:00`, hora `16:00`, relativo recente "há X min/horas/dias", day of week abreviado "Seg/Ter/Qua"); timezone Europe/Lisbon; servidor UTC, cliente pt-PT.
- UX-DR37: Pluralização PT-PT ("1 jogador / 2 jogadores", "0 jogadores"); decimais com vírgula em UI corrente, ponto em UI técnica ("ACWR 1.83").
- UX-DR38: Tom editorial: 2.ª pessoa singular ("os teus dados"), frases ≤15 palavras, B1 CEFR teto, sem emojis, sem maiúsculas dramáticas, sem "Olá!"/"Bem-vindo!"/"Parabéns!".

**Acessibilidade**

- UX-DR39: Skip link visível com focus, landmarks `<header>/<nav>/<main>`, 1 `<h1>` por página sem saltos de hierarquia; HTML semântico antes de ARIA.
- UX-DR40: Focus rings 2px solid + 2px offset cor `accent/focus-ring` (azul universal); `:focus-visible` obrigatório; nunca remover outline sem substituto.
- UX-DR41: ARIA — `aria-label` em ícone-only buttons; `aria-live="polite"` em badges dinâmicos (pendentes, sync); `aria-current="page"` em tabs ativos; `aria-invalid` + `aria-describedby` em inputs com erro; `role="status"` em loading inline; `role="alert"` em erros críticos.
- UX-DR42: axe-core via `vitest-axe` em todos os testes de componente; `eslint-plugin-jsx-a11y` em pre-commit; Lighthouse CI a11y ≥90; build falha em violações (NFR37).
- UX-DR43: Versão linguisticamente adaptada para sub-14 (NFR43) — política de privacidade, questionário e prompts em B1 simplificado para 13–15 anos; daltonia mitigada por redundância cor+ícone+forma.

**Responsive Strategy**

- UX-DR44: Mobile-first absoluto; mobile (≤767px) single column + bottom tab bar; tablet (768–1023px) layout especializado para touchscreen 3-ecrãs full-bleed alvos ≥60×60px; desktop (≥1024px) sidebar esquerda fixa + max-width 1024px central + 3–4 colunas em dashboards + ⌘K palette.
- UX-DR45: `rem` em fontes, `px` em borders/shadows, `%`/`vw`/`vh` em layouts fluidos; Tailwind utilities first; `<picture>` + srcset para fotos jogadores (1×/2×/3× WebP + JPEG fallback); lazy loading nativo; viewport meta com `viewport-fit=cover`.

**Direções de Design Escolhidas (UX Step 9)**

- UX-DR46: Painel de Prontidão — direção A (Lista por posição) como default e direção B (Field formation 4-3-3) como vista alternativa via toggle no header (`Lista | Formação`).
- UX-DR47: Questionário — direção B (Slider 1–5 com snap discreto), vista única, submit no fim.
- UX-DR48: Touchscreen — direção B (sticky player + stack) com fusão de ecrãs action+zone para reduzir taps.

### FR Coverage Map

| FR | Epic | Capability |
| --- | --- | --- |
| FR1, FR2, FR3, FR11 | Epic 1 | Auth + papéis + multi-tenant + MFA |
| FR4, FR5, FR6, FR7, FR8, FR9 | Epic 3 | Consentimento parental tokenizado + retirada |
| FR10 | Epic 7 | Reconfirmação aos 18 anos (Growth) |
| FR12, FR13, FR15, FR16 | Epic 2 | Gestão de jogadores + métricas + retenção |
| FR14 | Epic 7 | Perfil unificado (Growth) |
| FR17, FR18, FR20 | Epic 2 | Calendário + convocatória + épocas |
| FR19 | Epic 6 | Substituições com derivação de minutos |
| FR21, FR22, FR23, FR24, FR25, FR26 | Epic 4 | Questionário fadiga + offline + dados mediados |
| FR27, FR28, FR29, FR30, FR31 | Epic 6 | Touchscreen 7 métricas + presenças + sRPE |
| FR32, FR33, FR34, FR35, FR36 | Epic 5 | ACWR + sRPE + Painel + drill-down + realtime 4h |
| FR37, FR38 | Epic 5 | Dashboards tendências + carga acumulada |
| FR39, FR40, FR41 | Epic 7 | Correlações + curva recuperação + agregado equipa (Growth) |
| FR42, FR43, FR44 | Epic 4 | Push opaco + subscrição |
| FR45 | Epic 3 | Email transacional consent + GDPR |
| FR46, FR47, FR48, FR49, FR50, FR51, FR53, FR54 | Epic 3 | Direitos RGPD + audit logs + política versionada |
| FR52 | Epic 5 | Decisão data-driven (KPI auditável) |
| FR55, FR56, FR57, FR58 | Epic 1 | Heartbeat + backup + browser blocks |
| FR59 | Epic 7 | PDF export mediado (Growth) |

**Cobertura: 59/59 FRs.**

## Epic List

### Epic 1: Fundação Técnica, Identidade & Acesso Multi-Clube

Treinador, Analista e Jogador autenticam-se no clube com permissões corretas (multi-tenant RLS isolado, MFA opcional). Base técnica completa para o resto: project init, migrations core, JWT custom claims, middleware Next.js, route groups (player)/(staff), navegação por papel, design system foundation (tokens + 7 patterns shadcn-based), audit logs base, heartbeat + backup automatizados, CI/CD com lighthouse/axe-core/bundle-size gates, telemetria interna, página de browser bloqueado.

**FRs covered:** FR1, FR2, FR3, FR11, FR55, FR56, FR57, FR58

### Epic 2: Plantel, Calendário & Sessões (gestão operacional do staff)

Analista gere plantel completo (jogadores, métricas peso/altura série temporal, posições principal + 4 alternativas, marcar inativos, política de retenção 5 épocas) e Treinador gere calendário (sessões treino/jogo/amigável, convocados, equipa inicial, épocas com dados filtrados ou cumulativos). Permite operar a app antes de haver fadiga, prontidão ou estatísticas — desbloqueia todos os épicos seguintes que dependem de jogador + sessão.

**FRs covered:** FR12, FR13, FR15, FR16, FR17, FR18, FR20

### Epic 3: Consentimento Parental & Direitos GDPR

Encarregados confirmam consentimento parental via link tokenizado (sem criar conta) com timestamp/IP/versão registados; titulares exercem direitos RGPD (exportação CSV ≤30 dias, apagamento em cascata ≤30 dias, retificação ≤7 dias com log auditável, retirada de consentimento imediata, tratamento limitado, consulta de logs de acesso aos seus dados de saúde nos últimos 12 meses). Sistema preparado conformemente para receber dados de menores 13–15. Política de privacidade versionada e adaptada linguisticamente.

**FRs covered:** FR4, FR5, FR6, FR7, FR8, FR9, FR45, FR46, FR47, FR48, FR49, FR50, FR51, FR53, FR54

### Epic 4: Recolha de Fadiga & Notificações (jornada do Tomás)

Jogador responde questionário de fadiga (5 dimensões, slider 1–5 com snap discreto, adaptação sub-14), em modo offline com sincronização automática e badge de pendentes; recebe push notifications opacas X minutos antes/depois de sessão (X/Y configuráveis pelo staff); pode subscrever/cancelar. Staff vê respostas individuais e tendências sem mediação adicional. Filosofia "dados mediados" enforçada (Jogador não vê o seu Painel, Curva de Recuperação ou relatórios processados).

**FRs covered:** FR21, FR22, FR23, FR24, FR25, FR26, FR42, FR43, FR44

### Epic 5: Painel de Prontidão & Inteligência (defining experience do José)

Treinador abre app em <3s, vê glance value agregado (3 números 48px), drill-down em <30s para detalhe individual (séries fadiga 4 semanas, ACWR + banda, presenças, nota livre), troca entre vista Lista (default) e Formação 4-3-3 via toggle no header, marca decisões data-driven (FR52). Sistema calcula ACWR (rácio carga aguda 7d / crónica 28d com limiares por escalão) e sRPE automaticamente, atualiza Painel em tempo real na janela 4h pré-sessão. Analista consulta tendências individuais 4 semanas e carga acumulada por jogador na época.

**FRs covered:** FR32, FR33, FR34, FR35, FR36, FR37, FR38, FR52

### Epic 6: Recolha de Performance — Touchscreen 3-ecrãs (jornada da Ana)

Analista regista presenças, Session-RPE (1–10 × duração) e substituições durante jogo (sistema deriva minutos automaticamente); regista eventos estatísticos via touchscreen B (sticky player + stack, alvos ≥60×60px, zero animações em fluxo reflexo, histórico recente visível). 7 métricas cobertas (perdas de bola, recuperações, remates totais, remates enquadrados, passes completados, pressões defensivas, ações defensivas/ofensivas com sucesso). Funciona em offline com sincronização sem perda; janela configurável após sessão para editar/apagar eventos.

**FRs covered:** FR19, FR27, FR28, FR29, FR30, FR31

### Epic 7: Análise Avançada & Operacionalização "Dados Mediados" (Phase 2 / Growth)

Perfil unificado do jogador (séries fadiga + peso + altura + ACWR + presenças + estatísticas integradas), Curva de Recuperação Individual (trajectória pós-sessão intensa), Dashboard de Equipa Agregado (média fadiga, presença, estatísticas), deteção de correlações individuais fadiga×performance, exportação de relatórios PDF mediada pelo staff, reconfirmação automática aos 18 anos com anonimização passados 90 dias sem reconfirmação.

**FRs covered:** FR10, FR14, FR39, FR40, FR41, FR59

## Epic 1: Fundação Técnica, Identidade & Acesso Multi-Clube

Treinador, Analista e Jogador autenticam-se no clube com permissões corretas (multi-tenant RLS isolado, MFA opcional). Base técnica completa para o resto: project init, migrations core, JWT custom claims, middleware Next.js, route groups (player)/(staff), navegação por papel, design system foundation (tokens + 7 patterns shadcn-based), audit logs base, heartbeat + backup automatizados, CI/CD com lighthouse/axe-core/bundle-size gates, telemetria interna, página de browser bloqueado.

### Story 1.1: Project Initialization & Stack Bootstrap

As a solo developer,
I want to scaffold the project with a deterministic, reproducible stack initialization sequence,
So that the foundation is consistent, AI-implementable, and provider-agnostic from day one.

**Acceptance Criteria:**

**Given** an empty repository
**When** the initialization sequence is executed
**Then** `create-next-app` runs with flags `--typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`
**And** `tsconfig.json` has `"strict": true` and `"noUncheckedIndexedAccess": true`
**And** `package.json` declares Node 22 LTS engine

**Given** the Next.js scaffold exists
**When** dependencies are installed sequentially per AR2
**Then** shadcn/ui is initialized
**And** `@supabase/supabase-js`, `@supabase/ssr`, `@serwist/next`, `dexie`, `@tanstack/react-query` (+persist-client +sync-storage-persister), `zustand`, `react-hook-form`, `zod`, `@hookform/resolvers`, `date-fns`, `recharts` are installed
**And** dev deps `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `vitest-axe`, `eslint-plugin-jsx-a11y` are installed

**Given** the project compiles
**When** `next dev --webpack` runs
**Then** the dev server starts on port 3000 without errors
**And** the homepage renders default content

**Given** Tailwind v4 CSS-first config
**When** `globals.css` declares `@theme`
**Then** design tokens declared as CSS variables are accessible to all components

**Given** the provider-agnostic constraint (NFR58)
**When** the codebase is grepped
**Then** there are zero imports from `@vercel/*` outside `next/*`

### Story 1.2: Supabase Project Setup, DPA & DPIA Initial Documentation

As a solo developer with GDPR responsibilities,
I want a Supabase project provisioned in EU region with DPA signed and DPIA documentation started,
So that we can lawfully collect health data from the pilot squad before release.

**Acceptance Criteria:**

**Given** the EU residency requirement (NFR30)
**When** the Supabase project is provisioned
**Then** it is created in an EU region
**And** Vercel project is configured with primary region `fra1`
**And** Resend is set to its EU instance

**Given** GDPR compliance (NFR24, AR24)
**When** the legal documentation is initialized
**Then** the DPA with Supabase is signed and linked from `_compliance/dpa.md`
**And** a DPIA template is created at `_compliance/dpia.md` with sections for Art. 9 base jurídica, risk assessment, mitigations, and approval signatures

**Given** local dev workflow
**When** `supabase start` is run
**Then** a Docker-based local Postgres comes up healthy
**And** `supabase migration new` is functional

**Given** environment variable conventions (AR30)
**When** `.env.example` is committed
**Then** it documents `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `BACKUP_ENCRYPTION_KEY`
**And** `.gitignore` excludes all `.env*` except `.env.example`

### Story 1.3: Migrations Foundation — Core Identity Tables, UUIDv7 & RLS Helpers

As a solo developer,
I want foundational migrations creating clubs/profiles tables with UUIDv7 PKs, RLS enabled, and auth helper functions,
So that every future table inherits a consistent multi-tenant security pattern.

**Acceptance Criteria:**

**Given** Supabase migrations CLI
**When** migration `000010_uuidv7_function.sql` is applied
**Then** a PL/pgSQL `uuidv7()` function (Fabio Lima implementation) exists as fallback for server-generated UUIDs (AR4)

**Given** migration `000020_clubs_profiles.sql`
**When** applied
**Then** `clubs` table exists (id uuid PK default uuidv7(), name text, country text, created_at timestamptz)
**And** `profiles` table exists (id uuid PK = auth.uid(), club_id uuid FK, role text CHECK in ('coach','analyst','player'), full_name text, created_at timestamptz)
**And** RLS is enabled on both tables (AR8, NFR16)

**Given** migration `000030_auth_helpers.sql`
**When** applied
**Then** `auth.club_id()` returning uuid from JWT claim exists
**And** `auth.user_role()` returning text from JWT claim exists (AR12)

**Given** migration `000040_profiles_rls.sql`
**When** applied
**Then** policy "club isolation read" allows SELECT where `club_id = auth.club_id()`
**And** policy "self update" allows UPDATE where `id = auth.uid()` with check
**And** index `idx_profiles_club` on `profiles(club_id)` exists (AR9, NFR1)

**Given** CI integration
**When** `supabase db reset --no-seed` runs in the CI pipeline
**Then** all migrations apply without error (AR7)

### Story 1.4: Supabase Auth Hook for JWT Custom Claims (club_id, role)

As a solo developer,
I want a Supabase Auth Hook that injects `club_id` and `role` claims into every JWT,
So that all RLS policies have the context they need without app-side workarounds.

**Acceptance Criteria:**

**Given** a user with a profile signs in
**When** the JWT is issued
**Then** it contains custom claims `club_id` (uuid string) and `role` (one of "coach", "analyst", "player") (AR11)

**Given** the Edge Function `auth-hook` is deployed and configured in Supabase dashboard
**When** the hook runs during JWT issuance
**Then** it reads the user's `profiles` row via service-role client
**And** merges `club_id` + `role` into the JWT payload

**Given** a user authenticates without a profile row
**When** the hook executes
**Then** it logs a structured warning
**And** the JWT is issued without custom claims (graceful failure, no crash)

**Given** a JWT with claims is presented
**When** SQL queries execute via `supabase-js`
**Then** `auth.club_id()` and `auth.user_role()` return the correct values inside RLS policies

**Given** the test coverage requirement (NFR54)
**When** unit tests run
**Then** the hook's claim-merging logic has ≥80% coverage including the no-profile fallback case

### Story 1.5: Email/Password Authentication & Password Recovery

As a Treinador, Analista or Jogador,
I want to log in with email and password and recover my password by email,
So that I can access the system independently and recover from forgotten credentials without admin help.

**Acceptance Criteria:**

**Given** a user on `/login`
**When** they submit valid email + password
**Then** they are authenticated via Supabase Auth
**And** redirected to their role's home route (`/prontidao` for coach, `/sessoes` for analyst, `/hoje` for player) (FR1)

**Given** a user on `/login` with invalid credentials
**When** they submit
**Then** an inline `<Alert>` displays "Email ou password incorretos" without revealing which is wrong

**Given** a logged-in user
**When** they trigger logout
**Then** session tokens are revoked
**And** the user is redirected to `/login`

**Given** a user on `/recuperar-password`
**When** they submit a registered email
**Then** a recovery email is sent via Supabase Auth (Resend EU)
**And** the UI shows `<CalmConfirmation>` "Se o email existir, vais receber um link em alguns minutos" (no enumeration leak)

**Given** a recovery link is clicked
**When** the user submits a new password
**Then** the password is updated
**And** all existing sessions are invalidated (NFR18)
**And** the user is redirected to `/login`

**Given** session inactivity
**When** 1 hour passes without activity
**Then** the access token expires (NFR17)
**And** the user is redirected to `/login` on next protected request

**Given** the TLS requirement (NFR14)
**When** any auth request is made
**Then** it is over HTTPS only

### Story 1.6: Role Assignment & Multi-Tenant Access Enforcement

As the system,
I want to enforce one-and-only-one role per profile and strict club-level isolation,
So that no user can access data from another club and role permissions are unambiguous.

**Acceptance Criteria:**

**Given** any two clubs A and B with seeded fixtures
**When** a user from club A queries any RLS-protected table
**Then** no rows from club B are returned (FR3, validated by integration test)

**Given** a write attempt with mismatched `club_id`
**When** a user tries to insert a row with a `club_id` different from `auth.club_id()`
**Then** the insert is rejected by RLS `with check` (AR10)

**Given** the helpers convention (AR15)
**When** `lib/supabase/{client,server,middleware,service-role}.ts` are reviewed
**Then** they expose typed clients matching Supabase patterns
**And** the service-role client is only importable from `lib/supabase/service-role.ts` (lint rule blocks elsewhere) (AR13)

**Given** the Next.js middleware (AR14)
**When** a protected route is requested
**Then** it refreshes the Supabase session
**And** blocks unauthenticated requests with redirect to `/login`

**Given** a profile exists
**When** queried
**Then** exactly one `role` value in `('coach', 'analyst', 'player')` is present per `auth.uid()` (FR2, CHECK constraint enforces)

**Given** test coverage (NFR54)
**When** integration tests run with seeded multi-tenant fixtures
**Then** all cross-tenant access attempts fail
**And** all same-tenant access attempts succeed

### Story 1.7: Optional MFA for Treinador & Analista

As a Treinador or Analista,
I want to optionally enable TOTP-based MFA on my account,
So that my access to the team's health data has an extra layer of protection.

**Acceptance Criteria:**

**Given** a coach or analyst on `/configuracoes/seguranca`
**When** they enable MFA
**Then** a TOTP secret is generated via Supabase Auth MFA (AAL2)
**And** a QR code is displayed for an authenticator app (FR11, NFR19)

**Given** a TOTP code is verified
**When** entered correctly during enrollment
**Then** MFA is activated for the account
**And** subsequent logins challenge for the code after password

**Given** a Jogador account
**When** they navigate to `/configuracoes/seguranca`
**Then** the MFA enrollment option is hidden (MVP scope)

**Given** MFA is enabled
**When** the user logs in with correct password but wrong TOTP
**Then** the session is not created
**And** a clear error is shown: "Código de verificação inválido"

**Given** MFA is enabled
**When** the user wants to disable it
**Then** they must confirm with current password
**And** a notification email is sent confirming the change

**Given** the configuration setting `mfa_required_roles`
**When** set to `['coach','analyst']` (Growth phase trigger)
**Then** login without active MFA prompts an enrollment flow before granting access

### Story 1.8: Design System Foundation — Tokens, 7 Pattern Components & Button Hierarchy

As a solo developer building UI,
I want the design tokens stabilized and the 7 universal pattern components implemented and tested,
So that all subsequent stories compose UI from a consistent, accessible vocabulary.

**Acceptance Criteria:**

**Given** Tailwind v4 CSS-first config
**When** `globals.css` declares `@theme`
**Then** color tokens (`bg/`, `text/`, `border/`, `accent/`, `signal/{ready,caution,alert,info,neutral}`) are defined
**And** typography tokens (Inter via `next/font/google`, system-ui in critical routes, mono ui-monospace) are defined
**And** spacing 4px scale, border-radius 2/6/12/full, shadow sm/md, animation 150ms (200ms modal, 0ms touchscreen), z-index 0/10/20/30/40/50 are defined as CSS variables (UX-DR1–UX-DR4)

**Given** the dark mode rule (UX-DR1)
**When** the user OS is in dark mode
**Then** `prefers-color-scheme: dark` swaps token values
**And** no user-facing toggle exists

**Given** `<SemaforoBadge>` (UX-DR5)
**When** rendered with `state="ready"|"caution"|"alert"|"neutral"` and `size="sm"|"md"|"lg"`
**Then** color + lucide icon (`check-circle-2`, `alert-triangle`, `alert-octagon`, `circle-dashed`) + shape redundancy is visible
**And** `aria-label="Estado: pronto/atenção/não pronto/sem dados"` is set
**And** contrast meets WCAG AA on `bg/base` (NFR37)

**Given** `<DrillDownSheet>` (UX-DR6)
**When** opened on iOS Safari
**Then** it animates from bottom 200ms ease-out
**And** swipe-down closes
**And** ESC closes
**And** focus is trapped while open
**And** focus restores to opener on close

**Given** `<PendingBadge>` (UX-DR7)
**When** the outbox count > 0
**Then** it displays "X pendentes" in `signal/info`
**And** has `aria-live="polite"`
**When** count = 0
**Then** it is hidden

**Given** `<EmptyState>` (UX-DR8)
**When** rendered
**Then** it shows neutral icon + title + description + optional CTA
**And** copy follows tone rules (no apology, indicate next step)

**Given** `<TooltipExplain>` (UX-DR9)
**When** wrapping the term "ACWR"
**Then** the term is underlined dotted
**And** tap/hover opens a popover with B1 definition + optional formula in mono (NFR42)

**Given** `<HapticButton>` (UX-DR10)
**When** pressed on a device with vibration support
**Then** `navigator.vibrate(10)` fires
**When** pressed on devices without support
**Then** it falls back silently with no error

**Given** `<CalmConfirmation>` (UX-DR11)
**When** invoked with a message
**Then** a discrete banner fades in 200ms
**And** auto-dismisses after 1500ms
**And** no emojis or "Sucesso!" copy is rendered

**Given** the Button hierarchy rule (UX-DR30)
**When** `<Button>` is implemented
**Then** exactly 3 variants exist (primary `bg-accent-primary`+white, ghost border+text, destructive `bg-signal-alert`+white)
**And** no `warning` or `info` variants exist
**And** touch target ≥44×44px in all sizes (NFR40)
**And** loading state shows inline spinner with text preserved + disabled

**Given** test coverage
**When** `vitest-axe` runs against each pattern's fixture
**Then** zero a11y violations are reported (NFR37, UX-DR42)

### Story 1.9: Role-Based Navigation Shell & Route Groups

As a logged-in user,
I want a navigation shell that adapts to my role with Portuguese URLs and bottom tabs,
So that I am routed to capabilities relevant to me without seeing controls I cannot use.

**Acceptance Criteria:**

**Given** Next.js App Router
**When** the project structure is set up
**Then** `src/app/` contains route groups `(player)/` and `(staff)/` with separate `layout.tsx` files (UX-DR29)

**Given** a coach user logged in
**When** the layout renders on mobile
**Then** the bottom tab bar shows "Prontidão · Calendário · Plantel · Eu" (lucide icons + `text-2xs` labels) (UX-DR26)

**Given** an analyst user logged in
**When** the layout renders
**Then** mobile shows bottom tabs "Sessões · Plantel · Tendências · Eu"
**And** desktop ≥1024px shows a left sidebar replacing the bottom tab bar

**Given** a player user logged in
**When** the layout renders
**Then** the bottom tab bar shows exactly "Hoje · Histórico · Eu" (3 tabs, no more)

**Given** the URL convention (UX-DR28)
**When** routes are defined
**Then** they match `/prontidao`, `/calendario`, `/plantel`, `/plantel/[id]`, `/sessoes`, `/sessoes/[id]`, `/tendencias`, `/configuracoes`, `/hoje`, `/historico`, `/consentimento/[token]`
**And** no slug contains a person's name (always UUID)
**And** `/api/*` is in English

**Given** the sticky header (UX-DR27)
**When** rendered
**Then** it shows a contextual title + meta line (e.g., "Painel · Sáb 16:00") wrapped in semantic `<header>`

**Given** mobile navigation
**When** the user uses the native iOS/Android back gesture
**Then** it works without a custom back button

**Given** a player tries to navigate to `/sessoes`
**When** the route is requested
**Then** the middleware redirects to `/hoje` (role-based access enforcement)

### Story 1.10: Browser Compatibility Page & In-App WebView Block

As any user trying to access the app from an unsupported environment,
I want a clear, helpful message explaining what to do,
So that I can switch to a compatible browser instead of seeing a broken app.

**Acceptance Criteria:**

**Given** a user opens the app in IE 11, Opera Mini, UC Browser, or any browser without Service Worker support
**When** the page loads
**Then** a friendly fallback page renders explaining "Este site precisa de um browser moderno"
**And** lists the supported browsers
**And** instructs how to open in a compatible one (FR57, NFR60)

**Given** a user opens the app inside Facebook, Instagram, or WhatsApp in-app WebView
**When** user-agent or `navigator.standalone` detection identifies the WebView
**Then** a blocking page renders "Abre o SPARTA no teu browser principal"
**And** shows a "Copiar link" button + step-by-step iOS/Android instructions (FR58)

**Given** a user opens the app in Chrome (last 2), Safari iOS 16.4+, Safari macOS (last 2), Firefox (last 2), Edge (last 2), or Samsung Internet (last 2)
**When** the page loads
**Then** no blocking page is shown
**And** the app proceeds normally (NFR59)

**Given** the detection logic
**When** unit tests run with mocked user-agents
**Then** each unsupported case is covered ≥80% (NFR54)

**Given** accessibility
**When** the fallback/block pages render
**Then** `axe-core` reports zero violations
**And** copy is in B1 PT-PT (NFR42, UX-DR38)

### Story 1.11: Outbox Foundation — Dexie + UUIDv7 Generation & Service Worker (Serwist)

As any user submitting data,
I want my submissions queued locally with idempotent UUIDv7 IDs and synced when online,
So that data is never lost and never duplicated even on flaky networks.

**Acceptance Criteria:**

**Given** the Dexie outbox in `lib/outbox/`
**When** initialized
**Then** an IndexedDB database with a generic `pending_mutations` store (id uuid, kind text, payload json, created_at, status, retry_count) is created (AR18)

**Given** UUIDv7 generation
**When** `lib/uuid.ts` `newId()` is called
**Then** it returns a UUIDv7 via `uuid` v9+ `v7()`
**And** IDs are time-ordered (verifiable in tests) (AR4, NFR48)

**Given** the service worker via Serwist
**When** `app/sw.ts` is configured
**Then** it pre-caches the app shell
**And** handles offline navigation requests with a cached `/offline` page (AR19, NFR12)

**Given** a queued mutation
**When** the device regains connectivity
**Then** the foreground drain logic flushes pending entries via Server Actions or Edge Functions
**And** calls upsert with the client-generated UUIDv7 (idempotent) (NFR3, NFR47, NFR48)

**Given** an orphan outbox before logout (NFR52, AR20)
**When** the user attempts to log out with pending mutations
**Then** a `<Dialog>` warns "Tens X submissões por enviar. Sair sem sincronizar?"
**And** offers a destructive "Sair mesmo assim" + ghost "Cancelar"

**Given** test coverage (NFR54)
**When** tests run
**Then** `lib/outbox/` and `lib/uuid.ts` have ≥80% coverage including replay, conflict, and orphan scenarios

**Given** the build-tooling constraint (AR3)
**When** `next build` runs
**Then** Webpack is used (Turbopack disabled) due to Serwist incompatibility

### Story 1.12: Audit Logs & Telemetry Foundation Tables

As the system,
I want `audit_logs` and `telemetry_events` tables wired with helpers,
So that compliance evidence and product KPIs accumulate from day one without bolt-on later.

**Acceptance Criteria:**

**Given** migration `000050_audit_logs.sql`
**When** applied
**Then** table `audit_logs` exists (id, club_id, actor_id, action, target_kind, target_id, occurred_at, payload jsonb)
**And** RLS is enabled
**And** policies allow titulares to SELECT their own log entries via `target_id = auth.uid()`
**And** staff to SELECT entries for their `club_id` (FR50, FR51, AR21, NFR16)

**Given** migration `000060_telemetry_events.sql`
**When** applied
**Then** table `telemetry_events` exists (id, club_id, kind, payload_json, occurred_at)
**And** RLS is enabled
**And** only the service-role can INSERT (AR31, NFR22)

**Given** `lib/actions/telemetry.ts`
**When** `logTelemetry(kind, payload)` is invoked from a Server Action
**Then** it inserts a row via the service-role client
**And** the call is fire-and-forget (does not block UX)

**Given** `lib/actions/audit.ts`
**When** `logAccess(action, targetKind, targetId)` is called from a Server Action that reads health data
**Then** it inserts an `audit_logs` row with `actor_id = auth.uid()` (FR50)

**Given** the log retention requirement (NFR20)
**When** the pg_cron job `purge_audit_logs_older_than_12_months` runs monthly
**Then** rows older than 12 months are deleted

**Given** the structured logs requirement (NFR56)
**When** critical events (auth, health mutations, exports, deletions, sync failures) occur
**Then** JSON-structured logs are emitted to stdout (Vercel + Supabase capture)

**Given** the no-third-party-analytics constraint (NFR22)
**When** the codebase is grepped
**Then** no analytics SDK (Google Analytics, Mixpanel, PostHog, Segment) is present

### Story 1.13: GitHub Actions CI Pipeline with Quality Gates

As a solo developer,
I want a CI pipeline that enforces lint, types, tests, a11y, bundle size, lighthouse, and migration validity,
So that no PR can merge if it violates the project's invariants.

**Acceptance Criteria:**

**Given** `.github/workflows/ci.yml`
**When** triggered on `pull_request` and `push: main`
**Then** it runs jobs: lint (ESLint+Prettier), typecheck (`tsc --noEmit`), test (`vitest run --coverage`), axe-core (`vitest-axe`), build (`next build`), bundle-size, lighthouse-ci, migration-validate (AR29)

**Given** the bundle-size job
**When** `next build` outputs bundle stats
**Then** the initial JS bundle ≤200KB gzipped or the job fails (NFR11)

**Given** the lighthouse-ci job against a preview deployment
**When** scores are computed
**Then** Performance ≥85, Accessibility ≥90, Best Practices ≥95, PWA ≥100 are required or the job fails (NFR13)

**Given** the migration-validate job
**When** triggered
**Then** `supabase db reset --no-seed` runs in CI Postgres
**And** exits 0 or the job fails (AR7)

**Given** the test job
**When** coverage is computed
**Then** coverage on `lib/readiness/`, `lib/outbox/`, `lib/uuid.ts` is ≥80% or the job fails (NFR54)

**Given** the strict typing rule (NFR55)
**When** typecheck runs
**Then** `"strict": true` and `"noUncheckedIndexedAccess": true` apply
**And** no `any` exists outside fronteiras documentadas (lint rule with allowlist)

**Given** the a11y job
**When** `vitest-axe` runs
**Then** zero violations across all component tests or the job fails (NFR37)

**Given** secrets handling (AR30)
**When** the workflow runs
**Then** it reads `SUPABASE_DB_URL` and other secrets from GitHub Actions secrets (no plain text)

### Story 1.14: GitHub Actions Heartbeat Workflow

As the system,
I want a scheduled workflow that pings the Supabase database every ≤6 days,
So that the project stays active on the free tier and we are alerted if the database becomes unreachable.

**Acceptance Criteria:**

**Given** `.github/workflows/heartbeat.yml`
**When** the cron `0 12 */6 * *` fires
**Then** a job runs that opens a connection via `SUPABASE_DB_URL` and runs `select now();` (FR55, NFR49, AR27)

**Given** the heartbeat query succeeds
**When** the workflow ends
**Then** it exits 0 with no notification

**Given** the heartbeat query fails
**When** the workflow ends
**Then** it exits non-zero
**And** after 2 consecutive failures the workflow opens a GitHub issue tagged `heartbeat-alert` (NFR50)

**Given** secret usage (AR30)
**When** the workflow runs
**Then** it reads `SUPABASE_DB_URL` from secrets only

### Story 1.15: GitHub Actions Weekly Backup Workflow

As the system,
I want weekly encrypted backups of the database with 12-week retention,
So that we can recover from any data loss within recent operational history.

**Acceptance Criteria:**

**Given** `.github/workflows/backup.yml`
**When** the cron `0 3 * * 0` fires (Sunday 03:00 UTC)
**Then** a job runs `pg_dump` against production via `SUPABASE_DB_URL` (FR56, NFR51, AR28)

**Given** the dump succeeds
**When** the workflow continues
**Then** the file is encrypted with `BACKUP_ENCRYPTION_KEY` (AES-256)
**And** pushed to a private repo `sparta-backups` with filename `YYYY-MM-DD-backup.sql.enc`

**Given** the retention policy
**When** the workflow finishes
**Then** files older than 12 weeks in the backup repo are deleted (NFR51)

**Given** the dump fails
**When** the workflow ends
**Then** it opens a GitHub issue tagged `backup-failure`

**Given** secret usage (AR30)
**When** the workflow runs
**Then** it reads `SUPABASE_DB_URL`, `BACKUP_ENCRYPTION_KEY`, and a deploy key for the backup repo from secrets

### Story 1.16: Accessibility Foundation — Skip Link, Focus Rings, Reduced Motion, Alt Text

As any user, especially keyboard or screen-reader users,
I want consistent skip links, visible focus rings, reduced motion support and alt text across the app,
So that the entire system is navigable and respectful of my needs.

**Acceptance Criteria:**

**Given** the root layout
**When** rendered
**Then** `<a href="#main-content">Saltar para o conteúdo</a>` is the first focusable element
**And** becomes visible on focus (UX-DR39)

**Given** any focusable element
**When** it receives keyboard focus
**Then** a 2px solid `accent/focus-ring` ring with 2px offset is rendered via `:focus-visible` only
**And** no element has `outline: none` without a substitute (UX-DR40, NFR38)

**Given** the `<html>` element
**When** the page loads
**Then** `lang="pt-PT"` is set
**And** exactly one `<h1>` exists per page with no hierarchy skips (UX-DR39, NFR39)

**Given** user OS preference
**When** `prefers-reduced-motion: reduce` is set
**Then** all animations either are disabled or use `motion-reduce:` Tailwind variant
**And** no parallax/auto-play animations remain (UX-DR3, NFR41)

**Given** the touch target rule (NFR40)
**When** any interactive element is rendered
**Then** its computed bounding box is ≥44×44px (validated by `vitest-axe`)

**Given** the contrast rule (NFR37)
**When** `axe-core` runs in CI
**Then** `text/primary` on `bg/base` ≥4.5:1
**And** `text/muted` on `bg/base` ≥4.5:1
**And** signal colors meet ≥4.5:1 (text) or ≥3:1 (large/UI)

**Given** the alt text rule (NFR44)
**When** any `<img>` is rendered
**Then** it has a non-empty `alt` attribute (or `alt=""` for decorative images)
**And** `eslint-plugin-jsx-a11y` enforces this at build time

### Story 1.17: Design Token & Font System Alignment (Visual Look & Feel Baseline)

As a developer implementing any new screen,
I want a complete, mockup-aligned token and font system in `globals.css` and `layout.tsx`,
So that all new screens automatically match the visual look and feel defined in `docs/ux-design/`.

**Acceptance Criteria:**

**Given** the font system (UX-DR2 revised)
**When** `layout.tsx` is updated
**Then** `Inter Tight` is loaded via `next/font/google` with weights 400/500/600/700 and subsets `latin`
**And** `JetBrains Mono` is loaded via `next/font/google` with weights 400/500/600 and subsets `latin`
**And** the CSS variables `--font-sans` and `--font-mono` in `@theme` point to the new fonts
**And** `Geist` and `Geist Mono` are removed from the project

**Given** the ink token scale (missing from current `globals.css`)
**When** the `globals.css` `:root` and `.dark` blocks are updated
**Then** `:root` defines `--color-ink-2: #525252`, `--color-ink-3: #737373`, `--color-ink-4: #A3A3A3`
**And** `.dark` defines `--color-ink-2: #D4D4D4`, `--color-ink-3: #A3A3A3`, `--color-ink-4: #737373`
**And** `@theme inline` exposes them as `--color-ink-2`, `--color-ink-3`, `--color-ink-4`

**Given** the surface token scale (missing from current `globals.css`)
**When** the `globals.css` `:root` and `.dark` blocks are updated
**Then** `:root` defines `--color-surface: #FAFAFA`, `--color-surface-2: #F5F5F5`
**And** `.dark` defines `--color-surface: #171717`, `--color-surface-2: #262626`
**And** `@theme inline` exposes them as `--color-surface`, `--color-surface-2`

**Given** the hairline token (editorial separators, missing from current `globals.css`)
**When** the `globals.css` `:root` and `.dark` blocks are updated
**Then** `:root` defines `--color-hairline: #E5E5E5`, `--color-hairline-strong: #D4D4D4`
**And** `.dark` defines `--color-hairline: #262626`, `--color-hairline-strong: #404040`
**And** `@theme inline` exposes them as `--color-hairline`, `--color-hairline-strong`

**Given** the field color (pitch SVG green, used in touchscreen zone selector and position diagram)
**When** the `globals.css` `:root` block is updated
**Then** `:root` defines `--color-field: #10B981`, `--color-field-deep: #059669`
**And** both values are identical in `.dark` (field green is context-invariant)
**And** `@theme inline` exposes `--color-field`, `--color-field-deep`

**Given** the signal background/foreground token pairs (used in StatusPill/SemaforoBadge)
**When** the `globals.css` `:root` and `.dark` blocks are updated
**Then** `:root` defines `--signal-ready-bg: #F0FDF4`, `--signal-ready-ink: #166534`
**And** `:root` defines `--signal-caution-bg: #FEFCE8`, `--signal-caution-ink: #854D0E`
**And** `:root` defines `--signal-alert-bg: #FEF2F2`, `--signal-alert-ink: #991B1B`
**And** `.dark` defines `--signal-ready-bg: rgba(34,197,94,0.12)`, `--signal-ready-ink: #86EFAC`
**And** `.dark` defines `--signal-caution-bg: rgba(234,179,8,0.14)`, `--signal-caution-ink: #FDE68A`
**And** `.dark` defines `--signal-alert-bg: rgba(239,68,68,0.14)`, `--signal-alert-ink: #FCA5A5`
**And** all six tokens are exposed in `@theme inline`

**Given** the dark mode mechanism (UX-DR1 — prefers-color-scheme only, no user toggle)
**When** the dark mode implementation is audited
**Then** `globals.css` uses `@media (prefers-color-scheme: dark)` to apply `.dark` class automatically via `<html class>` set server-side from `next/headers` cookies or via `<script>` in `<head>` before first paint
**And** there is no user-facing dark mode toggle in Settings or navigation
**And** existing `.dark` class selector continues to work (shadcn compatibility)

**Given** the `Eyebrow` primitive component (small-caps section marker with leading dash, used in profile and multiple screens)
**When** `src/components/patterns/Eyebrow.tsx` is created
**Then** it renders a `<div>` with `font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-3` and a `<span>` leading dash (12px wide, 1px height, bg-ink-3)
**And** it accepts `children` and an optional `className` prop
**And** it has a vitest unit test

**Given** the `Datum` primitive component (value + label stacked in mono, used in stats displays)
**When** `src/components/patterns/Datum.tsx` is created
**Then** it renders a value in `font-mono font-medium tabular-nums` and a label in `font-mono text-[8.5px] tracking-[0.12em] uppercase text-ink-3`
**And** it accepts `value`, `unit` (optional), `label`, `valueSize` (default 22), `color` (optional) props
**And** it has a vitest unit test

**Given** all changes compile and tests pass
**When** `npm run build` and `npm run test --run` are executed from `sparta/`
**Then** build exits 0, typecheck exits 0, lint exits 0 with ≤ previous warning count, all existing tests pass

## Epic 2: Plantel, Calendário & Sessões (gestão operacional do staff)

Analista gere plantel completo (jogadores, métricas peso/altura série temporal, posições principal + 4 alternativas, marcar inativos, política de retenção 5 épocas) e Treinador gere calendário (sessões treino/jogo/amigável, convocados, equipa inicial, épocas com dados filtrados ou cumulativos). Permite operar a app antes de haver fadiga, prontidão ou estatísticas — desbloqueia todos os épicos seguintes que dependem de jogador + sessão.

### Story 2.1: Player Records & Plantel List

As an Analista,
I want to create, edit and archive player records (name, age, jersey, age group, positions) and see the full plantel,
So that the squad's roster is the single source of truth for everything that follows.

**Acceptance Criteria:**

**Given** migration `000070_players_positions.sql`
**When** applied
**Then** table `players` exists (id uuid PK uuidv7, club_id uuid FK, profile_id uuid FK nullable, jersey_num int, full_name text, birthdate date, age_group text CHECK in ('u14','u15','u17','u19','senior'), is_archived boolean default false, created_at, updated_at)
**And** table `positions` exists (id uuid PK, player_id uuid FK, position text, is_primary boolean, sort_order int 0–4)
**And** RLS is enabled with policies "club isolation read" + "staff write own club" (auth.user_role() in ('coach','analyst')) + `with check` (AR8, AR9, AR10)
**And** index `idx_players_club` and `idx_positions_player` exist (NFR1)

**Given** Analista on `/plantel`
**When** the page loads
**Then** the list shows all non-archived players for the club grouped by `age_group`
**And** each row shows jersey, name, primary position, age group, and a `<SemaforoBadge state="neutral">` placeholder
**And** the list defaults to alphabetical by last name (UX-DR35)

**Given** Analista on `/plantel/novo`
**When** they submit a valid form (name, birthdate, jersey, age group, primary position, up to 4 alternatives)
**Then** a player row is inserted with `club_id = auth.club_id()`
**And** position rows are inserted with `is_primary=true` for the first and `sort_order` for alternatives (FR12)
**And** the user is redirected to `/plantel/[id]` with `<CalmConfirmation>` "Jogador adicionado"

**Given** form validation (UX-DR31)
**When** the form is submitted
**Then** Zod schema validates `jersey_num 1–99 unique within club non-archived`, `age_group` enum, ≥1 primary position, ≤4 alternatives
**And** errors appear inline on-blur in `signal/alert` text
**And** submit blocks until errors are fixed

**Given** Analista on `/plantel/[id]/editar`
**When** they save changes
**Then** the player row and positions are updated atomically in a transaction
**And** an `audit_logs` entry with `action='player.updated'` is recorded (FR50)

**Given** Analista on `/plantel/[id]`
**When** they trigger "Arquivar"
**Then** a destructive `<Dialog>` confirms the action (UX-DR33)
**When** confirmed
**Then** `is_archived=true` is set
**And** the player no longer appears in the default `/plantel` list (FR12)
**And** historical data referencing the player remains intact

**Given** the test coverage requirement (NFR54)
**When** integration tests run
**Then** create/edit/archive flows have ≥80% coverage including Zod validation edge cases

### Story 2.2: Player Photo Upload

As an Analista,
I want to upload a photo per player stored privately in Supabase Storage,
So that the staff can identify players in the Painel and touchscreen without exposing photos publicly.

**Acceptance Criteria:**

**Given** Supabase Storage
**When** the storage bucket `player-photos` is provisioned (private, club-scoped)
**Then** bucket policies enforce `select`/`insert`/`update`/`delete` only when the path prefix matches `auth.club_id()`
**And** the bucket is in EU region (NFR30)

**Given** migration `000080_players_photo.sql`
**When** applied
**Then** column `photo_path text` is added to `players` (nullable, format `<club_id>/<player_id>.<ext>`)

**Given** Analista on `/plantel/[id]/editar`
**When** they upload a photo (jpg/png/webp ≤2MB)
**Then** the file is sent via `<picture>`-friendly resize (server-side) to ≤512×512
**And** the URL is signed with 1h expiry for display (NFR21 — no public URL of player photo)
**And** `players.photo_path` is updated

**Given** the image rendering rule (NFR44)
**When** the photo is rendered
**Then** the `<img>` `alt` attribute equals the player's `full_name`
**And** lazy loading is enabled (`loading="lazy"`)

**Given** an Analista from another club
**When** they attempt to read the photo URL
**Then** the storage policy denies the request (multi-tenant isolation, FR3)

**Given** archiving a player
**When** `is_archived=true` is set
**Then** the photo is preserved (does not auto-delete) — anonymization happens in the retention story 2.9

### Story 2.3: Player Metrics Time Series — Weight & Height

As an Analista,
I want to record successive weight and height readings per player and view them as a time series,
So that we can track growth/condition trends without overwriting past readings.

**Acceptance Criteria:**

**Given** migration `000090_player_metrics.sql`
**When** applied
**Then** table `player_metrics` exists (id uuid PK, club_id uuid FK, player_id uuid FK, weight_kg numeric(5,2) nullable, height_cm numeric(5,2) nullable, recorded_at timestamptz, created_by uuid FK profiles)
**And** RLS enabled with same club-isolation pattern (AR8, FR13)
**And** index `idx_player_metrics_player_recorded` on `(player_id, recorded_at desc)` (NFR1)

**Given** Analista on `/plantel/[id]`
**When** they tap "Adicionar leitura"
**Then** a `<DrillDownSheet>` opens with optional weight (kg, 30–150) and optional height (cm, 100–220) and required `recorded_at` (default now)
**When** the form is submitted
**Then** a row is inserted with `created_by = auth.uid()` (FR13)
**And** the sheet closes with `<CalmConfirmation>` "Leitura registada"

**Given** the player profile shows the metrics tab
**When** rendered
**Then** a time series of weight and height is displayed (recharts, dual axis if both exist)
**And** the latest value is shown numerically next to each axis
**And** if no readings exist, an `<EmptyState>` is shown with copy "Sem leituras ainda — adiciona a primeira" + CTA (UX-DR8)

**Given** the staff edits a reading
**When** they update a value within 24h of `recorded_at`
**Then** the row is updated
**And** an `audit_logs` entry with `action='metric.updated'` is created (FR50)

**Given** test coverage (NFR54)
**When** unit tests run
**Then** Zod validation, time series rendering, and empty state branches are covered

### Story 2.4: Mark Player as Inactive (Soft Status)

As an Analista,
I want to mark a player as inactive (e.g., long-term injury, temporary leave) without losing their history,
So that they disappear from active workflows but their data remains for context and resumption.

**Acceptance Criteria:**

**Given** migration `000100_players_inactive.sql`
**When** applied
**Then** column `is_active boolean default true` and `inactive_reason text nullable` are added to `players` (FR15)

**Given** Analista on `/plantel/[id]`
**When** they tap "Marcar inativo"
**Then** a `<DrillDownSheet>` prompts for an optional reason (≤200 chars)
**When** confirmed
**Then** `is_active=false` and `inactive_reason` are set
**And** the player is removed from the default `/plantel` active list
**And** an "Inativos" filter chip in `/plantel` reveals them on demand (UX-DR35)

**Given** Analista on an inactive player's profile
**When** they tap "Reativar"
**Then** `is_active=true` and `inactive_reason=null` are set
**And** the player re-appears in the active list

**Given** an inactive player
**When** any subsequent flow lists "convocáveis" (Story 2.7) or "presentes" (Epic 6)
**Then** the inactive player is excluded by default
**And** historical references to them (past sessions, fatigue, events) remain intact and queryable

**Given** the difference between "archived" and "inactive"
**When** documentation is reviewed
**Then** archived = removed from squad permanently (Story 2.1) and inactive = temporary out-of-rotation (this story)
**And** both flags are independent

### Story 2.5: Season Management (Épocas)

As a Treinador or Analista,
I want to create and manage seasons with start/end dates and view data filtered by season or cumulative,
So that historical analysis can be scoped to the right period without contamination across seasons.

**Acceptance Criteria:**

**Given** migration `000110_seasons.sql`
**When** applied
**Then** table `seasons` exists (id uuid PK, club_id uuid FK, name text, start_date date, end_date date, is_current boolean, created_at)
**And** a unique constraint enforces only one `is_current=true` per `club_id`
**And** RLS enabled with club-isolation (FR20)

**Given** Treinador or Analista on `/configuracoes/epocas`
**When** they create a new season
**Then** name (e.g., "2026/27"), start_date, end_date are required
**And** `end_date > start_date` is enforced via Zod
**And** if "Definir como atual" is checked, the previous current season is set to `is_current=false` atomically

**Given** an existing season
**When** the staff edits dates or name
**Then** the row is updated
**And** an audit log entry is recorded

**Given** any data view that supports season scoping (e.g., trends in Epic 5, agregados in Epic 7)
**When** the user toggles between "Época atual" and "Cumulativo (todas as épocas)"
**Then** the query filter switches between `season_id = currentSeason` and no filter
**And** the toggle state is preserved per session in `localStorage`

**Given** no season is marked current
**When** flows that require a current season run
**Then** the UI prompts the staff to pick or create a current season before proceeding (graceful degradation)

### Story 2.6: Session Management — Create/Edit/Cancel (Treino, Jogo, Amigável)

As a Treinador,
I want to create, edit and cancel training sessions, matches and friendlies with date, time and type,
So that the calendar is an accurate plan that subsequent flows (fadiga, performance, prontidão) attach to.

**Acceptance Criteria:**

**Given** migration `000120_sessions.sql`
**When** applied
**Then** table `sessions` exists (id uuid PK, club_id uuid FK, season_id uuid FK, type text CHECK in ('training','match','friendly'), scheduled_at timestamptz, duration_min int default 90, location text nullable, status text CHECK in ('scheduled','cancelled','completed') default 'scheduled', notes text, created_by uuid FK)
**And** RLS enabled with club isolation + write restricted to `coach` (FR17)

**Given** Treinador on `/calendario/nova`
**When** they submit a valid session form (type, scheduled_at, duration, optional location/notes)
**Then** a session is inserted with `season_id` derived from the current season's date range
**And** `<CalmConfirmation>` "Sessão criada" is shown
**And** the user returns to `/calendario`

**Given** Treinador on `/sessoes/[id]/editar`
**When** they save changes
**Then** the session is updated
**And** an audit log entry `action='session.updated'` is created

**Given** Treinador on `/sessoes/[id]`
**When** they tap "Cancelar sessão"
**Then** a destructive `<Dialog>` confirms with copy "Esta sessão vai ser cancelada. Já há respostas ou eventos associados?"
**When** confirmed
**Then** `status='cancelled'` is set
**And** future automatic notifications for that session are suppressed
**And** historical fatigue/event rows for that session remain intact

**Given** form validation
**When** the user submits
**Then** Zod enforces `scheduled_at` ≥ now-1d (allow same-day backfill), `duration_min` 15–240, `type` enum

**Given** datetime display (UX-DR36)
**When** sessions are listed
**Then** dates render via `date-fns` with locale `pt-PT` (e.g., "07/05 às 16:00")
**And** timezone is Europe/Lisbon (server stores UTC)

### Story 2.7: Calendar View per Role

As a Treinador, Analista or Jogador,
I want to see the calendar of sessions filtered by my role's relevance,
So that each user sees what they need without information overload.

**Acceptance Criteria:**

**Given** a Treinador on `/calendario`
**When** the view loads
**Then** sessions are listed grouped by week
**And** each session card shows date, time, type icon (training/match/friendly), location
**And** tap on a session opens `/sessoes/[id]`
**And** a primary "Nova sessão" button (1 per ecrã, UX-DR30) is visible

**Given** an Analista on `/sessoes`
**When** the view loads
**Then** the same listing is shown but the primary CTA is "Registar sessão" (allowing past-session backfill)
**And** filters chip allow "Apenas treinos / Apenas jogos / Tudo" (UX-DR35)

**Given** a Jogador on `/hoje`
**When** the view loads
**Then** only the next upcoming session for their club is shown (or empty state if none in the next 7 days) (UX-DR8)
**And** the questionário CTA (Epic 4) appears here when applicable

**Given** the season toggle (Story 2.5)
**When** the user switches to "Cumulativo"
**Then** sessions from all seasons are listed paginated (most recent first)

**Given** a cancelled session
**When** rendered
**Then** the card visually appears struck-through with `text/muted` and an explicit "Cancelada" badge
**And** is ordered alongside active sessions of the same date

**Given** a11y (NFR38)
**When** the user navigates the calendar by keyboard
**Then** sessions are reachable via Tab order
**And** the current day has `aria-current="date"`

### Story 2.8: Match Squad Selection — Convocados & Starting XI

As a Treinador,
I want to define the convocados list and the starting XI for each match (or friendly),
So that the squad is committed before kickoff and downstream flows (presence, events, minute derivation) have a baseline.

**Acceptance Criteria:**

**Given** migration `000130_match_lineups.sql`
**When** applied
**Then** table `match_lineups` exists (id uuid PK, session_id uuid FK, player_id uuid FK, role text CHECK in ('starter','bench','convocado_only'), shirt_num int, started_minute int default 0, ended_minute int nullable)
**And** RLS enabled with club isolation derived from `session_id` (FR18)
**And** unique constraint `(session_id, player_id)`

**Given** Treinador on `/sessoes/[id]/convocatoria` for a `match` or `friendly`
**When** the page loads
**Then** the active, non-inactive players from the club are shown grouped by position
**And** the user can toggle each player into "Titular (XI)", "Banco", or leave unselected (not convocado)
**And** a counter shows "X / 11 titulares · Y suplentes"

**Given** the user submits the lineup
**When** valid (exactly 11 starters)
**Then** rows are inserted/updated with `role='starter'` for XI, `role='bench'` for substitutes, `role='convocado_only'` if explicitly added without bench/starter slot
**And** `started_minute=0` for starters and `null` for bench (filled when sub happens in Epic 6)
**And** Zod blocks submit if not exactly 11 starters

**Given** the lineup exists
**When** the Treinador edits before kickoff
**Then** changes are written and an audit log entry is created
**And** after `scheduled_at + duration_min` the lineup is locked (read-only) — substitutions go through Epic 6 instead

**Given** a `training` session
**When** opening this page
**Then** the URL responds 404 / "Não aplicável a treinos" — convocatória is only for matches/friendlies

**Given** the touch target rule (NFR40)
**When** rendered on mobile
**Then** each player toggle is ≥44×44px

### Story 2.9: Retention Policy — Preserve History 5 Seasons + Anonymization Hook

As the system,
I want to preserve player history for 5 seasons after they leave the club, then anonymize personal data automatically,
So that we comply with the retention policy without manual intervention.

**Acceptance Criteria:**

**Given** the retention policy (FR16, NFR16, AR23)
**When** a player is archived (Story 2.1) and 5 seasons have elapsed since `players.archived_at`
**Then** a pg_cron job `anonymize_archived_players` runs monthly
**And** sets `full_name='[anonimizado]'`, `birthdate=null`, `photo_path=null`, deletes the photo file from Storage
**And** keeps fatigue/match_event/metric history with `player_id` intact (statistics-only retention)

**Given** migration `000140_pg_cron_retention.sql`
**When** applied
**Then** the pg_cron extension is enabled
**And** the monthly job is registered with cron `0 4 1 * *` (1st of month, 04:00 UTC)
**And** the job logs each anonymization to `audit_logs` with `action='retention.anonymized'` (FR50)

**Given** an analyst views an anonymized player's profile
**When** the page loads
**Then** the name shows "[anonimizado]" with a tooltip "Política de retenção: 5 épocas pós-saída"
**And** historical metrics/aggregates remain visible
**And** photo placeholder uses lucide `circle-dashed` icon (no exposed image)

**Given** a player's archive timestamp
**When** the Analista hovers/taps the archive metadata
**Then** the system shows "Será anonimizado em DD/MM/YYYY" calculated as `archived_at + 5 seasons`

**Given** test coverage (NFR54)
**When** unit tests run with mocked time
**Then** the anonymization function is covered ≥80% including: not yet due, exactly due, already anonymized (idempotent)

**Given** the Growth-phase full automation (FR16 [Growth])
**When** Phase 2 evolves
**Then** the same hook is reused without rewriting (Phase 1 already implements the automatic anonymization; only PII-dashboard surfacing is Phase 2)

### Story 2.11: Calendar Visual Alignment — Session Block Colors, Week/Month Toggle & "Próximos 7 Dias"

As a Treinador or Analista,
I want the Calendar to visually match the approved mockups (`docs/ux-design/Variação A Semana` and `Variação B Mês`),
So that the experience is polished, role-appropriate, and consistent with the established look & feel.

**Context:** Stories 2-6 and 2-7 implemented the Calendar's data layer and base structure. This story adds the visual layer defined in the UX mockups, which was not yet implemented. Requires Story 1-17 (token alignment) to be done first.

**Acceptance Criteria:**

**Given** the week view (Variação A — timeline + agenda)
**When** the `/calendario` page renders in week mode
**Then** the top strip shows 7 day chips (SEX/SÁB/DOM/SEG/TER/QUA/QUI) with the active day highlighted using a solid pill (bg-foreground, text-background)
**And** the active day chip has a colored dot below it indicating the session type (or neutral if no session)
**And** sessions for the selected day are shown as colored full-width blocks: `Fisioterapia`=purple (`#7C3AED`), `Treino *`=blue (`#2563EB`), `Jogo *`=red (`signal-alert`), `Amigável`=yellow (`signal-caution`), `Recuperação`=green (`signal-ready`)
**And** each session block shows: session type, time + duration, location (if set), and an attendance count badge (e.g. "36")
**And** below the "hoje" sessions block, a "Próximos 7 dias" section lists upcoming sessions with a colored left-border line per type, time, and attendance count

**Given** the month view (Variação B — grid heatmap + agenda)
**When** the user toggles to month view
**Then** a full-month grid renders with week columns (DOM through SÁB)
**And** each day cell shows: day number, colored dots for each session type that day (max 3 dots, then "+N"), and a subtle highlight for today
**And** tapping/clicking a day cell scrolls to that day's session block in the "Próximos 7 dias" list below the grid
**And** the selected day has a border outline (not filled, to avoid competing with the colored session dots)

**Given** the week/month toggle
**When** the Calendar page header renders
**Then** a segmented control "Semana | Mês" is visible in the header
**And** the selected mode persists across navigation (localStorage or URL param)

**Given** dark mode support (Story 1-17 tokens required)
**When** `prefers-color-scheme: dark` is active
**Then** session block backgrounds use darkened variants of the session type colors (opacity 0.2 on dark surface, text uses full-brightness color)
**And** day chip active state inverts correctly (bg-foreground → near-white on dark)
**And** contrast ratios meet ≥4.5:1 for all text-on-background combinations

**Given** role-based display (Story 2-7 existing logic)
**When** a Jogador accesses `/calendario` (their view `/hoje`)
**Then** the player sees only sessions they are convocado for, with no staff-only attendance count badge
**And** week/month toggle is still available

**Given** accessibility
**When** the Calendar renders
**Then** each day chip has `aria-label="[dia], [data], [N sessões]"`
**And** session blocks have `role="article"` with `aria-label` describing type, time, and location
**And** the week/month toggle uses `role="tablist"` / `role="tab"` with `aria-selected`

**Given** existing tests (Story 2-6, 2-7)
**When** `npm run test --run` executes
**Then** all prior calendar tests continue to pass
**And** ≥6 new tests cover: day chip selection, session block color mapping, month grid dot rendering, "Próximos 7 dias" list, toggle persistence, dark mode token usage via CSS variables

## Epic 3: Consentimento Parental & Direitos GDPR

Encarregados confirmam consentimento parental via link tokenizado (sem criar conta) com timestamp/IP/versão registados; titulares exercem direitos RGPD (exportação CSV ≤30 dias, apagamento em cascata ≤30 dias, retificação ≤7 dias com log auditável, retirada de consentimento imediata, tratamento limitado, consulta de logs de acesso aos seus dados de saúde nos últimos 12 meses). Sistema preparado conformemente para receber dados de menores 13–15. Política de privacidade versionada e adaptada linguisticamente.

### Story 3.1: Privacy Policy Versioning + Sub-14 Adapted Copy

As the system,
I want every privacy policy version to be stored with its full text and a sub-14 adapted version,
So that every consent record is bound to a precise, immutable text and minors get B1-simplified copy.

**Acceptance Criteria:**

**Given** migration `000150_privacy_policies.sql`
**When** applied
**Then** table `privacy_policies` exists (id uuid PK uuidv7, version text, effective_from date, body_full_md text, body_u14_md text, is_current boolean, created_at)
**And** unique constraint enforces only one `is_current=true` row globally (FR54)

**Given** the initial seed
**When** `seed.sql` runs
**Then** version `1.0.0` exists with `is_current=true`
**And** both `body_full_md` and `body_u14_md` are non-empty PT-PT B1 copy (NFR42, NFR43)

**Given** any new policy version
**When** inserted via migration
**Then** the previous `is_current` row is set to false in the same transaction
**And** `effective_from = today` is recorded

**Given** a user reads `/politica-privacidade`
**When** the page renders
**Then** the current `body_full_md` is rendered as Markdown
**And** if the user is a player aged 13–15 (`age_group in ('u14','u15')`), the `body_u14_md` is rendered instead (FR53, FR22)
**And** `<html lang="pt-PT">` is preserved (UX-DR39)

**Given** a player aged 13–15 viewing the policy
**When** they tap a glossary term (e.g., "RGPD")
**Then** a `<TooltipExplain>` shows a B1 definition (UX-DR9)

**Given** the editorial tone (UX-DR38)
**When** copy is reviewed
**Then** sentences ≤20 words, 2nd person singular ("os teus dados"), no emojis, no exclamation marks, B1 CEFR ceiling

### Story 3.2: Parental Consent — Schema, Token Generation & Underage Access Block

As the system,
I want a tokenized parental-consent record per minor and to block their access until confirmation,
So that no health data of a 13–15 year old is collected without verifiable parental approval.

**Acceptance Criteria:**

**Given** migration `000160_parental_consents.sql`
**When** applied
**Then** table `parental_consents` exists (id uuid PK uuidv7, club_id uuid FK, player_id uuid FK, parent_email citext, token text unique, token_expires_at timestamptz, status text CHECK in ('pending','confirmed','withdrawn','expired'), confirmed_at timestamptz nullable, confirmed_ip inet nullable, policy_version_id uuid FK privacy_policies, created_at timestamptz)
**And** RLS enabled with club isolation; tokens are queryable via service-role only (AR13)
**And** unique partial index `(player_id) where status in ('pending','confirmed')`

**Given** a player aged 13–15 is created (Story 2.1)
**When** the Analista provides the parent email during creation
**Then** a row in `parental_consents` is inserted with `status='pending'`, fresh `token=newId()`, `token_expires_at=now()+90d`, `policy_version_id` = current policy (FR4, FR6)

**Given** a 13–15 year old player attempts to log in (Epic 1 auth)
**When** their `parental_consents.status != 'confirmed'`
**Then** the middleware blocks access to all routes except `/aguardar-consentimento`
**And** `/aguardar-consentimento` shows copy "O teu encarregado de educação ainda precisa de confirmar." with a "Reenviar email" CTA (rate-limited to 1 per 5 minutes) (FR4)

**Given** the player turns 16 mid-flow
**When** their `birthdate` indicates ≥16
**Then** the middleware bypasses the consent gate (mediation no longer required for that age)

**Given** age detection
**When** birth date is unknown or empty
**Then** the player is treated as a minor by default (fail-safe)

**Given** test coverage (NFR54)
**When** integration tests run
**Then** all consent states (pending, confirmed, withdrawn, expired) and age boundary cases (15→16 transition, missing birthdate) are covered

### Story 3.3: Parental Consent — Email Send & Token Landing Page

As an Encarregado de Educação,
I want to receive an email with a one-click link that confirms my consent without making me create an account,
So that I can authorize my child's participation with minimum friction.

**Acceptance Criteria:**

**Given** a `parental_consents` row with `status='pending'` (FR5, FR45)
**When** the Edge Function `send-parental-consent` is invoked
**Then** Resend EU sends the email to `parent_email`
**And** the email is rendered from `<ParentalConsentEmail>` template (UX-DR23) — ≤50KB inline-CSS, plain-text fallback, B1 PT-PT, ≤200 words, single primary CTA "Confirmar consentimento"
**And** the email links to `https://<host>/consentimento/<token>`

**Given** the Encarregado clicks the link
**When** the route `/consentimento/[token]` is requested (`<ConsentLandingPage>`, UX-DR24)
**Then** the page is server-rendered, progressively enhanced (works without JS)
**And** the token is validated via Edge Function `consent-validate` (service-role, bypasses RLS, AR13)

**Given** the token state
**When** valid and `status='pending'` and not expired
**Then** the page shows the policy version (`body_full_md`) + child name + "Confirmo o consentimento" primary button + "Recusar" ghost button (UX-DR30)
**When** the token is `expired` (>90 days) or already `confirmed`/`withdrawn`/invalid
**Then** the page shows the appropriate explanatory state (no leak of validity beyond what the user typed) with `<EmptyState>` (UX-DR8)

**Given** the Encarregado submits "Confirmar consentimento"
**When** processed
**Then** `status='confirmed'`, `confirmed_at=now()`, `confirmed_ip=request_ip`, `policy_version_id` = current policy version (FR6)
**And** the player can now access the app
**And** an `audit_logs` entry `action='consent.confirmed'` is recorded
**And** a confirmation email is sent to `parent_email` ("Consentimento registado em DD/MM/YYYY")

**Given** the Encarregado submits "Recusar"
**When** processed
**Then** `status='withdrawn'`, `confirmed_at=now()` (recording moment of action)
**And** the app remains blocked for the player
**And** the staff is notified by email and in-app banner

**Given** EU residency (NFR30)
**When** Resend is invoked
**Then** the EU instance is used; no third-party tracker is embedded in the email body (NFR22)

### Story 3.4: Parental Consent — Reminders Day 7/14 + Staff Alert

As the system,
I want to automatically resend the parental consent request at day 7 and day 14, and alert the staff after 14 days without response,
So that consent does not silently lapse and the staff can intervene with the family if needed.

**Acceptance Criteria:**

**Given** migration `000170_pg_cron_consent_reminders.sql`
**When** applied
**Then** the pg_cron job `parental_consent_reminders` runs daily at 08:00 UTC

**Given** the daily job runs
**When** evaluating `parental_consents` with `status='pending'`
**Then** for rows where `created_at` is exactly 7 days ago, the `send-parental-consent` Edge Function is invoked again with subject prefix "[Lembrete]"
**And** for rows where `created_at` is exactly 14 days ago, the same is invoked with "[2º lembrete]"
**And** for rows where `created_at` is ≥14 days ago and a staff alert hasn't been sent, an email is sent to the club's coach + analyst with copy "X jogadores com consentimento parental por confirmar" and an in-app banner is added on `/plantel` (FR7)

**Given** the staff alert
**When** rendered as in-app banner
**Then** it lists the affected player names with a "Reenviar manualmente" action that triggers `send-parental-consent` immediately (rate-limited to 1 per 5 minutes per row)

**Given** idempotency
**When** the same row would receive the same reminder twice (e.g., job retried)
**Then** a `parental_consent_reminders_log` (id, consent_id, kind, sent_at) prevents duplicate sends within a 24h window

**Given** test coverage (NFR54)
**When** unit tests run with mocked time
**Then** the day-7, day-14, and post-14 staff-alert branches are covered

### Story 3.5: Subject Rights Hub — Routing for Adult Titular & Encarregado

As an adult titular (or Encarregado de Educação),
I want a single hub where I can see and trigger every right I have under GDPR,
So that I do not need to email anyone or hunt around to exercise my rights.

**Acceptance Criteria:**

**Given** the routes `/configuracoes/direitos` (logged-in adult titular) and `/direitos/[token]` (Encarregado tokenized)
**When** the user reaches the hub (FR8 entry, FR9 entry)
**Then** the page lists exactly 5 actions: "Exportar os meus dados (CSV)", "Apagar os meus dados", "Retificar dados pessoais", "Limitar tratamento", "Retirar consentimento"
**And** each action navigates to its dedicated route (Stories 3.6–3.10)
**And** until each downstream story is implemented, the action route returns "Em desenvolvimento" with a clear note

**Given** an adult titular (≥16) on `/configuracoes/direitos`
**When** the page loads
**Then** their identity is the logged-in `auth.uid()`
**And** the actions apply to their own data only (FR9)

**Given** an Encarregado on `/direitos/[token]`
**When** the route is requested
**Then** the token is validated via Edge Function (service-role) against `parental_consents` rows where `parent_email` matches and `status='confirmed'`
**And** if valid, the actions apply to the linked minor's data (FR8)
**And** the token has a 30-day expiry; expired/invalid tokens show an explanatory `<EmptyState>` (UX-DR8)

**Given** a player <16 logged in directly
**When** they navigate to `/configuracoes/direitos`
**Then** the page shows "As tuas opções estão com o teu encarregado de educação. Pede-lhe para abrir o email mais recente da SPARTA."
**And** no action buttons are visible (FR8 — only Encarregado mediates)

**Given** the navigation pattern (UX-DR26)
**When** the user is on the hub
**Then** breadcrumbs (desktop) or sticky header (mobile) clearly indicate they are in "Os meus direitos"

### Story 3.6: Right to Export — CSV Download

As an adult titular or Encarregado,
I want to export my (or my child's) personal and biometric data as a structured CSV bundle,
So that I have full portability of my data within ≤30 days as required by GDPR Art. 15/20.

**Acceptance Criteria:**

**Given** Edge Function `export-csv`
**When** triggered from the hub (Story 3.5)
**Then** it queries all rows for the subject across `profiles`, `players`, `player_metrics`, `fatigue_responses`, `match_events`, `session_metrics`, `attendances`, `match_lineups`, `parental_consents`, `data_decisions`, `audit_logs`, `notification_log` (FR46, NFR27)
**And** generates a ZIP with one CSV per table, named `<table>.csv`, plus a `README.txt` explaining each file
**And** uploads the ZIP to a private Supabase Storage bucket `exports` with a 7-day signed URL

**Given** the export is generated synchronously when ≤5MB
**When** size is larger
**Then** the function processes asynchronously; a `<CalmConfirmation>` shows "A processar — vais receber um email com o link em alguns minutos"

**Given** the export completes
**When** the email is sent (FR45)
**Then** Resend EU sends a transactional email with subject "A tua exportação está pronta" and the signed URL
**And** copy is B1 PT-PT, ≤200 words, no emojis (UX-DR38)
**And** an `audit_logs` entry `action='subject.exported'` is recorded

**Given** the SLA NFR27
**When** measured from request to email delivery
**Then** the export is delivered in ≤30 days (target: ≤10 minutes for small subjects)

**Given** download access
**When** the URL is opened
**Then** the file is served over HTTPS (NFR14)
**And** the URL expires after 7 days

**Given** audit visibility
**When** the subject opens Story 3.12 (visibility)
**Then** the export entry is listed

### Story 3.7: Right to Erasure — Cascade Deletion

As an adult titular or Encarregado,
I want to delete all my (or my child's) data with a cascade across every related table,
So that GDPR Art. 17 is honoured within ≤30 days.

**Acceptance Criteria:**

**Given** Edge Function `erase-cascade`
**When** triggered from the hub
**Then** a destructive `<Dialog>` requires a typed confirmation ("Confirmo o apagamento") (UX-DR33)
**When** confirmed
**Then** the function deletes the subject's rows from `players`, `player_metrics`, `fatigue_responses`, `match_events`, `session_metrics`, `attendances`, `match_lineups`, `parental_consents`, `data_decisions`, `notification_log`, `push_subscriptions` (FR47, NFR26)
**And** preserves `audit_logs` entries with `actor_id` rewritten to NULL and `target_id` rewritten to NULL but actions retained for 12 months (immutable evidence)
**And** the user's `auth.users` row is deleted at the end (Supabase Auth API)

**Given** the cascade
**When** the function runs
**Then** it uses a transaction wrapping all deletes; partial failure rolls back
**And** an `audit_logs` entry `action='subject.erased'` is created BEFORE the row is anonymized so the action remains visible
**And** the SLA target is ≤30 days (NFR26); operational target ≤30 seconds

**Given** the email confirmation (FR45)
**When** erasure completes
**Then** Resend EU sends a transactional email "Os teus dados foram apagados em DD/MM/YYYY"
**And** if the subject is a child, the email also goes to the parent

**Given** post-erasure
**When** the user attempts to log in
**Then** the auth fails ("Conta não encontrada")
**And** any session cookies are invalidated server-side (NFR18)

**Given** test coverage (NFR54)
**When** integration tests run
**Then** the cascade is verified across all tables AND audit_logs is preserved

### Story 3.8: Right to Rectification — Staff-Mediated with Audit Log

As an adult titular or Encarregado,
I want to request rectification of personal data (name, birthdate, email, etc.) and have the staff act on it within ≤7 days,
So that GDPR Art. 16 is honoured with full traceability.

**Acceptance Criteria:**

**Given** the rectification entry on the hub
**When** the user submits the form (which fields, requested values, free-text reason)
**Then** a row in `rectification_requests` (migration `000180_rectification_requests.sql`) is inserted with `status='pending'` (FR48, NFR28)
**And** `<CalmConfirmation>` "Pedido recebido — vais ter resposta em até 7 dias" is shown

**Given** staff on `/configuracoes/direitos-pendentes`
**When** the page loads
**Then** all pending requests for the club are listed (RLS by club_id)
**And** each can be approved (apply the change) or rejected with a reason

**Given** staff approves the rectification
**When** committed
**Then** the change is applied to the source table (e.g., `players.full_name`)
**And** `rectification_requests.status='applied'`, `applied_at`, `applied_by` are written
**And** an `audit_logs` entry `action='subject.rectified'` with before/after values in `payload` is recorded (FR48)

**Given** staff rejects the request
**When** committed with a reason
**Then** `status='rejected'`, `rejected_at`, `rejected_by`, `reject_reason` are written

**Given** SLA NFR28
**When** any pending request reaches day 5
**Then** an in-app banner appears for the staff
**And** at day 7, an email reminder is sent to the staff

**Given** subject notification (FR45)
**When** the request is resolved (applied or rejected)
**Then** the subject receives an email summarizing the outcome

### Story 3.9: Right to Restrict Processing — Freeze State

As an adult titular or Encarregado,
I want to mark my account as "tratamento limitado" so the system stops collecting and processing my data without erasing history,
So that I can pause the system's activity over me without losing past records.

**Acceptance Criteria:**

**Given** migration `000190_processing_restrictions.sql`
**When** applied
**Then** column `processing_restricted boolean default false` and `restricted_at timestamptz nullable` are added to `profiles` (and to `players` if standalone-without-profile)
**And** RLS allows the subject to set their own (or, for Encarregado, the linked minor's) flag (FR49)

**Given** the subject toggles "Limitar tratamento" on the hub
**When** confirmed via destructive `<Dialog>` (UX-DR33)
**Then** `processing_restricted=true`, `restricted_at=now()` are set
**And** an `audit_logs` entry `action='subject.restricted'` is recorded
**And** the change takes effect immediately (NFR29)

**Given** restriction is active
**When** any subsequent write affecting the subject is attempted (fatigue submission, event registration, lineup, etc.)
**Then** the operation is rejected with a clear inline message ("Tratamento limitado — não podemos registar novos dados")
**And** read of historical data is unaffected

**Given** the subject reverses the restriction
**When** they toggle it off
**Then** `processing_restricted=false`, `restricted_at=null` are set immediately
**And** writes resume normally
**And** the audit log records `action='subject.unrestricted'`

**Given** automatic notifications
**When** a session approaches and the subject is restricted
**Then** no push or email is sent to them (NFR21)

### Story 3.10: Right to Withdraw Consent — Immediate Effect

As an adult titular or Encarregado,
I want to withdraw consent immediately and trigger anonymization of my data,
So that GDPR Art. 21 is honoured with no waiting period.

**Acceptance Criteria:**

**Given** the withdrawal entry on the hub
**When** the subject confirms via destructive `<Dialog>`
**Then** consent withdrawal is recorded immediately (NFR29)
**And** the audit_logs entry `action='subject.withdrew'` is created

**Given** the subject is an adult titular (FR9)
**When** withdrawal happens
**Then** processing stops (same as restriction) AND erasure cascade (Story 3.7) is triggered automatically as the GDPR-prescribed downstream effect
**And** the subject is logged out

**Given** the subject is an Encarregado for a minor (FR8)
**When** withdrawal happens
**Then** the minor's `parental_consents.status='withdrawn'` is set
**And** the minor's account is blocked (Story 3.2 middleware)
**And** the cascade erasure is triggered automatically

**Given** an in-flight outbox (NFR52, AR20)
**When** withdrawal is confirmed
**Then** any pending offline mutations for the subject are dropped (not synced to server)

**Given** subject visibility
**When** the audit log is queried (Story 3.12)
**Then** the withdrawal entry is the latest visible entry before erasure-anonymization scrubs identifiers

### Story 3.11: Health Data Access Audit Logging — Auto-Wrapper for Staff Reads

As the system,
I want every staff-side read of health data to automatically write an `audit_logs` entry,
So that FR50 is enforced uniformly and FR51 has data to display from day one.

**Acceptance Criteria:**

**Given** `lib/data/audited.ts`
**When** the wrapper `auditedRead({ targetKind, targetId, action }, fn)` is invoked from any Server Action / Edge Function reading `fatigue_responses`, `match_events`, `readiness_snapshots`, `session_metrics`
**Then** before returning the result it inserts an `audit_logs` row with `actor_id=auth.uid()`, `action`, `target_kind`, `target_id`, `payload` (FR50, AR21)
**And** the audit insertion is fire-and-forget (does not block the read latency)

**Given** the lint rule `no-direct-health-data-read`
**When** any code outside `lib/data/audited.ts` queries the listed health tables directly
**Then** ESLint fails the build with "Use auditedRead() to enforce FR50 logging"

**Given** the retention rule (NFR20)
**When** the pg_cron job from Story 1.12 runs
**Then** entries older than 12 months are deleted

**Given** test coverage (NFR54)
**When** unit tests run
**Then** the wrapper logs correctly across mocked auth contexts AND skips logging when no `auth.uid()` (system-internal jobs) AND fails closed if logging itself errors persistently

**Given** structured logs (NFR56)
**When** an audit insert fails
**Then** a JSON error log is emitted to stdout for ops follow-up

### Story 3.12: Subject Visibility — Who Accessed My Health Data

As an adult titular or Encarregado,
I want to see a list of every staff access to my (or my child's) health data in the last 12 months,
So that GDPR Art. 15 is honoured concretely with named accesses, not abstract policy.

**Acceptance Criteria:**

**Given** the route `/configuracoes/direitos/acessos` (titular) or the equivalent under `/direitos/[token]/acessos` (Encarregado)
**When** the user reaches the page
**Then** the last 12 months of `audit_logs` entries with `target_id = subject` are shown chronologically (FR51, NFR20)
**And** each entry lists `occurred_at` (date+time pt-PT, UX-DR36), `actor` full name + role, `action` translated to PT-PT (e.g., "Consultou questionário de fadiga"), `target_kind` translated

**Given** RLS policy on `audit_logs` (Story 1.12)
**When** the subject queries
**Then** only entries with `target_id = auth.uid()` (or linked minor for Encarregado) are returned
**And** entries from other subjects are not leaked

**Given** export support
**When** the subject taps "Exportar este histórico"
**Then** a CSV is generated and downloaded (or emailed if large) using the Story 3.6 infrastructure

**Given** large lists
**When** there are >100 entries
**Then** pagination loads 50 at a time
**And** a search by date range is provided

**Given** the empty case
**When** no accesses exist (e.g., new subject)
**Then** an `<EmptyState>` is shown: "Sem acessos registados. Os teus dados ainda não foram consultados pelo staff." (UX-DR8)

**Given** copy tone (UX-DR38)
**When** the page renders
**Then** all action translations use 2nd person singular and are ≤15 words; no emojis

## Epic 4: Recolha de Fadiga & Notificações (jornada do Tomás)

Jogador responde questionário de fadiga (5 dimensões, slider 1–5 com snap discreto, adaptação sub-14), em modo offline com sincronização automática e badge de pendentes; recebe push notifications opacas X minutos antes/depois de sessão (X/Y configuráveis pelo staff); pode subscrever/cancelar. Staff vê respostas individuais e tendências sem mediação adicional. Filosofia "dados mediados" enforçada (Jogador não vê o seu Painel, Curva de Recuperação ou relatórios processados).

### Story 4.1: Fatigue Response Schema & Idempotent Server Action

As the system,
I want a `fatigue_responses` table and an idempotent server action that accepts client-generated UUIDv7 IDs,
So that submissions are durable, deduplicated, and ready for offline replay from day one.

**Acceptance Criteria:**

**Given** migration `000200_fatigue_responses.sql`
**When** applied
**Then** table `fatigue_responses` exists (id uuid PK uuidv7, club_id uuid FK, player_id uuid FK, session_id uuid FK, phase text CHECK in ('pre','post'), dim_energy int CHECK 1–5, dim_focus int CHECK 1–5, dim_sleep int CHECK 1–5, dim_soreness int CHECK 1–5, dim_mood int CHECK 1–5, srpe_value int nullable CHECK 1–10, submitted_at timestamptz, submitted_via text CHECK in ('online','offline-drain'))
**And** RLS enabled with two policies: "player sees own" (`player_id = auth.uid()`-linked profile) and "staff reads club" (`auth.user_role() in ('coach','analyst')` AND `club_id = auth.club_id()`) (FR3, FR25, FR26)
**And** unique index on `(player_id, session_id, phase)` enforces one response per phase per session
**And** index `idx_fatigue_responses_player_submitted` on `(player_id, submitted_at desc)` for trend queries (NFR1)

**Given** Server Action `submitFatigueResponse(payload)` in `lib/actions/fatigue.ts`
**When** invoked with a UUIDv7 id and the 5 dimensions
**Then** it performs an upsert (`on conflict (id) do update set`) — replaying the same payload is a no-op (FR23, NFR48)
**And** validates via Zod (all dimensions 1–5; phase enum; player owns the record)
**And** returns the persisted row id

**Given** the action wraps the read paths via `auditedRead()` (Story 3.11)
**When** staff later reads fatigue responses
**Then** an audit log entry is created automatically (FR50)

**Given** processing-restriction enforcement (Story 3.9)
**When** the player has `processing_restricted=true`
**Then** the action rejects the write with a clear error returned to the UI

**Given** test coverage (NFR54)
**When** unit tests run
**Then** Zod validation, upsert idempotency, RLS isolation, and processing-restriction rejection are covered

### Story 4.2: Fatigue Questionnaire UI — 5 Sliders with Snap, Single View

As a Jogador,
I want a single-page questionnaire with 5 sliders (1–5, snap discrete) before and after each session,
So that I can fulfill my contribution to the team's data without complex navigation.

**Acceptance Criteria:**

**Given** the route `/questionario/[sessionId]/[phase]` (`<FatigueQuestionnaire>`, UX-DR16)
**When** the page loads for an authenticated player whose session is "live" (within phase window)
**Then** all 5 dimensions are shown stacked in a single view (UX-DR47)
**And** each is a `<FatigueSlider>` (UX-DR17) with extremes labeled in PT-PT ("Esgotado | Pleno", "Disperso | Concentrado", "Mau | Excelente sono", "Muito dor | Sem dor", "Mau | Bom estado")
**And** sliders snap to 1/2/3/4/5 only — no continuous values (UX-DR47)
**And** tap on any track point sets the position immediately

**Given** autosave (UX-DR16)
**When** any slider value changes
**Then** the partial state is debounced 800ms and persisted in IndexedDB keyed by `(sessionId, phase, playerId)`
**And** if the user closes and reopens the page, partial answers are restored

**Given** a primary submit button (UX-DR30)
**When** the player taps "Submeter" (only enabled when all 5 are set)
**Then** `submitFatigueResponse()` is called with a fresh UUIDv7 (Story 4.1)
**And** the IndexedDB partial state is cleared
**And** `<CalmConfirmation>` "Registado, bom treino" is shown (UX-DR11, UX-DR38)
**And** the user is redirected to `/hoje`

**Given** submission of `phase='post'` includes the optional Session-RPE
**When** the post-session questionnaire is submitted
**Then** an additional 1–10 slider for Session-RPE appears below the 5 dimensions (FR21 + Epic 6 sRPE source)
**And** if blank, `srpe_value` is null

**Given** keyboard navigation (NFR38, UX-DR40)
**When** a slider receives focus
**Then** Left/Right arrow keys decrement/increment the value
**And** `aria-valuetext` reads "X de 5 — <label>" (e.g., "3 de 5 — médio") (UX-DR17)

**Given** axe-core (NFR37)
**When** tests run on `<FatigueQuestionnaire>` and `<FatigueSlider>`
**Then** zero a11y violations are reported

### Story 4.3: Sub-14 Linguistically Adapted Version

As a Jogador aged 13–15,
I want the questionnaire copy to be simplified and warmer,
So that I can answer accurately without feeling judged or confused by clinical language.

**Acceptance Criteria:**

**Given** a player whose `age_group` is `u14` or `u15` (FR22, NFR43)
**When** the questionnaire loads
**Then** `<FatigueSlider>` receives `ageGroup="u14"` and uses simplified copy ("Cansado | Cheio de energia", "Distraído | Atento", "Dormi mal | Dormi bem", "Tenho dor | Sem dor", "Triste/zangado | Bem-disposto")
**And** dimension titles use plain words (e.g., "Como te sentes hoje?" rather than "Estado emocional") (UX-DR32)

**Given** the submit button copy
**When** rendered for sub-14
**Then** the copy reads "Pronto, terminámos" instead of "Submeter" (UX-DR32)

**Given** help text
**When** the page renders for sub-14
**Then** a single-sentence introduction explains "Não há respostas certas. O que importa é como te sentes mesmo." in B1 PT-PT (NFR42)

**Given** test coverage
**When** snapshot tests run with `ageGroup="u14"` and `ageGroup="senior"`
**Then** the rendered copy differs as specified
**And** axe-core passes both variants (NFR37)

### Story 4.4: Offline Submission + Pendentes Badge + Force Sync

As a Jogador,
I want to submit the questionnaire even when I have no connectivity, see how many submissions are pending, and force a manual sync,
So that I never lose my answers and I have visibility into the offline state.

**Acceptance Criteria:**

**Given** the player taps "Submeter" while offline
**When** the action is invoked
**Then** the payload (with UUIDv7 id) is enqueued in the Dexie outbox (`kind='fatigue.submit'`) (Story 1.11, FR23, AR18)
**And** `<CalmConfirmation>` shows "Em modo offline. Os teus dados estão seguros e vão ser enviados quando voltares a ter rede." (UX-DR38)

**Given** connectivity returns
**When** the foreground drain runs
**Then** queued submissions are sent to `submitFatigueResponse()` (Story 4.1)
**And** server upserts dedupe by UUIDv7 (NFR48)
**And** `submitted_via='offline-drain'` is recorded
**And** the drain completes ≤5s for up to 50 entries on 4G (NFR3, NFR47)

**Given** the player's `<PendingBadge>` (UX-DR7)
**When** the outbox count > 0
**Then** the bottom tab "Hoje" shows "X pendentes" in `signal/info` blue with `aria-live="polite"` (FR24)
**When** count = 0
**Then** the badge is hidden

**Given** the badge is tapped
**When** the user is on `/hoje`
**Then** a "Sincronizar agora" ghost button is visible
**When** tapped
**Then** the drain runs immediately (foreground)
**And** completion shows the badge updating to the new count (or hiding if zero) (FR24)

**Given** orphan-outbox protection (NFR52, AR20, Story 1.11)
**When** the player tries to log out with pending fatigue submissions
**Then** the warning `<Dialog>` lists the pending count

**Given** test coverage (NFR54)
**When** integration tests run
**Then** offline submit, replay, dedupe, and force-sync are covered

### Story 4.5: Staff Read — Individual Responses & 4-Week Trends

As a Treinador or Analista,
I want to consult any player's fatigue responses and 4-week trend without intermediate approvals,
So that I can interpret the data in the moment of decision (Painel drill-down, training plan).

**Acceptance Criteria:**

**Given** the route `/plantel/[id]/fadiga` (staff-only via middleware role check)
**When** the staff opens it
**Then** the most recent 28 days of `fatigue_responses` for that player are queried via `auditedRead()` (Story 3.11, FR50)
**And** rendered as a recharts time series with 5 lines (one per dimension) plus optional sRPE markers (FR25)
**And** a tabular view per session is also available via a `<Tabs>` toggle

**Given** the time series chart
**When** rendered
**Then** the y-axis is fixed 1–5 with gridlines at integer values
**And** missing data points are gaps, not zero-imputed
**And** the chart respects `prefers-reduced-motion` (no animation if reduced) (NFR41)

**Given** a session with both phases recorded
**When** rendered as a tabular row
**Then** pre and post values are displayed side-by-side per dimension
**And** the delta (post − pre) is shown with semantic color (green if improved, red if worsened, neutral if same) — using redundancy color + arrow icon (UX-DR1)

**Given** filters (UX-DR35)
**When** the staff opens the filters `<Sheet>`
**Then** they can narrow by phase (`pre`/`post`/both), date range, dimensions
**And** filter state shows as removable chips

**Given** an `<EmptyState>` for new players
**When** no responses exist
**Then** copy "Sem respostas ainda. O Tomás vai começar a registar quando responder ao primeiro questionário." (UX-DR8, UX-DR38)

**Given** axe-core (NFR37)
**When** the page is tested
**Then** zero a11y violations

### Story 4.6: "Dados Mediados" Block — Player Has No Self-Access to Processed Data

As the system,
I want to enforce that a Jogador has no UI path or API path to their Painel de Prontidão, Recovery Curve, or generated reports,
So that the deliberate product principle (mediated data — staff conveys, not the system directly) is technically guaranteed.

**Acceptance Criteria:**

**Given** the route `(player)/`-scoped layout (Story 1.9)
**When** a player attempts to navigate to `/prontidao`, `/tendencias`, `/relatorios/[id]`, `/plantel/[id]/fadiga`, or any staff-only route
**Then** the middleware returns 404 (not 403, to avoid hinting that the resource exists) (FR26)

**Given** the API surface
**When** any Server Action that returns `readiness_snapshots`, individual time-series for the player's own player_id, or PDF reports is called by an authenticated player
**Then** the action returns "Não autorizado" without disclosing whether data exists (FR26)

**Given** the player views their own `/historico`
**When** the page loads
**Then** only their own submitted answers (raw scale 1–5) are listed — no derived metrics (no ACWR, no readiness state, no trends visualization)
**And** copy says "As tuas respostas. O treinador é quem interpreta como conjunto." (UX-DR38)

**Given** a CI test asserting the contract
**When** the test runs
**Then** for each player route, the response cannot leak readiness state, ACWR values, or any computed metric

**Given** test coverage (NFR54)
**When** integration tests run
**Then** all forbidden paths are exercised with player auth and verified to return 404 / "Não autorizado"

### Story 4.7: Push Subscription Infrastructure — VAPID Setup & Subscribe/Unsubscribe

As a Jogador,
I want to subscribe to and unsubscribe from push notifications at any moment,
So that I control the channel — without losing access to the app if I unsubscribe.

**Acceptance Criteria:**

**Given** migration `000210_push_subscriptions.sql`
**When** applied
**Then** table `push_subscriptions` exists (id uuid PK, club_id uuid FK, profile_id uuid FK, endpoint text, keys_json jsonb, created_at, last_used_at, is_active boolean default true)
**And** RLS enabled with self-only access for player; staff cannot read keys (NFR21)

**Given** VAPID keys (AR25, AR30)
**When** the project is configured
**Then** `VAPID_PUBLIC_KEY` is exposed via `NEXT_PUBLIC_*` for client subscription
**And** `VAPID_PRIVATE_KEY` is held only by the `send-push` Edge Function

**Given** a player on `/configuracoes/notificacoes`
**When** they tap "Ativar notificações"
**Then** the browser's push permission prompt is shown
**When** granted
**Then** the service worker (Story 1.11) registers a subscription via `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })`
**And** the subscription is upserted in `push_subscriptions` (FR44)
**And** the UI shows "Ativo" with last-used timestamp

**Given** the player taps "Desativar notificações"
**When** confirmed
**Then** `is_active=false` is set
**And** the browser-side subscription is removed via `subscription.unsubscribe()`
**And** the player is NOT logged out and retains full app access (FR44)

**Given** a player whose subscription has expired or been invalidated by the browser
**When** the next `send-push` call returns a 410 Gone
**Then** the row is marked `is_active=false` automatically

**Given** browser support
**When** the user opens the page on a browser without push support (Safari iOS pre-16.4)
**Then** the page shows an explanatory `<EmptyState>` "O teu browser ainda não suporta notificações." with no broken UI (UX-DR8)

### Story 4.8: Pre/Post Session Push Notifications with Configurable X/Y

As a Jogador with push enabled,
I want to receive an opaque push reminder X minutes before and Y minutes after each session,
So that I am gently nudged to fill the questionnaire without disclosing health context in the notification body.

**Acceptance Criteria:**

**Given** migration `000220_notification_settings.sql`
**When** applied
**Then** table `notification_settings` exists per club with columns `pre_minutes int default 30`, `post_minutes int default 30`, `is_enabled boolean default true` (FR42)
**And** the staff configures these on `/configuracoes/notificacoes-clube`

**Given** the Edge Function `schedule-session-pushes` runs hourly via pg_cron
**When** it queries upcoming sessions in the next 24h
**Then** for each player with an active push subscription it computes the pre-event time (`scheduled_at - pre_minutes`) and post-event time (`scheduled_at + duration_min + post_minutes`)
**And** enqueues two `notification_log` rows with `kind='fatigue_pre' | 'fatigue_post'`, `scheduled_for timestamptz`, `status='scheduled'`

**Given** the Edge Function `send-push` runs every 5 minutes
**When** it processes scheduled notifications whose `scheduled_for ≤ now()`
**Then** it sends each via `web-push` with VAPID
**And** the payload contains ONLY opaque text (e.g., "Treino daqui a pouco — abre o app") and a deep link to `/questionario/<sessionId>/<phase>` (FR43, NFR21)
**And** no health data, score, or session detail is in the payload (NFR21)
**And** on success `status='sent'`, on 410 the subscription is deactivated (Story 4.7)

**Given** the player taps the notification
**When** the deep link opens
**Then** the route is server-authenticated (middleware)
**And** if not logged in, redirected to `/login` with `?next=` parameter preserving the destination

**Given** processing-restriction (Story 3.9) or push-unsubscribed (Story 4.7) for a player
**When** the scheduling pass runs
**Then** that player's row is skipped (NFR21)

**Given** a session is cancelled (Story 2.6)
**When** notification_log rows for it have `status='scheduled'`
**Then** they are flipped to `status='cancelled'`
**And** no push fires

**Given** test coverage (NFR54)
**When** integration tests run
**Then** payload-opacity (no PII/health in body), retry on 410, cancellation propagation, and unsubscribed-skip are covered

## Epic 5: Painel de Prontidão & Inteligência (defining experience do José)

Treinador abre app em <3s, vê glance value agregado (3 números 48px), drill-down em <30s para detalhe individual (séries fadiga 4 semanas, ACWR + banda, presenças, nota livre), troca entre vista Lista (default) e Formação 4-3-3 via toggle no header, marca decisões data-driven (FR52). Sistema calcula ACWR (rácio carga aguda 7d / crónica 28d com limiares por escalão) e sRPE automaticamente, atualiza Painel em tempo real na janela 4h pré-sessão. Analista consulta tendências individuais 4 semanas e carga acumulada por jogador na época.

### Story 5.1: sRPE Calculation & Persistence per Session

As the system,
I want to compute and persist `sRPE = Session-RPE × duration_min` per player per session immediately after the post-session questionnaire,
So that ACWR has a stable load input and historical aggregates are queryable in O(1).

**Acceptance Criteria:**

**Given** migration `000230_session_metrics.sql`
**When** applied
**Then** table `session_metrics` exists (id uuid PK uuidv7, club_id uuid FK, session_id uuid FK, player_id uuid FK, srpe_value int CHECK 1–10, duration_min int, srpe_load int generated stored AS `srpe_value * duration_min`, computed_at timestamptz)
**And** RLS enabled with club isolation; staff read via `auditedRead()` (Story 3.11) (FR33, FR50)
**And** unique index on `(session_id, player_id)` enforces one row per player per session
**And** index `idx_session_metrics_player_computed` on `(player_id, computed_at desc)` (NFR1)

**Given** a post-session fatigue submission with `srpe_value` (Story 4.2)
**When** `submitFatigueResponse()` (Story 4.1) commits with `phase='post'` and `srpe_value` non-null
**Then** a `session_metrics` row is upserted in the same transaction with `duration_min` from the session (Story 2.6)
**And** `srpe_load` is automatically computed by the generated column

**Given** a session is registered without sRPE (player skipped it, or analyst-only session)
**When** the post window closes
**Then** `srpe_value` defaults to null and `session_metrics` is not created — ACWR (Story 5.2) treats it as missing data, not zero

**Given** test coverage (NFR54)
**When** unit tests run
**Then** computation, idempotent upsert, and missing-sRPE cases are covered ≥80%

### Story 5.2: ACWR Calculation Engine with Age-Group Thresholds

As the system,
I want a deterministic ACWR computation per player (acute 7d ÷ chronic 28d) with age-group thresholds and a confidence band,
So that the Painel can classify players into ready/caution/alert with calibrated science instead of ad-hoc rules.

**Acceptance Criteria:**

**Given** the spec (FR32)
**When** `lib/readiness/acwr.ts` `computeAcwr({ playerId, asOf })` is called
**Then** it returns `{ acute, chronic, ratio, ageGroup, threshold, state, dataSufficient }`
**And** `acute` = sum(`srpe_load`) over the 7 days ending at `asOf`
**And** `chronic` = average weekly load over the 28 days ending at `asOf` (4 trailing weeks ÷ 4)
**And** `ratio` = `acute / chronic` if `chronic > 0` else null
**And** `dataSufficient` = false if fewer than 4 chronic weeks of data (NFR1, FR32)

**Given** age-group thresholds (FR32)
**When** the function looks up the threshold table
**Then** thresholds are: `u14` `[0.8, 1.3]`, `u15` `[0.8, 1.4]`, `u17` `[0.8, 1.5]`, `u19` `[0.8, 1.5]`, `senior` `[0.8, 1.5]`
**And** `state='ready'` if ratio is within the band, `state='caution'` if outside by ≤0.2, `state='alert'` if outside by >0.2, `state='neutral'` if `dataSufficient=false`

**Given** a SQL mirror for batch refreshes
**When** migration `000240_acwr_function.sql` is applied
**Then** PL/pgSQL function `compute_acwr(player_id uuid, as_of timestamptz)` exists with identical logic
**And** `lib/readiness/acwr.ts` and the SQL function are tested for equivalence on shared fixtures (NFR54)

**Given** performance (NFR5)
**When** ACWR is recomputed for 18 convocados after a session is registered
**Then** the batch completes ≤3 seconds

**Given** test coverage (NFR54)
**When** unit tests run
**Then** boundary cases (insufficient data, zero chronic, very high ratio, age boundaries u14/u15) are covered ≥80%

### Story 5.3: Readiness Snapshots — Materialized Source for the Painel

As the system,
I want a `readiness_snapshots` table refreshed on demand and indexed by player + session,
So that the Painel reads in ≤2 seconds for 40 players (NFR1) without re-running ACWR per row.

**Acceptance Criteria:**

**Given** migration `000250_readiness_snapshots.sql`
**When** applied
**Then** table `readiness_snapshots` exists (player_id uuid PK part, session_id uuid PK part, club_id uuid, computed_at timestamptz, state text, acwr numeric(4,2), acwr_band_lo numeric(4,2), acwr_band_hi numeric(4,2), recent_fatigue_avg numeric(3,2), attendance_rate numeric(3,2), data_sufficient boolean, derived_age_group text)
**And** RLS enabled with club isolation; staff read via `auditedRead()` (FR50)
**And** primary key is composite `(player_id, session_id)` so each upcoming session has its own snapshot row

**Given** the refresh function
**When** `refresh_readiness(session_id uuid)` is invoked
**Then** for every active player attached to the club of the session it computes ACWR (Story 5.2), recent_fatigue_avg (last 7 days mean across 5 dimensions, normalized 1–5), attendance_rate (presences ÷ scheduled in last 28 days), and combines them into `state` per the rule:
- `alert` if ACWR=alert OR recent_fatigue_avg ≤ 2.0 OR attendance_rate < 0.5
- `caution` if ACWR=caution OR recent_fatigue_avg ≤ 2.8 OR attendance_rate < 0.7
- `ready` otherwise
- `neutral` if `data_sufficient=false`
**And** upserts the row (FR34)

**Given** the refresh trigger
**When** any of the source tables `session_metrics`, `fatigue_responses`, `attendances` (Epic 6), or `match_lineups` is modified
**Then** the relevant `readiness_snapshots` rows for upcoming sessions in the next 7 days are queued for refresh via Server Action `refreshUpcomingReadiness()`

**Given** performance (NFR1)
**When** the snapshot table is read for the upcoming session of a 40-player squad
**Then** the SELECT returns in ≤200 ms (P95)
**And** the index `idx_readiness_snapshots_session_player` supports it

**Given** test coverage (NFR54)
**When** unit tests run
**Then** the refresh function is covered ≥80% including the data-sufficiency neutral branch

### Story 5.4: Painel de Prontidão — Lista por Posição (Default View)

As a Treinador,
I want the Painel to show 3 aggregate numbers and the squad grouped by position with a semáforo per player,
So that I can glance the team's state in <3 seconds and identify candidates for drill-down.

**Acceptance Criteria:**

**Given** the route `/prontidao` (`<ReadinessPanel view="list">`, UX-DR12)
**When** a coach opens it
**Then** the page reads `readiness_snapshots` for the next upcoming session of the club (FR34)
**And** the header shows 3 numbers in `display-1` 48px: count of `ready` (green), `caution` (yellow), `alert` (red) (UX-DR2, UX-DR12)
**And** the body shows `<PositionGroup>` sections for GR / DEF / MED / AVA, each with `<PlayerRow>` rows (UX-DR13, UX-DR14)
**And** each row renders `<SemaforoBadge state=... size="md">` with redundant cor + ícone + forma (UX-DR5)

**Given** ordering inside each group (UX-DR35)
**When** rows render
**Then** order is `alert` → `caution` → `ready` → `neutral`
**And** within the same state, by ACWR descending (most loaded first)

**Given** glance performance (NFR1)
**When** the page first paints on 4G mobile
**Then** FCP ≤ 1.5s and aggregate numbers are visible ≤ 2s P95 for 40 players

**Given** the empty case (no upcoming session)
**When** the page loads
**Then** an `<EmptyState>` shows "Sem sessão agendada nas próximas 7 dias. Cria uma para ver o painel." with CTA to `/calendario/nova` (UX-DR8)

**Given** the `data_sufficient=false` row
**When** rendered
**Then** the badge is `neutral` cinzento
**And** an inline `<TooltipExplain>` next to ACWR explains "Em construção. Precisa de 4 semanas de dados." (UX-DR9, NFR42)

**Given** axe-core (NFR37, UX-DR42)
**When** the page is tested
**Then** zero a11y violations
**And** color is never the only signal (cor + ícone + forma)

### Story 5.5: Painel — Drill-Down Sheet with 4-Week Series, Banda ACWR, Presences, Nota Livre

As a Treinador,
I want to tap any player on the Painel and see a drill-down with their 4-week fatigue series, ACWR with confidence band, presences and free-text note in <500 ms,
So that I can investigate amber and red states with evidence in time to decide.

**Acceptance Criteria:**

**Given** the player row (Story 5.4) is tapped
**When** the `<DrillDownSheet>` opens (Story 1.8 UX-DR6)
**Then** drill-down opens ≤500 ms (cached snapshot read)
**And** the sheet shows: player name + escalão + position; ACWR with banda value (e.g., "1,32 · banda 0,8–1,5"); semáforo state with label
**And** a 4-week recharts time-series of fatigue (5 dimensions stacked or toggleable) with overlay of session days
**And** attendance rate of the last 28 days as a fraction "12/14 sessões"
**And** any existing data-driven decision note (Story 5.10) (FR35)

**Given** the staff swipes down or taps outside the sheet
**When** the sheet closes
**Then** focus returns to the player row (UX-DR6, NFR38)

**Given** keyboard navigation
**When** the staff tabs through rows and presses Enter on one
**Then** the sheet opens
**And** ESC closes it

**Given** missing data (`data_sufficient=false`)
**When** the sheet renders
**Then** the ACWR area shows banda cinzenta com `<TooltipExplain>` "Sem dados suficientes nos últimos 28 dias" (UX-DR9)
**And** the time series shows partial points without zero-imputation

**Given** the read happens via `auditedRead()` (Story 3.11)
**When** the sheet opens
**Then** an `audit_logs` row is created with `action='readiness.drilldown'`, `target_id=player_id` (FR50)

**Given** offline graceful degradation
**When** the staff opens the Painel offline
**Then** the cached snapshot from last sync is shown with a sticky meta line "Atualizado há X min" in `text/muted` (UX-DR38)

### Story 5.6: Painel — Field Formation 4-3-3 View with Toggle

As a Treinador,
I want a "Formação" toggle on the Painel header that swaps the list for an SVG 4-3-3 with the 11 starters positioned and the bench in a grid below,
So that I can complement the list view with a spatial mental model when planning the lineup.

**Acceptance Criteria:**

**Given** the toggle in the sticky header (UX-DR12, UX-DR46)
**When** the staff taps "Formação"
**Then** `<ReadinessPanel view="formation">` renders `<FieldFormation>` (UX-DR15) — a 2D SVG of the field with 11 players positioned per the 4-3-3 from `match_lineups` (Story 2.8 if a match exists for the upcoming session, else default formation slots)
**And** each player chip has the same `<SemaforoBadge>` redundancy (cor + ícone + forma)

**Given** no upcoming match (training session only)
**When** the toggle is selected
**Then** the field shows the squad's most-recently-used 4-3-3 lineup OR an `<EmptyState>` "Sem convocatória definida — define no Calendário"

**Given** the bench area
**When** rendered below the field
**Then** convocados marked `bench` (Story 2.8) are shown in a grid with the same semáforo badge

**Given** a player chip is tapped
**When** activated
**Then** the same `<DrillDownSheet>` from Story 5.5 opens

**Given** state persistence
**When** the staff reloads the Painel after switching to "Formação"
**Then** the last view is preserved per session in `localStorage` (default `list` for first-time visitors per UX-DR46)

**Given** Phase 1 scope (UX-DR15)
**When** the formation system is queried
**Then** only 4-3-3 is supported in MVP — other formations are gated to Phase 2 with a "Em breve" disabled selector

**Given** axe-core
**When** the formation view is tested
**Then** zero violations
**And** each player chip has `aria-label` "Estado: <state>, <name>, <position>, ACWR <value>"

### Story 5.7: Realtime Updates Window — 4h Pre-Session

As a Treinador,
I want the Painel to refresh in real time during the 4 hours leading up to a scheduled session,
So that newly submitted questionnaires update the semáforo without me reloading.

**Acceptance Criteria:**

**Given** the upcoming session's `scheduled_at` (Story 2.6)
**When** the staff opens the Painel within `[scheduled_at - 4h, scheduled_at]`
**Then** the page subscribes to a Supabase Realtime channel scoped to that session's `readiness_snapshots` rows (FR36)
**And** the subscription is automatically unsubscribed outside the window (NFR34 — ≤50 simultaneous connections constraint)

**Given** a player submits a fresh questionnaire during the window (Epic 4)
**When** `refreshUpcomingReadiness()` upserts the snapshot row (Story 5.3)
**Then** the Realtime channel pushes the update
**And** the affected `<PlayerRow>` (or chip in formation) animates a 200ms ease-out highlight (respecting `prefers-reduced-motion`, NFR41)
**And** the aggregate counts in the header update accordingly

**Given** outside the window
**When** the staff is on the Painel
**Then** the page polls `readiness_snapshots` only on user-driven refresh (pull-to-refresh on mobile)
**And** no Realtime connection is open

**Given** Realtime authentication
**When** the channel is opened
**Then** RLS enforces only the session's club rows are received (FR3)

**Given** test coverage (NFR54)
**When** integration tests run with mocked Realtime
**Then** subscribe/unsubscribe lifecycle, animation throttling, and pre-session window math are covered

### Story 5.8: Analista Dashboard — Individual 4-Week Fatigue Trends (Multi-Player Overview)

As an Analista,
I want a dashboard listing all active players' 4-week fatigue trends side-by-side as sparklines,
So that I can scan tendencies across the squad without opening each profile.

**Acceptance Criteria:**

**Given** the route `/tendencias/fadiga` (Analista bottom tab)
**When** the page loads
**Then** all active players are listed in rows
**And** each row shows: name, position, age group, and 5 small sparklines (one per fatigue dimension) of the last 28 days (FR37)
**And** each row also shows a delta indicator (last 7 days mean − previous 21 days mean) with cor + ícone

**Given** filters (UX-DR35)
**When** the analyst opens the filters `<Sheet>`
**Then** they can filter by position, age group, sort by delta or alphabetic
**And** filter chips show as removable

**Given** the read uses `auditedRead()`
**When** the page loads
**Then** an audit log entry `action='trends.viewed'` is created (FR50)

**Given** sparklines are not interactive
**When** rendered
**Then** they have `aria-label` "Tendência <dimension>: <trend>" (NFR39)
**And** color is paired with arrow direction (UX-DR1)

**Given** the empty case
**When** no fatigue data exists yet for a player
**Then** that row shows "—" placeholders without breaking layout (UX-DR8)

**Given** performance (NFR4)
**When** the page first paints
**Then** FCP ≤ 1s and full data ≤ 3s P95

### Story 5.9: Analista Dashboard — Cumulative Load per Player per Season

As an Analista,
I want a dashboard showing each player's cumulative sRPE load for the current season with a monthly breakdown,
So that I can spot under-trained or over-trained athletes at a glance and at depth.

**Acceptance Criteria:**

**Given** the route `/tendencias/carga` (Analista)
**When** the page loads
**Then** the current season is detected from Story 2.5 (`is_current=true`)
**And** each active player has a row with: name, total sRPE load (season cumulative), bar chart broken down by month (recharts), session count (FR38)
**And** the season toggle (Story 2.5) allows switching to "Cumulativo todas as épocas"

**Given** ordering
**When** rows render
**Then** default order is by total sRPE descending
**And** filter `<Sheet>` allows sorting by sessions count, alphabetic, or position

**Given** a player with very low load
**When** the row renders
**Then** a `signal/info` badge "Carga baixa" appears if `total_load < season_avg × 0.5`
**And** if `total_load > season_avg × 1.5`, a `signal/caution` badge "Carga alta" appears (with redundant icon)

**Given** the read uses `auditedRead()`
**When** the page loads
**Then** an audit log entry `action='load.viewed'` is created

**Given** export support
**When** the analyst taps "Exportar CSV"
**Then** the visible dataset is downloaded as CSV (sem dependência da Edge Function de Story 3.6 — este export é staff-only não-GDPR)

**Given** test coverage (NFR54)
**When** tests run
**Then** the season filter logic, monthly breakdown grouping, and threshold badge logic are covered ≥80%

### Story 5.10: Data-Driven Decision Input + Audit (FR52)

As a Treinador or Analista,
I want a discrete UI to mark and write a free-text note when the data informed a roster or management decision,
So that the "wow moment" KPI is auditable and we can validate the product's impact monthly.

**Acceptance Criteria:**

**Given** migration `000260_data_decisions.sql`
**When** applied
**Then** table `data_decisions` exists (id uuid PK uuidv7, club_id uuid FK, player_id uuid FK, session_id uuid FK nullable, actor_id uuid FK, decision_kind text CHECK in ('roster','management','load_adjustment','rest','other'), note text, was_data_driven boolean default true, created_at timestamptz)
**And** RLS enabled with club isolation + staff-only writes (AR22, FR52)
**And** index `idx_data_decisions_club_created` on `(club_id, created_at desc)` for the monthly KPI query

**Given** the `<DataDrivenDecisionInput>` component (UX-DR25)
**When** opened from the footer of the Painel drill-down (Story 5.5) or from a player profile
**Then** a small ghost button "Marcar decisão data-driven" expands inline into a `<Textarea>` (max 500 chars) + a `<RadioGroup>` for `decision_kind` + a `<Checkbox>` "Foi mesmo data-driven?" (default true)
**And** the UI is opcional, sem nudge persistente (UX-DR25)

**Given** the staff submits the form
**When** committed
**Then** a row is inserted with `actor_id = auth.uid()`
**And** an `audit_logs` entry `action='decision.marked'` is created
**And** a `telemetry_events` row with `kind='decision_marked'` is logged (Story 1.12, AR31)

**Given** existing decisions for the player
**When** the drill-down is opened
**Then** the most recent 3 decisions are visible above the input
**And** each is editable by the original `actor_id` within 24h, then read-only

**Given** the monthly KPI query
**When** the staff reaches `/configuracoes/kpis-validacao` (or similar internal route)
**Then** counts of decisions per month are visible aggregated by `decision_kind`
**And** the success-criteria target "≥1 decisão data-driven por mês na fase competitiva" can be measured (PRD Success Criteria)

**Given** RLS
**When** any user from another club queries `data_decisions`
**Then** zero rows are returned (FR3)

**Given** test coverage (NFR54)
**When** tests run
**Then** create flow, edit window, telemetry logging, and audit log emission are covered ≥80%

## Epic 6: Recolha de Performance — Touchscreen 3-ecrãs (jornada da Ana)

Analista regista presenças, Session-RPE (1–10 × duração) e substituições durante jogo (sistema deriva minutos automaticamente); regista eventos estatísticos via touchscreen B (sticky player + stack, alvos ≥60×60px, zero animações em fluxo reflexo, histórico recente visível). 8 ações cobertas (perdas de bola, recuperação de bola, remates totais, remates enquadrados, passes completados, pressões defensivas, ações defensivas com sucesso, ações ofensivas com sucesso). Funciona em offline com sincronização sem perda; janela configurável após sessão para editar/apagar eventos.

### Story 6.1: Match Events Schema & Idempotent Server Action

As the system,
I want a `match_events` table and an idempotent server action accepting client-generated UUIDv7 IDs,
So that 187+ events per match can be captured offline and synced later without dedupe issues.

**Acceptance Criteria:**

**Given** migration `000270_match_events.sql`
**When** applied
**Then** table `match_events` exists (id uuid PK uuidv7, club_id uuid FK, session_id uuid FK, player_id uuid FK, action text CHECK in ('ball_loss','ball_recovery','shot_total','shot_on_target','pass_completed','def_pressure','def_action_success','off_action_success'), zone text CHECK in ('def_left','def_center','def_right','mid_left','mid_center','mid_right','att_left','att_center','att_right'), occurred_at timestamptz, captured_at timestamptz default now(), captured_by uuid FK profiles, captured_via text CHECK in ('online','offline-drain'), is_deleted boolean default false, deleted_at timestamptz, deleted_by uuid)
**And** RLS enabled with club isolation; staff write only; reads via `auditedRead()` (FR3, FR50)
**And** index `idx_match_events_session` on `(session_id, occurred_at desc)` (NFR1)
**And** index `idx_match_events_player_session` on `(player_id, session_id)` for per-player aggregation

**Given** Server Action `submitMatchEvent(payload)` in `lib/actions/events.ts`
**When** invoked with a UUIDv7 id, action, zone, player_id, session_id
**Then** it performs an upsert (`on conflict (id) do update`) — replaying same payload is a no-op (FR28, NFR48)
**And** Zod validates: action enum is one of the 8 metrics, zone enum, session belongs to club, player is in `match_lineups` (Story 2.8)
**And** the action is wrapped by an outbox-friendly contract (input/output JSON)

**Given** soft-delete (FR29)
**When** Server Action `deleteMatchEvent(id)` is invoked within the configurable post-session edit window (Story 6.6)
**Then** `is_deleted=true`, `deleted_at`, `deleted_by` are set; no row is physically removed
**And** queries used by aggregations filter `where is_deleted=false`

**Given** processing-restriction (Story 3.9)
**When** the affected player has `processing_restricted=true`
**Then** the action rejects the write with a clear error

**Given** test coverage (NFR54)
**When** tests run
**Then** Zod validation, idempotent upsert, RLS isolation, soft-delete semantics, and outbox contract are covered ≥80%

### Story 6.2: Touchscreen B — Sticky Player + Stack with Action and Zone

As an Analista using a tablet pitchside,
I want a touchscreen that keeps the selected player sticky while I tap action and zone,
So that consecutive events of the same player register in ~2 taps each at a sustainable rhythm.

**Acceptance Criteria:**

**Given** the route `/sessoes/[id]/captura` (`<MatchEventCapture>`, UX-DR18)
**When** an Analista opens it during a match or friendly
**Then** the layout is full-bleed (no margins, UX-DR44)
**And** zero animations apply universally (independently of OS preference, UX-DR3)
**And** all touch targets are ≥60×60px (NFR40, UX-DR3)

**Given** the screen layout (Direção B, UX-DR48)
**When** rendered
**Then** the top sticky region shows the currently-selected player chip with name + jersey + position + lucide icon "Trocar jogador" (UX-DR18)
**And** the body shows `<PlayerGrid>` (4×3, 11 starters from `match_lineups`, UX-DR19) when no player is selected
**And** when a player IS selected, the body shows `<ActionList>` (grid 2×4 of 8 actions with cor border esquerda — `signal/ready` for positives like recovery/shot_on_target/pass_completed/def_action_success/off_action_success, `signal/alert` for negatives like ball_loss/def_pressure/shot_total) (UX-DR20)
**And** when an action is tapped, `<ZoneSelectorSheet>` opens with SVG meio-campo + 3×3 tappable grid (UX-DR21)

**Given** event registration
**When** the Analista taps player → action → zone
**Then** `submitMatchEvent()` is invoked (Story 6.1)
**And** the player remains sticky (UX-DR18)
**And** the next action can be tapped immediately (≤2 taps per subsequent event of same player)

**Given** the "Trocar jogador" button
**When** tapped
**Then** the sticky player is cleared and `<PlayerGrid>` returns

**Given** state management (UX-DR18)
**When** the screen is mounted
**Then** Zustand holds the sticky player; outbox state lives in IndexedDB

**Given** ARIA labels (NFR39, UX-DR19)
**When** rendered
**Then** each player button has `aria-label="<full name>, número <jersey>, <position>, <age group>"`
**And** action buttons have semantic Portuguese names
**And** zone grid uses `role="grid"` with 9 cells labeled e.g., "Defesa esquerda", "Meio centro", "Ataque direita"

**Given** axe-core (NFR37)
**When** the touchscreen is tested
**Then** zero a11y violations

### Story 6.3: Recent Events Ring (Last 6) for Audit-on-the-Go

As an Analista pitchside,
I want a footer showing my last 6 captured events for the current session,
So that I can audit my taps without diverting attention from the field.

**Acceptance Criteria:**

**Given** `<RecentEventsRing>` (UX-DR22)
**When** rendered as a sticky footer in the touchscreen view (Story 6.2)
**Then** it shows the last 6 events of the current session ordered most-recent-first
**And** each chip shows compact icon + jersey + zone (e.g., "🚫 #10 ME") in monospace for stable visual rhythm

**Given** an event is committed
**When** the ring updates
**Then** the new chip slides into position 1 with **zero animation** (matching UX-DR3 for reflexo flow)

**Given** the analyst long-presses or taps a chip
**When** activated
**Then** an inline confirmation "Remover evento?" appears (single primary destructive button + ghost cancel)
**When** confirmed
**Then** `deleteMatchEvent()` is invoked (Story 6.1) — only if within the post-session edit window (Story 6.6); else the action is disabled with `<TooltipExplain>` "Janela de edição encerrada"

**Given** the ring as accessibility surface
**When** screen reader is active
**Then** the footer is `role="log"` with `aria-live="polite"` so each new event is announced succinctly

**Given** session boundary
**When** the ring is rendered for a session different from the previously open one
**Then** the cache is reset

**Given** ≤6 events captured so far
**When** the ring renders
**Then** unfilled slots show a subtle dotted placeholder

### Story 6.4: Substitutions & Auto-Derived Minutes Played

As an Analista,
I want to register substitutions during a match and have minutes-played derived automatically per player,
So that the post-match per-player minute totals are correct without any manual math.

**Acceptance Criteria:**

**Given** a match's lineup (Story 2.8) is locked at kickoff
**When** the Analista taps "Substituição" in the touchscreen header
**Then** a `<DrillDownSheet>` opens with two columns: "Sai" (current starters/already-on-bench-after-sub) and "Entra" (currently-on-bench)
**And** the minute is auto-filled from `now() - scheduled_at` rounded to the nearest minute (clipped to 0–120)

**Given** the Analista picks "Sai" and "Entra" players and confirms
**When** committed (FR19)
**Then** the outgoing `match_lineups` row is updated `ended_minute = <minute>` (or `started_minute + duration_min` if `role='starter'`)
**And** the incoming `match_lineups` row is updated `started_minute = <minute>` and `role='starter'` (effectively "on")
**And** an `audit_logs` entry `action='lineup.substitution'` is created

**Given** end-of-match
**When** the Analista taps "Encerrar registo de jogo"
**Then** for every starter still on the field, `ended_minute` defaults to `duration_min` of the session
**And** for every player on the bench who never entered, both fields remain null
**And** a per-player `minutes_played = coalesce(ended_minute, duration_min) - coalesce(started_minute, 0)` is computed in a view `match_minutes_played`

**Given** edit support
**When** the Analista re-opens the match within the edit window (Story 6.6)
**Then** they can adjust substitution minutes
**And** every adjustment is logged

**Given** the Painel/dashboards
**When** they query minutes
**Then** they read from `match_minutes_played` view, not from individual rows

**Given** test coverage (NFR54)
**When** tests run with mocked timestamps
**Then** kickoff math, multiple subs, on-then-off-then-on edge case, and end-of-match defaulting are covered

### Story 6.5: Offline Match Event Capture + Outbox + Drain

As an Analista in a stadium with poor connectivity,
I want every event tap to be captured and synced when connectivity returns, with no data loss,
So that 187+ events per match are guaranteed even if the network drops mid-game.

**Acceptance Criteria:**

**Given** `submitMatchEvent()` (Story 6.1) is called while offline
**When** the action is invoked
**Then** the payload (with UUIDv7 id) is enqueued in the Dexie outbox with `kind='match.event'` (FR28, AR18)
**And** the UI proceeds optimistically (the new chip appears in `<RecentEventsRing>`)

**Given** connectivity returns
**When** the foreground drain runs
**Then** events are sent to the server in `occurred_at` ascending order
**And** server upserts dedupe by UUIDv7 (NFR48)
**And** `captured_via='offline-drain'` is recorded

**Given** drain performance (NFR3)
**When** 50 events are pending on 4G
**Then** the drain completes ≤5 seconds

**Given** the `<PendingBadge>` in the touchscreen header
**When** the outbox count > 0
**Then** "X eventos por sincronizar" is shown in `signal/info` blue (UX-DR7)

**Given** the orphan-outbox protection (NFR52, AR20)
**When** the Analista tries to log out with pending events
**Then** the `<Dialog>` warning lists the pending count

**Given** a substitution registered offline (Story 6.4)
**When** drained later
**Then** the lineup mutation is a separate kind (`lineup.substitution`) and is processed before any subsequent player-specific events for affected players

**Given** test coverage (NFR54)
**When** integration tests run
**Then** offline capture, replay, dedupe, ordering, and substitution-before-events sequencing are covered

### Story 6.6: Edit/Delete Events Within Configurable Post-Session Window

As an Analista,
I want a configurable window (default 24h) after a session during which I can edit or delete events I captured by mistake,
So that good-faith corrections are possible without compromising the immutability of the historical record afterwards.

**Acceptance Criteria:**

**Given** migration `000280_session_edit_window.sql`
**When** applied
**Then** `notification_settings` is extended with column `event_edit_window_hours int default 24` (re-using the table from Story 4.8) (FR29)

**Given** the Analista on `/sessoes/[id]/eventos`
**When** the page loads within `(session_end + edit_window_hours)`
**Then** all events are listed with edit/delete actions enabled
**And** `<RecentEventsRing>` (Story 6.3) chips remain interactive
**When** outside the window
**Then** edits are disabled with `<TooltipExplain>` "Janela de edição encerrada (24h após a sessão)" (UX-DR9)
**And** the API rejects edit attempts (server-side enforcement)

**Given** the Analista edits an event
**When** committed
**Then** the row is updated atomically
**And** an `audit_logs` entry `action='event.edited'` with before/after `payload` is created (FR50)

**Given** the Analista soft-deletes an event
**When** committed
**Then** `is_deleted=true`, `deleted_at`, `deleted_by` are set
**And** `audit_logs` entry `action='event.deleted'` is created
**And** aggregate dashboards re-compute excluding the deleted row

**Given** post-window read access
**When** any user views events from a session whose window has closed
**Then** events are read-only with no UI affordances for edit/delete

**Given** configurability
**When** the staff updates `event_edit_window_hours` on `/configuracoes/notificacoes-clube`
**Then** all future sessions use the new value
**And** in-flight sessions retain the value at creation time (snapshot in a copy column on `sessions` if needed for predictability)

### Story 6.7: Attendance Recording for Training Sessions

As an Analista,
I want to register presence/absence for each player on each training session,
So that the readiness model has accurate attendance and the staff can see participation trends.

**Acceptance Criteria:**

**Given** migration `000290_attendances.sql`
**When** applied
**Then** table `attendances` exists (id uuid PK uuidv7, club_id uuid FK, session_id uuid FK, player_id uuid FK, status text CHECK in ('present','absent','late','injured','excused'), note text nullable, recorded_by uuid FK, recorded_at timestamptz)
**And** RLS enabled with club isolation + staff writes only (FR30)
**And** unique index `(session_id, player_id)`

**Given** the Analista on `/sessoes/[id]/presencas` for a `training` session (or also for matches/friendlies optionally)
**When** the page loads
**Then** all active, non-inactive players for the club are listed grouped by position
**And** each row has a quick toggle: tap once = `present`, twice = `absent`, three times cycles through `late`/`injured`/`excused`/back to `present`
**And** a primary "Guardar presenças" button persists all rows (1 per ecrã, UX-DR30)

**Given** offline support
**When** the analyst registers presences while offline
**Then** the mutation is queued in the outbox (`kind='attendance.upsert'`)
**And** synced on reconnect with idempotent upsert (NFR48)

**Given** an inactive player (Story 2.4)
**When** the page loads
**Then** they are hidden by default
**And** a chip "Mostrar inativos" reveals them on demand (rare case: returning from injury)

**Given** the readiness snapshot refresh trigger (Story 5.3)
**When** an attendance row is upserted
**Then** the upcoming session's `readiness_snapshots` are queued for refresh (so attendance_rate updates)

**Given** `<EmptyState>`
**When** no players exist yet
**Then** copy "Sem jogadores no plantel — adiciona em /plantel" (UX-DR8)

**Given** axe-core (NFR37)
**When** the page is tested
**Then** zero a11y violations

### Story 6.8: Session-RPE Entry per Player at End of Session

As an Analista,
I want to register Session-RPE per player at the end of every session, complementing or replacing the player self-report,
So that the load model is complete even when players don't submit their post-session questionnaire.

**Acceptance Criteria:**

**Given** the route `/sessoes/[id]/srpe` (Analista, after session_end)
**When** the page loads
**Then** present players (Story 6.7) are listed with a 1–10 slider per player (snap discrete, same `<FatigueSlider>` paradigm as Story 4.2)
**And** the session's `duration_min` is shown in the header (read-only, defined at creation Story 2.6)
**And** if a player has already submitted post-session sRPE via questionnaire (Story 4.2), the slider pre-fills with their value with a meta line "Submetido pelo jogador" — the analyst can override if needed (FR31)

**Given** the Analista submits the form
**When** committed
**Then** for each player, a `session_metrics` row is upserted (Story 5.1) with `srpe_value`, `duration_min`, computed `srpe_load`
**And** the source ('player' vs 'analyst') is logged in `payload` of `audit_logs` `action='srpe.recorded'`

**Given** ACWR refresh
**When** `session_metrics` rows are committed
**Then** `refresh_readiness()` (Story 5.3) is queued for the upcoming session

**Given** offline support
**When** the analyst submits while offline
**Then** the mutation is queued (`kind='srpe.upsert'`)
**And** synced idempotently on reconnect (NFR48)

**Given** absent players (Story 6.7)
**When** the page renders
**Then** they show a disabled slider with "Ausente — sem sRPE"
**And** no row is written for them

**Given** test coverage (NFR54)
**When** tests run
**Then** override semantics, idempotent upsert, ACWR refresh trigger, and offline drain are covered ≥80%

## Epic 7: Análise Avançada & Operacionalização "Dados Mediados" (Phase 2 / Growth)

Perfil unificado do jogador (séries fadiga + peso + altura + ACWR + presenças + estatísticas integradas), Curva de Recuperação Individual (trajectória pós-sessão intensa), Dashboard de Equipa Agregado (média fadiga, presença, estatísticas), deteção de correlações individuais fadiga×performance, exportação de relatórios PDF mediada pelo staff, reconfirmação automática aos 18 anos com anonimização passados 90 dias sem reconfirmação.

### Story 7.1: 18-Year Re-Confirmation Flow with 90-Day Anonymization

As the system,
I want to detect when a player turns 18 and prompt them to reconfirm their own consent, anonymizing data after 90 days without response,
So that consent originally granted by a parent is renewed with the now-adult holder, per GDPR best practice.

**Acceptance Criteria:**

**Given** migration `000300_age_18_reconfirmation.sql`
**When** applied
**Then** table `consent_reconfirmations` exists (id uuid PK, player_id uuid FK, profile_id uuid FK, status text CHECK in ('pending','confirmed','anonymized'), created_at, confirmed_at nullable, anonymized_at nullable)

**Given** the daily pg_cron job `detect_age_18_transitions`
**When** it runs at 04:00 UTC
**Then** for every active player whose `birthdate + 18y = today`, a `consent_reconfirmations` row with `status='pending'` is created (FR10)
**And** a Resend EU email is sent: subject "Os teus dados — 18 anos: confirma se queres continuar" with a tokenized link `/reconfirmacao/[token]`

**Given** the player visits `/reconfirmacao/[token]`
**When** logged in (auth required, not tokenized like parental consent)
**Then** the page shows the current privacy policy (Story 3.1) and "Confirmo o consentimento próprio" (primary) + "Apagar os meus dados" (destructive)
**When** confirmed
**Then** `status='confirmed'`, `confirmed_at=now()` are set
**And** an `audit_logs` entry `action='consent.self_confirmed_at_18'` is created

**Given** no response after 90 days
**When** the daily pg_cron job `enforce_age_18_anonymization` runs
**Then** for every `pending` row with `created_at <= now() - 90d`, the player's PII is anonymized (same logic as Story 2.9 retention) without erasing aggregates
**And** `status='anonymized'`, `anonymized_at=now()` are set
**And** an `audit_logs` entry `action='consent.auto_anonymized_at_18'` is recorded

**Given** an in-flight pending row
**When** the player chooses "Apagar os meus dados"
**Then** Story 3.7's erasure cascade is triggered immediately
**And** the row's `status='anonymized'`, `anonymized_at=now()` are set

**Given** test coverage (NFR54)
**When** tests run with mocked time
**Then** the day-of-18, day-90 anonymization, manual confirm, and explicit erase paths are covered ≥80%

### Story 7.2: Unified Player Profile (Perfil Consolidado)

As a Treinador or Analista,
I want a unified player profile aggregating fatigue, weight, height, ACWR, presences and statistics across the player's entire history with the club,
So that I have a single canonical view rather than navigating across multiple dashboards.

**Acceptance Criteria:**

**Given** the route `/plantel/[id]/perfil` (`<PlayerProfile>`, FR14)
**When** the staff opens it
**Then** the page shows: header with name, age group, position(s), photo (Story 2.2); life-of-player tabs "Fadiga", "Carga & ACWR", "Métricas físicas", "Presenças", "Estatísticas", "Decisões data-driven"
**And** each tab loads its data via `auditedRead()` (FR50)

**Given** the "Fadiga" tab
**When** rendered
**Then** it shows the same 4-week recharts series as Story 4.5 plus a season cumulative view via the season toggle (Story 2.5)

**Given** the "Carga & ACWR" tab
**When** rendered
**Then** it shows ACWR over time (line) with the age-group banda (Story 5.2) overlaid as a shaded band
**And** sRPE per session as bars on a secondary axis

**Given** the "Métricas físicas" tab
**When** rendered
**Then** it shows the weight + height time series from Story 2.3

**Given** the "Presenças" tab
**When** rendered
**Then** it shows attendance status per session (Story 6.7) grouped by month with a percentage summary
**And** filters allow `training` only / `match` only / both

**Given** the "Estatísticas" tab
**When** rendered
**Then** it shows the 8 action metrics (Story 6.1) per match with cumulative totals and per-90 normalization
**And** zones heatmap of where actions occurred (using SVG meio-campo + intensity color)

**Given** the "Decisões data-driven" tab
**When** rendered
**Then** it lists every `data_decisions` row for the player (Story 5.10) with the original note and timestamp

**Given** the page is forbidden to the player themselves (FR26)
**When** a player attempts to access `/plantel/<own_id>/perfil`
**Then** the middleware returns 404 (Story 4.6)

**Given** performance (NFR4)
**When** the page first paints on 4G mobile
**Then** FCP ≤ 1s and full data ≤ 3s P95

### Story 7.3: Recovery Curve Individual

As a Treinador or Analista,
I want a chart showing each player's typical fatigue trajectory in the days following a high-intensity session,
So that we can calibrate rest cycles per athlete instead of applying one rule for the whole squad.

**Acceptance Criteria:**

**Given** `lib/readiness/recovery.ts` `computeRecoveryCurve({ playerId, lookbackSessions=10 })`
**When** invoked
**Then** it identifies the last N high-intensity sessions for the player (defined as `srpe_load > player_avg × 1.2`)
**And** for each, samples the post-session fatigue dimensions on day 0 (post-session questionnaire), day 1, day 2, day 3 (FR40)
**And** averages each day's reading across the N sessions
**And** returns `{ day: 0..3, avgFatigue: 1..5, sampleSize: int, dimensions: { energy, focus, sleep, soreness, mood } }`

**Given** the route `/plantel/[id]/perfil/recuperacao` or a "Recuperação" tab inside the unified profile (Story 7.2)
**When** the staff opens it
**Then** `<RecoveryCurve>` (UX-DR per Phase 2 list) renders a recharts line chart with day-on-x and avg fatigue-on-y, one line per dimension
**And** sample size is shown as `n=12 sessões`
**And** if `sampleSize < 5`, an `<EmptyState>` "Sem amostra suficiente. Precisamos de 5+ sessões intensas." is shown (UX-DR8)

**Given** the `<TooltipExplain>` for the chart
**When** hovered/tapped
**Then** it explains: "Esta curva mostra como X recupera nos dias após um treino intenso. Use para calibrar a próxima sessão." (B1, NFR42)

**Given** the player must NOT see this curve (FR26)
**When** a player attempts to access the route
**Then** the middleware returns 404

**Given** test coverage (NFR54)
**When** tests run on fixture data
**Then** identification of high-intensity sessions, day sampling, sample-size threshold, and the emptiness branch are covered ≥80%

### Story 7.4: Team Aggregate Dashboard

As a Treinador,
I want a single dashboard showing team-level aggregates (average fatigue, attendance rate, statistical totals) over the season,
So that I can see the squad as a system, not just as 40 individual rows.

**Acceptance Criteria:**

**Given** the route `/equipa/agregado` (Treinador only)
**When** the page loads
**Then** `<TeamAggregateDashboard>` (FR41) shows: average fatigue across squad over 4 weeks (line), squad attendance rate over 4 weeks (line), top 3 most-loaded players, top 3 most-fatigued players, total events captured per match (bar)
**And** all metrics scope by season via the toggle (Story 2.5)

**Given** filters (UX-DR35)
**When** opened in `<Sheet>`
**Then** filter by age group (only sub-X), filter by competition (matches vs friendlies vs all)
**And** filter chips show as removable

**Given** the "Top 3 mais carregados" chip
**When** tapped
**Then** the staff is navigated to the cumulative load dashboard (Story 5.9) pre-filtered to those 3 players

**Given** export
**When** the Treinador taps "Exportar PDF"
**Then** Story 7.6's PDF generator produces a snapshot of the dashboard

**Given** performance (NFR4)
**When** the page first paints
**Then** FCP ≤ 1s and full data ≤ 3s P95

**Given** access control (FR26)
**When** an Analista or Jogador navigates to this route
**Then** Analista sees a similar but read-only view (no decision links); Jogador returns 404

**Given** axe-core (NFR37)
**When** the page is tested
**Then** zero a11y violations
**And** color is paired with icon/shape for any signal

### Story 7.5: Fatigue × Performance Correlation Detection

As an Analista,
I want the system to detect statistically significant correlations between a player's fatigue and their statistical output,
So that we can name patterns ("when his sleep dimension drops below 2, his pass-completion drops 15 pp") instead of guessing.

**Acceptance Criteria:**

**Given** `lib/readiness/correlations.ts` `detectCorrelations({ playerId, lookbackDays=120 })`
**When** invoked
**Then** for each fatigue dimension and each of the 8 action metrics, it computes Spearman correlation across sessions where both are available (FR39)
**And** returns only correlations where `|rho| ≥ 0.5` AND `p < 0.05` AND `n ≥ 10` sessions
**And** sorts by absolute strength descending

**Given** the route `/plantel/[id]/perfil/correlacoes`
**When** the staff opens it
**Then** the detected correlations are listed in plain Portuguese (e.g., "Sono baixo está associado a 18 pp menos passes completados — 14 jogos analisados")
**And** each item has a `<TooltipExplain>` "Correlação não é causa. Use como pista, não como sentença." (B1, NFR42)

**Given** the empty case
**When** no correlations meet the threshold
**Then** an `<EmptyState>` "Sem padrões significativos ainda. Continua a recolher dados." (UX-DR8, UX-DR38)

**Given** the player must NOT see correlations of themselves (FR26)
**When** a player attempts to access the route
**Then** the middleware returns 404

**Given** the read uses `auditedRead()`
**When** the page loads
**Then** an audit log entry `action='correlations.viewed'` is created (FR50)

**Given** test coverage (NFR54)
**When** tests run with synthetic fixtures
**Then** strong correlations are detected, weak ones are filtered, and small-sample (n<10) cases return empty correctly

### Story 7.6: Mediated PDF Report — Generation, Storage & Sharing

As a Treinador or Analista,
I want to generate a PDF report for a specific player (with their performance and fatigue) and share it via a signed link,
So that the staff curates what is conveyed (filosofia "dados mediados") without giving the player or guardian self-service access to the system.

**Acceptance Criteria:**

**Given** migration `000310_pdf_reports.sql`
**When** applied
**Then** table `pdf_reports` exists (id uuid PK uuidv7, club_id uuid FK, player_id uuid FK, generated_by uuid FK, scope text CHECK in ('match','training','period'), period_start date, period_end date, file_path text, generated_at timestamptz, shared_with_email citext nullable, shared_at timestamptz nullable, expires_at timestamptz)
**And** RLS enabled with club isolation + staff-only writes (FR59)

**Given** the route `/plantel/[id]/relatorio/novo`
**When** a coach or analyst configures the report (period start/end, scope, optional shared email)
**Then** Edge Function `generate-pdf-report` runs `<PdfReport>` template against the player's data within the period
**And** the PDF is rendered server-side (`@react-pdf/renderer` or similar) with: profile header, fatigue series, ACWR over period, sRPE totals, per-match stat breakdown, attendance summary
**And** the file is uploaded to Supabase Storage bucket `reports` with a 30-day signed URL

**Given** an `audit_logs` entry
**When** the report is generated
**Then** `action='report.generated'` with `target_id=player_id`, `payload={ generated_by, period }` is recorded (FR50)

**Given** sharing the PDF (mediated)
**When** the staff inputs an email and confirms
**Then** Resend EU sends the email with the signed URL and B1 PT-PT copy ("Em anexo, relatório do {player}. Disponível por 30 dias.")
**And** `shared_with_email`, `shared_at` are recorded
**And** an audit log entry `action='report.shared'` is recorded

**Given** the player has NO direct path to generate or list their own reports (FR26, FR59)
**When** a Jogador attempts `/plantel/[id]/relatorio/novo` with their own id
**Then** the middleware returns 404
**And** the API rejects the request

**Given** processing-restriction (Story 3.9)
**When** the affected player is restricted
**Then** report generation rejects with a clear staff-side error

**Given** the staff's report-history view at `/plantel/[id]/relatorios`
**When** opened
**Then** the list of past reports (with `shared_with_email` or "(não partilhado)") is visible
**And** each row has "Reenviar link" and "Revogar link" actions
**When** "Revogar link" is confirmed
**Then** the signed URL is invalidated server-side (storage delete + DB row marked `expires_at=now()`)

**Given** test coverage (NFR54)
**When** tests run
**Then** generation, sharing, audit logging, player-self-access denial, and revocation are covered ≥80%
