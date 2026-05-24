# Story 4.8: Pre/Post Session Push Notifications with Configurable X/Y

**Status:** ready-for-dev

**Story ID:** 4.8  
**Epic:** Epic 4 — Recolha de Fadiga & Notificações (jornada do Tomás)  
**Criado:** 2026-05-24  
**Story anterior:** 4-7-push-subscription-infrastructure-vapid-setup-subscribe-unsubscribe  

> ⚠️ **DEPENDÊNCIA CRÍTICA:** Esta story requer que a Story 4.7 esteja **done** antes de começar.
> A Story 4.7 cria: `push_subscriptions` table, `deactivateExpiredSubscription()` Server Action, e as handlers do service worker.

---

## Story

As a Jogador with push enabled,
I want to receive an opaque push reminder X minutes before and Y minutes after each session,
So that I am gently nudged to fill the questionnaire without disclosing health context in the notification body.

---

## Acceptance Criteria

**AC #1 — Tabela `notification_settings` por Clube**

**Given** migration `000220_notification_settings.sql`

**When** applied

**Then** table `notification_settings` exists per club with columns:
- `id uuid PK default uuidv7()`
- `club_id uuid UNIQUE FK references clubs(id) ON DELETE CASCADE`
- `pre_minutes int NOT NULL DEFAULT 30 CHECK (pre_minutes BETWEEN 5 AND 120)`
- `post_minutes int NOT NULL DEFAULT 30 CHECK (post_minutes BETWEEN 5 AND 120)`
- `is_enabled boolean NOT NULL DEFAULT true`
- `updated_at timestamptz NOT NULL DEFAULT now()`

**And** RLS enabled: only staff (`coach`/`analyst`) of the same club can SELECT and UPDATE

**And** on initial club creation, a default row is auto-inserted via trigger or manually by staff

**And** staff configures these settings on `/configuracoes/notificacoes-clube`

---

**AC #2 — Tabela `notification_log` com Suporte a Cancelamento**

**Given** migration `000225_notification_log.sql`

**When** applied

**Then** table `notification_log` exists with columns:
- `id uuid PK default uuidv7()`
- `club_id uuid FK references clubs(id) ON DELETE CASCADE`
- `profile_id uuid FK references profiles(id) ON DELETE CASCADE`
- `session_id uuid FK references sessions(id) ON DELETE CASCADE`
- `kind text NOT NULL CHECK (kind IN ('fatigue_pre', 'fatigue_post'))`
- `scheduled_for timestamptz NOT NULL`
- `status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'failed', 'cancelled', 'skipped'))`
- `sent_at timestamptz NULL`
- `error_message text NULL`
- `created_at timestamptz NOT NULL DEFAULT now()`

**And** unique constraint on `(profile_id, session_id, kind)` to prevent duplicate scheduling

**And** index `idx_notification_log_processing` on `(status, scheduled_for)` for efficient queue polling

**And** index `idx_notification_log_session` on `(session_id, status)` for cancellation propagation

**And** a PostgreSQL trigger `tg_cancel_notifications_on_session_cancel` fires AFTER UPDATE on `sessions` when `NEW.status = 'cancelled'` and `OLD.status = 'scheduled'`, setting `notification_log.status = 'cancelled'` for all rows of that session with `status = 'scheduled'`

---

**AC #3 — Edge Function `schedule-session-pushes` (Hourly Scheduler)**

**Given** the Edge Function `schedule-session-pushes` runs hourly via pg_cron

**When** it queries upcoming sessions in the next 24h where `sessions.status = 'scheduled'`

**Then** for each session it reads `notification_settings` for the club to get `pre_minutes` and `post_minutes`

**And** for each player in the session with:
- An active push subscription (`push_subscriptions.is_active = true`)
- NOT processing-restricted (`players.processing_restricted = false`)
- `notification_settings.is_enabled = true`

