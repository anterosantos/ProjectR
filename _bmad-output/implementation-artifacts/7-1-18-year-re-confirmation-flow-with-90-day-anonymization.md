# Story 7.1: Fluxo de Reconfirmação aos 18 Anos com Anonimização após 90 Dias

Status: review

**Story ID:** 7.1
**Epic:** Epic 7 — Análise Avançada & Operacionalização "Dados Mediados" (Phase 2 / Growth)
**Criado:** 2026-06-01
**Story anterior:** 6-8-session-rpe-entry-per-player-at-end-of-session (done)

> ⚠️ **DEPENDÊNCIAS:**
> - Story **2.9** done — função `public.anonymize_archived_player(player_id uuid)` existe em PL/pgSQL; preserva agregados (session_metrics, readiness_snapshots), apaga PII (full_name → `[anonimizado]`, birthdate → NULL, foto)
> - Story **3.1** done — `/politica-privacidade` Server Component com conteúdo da política de privacidade
> - Story **3.7** done — Edge Function `delete-cascade` e Server Action `triggerErasureCascade()` (ou equivalente) para apagamento em cascata com audit log
> - Story **1.3** done — `public.uuidv7()` disponível em todas as migrações
> - Story **1.12** done — `audit_logs` table + helper fire-and-forget

> ℹ️ **PRÓXIMA MIGRAÇÃO DISPONÍVEL:** `000300` (Story 6.8 sem migração SQL; 6.7 usou `000290_attendances.sql`)

> ⚠️ **NOTA CRÍTICA — BREVO vs RESEND:** O epics.md refere "Resend EU email". O projeto **migrou para Brevo na Story 1.18**. Todos os emails devem usar a API Brevo (`https://api.brevo.com/v3/smtp/email`) com `BREVO_API_KEY` + `BREVO_SENDER_EMAIL`. **NÃO usar Resend.**

> ⚠️ **NOTA — `anonymize_archived_player()` vs jogador activo:** A função de Story 2.9 foi criada para jogadores com `is_archived=true`. Para a anonimização aos 90 dias, o Dev Agent deve verificar se a função funciona com jogadores activos ou se é necessário: (a) arquivar o jogador primeiro, ou (b) extrair a lógica de anonimização de PII numa nova função separada. A decisão deve preservar agregados (session_metrics, readiness_snapshots, match_events) e anonimizar PII (full_name, birthdate, photo_url no storage).

---

## Story

Como sistema,
Quero detetar quando um jogador faz 18 anos e solicitar-lhe que reconfirme o seu próprio consentimento, anonimizando os dados após 90 dias sem resposta,
Para que o consentimento originalmente dado por um encarregado seja renovado pelo titular adulto, conforme as boas práticas GDPR.

---

## Acceptance Criteria

### AC #1 — Migração `000300_age_18_reconfirmation.sql`

**Given** a migration `000300_age_18_reconfirmation.sql` aplicada

**When** o schema é inspecionado