it computes:
- `scheduled_for_pre = session.scheduled_at - (pre_minutes * interval '1 minute')`
- `scheduled_for_post = session.scheduled_at + (duration_min * interval '1 minute') + (post_minutes * interval '1 minute')`

**And** upserts two `notification_log` rows with `ON CONFLICT (profile_id, session_id, kind) DO NOTHING` (idempotent — safe to run multiple times per hour)

**And** skips players with `processing_restricted = true` or no active subscription (logging skipped count to stdout)

**And** scheduled time is always **in the future** (if `scheduled_for_pre < now()`, skip pre; if `scheduled_for_post < now()`, skip post)

---

**AC #4 — Edge Function `send-push` (Queue Processor, Every 5 Minutes)**

**Given** the Edge Function `send-push` runs every 5 minutes via pg_cron

**When** it processes `notification_log` rows where `status = 'scheduled' AND scheduled_for <= now()`

**Then** it processes up to 50 rows per run (LIMIT 50, ordered by `scheduled_for ASC`) to prevent timeouts

**And** for each row, it fetches the player's `push_subscriptions` row where `profile_id = notification_log.profile_id AND is_active = true`

**And** if no active subscription found, sets `status = 'skipped'` (subscription was cancelled between scheduling and sending)

**And** sends via `web-push` lib with VAPID private key (from Supabase secret `VAPID_PRIVATE_KEY`)

**And** the notification payload contains ONLY opaque text — NO health data, NO session type, NO score:
```json
{
  "title": "SPARTA",
  "body": "Sessão daqui a pouco — abre o app",      // pre-session
  "body": "Sessão concluída — responde ao questionário", // post-session
  "tag": "fatigue-notification",
  "data": { "deepLink": "/questionario/<sessionId>/pre|post" }
}
```

**And** on success: sets `status = 'sent'`, `sent_at = now()`

**And** on HTTP 410 Gone from push service: sets `status = 'failed'`, `error_message = '410 Gone'`; AND updates `push_subscriptions.is_active = false` for that endpoint (reusing the pattern from Story 4.7 `deactivateExpiredSubscription`)

**And** on other errors (5xx, timeout): sets `status = 'failed'`, `error_message` = HTTP status text; does NOT deactivate subscription (transient error)

---

**AC #5 — UI Staff: `/configuracoes/notificacoes-clube`**

**Given** a staff member (coach/analyst) navigates to `/configuracoes/notificacoes-clube`

**When** the page loads

**Then** the page shows:
- **Estado global:** Toggle "Enviar notificações de sessão" (maps to `is_enabled`)
- **Pré-sessão:** Input numérico "X minutos antes" (range 5–120, default 30)
- **Pós-sessão:** Input numérico "Y minutos depois" (range 5–120, default 30)
- **Guardar** button (primary)
- **Nota informativa:** "As notificações são enviadas aos jogadores com subscrição ativa. Texto opaco por privacidade RGPD."

**And** on save, Server Action `updateNotificationSettings({ pre_minutes, post_minutes, is_enabled })` is called:
1. Validates input via Zod (5 ≤ pre_minutes ≤ 120, 5 ≤ post_minutes ≤ 120)
2. Upserts `notification_settings` row for the club (ON CONFLICT (club_id) DO UPDATE)
3. Returns success

**And** on success: shows toast "Definições guardadas" via `CalmConfirmation` or inline success message

**And** player cannot access this page (middleware/auth blocks `/configuracoes/notificacoes-clube` for player role)

---

**AC #6 — Propagação de Cancelamento de Sessão**

**Given** a session is cancelled via `cancelSession()` (Story 2.6)

**When** `sessions.status` is updated to `'cancelled'`

**Then** the PostgreSQL trigger `tg_cancel_notifications_on_session_cancel` automatically sets `notification_log.status = 'cancelled'` for all rows where `session_id = <cancelled_session_id>` AND `status = 'scheduled'`

**And** the `send-push` Edge Function skips rows with `status != 'scheduled'` (so cancelled rows are never sent)