**Then** a tabela `consent_reconfirmations` existe com:
- `id uuid PRIMARY KEY DEFAULT public.uuidv7()`
- `club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE` *(invariante do projecto: todas as tabelas com PII têm club_id)*
- `player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE`
- `profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
- `token text NOT NULL UNIQUE`
- `status text NOT NULL CHECK (status IN ('pending','confirmed','anonymized'))`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `confirmed_at timestamptz` (nullable)
- `anonymized_at timestamptz` (nullable)
**And** RLS habilitada com policy staff-read por `club_id`
**And** sem políticas INSERT/UPDATE/DELETE para `authenticated` — escrita exclusivamente via service-role
**And** `CREATE UNIQUE INDEX idx_consent_reconfirmations_pending_per_player ON consent_reconfirmations(player_id) WHERE status = 'pending'`
**And** `CREATE INDEX idx_consent_reconfirmations_token ON consent_reconfirmations(token)`
**And** `CREATE INDEX idx_consent_reconfirmations_club ON consent_reconfirmations(club_id)`

---

### AC #2 — Funções PL/pgSQL e pg_cron jobs na migração

**Given** a migration `000300_age_18_reconfirmation.sql` aplicada

**When** o pg_cron job `detect_age_18_transitions` corre às 04:00 UTC diariamente

**Then** a função PL/pgSQL `detect_age_18_transitions()` é executada
**And** para cada jogador activo (`is_archived = false`) com `birthdate + interval '18 years' = CURRENT_DATE` e que tenha um `profile_id` definido:
  - Se já existe uma linha com `status IN ('pending','confirmed')` para esse player_id, a criação é ignorada (idempotente)
  - Caso contrário, cria uma linha em `consent_reconfirmations` com `status='pending'` e `token = encode(gen_random_bytes(32), 'hex')`
  - Invoca `pg_net.http_post()` de forma assíncrona para o Edge Function `send-age-18-reconfirmation` com `{"reconfirmationId": "<uuid>"}`

**Given** o pg_cron job `enforce_age_18_anonymization` corre às 04:30 UTC diariamente

**When** existem linhas em `consent_reconfirmations` com `status = 'pending'` E `created_at <= NOW() - INTERVAL '90 days'`

**Then** para cada linha encontrada:
  - A anonimização de PII do jogador é executada (ver nota sobre `anonymize_archived_player()` acima)
  - `status = 'anonymized'`, `anonymized_at = NOW()` são definidos
  - Um `audit_logs` entry com `action='consent.auto_anonymized_at_18'`, `actor_id=NULL`, `target_kind='player'`, `target_id=player_id`, `club_id=club_id` é inserido (fire-and-forget, dentro da função)

**And** ambos os jobs são registados com o padrão DO $do$ ... EXCEPTION WHEN unique_violation THEN NULL; END; (idempotente, seguro para re-aplicação)

---

### AC #3 — Edge Function `send-age-18-reconfirmation`

**Given** o Edge Function `supabase/functions/send-age-18-reconfirmation/index.ts` é invocado via POST com `{ "reconfirmationId": "<uuid>" }`

**When** o registo existe em `consent_reconfirmations` com `status='pending'`

**Then** o email do jogador é obtido via `adminClient.auth.admin.getUserById(profile_id)`
**And** um email Brevo é enviado com:
  - `sender: { name: "SPARTA", email: brevoSenderEmail }`
  - `to: [{ email: playerEmail }]`
  - `subject: "Os teus dados — 18 anos: confirma se queres continuar"`
  - `htmlContent` e `textContent` em PT-PT (nível B1): "Fizeste 18 anos! Os teus dados pessoais estão protegidos pelo teu clube. Como adulto, tens agora o direito de confirmar o teu próprio consentimento. Tens 90 dias para confirmar. Se não confirmares, os teus dados serão anonimizados automaticamente."
  - Link de confirmação: `${SITE_URL}/reconfirmacao/${token}`
  - Timeout 5s via `Promise.race([fetchBrevo, timeoutPromise])`
**And** em falha de Brevo: log de erro JSON estruturado + resposta HTTP 502

---

### AC #4 — Página `/reconfirmacao/[token]` (autenticada)

**Given** o jogador visita `/reconfirmacao/[token]` estando autenticado como `role='player'`

**When** o token é válido, existe em `consent_reconfirmations`, `status='pending'`, e o `profile_id` da linha corresponde ao `auth.uid()` do utilizador logado

**Then** a página mostra:
  - Título "Confirma o teu consentimento" (h1)
  - Conteúdo resumido da política de privacidade (redireccionamento para `/politica-privacidade` com link "ler na íntegra")
  - Botão primário "Confirmo o consentimento próprio"
  - Botão destrutivo "Apagar os meus dados" (envolto em `<CalmConfirmation>`)

**Given** o `status` já é `'confirmed'` ou `'anonymized'`

**When** a página tenta renderizar

**Then** `<EmptyState>` "Ação já processada. Não há nada a confirmar." é mostrado

**Given** o utilizador NÃO está autenticado

**When** visita `/reconfirmacao/[token]`

**Then** o middleware redireciona para `/login?redirect_to=/reconfirmacao/${token}` (comportamento padrão do grupo de rotas autenticadas)

**Given** o token não existe, o profile_id não corresponde ao utilizador logado, ou o utilizador não é `role='player'`

**When** `getReconfirmationByToken(token)` é chamado no Server Component

**Then** `notFound()` do Next.js é chamado → página 404

---

### AC #5 — Confirmação de consentimento

**Given** o jogador clica "Confirmo o consentimento próprio"

**When** `confirmReconfirmation(token)` é chamado (Server Action)

**Then** `requirePlayerRole()` é verificado (ou equivalente — garantir que só o próprio jogador pode confirmar)
**And** o token é validado (existe, pertence ao utilizador, status='pending')
**And** `consent_reconfirmations` é actualizado: `status='confirmed'`, `confirmed_at=now()`
**And** entrada `audit_logs` (fire-and-forget): `action='consent.self_confirmed_at_18'`, `target_kind='player'`, `target_id=player_id`, `actor_id=userId`, `club_id=clubId`
**And** toast "Consentimento confirmado. Obrigado!" é mostrado
**And** redirect para `/hoje`

---

### AC #6 — Apagamento imediato a pedido do jogador

**Given** o jogador clica "Apagar os meus dados" e confirma no `<CalmConfirmation>`

**When** `eraseDataViaReconfirmation(token)` é chamado (Server Action)

**Then** o token é validado (existe, pertence ao utilizador, status='pending')
**And** a cascata de apagamento da Story 3.7 é desencadeada (Edge Function `delete-cascade` ou mecanismo equivalente existente)
**And** `consent_reconfirmations` row: `status='anonymized'`, `anonymized_at=now()`
**And** entrada `audit_logs` (fire-and-forget): `action='consent.self_erased_at_18'`, `actor_id=userId`, `target_kind='player'`, `target_id=player_id`
**And** `supabase.auth.signOut()` é chamado no cliente após o apagamento
**And** redirect para `/` com mensagem "Os teus dados foram apagados."

---

### AC #7 — Cobertura de testes ≥80%

**Given** testes em `sparta/src/__tests__/reconfirmation.test.ts`

**When** executados com `npm run test`

**Then** cobrem:
- `confirmReconfirmation(token)`: happy path (status muda para 'confirmed', audit log criado), token inválido → not_found, utilizador errado (profile mismatch) → unauthorized, já confirmado → conflict
- `eraseDataViaReconfirmation(token)`: happy path (delete-cascade chamado, status='anonymized'), token inválido, utilizador errado, já anonimizado
- `getReconfirmationByToken(token)`: happy path, token não encontrado, profile mismatch, status já processado
- Rendering `ReconfirmationClient`: botão confirm dispara Server Action, botão erase mostra CalmConfirmation antes de disparar, EmptyState quando status≠pending
- Lógica das funções PL/pgSQL (via mocked SQL ou fixtures): day-of-18 cria row, idempotência (segunda chamada não cria duplicado), day-90 anonimiza + audit log

---

## Tasks / Subtasks

- [x] **Task 1: Migração `000300_age_18_reconfirmation.sql`** (AC: #1, #2)
  - [x] Criar `sparta/supabase/migrations/000300_age_18_reconfirmation.sql`
  - [x] Tabela `consent_reconfirmations` com todos os campos, constraints, índices e RLS (ver AC #1)
  - [x] `GRANT SELECT, INSERT, UPDATE ON consent_reconfirmations TO service_role;`
  - [x] Policy RLS staff-read:
    ```sql
    CREATE POLICY "consent_reconfirmations_staff_read"
      ON public.consent_reconfirmations
      FOR SELECT
      TO authenticated
      USING (club_id = (auth.jwt() ->> 'club_id')::uuid
             AND (auth.jwt() ->> 'role') IN ('coach', 'analyst'));
    ```
  - [x] Função PL/pgSQL `detect_age_18_transitions()`:
    ```sql
    CREATE OR REPLACE FUNCTION public.detect_age_18_transitions()
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE
      rec RECORD;
    BEGIN
      FOR rec IN
        SELECT p.id AS player_id, p.profile_id, p.club_id
        FROM   public.players p
        WHERE  p.is_archived = false
          AND  p.profile_id IS NOT NULL
          AND  p.birthdate + INTERVAL '18 years' = CURRENT_DATE
          AND  NOT EXISTS (
            SELECT 1 FROM public.consent_reconfirmations cr
            WHERE cr.player_id = p.id
              AND cr.status IN ('pending', 'confirmed')
          )
      LOOP
        INSERT INTO public.consent_reconfirmations
          (club_id, player_id, profile_id, token, status)
        VALUES (
          rec.club_id, rec.player_id, rec.profile_id,
          encode(gen_random_bytes(32), 'hex'), 'pending'
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO rec;

        -- Invoke Edge Function via pg_net (fire-and-forget)
        PERFORM pg_net.http_post(
          url     := current_setting('app.supabase_url', true)
                     || '/functions/v1/send-age-18-reconfirmation',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer '
                             || current_setting('app.service_role_key', true)
          ),
          body    := jsonb_build_object('reconfirmationId', rec.id)::text::bytea
        );
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'detect_age_18_transitions error: %', SQLERRM;
    END;
    $$;
    ```
  - [x] Função PL/pgSQL `enforce_age_18_anonymization()`:
    ```sql
    CREATE OR REPLACE FUNCTION public.enforce_age_18_anonymization()
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE
      rec RECORD;
    BEGIN
      FOR rec IN
        SELECT id, player_id, club_id
        FROM   public.consent_reconfirmations
        WHERE  status = 'pending'
          AND  created_at <= NOW() - INTERVAL '90 days'
      LOOP
        -- Anonymize PII (Story 2.9 pattern — verify function handles active players)
        PERFORM public.anonymize_archived_player(rec.player_id);

        UPDATE public.consent_reconfirmations
        SET    status = 'anonymized', anonymized_at = NOW()
        WHERE  id = rec.id;

        INSERT INTO public.audit_logs
          (club_id, actor_id, action, target_kind, target_id)
        VALUES (
          rec.club_id, NULL, 'consent.auto_anonymized_at_18',
          'player', rec.player_id
        );
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'enforce_age_18_anonymization error: %', SQLERRM;
    END;
    $$;
    ```
  - [x] Registar pg_cron jobs no bloco DO $do$ ... END; com EXCEPTION WHEN unique_violation:
    ```sql
    -- detect_age_18_transitions: diariamente às 04:00 UTC
    PERFORM cron.schedule(
      'detect_age_18_transitions',
      '0 4 * * *',
      $$SELECT public.detect_age_18_transitions()$$
    );
    -- enforce_age_18_anonymization: diariamente às 04:30 UTC
    PERFORM cron.schedule(
      'enforce_age_18_anonymization',
      '30 4 * * *',
      $$SELECT public.enforce_age_18_anonymization()$$
    );
    ```

- [x] **Task 2: Edge Function `send-age-18-reconfirmation`** (AC: #3)
  - [x] Criar `sparta/supabase/functions/send-age-18-reconfirmation/index.ts`
  - [x] Estrutura idêntica ao `send-parental-consent` (padrão Brevo, timeout 5s, CORS restrito)
  - [x] Lê `reconfirmationId` do body JSON
  - [x] Obtém registo `consent_reconfirmations` via service-role client
  - [x] Obtém email do jogador via `adminClient.auth.admin.getUserById(profile_id)` → `user.email`
  - [x] Envia via Brevo com subject, htmlContent, textContent PT-PT
  - [x] Env vars necessárias: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `SITE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - [x] Em sucesso: resposta `200 { ok: true }`; em erro Brevo: log JSON + resposta `502`