**And** no push fires for cancelled sessions

**And** the trigger is tested via migration test: INSERT session → create notification_log rows → UPDATE session status to 'cancelled' → verify notification_log rows have status='cancelled'

---

**AC #7 — Cobertura de Testes**

**Given** integration/unit tests

**When** tests run

**Then** coverage includes:
- ✅ `schedule-session-pushes` enqueues correct pre/post times based on `pre_minutes`/`post_minutes`
- ✅ Processing-restricted players are skipped (no notification_log row created)
- ✅ Players without active subscription are skipped
- ✅ Idempotency: running scheduler twice produces same number of rows (ON CONFLICT DO NOTHING)
- ✅ `send-push` sends correct opaque payload (no health data in title/body)
- ✅ 410 response deactivates subscription (`is_active=false`)
- ✅ Session cancellation triggers `status='cancelled'` on notification_log rows
- ✅ `updateNotificationSettings` validates range (pre/post_minutes 5–120)
- ✅ Staff can read/update notification_settings; player cannot

**And** coverage ≥80% for `src/lib/actions/notifications.ts`

---

## Tasks / Subtasks

- [ ] **Task 1: Migration — `notification_settings` table** (AC: #1)
  - [ ] Create `sparta/supabase/migrations/000220_notification_settings.sql`
  - [ ] Table: `id`, `club_id` (UNIQUE), `pre_minutes` (5–120), `post_minutes` (5–120), `is_enabled`, `updated_at`
  - [ ] Enable RLS with staff-only SELECT/UPDATE policy (coach/analyst, same club)
  - [ ] GRANT SELECT, INSERT, UPDATE to `authenticated`
  - [ ] Add COMMENT ON TABLE/COLUMN for documentation

- [ ] **Task 2: Migration — `notification_log` table + cancellation trigger + pg_cron jobs** (AC: #2, #3, #4, #6)
  - [ ] Create `sparta/supabase/migrations/000225_notification_log.sql`
  - [ ] Table: `id`, `club_id`, `profile_id`, `session_id`, `kind`, `scheduled_for`, `status`, `sent_at`, `error_message`, `created_at`
  - [ ] Unique constraint on `(profile_id, session_id, kind)`
  - [ ] Indexes: `idx_notification_log_processing (status, scheduled_for)`, `idx_notification_log_session (session_id, status)`
  - [ ] Trigger function `fn_cancel_notifications_on_session_cancel()` + trigger `tg_cancel_notifications_on_session_cancel`
  - [ ] Enable RLS: staff can SELECT (same club), service-role bypasses for Edge Functions
  - [ ] Register pg_cron job for `schedule-session-pushes` hourly (pattern: `net.http_post` to `/functions/v1/schedule-session-pushes`)
  - [ ] Register pg_cron job for `send-push` every 5 minutes (pattern: `net.http_post` to `/functions/v1/send-push`)
  - [ ] Graceful degradation when pg_cron/pg_net not available (local/CI)

- [ ] **Task 3: Server Actions — `src/lib/actions/notifications.ts`** (AC: #5)
  - [ ] `getNotificationSettings(): Promise<Result<NotificationSettings, AppError>>`
    - Auth check: staff only
    - SELECT from `notification_settings` WHERE club_id = profile.club_id
    - If no row: return defaults (`{ pre_minutes: 30, post_minutes: 30, is_enabled: true }`)
  - [ ] `updateNotificationSettings(input): Promise<Result<NotificationSettings, AppError>>`
    - Zod schema: `pre_minutes` (int, 5–120), `post_minutes` (int, 5–120), `is_enabled` (boolean)
    - Auth check: staff only (coach/analyst)
    - UPSERT into `notification_settings` ON CONFLICT (club_id) DO UPDATE
    - Returns updated settings
  - [ ] Use `createServerClient()` (await) + `ok()`/`err()` + `logger`

- [ ] **Task 4: Staff UI — `/configuracoes/notificacoes-clube`** (AC: #5)
  - [ ] Create `sparta/src/app/(staff)/configuracoes/notificacoes-clube/page.tsx` (Server Component)
  - [ ] Fetch current settings via `getNotificationSettings()` (server-side)
  - [ ] Create Client Component `NotificationSettingsForm` for interactive form
  - [ ] Fields: toggle `is_enabled`, numeric inputs `pre_minutes` and `post_minutes`
  - [ ] On submit: call `updateNotificationSettings()`, show success/error feedback
  - [ ] Use `react-hook-form` + Zod validation (client-side mirror of server validation)
  - [ ] Render `<EmptyState>` if not staff (defensive guard)
  - [ ] Add route to staff navigation menu (check if `/configuracoes` layout already exists)

- [ ] **Task 5: Edge Function — `schedule-session-pushes`** (AC: #3)
  - [ ] Create `sparta/supabase/functions/schedule-session-pushes/deno.json`
  - [ ] Create `sparta/supabase/functions/schedule-session-pushes/index.ts`
  - [ ] Read env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] Create service-role client (bypasses RLS for cross-table queries)
  - [ ] Query sessions: `WHERE status = 'scheduled' AND scheduled_at BETWEEN now() AND now() + interval '24 hours'`
  - [ ] For each session: read `notification_settings` for club → get `pre_minutes`, `post_minutes`, `is_enabled`
  - [ ] Skip if `is_enabled = false`
  - [ ] Query active players: JOIN `players` WHERE `players.session_id` (via `match_lineups` or all club players?): **use all club players** (notifications go to all club players with active subscriptions, not just match squad — per FR42/FR44)
  - [ ] Filter: `players.processing_restricted = false`, subscription `is_active = true`
  - [ ] Compute `scheduled_for_pre` and `scheduled_for_post`; skip if in the past
  - [ ] Bulk UPSERT into `notification_log` ON CONFLICT DO NOTHING
  - [ ] Log structured JSON: `{ event: 'schedule_session_pushes', session_id, enqueued, skipped }`
  - [ ] Return `200 OK` with stats

- [ ] **Task 6: Edge Function — `send-push`** (AC: #4)
  - [ ] Create `sparta/supabase/functions/send-push/deno.json`
  - [ ] Create `sparta/supabase/functions/send-push/index.ts`
  - [ ] Read env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` (or `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — see Dev Notes)
  - [ ] `import webpush from "npm:web-push"` — configure with VAPID keys
  - [ ] Query `notification_log` WHERE `status = 'scheduled' AND scheduled_for <= now() LIMIT 50` ORDER BY `scheduled_for ASC`
  - [ ] For each row: fetch `push_subscriptions` WHERE `profile_id = row.profile_id AND is_active = true`
  - [ ] If no subscription: UPDATE notification_log SET status='skipped'; continue
  - [ ] Build opaque payload: title "SPARTA", body based on kind (pre/post), deepLink
  - [ ] `await webpush.sendNotification(subscription, JSON.stringify(payload))`
  - [ ] On success: UPDATE notification_log SET status='sent', sent_at=now()
  - [ ] On 410/404: UPDATE notification_log SET status='failed', error_message='410 Gone' + UPDATE push_subscriptions SET is_active=false WHERE endpoint=subscription.endpoint
  - [ ] On other error: UPDATE notification_log SET status='failed', error_message=statusText
  - [ ] Log per-batch stats, return `200 OK`

- [ ] **Task 7: Testes de Integração** (AC: #7)
  - [ ] Create `sparta/src/__tests__/lib/actions/notifications.test.ts`
  - [ ] Test `getNotificationSettings`: no row → defaults; row exists → correct values
  - [ ] Test `updateNotificationSettings`: success upsert; range validation (pre_minutes < 5 → error)
  - [ ] Test RLS: player cannot call `updateNotificationSettings` (forbidden)
  - [ ] Mock `schedule-session-pushes` logic: verify pre/post times, skip logic, idempotency
  - [ ] Mock `send-push` logic: opaque payload assertion, 410 handler, subscription deactivation
  - [ ] Test cancellation: session cancel → notification_log rows become 'cancelled' (DB trigger test)
  - [ ] Target ≥80% branch coverage for `notifications.ts`

---

## Dev Notes

### ⚠️ Pré-requisito: Story 4.7 Must Be Done

Story 4.8 depends on:
- `push_subscriptions` table (migration `000210_push_subscriptions.sql`)
- `deactivateExpiredSubscription(endpoint)` Server Action in `src/lib/actions/push.ts`
- Service worker push + notificationclick handlers in `src/app/sw.ts`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` environment variable configured

If Story 4.7 is not done, implement it first.

---

### VAPID Key Naming — Discrepância Crítica

O ficheiro `.env.example` usa `VAPID_PUBLIC_KEY`, mas Story 4.7 especifica `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

**Correto para o cliente Next.js:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (sem o prefixo `NEXT_PUBLIC_` a variável não é acessível no browser).

**Para os Edge Functions (Deno):** lêem `VAPID_PRIVATE_KEY` via `Deno.env.get('VAPID_PRIVATE_KEY')` e precisam também da public key. Em Deno, não existe a convenção `NEXT_PUBLIC_`, por isso o Edge Function deve ler a public key de um secret nomeado `VAPID_PUBLIC_KEY`.

**Resumo:**
- `.env.local` (dev): `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<value>` (para o browser/Next.js)
- Vercel env var: `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<value>`
- Supabase Edge Function secrets: `VAPID_PRIVATE_KEY=<value>` + `VAPID_PUBLIC_KEY=<value>`
- `send-push` Edge Function lê: `Deno.env.get('VAPID_PRIVATE_KEY')` e `Deno.env.get('VAPID_PUBLIC_KEY')`

Update `.env.example` to clarify this distinction.

---

### Padrão de Edge Function (Deno) — Seguir Código Existente

Basear-se em `sparta/supabase/functions/send-parental-consent/index.ts`:
```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";
// Deno.env.get() para todos os secrets
// Service-role client (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey);
// Retornar Response com JSON e Content-Type
export default handler; // named export default
```

**Para web-push em Deno:**
```typescript
import webpush from "npm:web-push";
webpush.setVapidDetails(
  'mailto:sparta@example.com', // ou SITE_URL
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);
```

Nota: `npm:web-push` funciona em Supabase Edge Functions. Testar localmente com `supabase functions serve`.

---

### Padrão de pg_cron + pg_net — Seguir Migration 000172

Ver `000172_pg_cron_consent_reminders.sql` para o padrão exato:

```sql
-- Função PL/pgSQL SECURITY DEFINER com SET search_path = public
CREATE OR REPLACE FUNCTION public.schedule_session_pushes_job()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_key  text;
BEGIN
  BEGIN
    v_supabase_url := current_setting('app.supabase_url');
    v_service_key  := current_setting('app.service_role_key');
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := '';
    v_service_key  := '';
    RAISE WARNING '[schedule_session_pushes_job] app settings not configured — skipping';
  END;

  IF v_supabase_url <> '' AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url     := v_supabase_url || '/functions/v1/schedule-session-pushes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body    := '{}'::jsonb
    );
  END IF;
END;
$$;

-- Registo do job (cron a cada hora, em :00)
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron não disponível — ignorando';
    RETURN;
  END IF;
  PERFORM cron.schedule('schedule_session_pushes_hourly', '0 * * * *', $$SELECT public.schedule_session_pushes_job()$$);
EXCEPTION WHEN unique_violation THEN NULL;
END;
$do$;
```

O mesmo padrão para `send_push_job` mas com schedule `*/5 * * * *` (a cada 5 minutos).

---

### Padrão de Server Action — Seguir `fatigue.ts` e `sessions.ts`

```typescript
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { logger } from "@/lib/logger";
import { z } from "zod";

const NotificationSettingsSchema = z.object({
  pre_minutes: z.number().int().min(5).max(120),
  post_minutes: z.number().int().min(5).max(120),
  is_enabled: z.boolean(),
});

export async function updateNotificationSettings(
  input: unknown
): Promise<Result<NotificationSettings, AppError>> {
  const validated = NotificationSettingsSchema.safeParse(input);
  if (!validated.success) {
    return err({ code: "validation", message: "Valores inválidos: minutos deve estar entre 5 e 120" });
  }
  
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });
  
  // Verify staff role
  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();
    
  if (!profile?.club_id) return err({ code: "forbidden", message: "Perfil não encontrado" });
  if (!["coach", "analyst"].includes(profile.role ?? "")) {
    return err({ code: "forbidden", message: "Só staff pode alterar estas definições" });
  }
  // ...upsert...
}
```

---

### Payload Opaco — Requisito NFR21 (GDPR Art. 9)

O payload de push **nunca** pode conter:
- Nome do tipo de sessão (treino/jogo)
- Score/avaliação
- Dados de saúde (fadiga, lesão)
- Nome do jogador no body

Textos aprovados:
- `fatigue_pre`: body = `"Sessão daqui a pouco — abre o app"`
- `fatigue_post`: body = `"Sessão concluída — responde ao questionário"`
- `title`: sempre `"SPARTA"` (ou `"SPARTA 🏆"`)

O `data.deepLink` é aceite no payload pois é só uma rota, não dados de saúde.

---

### Qual Conjunto de Jogadores Recebe Notificações?

O AC #3 diz "cada player com subscrição ativa" para uma sessão. A interpretação correta é:
- **Todos os jogadores ativos do clube** (não apenas os convocados) — as notificações pré/pós sessão são para estimular o preenchimento geral, não apenas para a equipa convocada
- Filtros: `players.club_id = session.club_id`, `players.archived_at IS NULL`, `players.processing_restricted = false`, e `push_subscriptions.is_active = true` para o respetivo `profile_id`

Referência: FR42 "Sistema envia push notification ao Jogador X minutos antes e Y minutos depois de **cada sessão**" — sem menção de convocados.

---

### Tabela `sessions` — Campos Relevantes

```sql
id uuid PK
club_id uuid FK
season_id uuid FK
type text -- 'training' | 'match' | 'friendly'
scheduled_at timestamptz NOT NULL  -- UTC; renderizar em Europe/Lisbon no cliente
duration_min int NOT NULL DEFAULT 90  -- CHECK (duration_min BETWEEN 15 AND 240)
status text -- 'scheduled' | 'cancelled' | 'completed'
```

Para o `schedule-session-pushes`, usar:
```sql
SELECT s.id, s.club_id, s.scheduled_at, s.duration_min
FROM sessions s
WHERE s.status = 'scheduled'
  AND s.scheduled_at BETWEEN now() AND now() + interval '24 hours'
```

---

### Cancellation Trigger — Padrão SQL

```sql
-- Função trigger
CREATE OR REPLACE FUNCTION public.fn_cancel_notifications_on_session_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'scheduled' THEN
    UPDATE public.notification_log
    SET status = 'cancelled'
    WHERE session_id = NEW.id
      AND status = 'scheduled';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER tg_cancel_notifications_on_session_cancel
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_cancel_notifications_on_session_cancel();
```

---

### TypeScript: `noUncheckedIndexedAccess`

O projeto usa `"noUncheckedIndexedAccess": true` no `tsconfig.json`. Em arrays e objectos, sempre usar:
```typescript
const item = arr?.[0] ?? null;
const val = obj?.["key"] ?? defaultValue;
```
Nunca: `const item = arr[0]` (erro de TypeScript).

---

### Estrutura de Ficheiros — Route Group Staff

As rotas de staff ficam em `src/app/(staff)/`:
```
src/app/(staff)/
├── configuracoes/
│   ├── notificacoes-clube/
│   │   └── page.tsx           ← NOVO (Server Component)
│   ├── seguranca/
│   │   └── page.tsx, actions.ts  (existente)
│   └── ...
```

Se o layout `(staff)/configuracoes/layout.tsx` não existir, criar apenas o `page.tsx`.

---

### Ficheiros Existentes Relevantes — NÃO Modificar Sem Necessidade

| Ficheiro | Estado | Relevância |
|---------|--------|------------|
| `src/lib/actions/fatigue.ts` | Existente | Padrão de Server Action |
| `src/lib/actions/sessions.ts` | Existente | `cancelSession()` já existe; trigger DB elimina necessidade de modificar |
| `src/lib/actions/push.ts` | Criar em Story 4.7 | `deactivateExpiredSubscription(endpoint)` chamado por `send-push` |
| `supabase/functions/send-parental-consent/index.ts` | Existente | Padrão de Edge Function Deno |
| `supabase/migrations/000172_pg_cron_consent_reminders.sql` | Existente | Padrão pg_cron + pg_net |
| `supabase/migrations/000200_fatigue_responses.sql` | Existente | Padrão de migration com RLS |

---

### Lições das Stories Anteriores

**Story 4.7 (não implementada ainda):**
- Migração `000210_push_subscriptions.sql` — verificar que foi aplicada
- `push_subscriptions.profile_id` → FK para `profiles`, não para `players`
- `deactivateExpiredSubscription(endpoint)` → chamada quando receber 410 do push service
- VAPID key naming: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` no client; `VAPID_PUBLIC_KEY` nos Edge Functions

**Story 4.4 (done — outbox offline):**
- O outbox drain usa Server Actions — padrão idempotente com UUIDv7
- Lição: idempotência via ON CONFLICT DO NOTHING para notification_log (mesma lógica)

**Story 3.4 (done — consent reminders):**
- pg_cron + pg_net padrão exato em `000172_pg_cron_consent_reminders.sql`
- Usar `SECURITY DEFINER SET search_path = public` em todas as funções PL/pgSQL
- Graceful degradation em local/CI quando pg_cron não disponível

**Story 1.12 (done — audit/telemetry):**
- Telemetry events: fire-and-forget com `void (async () => {})()`
- Não usar telemetry_events para notification_log (tabela dedicada)

---

### Ordem de Implementação Recomendada

1. **Fase 1 — DB:** Tasks 1 e 2 (migrações). Verificar `supabase db reset --no-seed` sem erros.
2. **Fase 2 — Server Actions:** Task 3 (`notifications.ts`). Testes unitários passam.
3. **Fase 3 — UI Staff:** Task 4 (page + form). Testar manualmente em dev server.
4. **Fase 4 — Edge Functions:** Task 5 (`schedule-session-pushes`) + Task 6 (`send-push`).
5. **Fase 5 — Testes:** Task 7. ≥80% coverage em `notifications.ts`.

---

## Dev Agent Record

### Agent Model Used

_a preencher pelo dev agent_

### Debug Log References

### Completion Notes List

### File List

---

## Project Structure Notes

**Novos ficheiros a criar:**
- `sparta/supabase/migrations/000220_notification_settings.sql`
- `sparta/supabase/migrations/000225_notification_log.sql`
- `sparta/supabase/functions/schedule-session-pushes/index.ts`
- `sparta/supabase/functions/schedule-session-pushes/deno.json`
- `sparta/supabase/functions/send-push/index.ts`
- `sparta/supabase/functions/send-push/deno.json`
- `sparta/src/app/(staff)/configuracoes/notificacoes-clube/page.tsx`
- `sparta/src/lib/actions/notifications.ts`
- `sparta/src/__tests__/lib/actions/notifications.test.ts`

**Ficheiros a atualizar:**
- `sparta/.env.example` — Clarificar VAPID key naming (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` vs `VAPID_PUBLIC_KEY`)
- `sparta/docs/PUSH.md` — Atualizar com informação sobre scheduler + send-push (complementar docs da Story 4.7)

**Ficheiros a NÃO modificar:**
- `sparta/src/lib/actions/sessions.ts` — O cancelamento é propagado via trigger DB (AC #6)
- `sparta/src/lib/actions/push.ts` — Criado em Story 4.7; o `send-push` Edge Function usa RLS bypass direto em vez de chamar Server Action para deactivate

---

## References

- [Epics.md — Story 4.8 AC](../_bmad-output/planning-artifacts/epics.md#Story-4.8) — Acceptance Criteria fonte
- [Architecture.md — Edge Functions](../_bmad-output/planning-artifacts/architecture.md#Edge-Functions) — Padrão Deno + service-role
- [Architecture.md — Push notification flow](../_bmad-output/planning-artifacts/architecture.md#Push-notification) — Sequência completa
- [Architecture.md — notification_settings dir](../_bmad-output/planning-artifacts/architecture.md#lib) — `lib/push/` directory
- [000172_pg_cron_consent_reminders.sql](../sparta/supabase/migrations/000172_pg_cron_consent_reminders.sql) — Padrão pg_cron + pg_net
- [send-parental-consent/index.ts](../sparta/supabase/functions/send-parental-consent/index.ts) — Padrão Edge Function Deno
- [fatigue.ts](../sparta/src/lib/actions/fatigue.ts) — Padrão Server Action
- [Story 4.7](./4-7-push-subscription-infrastructure-vapid-setup-subscribe-unsubscribe.md) — Pré-requisito (push_subscriptions + deactivateExpiredSubscription)
- NFR21: Payload push sempre opaco — sem dados Art. 9

---

## AC Verification Template

| AC | Verificado | Notas |
|----|------------|-------|
| AC #1 | ❌ Pendente | notification_settings table + RLS |
| AC #2 | ❌ Pendente | notification_log table + cancellation trigger |
| AC #3 | ❌ Pendente | schedule-session-pushes Edge Function + pg_cron |
| AC #4 | ❌ Pendente | send-push Edge Function + queue processing |
| AC #5 | ❌ Pendente | /configuracoes/notificacoes-clube Staff UI |
| AC #6 | ❌ Pendente | Cancellation propagation via trigger |
| AC #7 | ❌ Pendente | Test coverage ≥80% |

---

## Status Log

**2026-05-24:** Story criada via bmad-create-story. Análise completa: epics (AC fonte), architecture (Edge Function patterns, notification flow, pg_cron), Story 4.7 (pré-requisito: push_subscriptions + deactivateExpiredSubscription), Story 3.4 (pg_cron + pg_net pattern exato em 000172), fatigue.ts + sessions.ts (Server Action patterns), send-parental-consent (Deno Edge Function pattern), AGENTS.md (noUncheckedIndexedAccess, path aliases, React 19). Ready for dev.

**Próximo:** Verificar que Story 4.7 está done; depois run `/bmad-dev-story 4-8-pre-post-session-push-notifications-with-configurable-x-y.md`.

---

## Story Metadata

- **Epic Key:** 4
- **Story Key:** 4.8
- **Complexidade:** Alta (2 migrações + DB trigger + 2 Edge Functions + pg_cron + UI Staff + testes)
- **Estimativa de esforço:** 10–14 horas
- **Dependências:** Story 4.7 (push_subscriptions table + deactivateExpiredSubscription), Story 2.6 (sessions + cancelSession), Story 1.12 (telemetry pattern), Story 3.4 (pg_cron pattern)
- **Bloqueada por:** Story 4.7 não estar done
- **Categoria de teste:** Integration (DB trigger, Edge Function logic, RLS, queue processing)
- **Alterações na DB:** 2 migrações, 2 novas tabelas, 1 trigger, 2 jobs pg_cron