- [x] **Task 3: Schema Zod `src/lib/schemas/reconfirmation.ts`** (AC: #5, #6)
  - [x] Criar `sparta/src/lib/schemas/reconfirmation.ts` (SEM `"use server"`)
  - [x] Interface `ConsentReconfirmation` com todos os campos tipados

- [x] **Task 4: Server Actions `src/lib/actions/reconfirmation.ts`** (AC: #4, #5, #6)
  - [x] Criar `sparta/src/lib/actions/reconfirmation.ts` com `"use server"` no topo
  - [x] Helper interno `getAuthenticatedPlayer()` com verificação role=player
  - [x] `getReconfirmationByToken(token: string)` com verificação profile_id === userId
  - [x] `confirmReconfirmation(token: string)` com audit log fire-and-forget
  - [x] `eraseDataViaReconfirmation(token: string)` invoca Edge Function `erase-cascade`

- [x] **Task 5: Server Component `src/app/(player)/reconfirmacao/[token]/page.tsx`** (AC: #4)
  - [x] Criar `sparta/src/app/(player)/reconfirmacao/[token]/page.tsx`
  - [x] notFound() quando token inválido ou profile mismatch
  - [x] EmptyState quando status ≠ 'pending'
  - [x] Link "Ler política de privacidade na íntegra" → `/politica-privacidade`
  - [x] Metadata definida

- [x] **Task 6: Client Component `ReconfirmationClient.tsx`** (AC: #4, #5, #6)
  - [x] Criar `sparta/src/app/(player)/reconfirmacao/[token]/ReconfirmationClient.tsx`
  - [x] Botão primário "Confirmo o consentimento próprio" com startTransition
  - [x] CalmConfirmation success toast após confirmação + redirect /hoje
  - [x] Botão destrutivo "Apagar os meus dados" → CalmConfirmation warning (3s) → onDismiss executa erase
  - [x] supabase.auth.signOut() + redirect / após apagamento
  - [x] Botões com disabled={isPending}, aria-busy

- [x] **Task 7: Actualização de `database.types.ts`** (AC: #1)
  - [x] Adicionado tipo `consent_reconfirmations` com Row/Insert/Update/Relationships

- [x] **Task 8: Testes** (AC: #7)
  - [x] Criar `sparta/src/__tests__/reconfirmation.test.ts` — 19 testes Server Actions + PL/pgSQL simulation
  - [x] Criar `sparta/src/__tests__/app/reconfirmation-client.test.tsx` — 7 testes componente
  - [x] 26/26 testes passam; 1853/1853 testes totais ✅; lint ✅; typecheck ✅

---

## Dev Notes

### Arquitectura Geral

Esta story cobre todo o ciclo de reconfirmação GDPR quando um jogador menor atinge a maioridade:
1. **Detecção automática** (pg_cron às 04:00 UTC): cria `consent_reconfirmations` row + envia email
2. **Confirmação voluntária** (player visita /reconfirmacao/[token]): confirma ou apaga
3. **Anonimização forçada** (pg_cron às 04:30 UTC): após 90 dias sem resposta

### Padrões de Projecto a Seguir Obrigatoriamente

**pg_cron (reutilizar padrão de `000142_pg_cron_anonymize_job.sql` e `000172_pg_cron_consent_reminders.sql`):**
```sql
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not available — skipping cron job registration (local/CI env)';
    RETURN;
  END IF;
  PERFORM cron.schedule('nome_job', 'cron_expr', $$SQL$$);
EXCEPTION
  WHEN unique_violation THEN NULL;  -- já registado, safe to ignore
END;
$do$;
```

**Server Actions (padrão estabelecido):**
- `"use server"` no topo do ficheiro
- Validação no início via `getAuthenticatedPlayer()` ou `requireStaffRole()`
- Retornam `Result<T, E>` (discriminated union: `{ ok: true; data: T } | { ok: false; error: E }`)
- Fire-and-forget para audit_logs (envolvido em `void (async () => { ... })()`)
- Usar `getServiceRoleClient()` para escritas que bypassa RLS

**Edge Function Brevo (padrão de `send-parental-consent/index.ts`):**
```typescript
const fetchBrevo = fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: { "api-key": brevoApiKey, "Content-Type": "application/json" },
  body: JSON.stringify({ sender: { name: "SPARTA", email: brevoSenderEmail }, to: [...], subject, htmlContent, textContent }),
})
const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("brevo_timeout")), 5000))
const brevoRes = await Promise.race([fetchBrevo, timeoutPromise])
```

**Audit logs (padrão fire-and-forget):**
```typescript
void (async () => {
  try {
    await serviceRole.from('audit_logs').insert({
      actor_id: userId, // NULL se job automático
      action: 'consent.self_confirmed_at_18',
      target_kind: 'player', target_id: playerId, club_id: clubId,
    })
  } catch (e) {
    logger.error('reconfirmation.audit_log_failed', { error: e instanceof Error ? e.message : String(e) })
  }
})()
```

### Estrutura de Ficheiros

```
sparta/
├── supabase/
│   ├── migrations/
│   │   └── 000300_age_18_reconfirmation.sql          [NOVO]
│   └── functions/
│       └── send-age-18-reconfirmation/
│           └── index.ts                              [NOVO]
└── src/
    ├── lib/
    │   ├── schemas/
    │   │   └── reconfirmation.ts                     [NOVO]
    │   ├── actions/
    │   │   └── reconfirmation.ts                     [NOVO]
    │   └── supabase/
    │       └── database.types.ts                     [UPDATE: adicionar consent_reconfirmations]
    ├── app/
    │   └── (player)/
    │       └── reconfirmacao/
    │           └── [token]/
    │               ├── page.tsx                      [NOVO — Server Component]
    │               └── ReconfirmationClient.tsx      [NOVO — Client Component]
    └── __tests__/
        └── reconfirmation.test.ts                    [NOVO]
```

### Ficheiros Existentes a NÃO Modificar (a menos que necessário)

- `src/lib/actions/data-rights.ts` — já tem o mecanismo de erasure da Story 3.7; reutilizar
- `src/lib/outbox/drain.ts` — este fluxo não é offline (acção deliberada autenticada, sem outbox)
- `src/middleware.ts` — a rota `/reconfirmacao` não é uma rota staff-only; sem alterações previstas

### Pontos de Atenção Específicos

1. **`anonymize_archived_player()` e jogadores activos**: A função foi criada para `is_archived=true`. O Dev Agent deve ler `sparta/supabase/migrations/000142_pg_cron_anonymize_job.sql` e a função correspondente para verificar se funciona com jogadores activos. Se não funcionar, extrair a lógica de anonimização de PII numa função nova (e.g., `anonymize_player_pii(player_id)`).

2. **Token vs autenticação**: O token no URL é um identificador do pedido de reconfirmação, NÃO um bypass de autenticação. O utilizador DEVE estar logado. A verificação é dupla: token existe + profile_id === auth.uid().

3. **Rota `/reconfirmacao` no grupo de rotas**: Verificar se o grupo `(player)` tem um layout que aplica middleware de autenticação. Se não, o Server Component deve lidar com o redirect manualmente ou usar o middleware global.

4. **Email do jogador**: Obtido via `adminClient.auth.admin.getUserById(reconfirmation.profile_id)`. O `profile_id` referencia `profiles.id` que é FK para `auth.users.id`. Logo `adminClient.auth.admin.getUserById(profile_id)` devolve o utilizador com o email.

5. **Erasure vs Anonimização**:
   - "Apagar os meus dados" (AC #6) = Story 3.7 cascade delete (apaga tudo, incluindo agregados)
   - 90-day auto-job (AC #7) = anonimização de PII preservando agregados (Story 2.9 pattern)
   São dois mecanismos DIFERENTES.

6. **club_id na tabela**: Apesar de não estar na spec do epics, o invariante do projecto exige `club_id` em todas as tabelas com PII (verificado por lint CI). Adicioná-lo via JOIN no player na PL/pgSQL.

---

## Review Findings

### Decision-Needed

- [x] (Decision) **Unauthenticated users: redirect to login** — Resolvido: `/reconfirmacao/[token]/page.tsx` line 20 agora chama `redirect()` para `/login?redirect_to=/reconfirmacao/${token}` em vez de `notFound()`. Matches spec AC#4.

### Patches

- [ ] (Patch) **Inconsistent state: confirmed_at set, status ≠ 'confirmed'** — `reconfirmation.ts:117-118` — Sem constraint SQL `WHEN confirmed_at IS NOT NULL THEN status = 'confirmed'`, estado corrupto é possível (e.g., direct SQL edits, race conditions). Requer CHECK constraint na migração.
- [ ] (Patch) **'anonymized' status not handled in ReconfirmationClient** — `ReconfirmationClient.tsx:10-90` — Estado machine não renderiza "already anonymized"; mostra buttons para confirm/erase que vão falhar. Requer novo branch de renderização para status='anonymized'.
- [ ] (Patch) **Concurrent confirm + erase race condition** — `reconfirmation.ts:115-239` — Sem transação ou locking, dois requests simultâneos podem deixar row em estado inconsistente (both confirmed_at E anonymized_at set). Requer SELECT … FOR UPDATE ou transactional guard.
- [ ] (Patch) **Audit log insert fails silently** — `reconfirmation.ts:128-143, 241-256` — Fire-and-forget pattern sem alerting; se audit_logs falhar, player vê sucesso mas não há compliance trail. Requer fallback ou logger.error com contexto.
- [ ] (Patch) **Cron job failures logged as WARNING only, no alerting** — `000300_age_18_reconfirmation.sql:158-167, 207-209` — RAISE WARNING não dispara Slack/email; DBAs devem inspecionar logs manualmente. Requer alerting mechanism ou edge function call para monitoring.
- [ ] (Patch) **Edge Function skipped flag ignored** — `000300_age_18_reconfirmation.sql:150-157` — Cron job não verifica `skipped` flag na resposta Edge Function; email silenciosamente omitido (pending → 90 days → auto-anonymized, player never notified). Requer check do response body.
- [ ] (Patch) **Timeout error handling incomplete** — `reconfirmation.ts:198-232` — Apenas AbortError é caught; TypeError, network errors bubbles unhandled → server action crashes. Requer catch-all com graceful error message.
- [ ] (Patch) **anonymize_player_pii() idempotency check partial** — `000300_age_18_reconfirmation.sql:65-69` — Only checks `full_name = '[anonimizado]'`; birthdate/photo_path can still be populated if name was manually edited. Requer multi-field idempotency check.
- [ ] (Patch) **profile_id references deleted auth user** — `reconfirmation.ts:105-115` — Edge Function calls `adminClient.auth.admin.getUserById()` without pre-validation; returns 500 if user deleted. Requer profile existence check BEFORE creating reconfirmation row, or better error handling in EF.

### Deferred

- [x] (Defer) **Birthdate timezone off-by-one** — `000300_age_18_reconfirmation.sql:125` — `CURRENT_DATE` evaluated in server timezone (UTC); if club is in PT, may trigger on wrong date. This is pre-existing (shared across all age-based triggers in codebase), not specific to this story. Deferred to timezone audit epic.

---

### Referências de Código

- Padrão pg_cron: `sparta/supabase/migrations/000142_pg_cron_anonymize_job.sql` e `000172_pg_cron_consent_reminders.sql`
- Padrão Edge Function Brevo: `sparta/supabase/functions/send-parental-consent/index.ts`
- Padrão Server Actions auth: `sparta/src/lib/actions/auth.ts` (requireStaffRole)
- Padrão anonymization PL/pgSQL: `sparta/supabase/migrations/000142_pg_cron_anonymize_job.sql`
- Padrão RLS: `sparta/supabase/migrations/000170_parental_consents.sql`
- Story 3.7 erasure: `_bmad-output/implementation-artifacts/3-7-right-to-erasure-cascade-deletion.md`
- Story 2.9 anonymization: `_bmad-output/implementation-artifacts/2-9-retention-policy-preserve-history-5-seasons-anonymization-hook.md`
- Players schema com birthdate: `sparta/supabase/migrations/000070_players_positions.sql`
- Parental consents schema: `sparta/supabase/migrations/000170_parental_consents.sql`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Criada função `anonymize_player_pii(player_id)` separada de `anonymize_archived_player()` porque a função original verifica `is_archived=true` e não funciona para jogadores activos. A nova função anonimiza PII sem verificar o estado de arquivo (preserva agregados via FK). Diferença semântica crítica: AC#6 (apagar → erase-cascade full delete) vs AC#2 pg_cron (anonimizar → PII-only).
- RLS policy usa padrão `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND ...)` em vez de `auth.jwt() ->> 'club_id'` (não funciona em CI/Supabase local — ver AGENTS.md regra #3).
- `pg_net.http_post()` corrigido para `net.http_post()` (extensão pg_net instala funções no schema `net`, não `pg_net`) — seguindo padrão de `000172_pg_cron_consent_reminders.sql`.
- RETURNING INTO usa variável separada `v_reconf_id uuid` para não sobrescrever campos do record loop (bug no spec original).
- CalmConfirmation usada como warning pré-ação (3s duration, onDismiss = trigger erase) para o botão destrutivo, e como success toast (2s, onDismiss = redirect) após confirmação.
- Testes do componente mockam CalmConfirmation para capturar `onDismiss` e invocá-lo manualmente — evita conflito entre `vi.useFakeTimers()` e `waitFor` interno do Testing Library.

### File List

- sparta/supabase/migrations/000300_age_18_reconfirmation.sql [NOVO]
- sparta/supabase/functions/send-age-18-reconfirmation/index.ts [NOVO]
- sparta/src/lib/schemas/reconfirmation.ts [NOVO]
- sparta/src/lib/actions/reconfirmation.ts [NOVO]
- sparta/src/app/(player)/reconfirmacao/[token]/page.tsx [NOVO]
- sparta/src/app/(player)/reconfirmacao/[token]/ReconfirmationClient.tsx [NOVO]
- sparta/src/lib/supabase/database.types.ts [MODIFICADO — adicionado consent_reconfirmations]
- sparta/src/__tests__/reconfirmation.test.ts [NOVO]
- sparta/src/__tests__/app/reconfirmation-client.test.tsx [NOVO]

### Change Log

- 2026-06-01: Story 7.1 implementada — fluxo completo de reconfirmação GDPR aos 18 anos: migração SQL + pg_cron + Edge Function Brevo + Server Actions + página player + 26 testes. 1853/1853 testes ✅; lint ✅; typecheck ✅ (sem novas regressões).
