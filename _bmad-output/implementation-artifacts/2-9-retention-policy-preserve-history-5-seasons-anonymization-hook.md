# Story 2.9: Retention Policy — Preserve History 5 Seasons + Anonymization Hook

**Status:** ready-for-dev

**Story ID:** 2.9  
**Epic:** Epic 2 — Plantel, Calendário & Sessões (gestão operacional do staff)  
**Created:** 2026-05-19

---

## Story

Como o Sistema,  
Quero preservar o histórico de um jogador por 5 épocas após ele sair do clube, depois anonimizar os dados pessoais automaticamente,  
Para que cumprir a política de retenção sem intervenção manual.

---

## Acceptance Criteria

### AC #1: Migração `000140_players_archived_at.sql` — Campo de Timestamp

**Given** migração `000140_players_archived_at.sql`  
**When** aplicada  
**Then** tabela `players` recebe coluna:
- `archived_at timestamptz nullable` (default null; preenchido quando `is_archived=true`)
- Índice em `(club_id, archived_at)` para queries rápidas de jogadores arquivados por timestamp

**And** na seed.sql, a coluna é criada mas sem dados (dados inseridos via UI Story 2.4)

---

### AC #2: Migração `000141_anonymize_archived_players_function.sql` — Função PL/pgSQL

**Given** migração `000141_anonymize_archived_players_function.sql`  
**When** aplicada  
**Then** função PL/pgSQL `anonymize_archived_player(player_id uuid)` existe:

```sql
CREATE OR REPLACE FUNCTION public.anonymize_archived_player(p_player_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_club_id uuid;
  v_archived_at timestamptz;
  v_age_group text;
  v_seasons_count int;
BEGIN
  -- Fetch player's archived_at and club_id
  SELECT club_id, archived_at, age_group INTO v_club_id, v_archived_at, v_age_group
    FROM players WHERE id = p_player_id;
  
  IF v_archived_at IS NULL THEN
    RAISE NOTICE 'Player % is not archived; skipping anonymization', p_player_id;
    RETURN false;
  END IF;
  
  -- Calculate seasons elapsed since archived_at
  -- Assuming each season is ~9 months (crude approximation; refined in implementation)
  v_seasons_count := FLOOR(EXTRACT(DAY FROM (NOW() - v_archived_at)) / 275);
  
  IF v_seasons_count < 5 THEN
    RAISE NOTICE 'Player % archived < 5 seasons ago; skipping', p_player_id;
    RETURN false;
  END IF;
  
  -- Anonymize: full_name, birthdate, photo_path
  UPDATE players
  SET
    full_name = '[anonimizado]',
    birthdate = NULL,
    photo_path = NULL,
    is_archived = true,
    updated_at = NOW()
  WHERE id = p_player_id;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION anonymize_archived_player(uuid) IS
  'Anonymizes a player archived 5+ seasons ago. Idempotent: returns false if not yet due or already anonymized.';
```

**And** função é idempotente:
- Se player não está em `is_archived=true`, retorna false
- Se `archived_at` é NULL, retorna false
- Se `archived_at + 5 seasons > NOW()`, retorna false
- Se já foi anonimizado (full_name='[anonimizado]'), retorna false (sem erro)

---

### AC #3: Migração `000142_pg_cron_anonymize_job.sql` — Cron Job Mensal

**Given** migração `000142_pg_cron_anonymize_job.sql`  
**When** aplicada  
**Then** pg_cron job `anonymize_archived_players_monthly` é registrado:

```sql
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not available — skipping cron job registration';
    RETURN;
  END IF;
  
  PERFORM cron.schedule(
    'anonymize_archived_players_monthly',
    '0 1 1 * *',  -- 1st of each month at 01:00 UTC
    $$
    SELECT anonymize_archived_player(id)
    FROM players
    WHERE is_archived = true
      AND archived_at IS NOT NULL
      AND full_name != '[anonimizado]'
    $$
  );
EXCEPTION
  WHEN unique_violation THEN NULL;
END;
$do$;
```

**And** job corre mensalmente sem erros, processando batch de jogadores arquivados  
**And** histórico de fadiga, eventos e métricas permanece intacto com `player_id` preservado (statistics-only retention)  
**And** a função roda como `postgres` role (bypassa RLS) conforme pg_cron spec

---

### AC #4: Campo `photo_path` em Tabela `players`

**Given** a tabela `players` de story 2.2 (000085_players_photo.sql)  
**When** revisada  
**Then** coluna `photo_path` text nullable existe (armazena caminho Storage em Supabase, ex. `players/club-id/player-id/photo.webp`)

**And** durante anonimização, `photo_path` é setado para NULL  
**And** arquivo real em Storage é deletado via Edge Function `anonymize-player-photos` (ver AC #5)

---

### AC #5: Edge Function `anonymize-player-photos` — Limpeza Storage

**Given** Edge Function em `supabase/functions/anonymize-player-photos/index.ts`  
**When** invocada via cron ou manualmente via Server Action  
**Then** função executa:

- Fetcheia lista de players com `archived_at + 5 seasons <= NOW()` e `photo_path IS NOT NULL`
- Para cada player, deleta arquivo de Storage em `players/{club_id}/{player_id}/*` usando service-role client
- Não falha se arquivo já não existe (idempotente)
- Logs via `logTelemetry` para auditoria (fi.kind='photo_anonymization_completed')

**Implementation detail:**
```typescript
// supabase/functions/anonymize-player-photos/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";

export default async (req: Request) => {
  const supabaseServiceRole = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Query players ready for anonymization with photos still present
  const { data: players, error } = await supabaseServiceRole
    .from("players")
    .select("id, club_id, photo_path")
    .eq("is_archived", true)
    .not("photo_path", "is", null)
    .lte("archived_at", new Date(Date.now() - 5 * 9 * 30 * 24 * 60 * 60 * 1000)); // Approximate 5 seasons

  if (error) {
    return new Response(`Error fetching players: ${error.message}`, { status: 500 });
  }

  // Delete photos from Storage
  for (const player of players || []) {
    const bucket = "players";
    const path = `${player.club_id}/${player.id}`;
    
    const { error: deleteError } = await supabaseServiceRole.storage
      .from(bucket)
      .remove([path]);

    if (deleteError && !deleteError.message.includes("not found")) {
      console.error(`Failed to delete ${path}: ${deleteError.message}`);
    }
  }

  return new Response("Photo anonymization completed", { status: 200 });
};
```

---

### AC #6: Server Action `anonymizePlayer` — Testabilidade & Controle Manual

**Given** server action em `src/lib/actions/players.ts`  
**When** chamada com `player_id`  
**Then** executa:

```typescript
export async function anonymizePlayer(playerId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Verify user is analyst/coach
    const { data: { user } } = await supabaseServer.auth.getUser();
    if (!user) return { success: false, message: "Not authenticated" };

    // Call PL/pgSQL function
    const { data, error } = await supabaseServer
      .rpc("anonymize_archived_player", { p_player_id: playerId });

    if (error) {
      return { success: false, message: `Anonymization failed: ${error.message}` };
    }

    // Log telemetry
    await logTelemetry({
      kind: "player_anonymized",
      payload: { player_id: playerId, triggered_by: "manual_test_or_cron" }
    });

    // Trigger photo cleanup if needed
    // In production, photo cleanup happens via Edge Function cron,
    // but for tests we can trigger manually
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/anonymize-player-photos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` }
    });

    return { success: true, message: "Player anonymized and photos cleaned up" };
  } catch (err) {
    return { success: false, message: `Unexpected error: ${String(err)}` };
  }
}
```

---

### AC #7: UI — Metadados de Arquivo nos Detalhes do Jogador

**Given** página de detalhes do jogador em `/plantel/[id]`  
**When** jogador está `is_archived=true` e `archived_at` está setado  
**Then** UI mostra:

- Badge/metadata: "Será anonimizado em **DD/MM/YYYY**" (calculado como `archived_at + 5 seasons` formatado em PT-PT)
- Se já anonimizado (full_name='[anonimizado]'): "Anonimizado em DD/MM/YYYY"
- Foto substitui-se com ícone `<CircleDashed>` (lucide-react) se `photo_path` for NULL

**Implementation in component:**
```typescript
// src/components/domain/PlayerDetailsHeader.tsx
const calculateAnonymizationDate = (archivedAt: string, ageGroup: string) => {
  const archived = new Date(archivedAt);
  // 5 seasons ≈ 5 × 9 months (crude; refined by PM later)
  const anonymizationDate = new Date(archived.getFullYear() + 4, archived.getMonth() + 9, archived.getDate());
  return anonymizationDate;
};

export function PlayerDetailsHeader({ player }) {
  const isAnonymized = player.full_name === "[anonimizado]";
  const anonymizationDate = player.archived_at 
    ? calculateAnonymizationDate(player.archived_at, player.age_group)
    : null;

  return (
    <div className="space-y-2">
      {player.is_archived && anonymizationDate && (
        <div className="text-sm text-text-secondary">
          {isAnonymized
            ? `Anonimizado em ${formatDate(player.updated_at, "short")}`
            : `Será anonimizado em ${formatDate(anonymizationDate, "short")}`}
        </div>
      )}
      {!player.photo_path && <CircleDashed className="w-12 h-12" />}
    </div>
  );
}
```

---

### AC #8: Teste Unitário — `anonymize_archived_player` Function

**Given** testes via `npm run test --run` em `project-r/`  
**When** executados  
**Then** cobertura ≥80% para:

- **Not Yet Due:** Player archived 3 seasons ago → function returns false, no anonymization occurs
- **Exactly Due:** Player archived 5.0 seasons ago → function returns true, PII anonymized
- **Already Anonymized:** Player already has full_name='[anonimizado]' → function returns false (idempotent)
- **Not Archived:** Player has is_archived=false → function returns false (guard)
- **NULL archived_at:** Player has archived_at=NULL → function returns false (guard)

**Test fixture example:**
```typescript
// __tests__/lib/anonymize-archived-player.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { supabaseAdmin } from "@/lib/supabase/service-role";

describe("anonymize_archived_player", () => {
  beforeEach(async () => {
    // Reset to clean state
    await supabaseAdmin.from("players").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  });

  it("should not anonymize player archived < 5 seasons ago", async () => {
    const now = new Date();
    const 3SeasonAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    
    const { data: player } = await supabaseAdmin
      .from("players")
      .insert({
        club_id: testClubId,
        jersey_num: 1,
        full_name: "João Silva",
        birthdate: "2005-01-01",
        age_group: "u19",
        is_archived: true,
        archived_at: 3SeasonAgo.toISOString()
      })
      .select()
      .single();

    const { data: result, error } = await supabaseAdmin.rpc("anonymize_archived_player", {
      p_player_id: player.id
    });

    expect(error).toBeNull();
    expect(result).toBe(false);

    const { data: fetched } = await supabaseAdmin
      .from("players")
      .select("full_name")
      .eq("id", player.id)
      .single();

    expect(fetched.full_name).toBe("João Silva"); // Not anonymized
  });

  it("should anonymize player archived 5+ seasons ago", async () => {
    const now = new Date();
    const 5SeasonAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    
    const { data: player } = await supabaseAdmin
      .from("players")
      .insert({
        club_id: testClubId,
        jersey_num: 2,
        full_name: "Maria Costa",
        birthdate: "2004-01-01",
        age_group: "u19",
        is_archived: true,
        archived_at: 5SeasonAgo.toISOString()
      })
      .select()
      .single();

    const { data: result, error } = await supabaseAdmin.rpc("anonymize_archived_player", {
      p_player_id: player.id
    });

    expect(error).toBeNull();
    expect(result).toBe(true);

    const { data: fetched } = await supabaseAdmin
      .from("players")
      .select("full_name, birthdate, photo_path")
      .eq("id", player.id)
      .single();

    expect(fetched.full_name).toBe("[anonimizado]");
    expect(fetched.birthdate).toBeNull();
    expect(fetched.photo_path).toBeNull();
  });

  it("should be idempotent (second call returns false)", async () => {
    const now = new Date();
    const 5SeasonAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    
    const { data: player } = await supabaseAdmin
      .from("players")
      .insert({
        club_id: testClubId,
        jersey_num: 3,
        full_name: "Carlos Ferreira",
        birthdate: "2003-01-01",
        age_group: "senior",
        is_archived: true,
        archived_at: 5SeasonAgo.toISOString()
      })
      .select()
      .single();

    // First call
    const { data: result1 } = await supabaseAdmin.rpc("anonymize_archived_player", {
      p_player_id: player.id
    });
    expect(result1).toBe(true);

    // Second call (already anonymized)
    const { data: result2 } = await supabaseAdmin.rpc("anonymize_archived_player", {
      p_player_id: player.id
    });
    expect(result2).toBe(false);
  });
});
```

---

### AC #9: Cobertura de Testes — Retenção de Histórico

**Given** testes via `npm run test --run`  
**When** executados  
**Then** validar que:

- Fatigue responses, match events, and metrics históricos permanecem acessíveis com `player_id` (relatórios estatísticos)
- Tabelas relacionadas (fatigue_responses, match_events, session_metrics) não são afetadas por anonimização
- Query de "estatísticas carreira do jogador anonimizado" ainda funciona via `SELECT COUNT(*) FROM match_events WHERE player_id=$1`

**Example:**
```typescript
// __tests__/integration/retention-statistics.test.ts
it("should preserve match event statistics after anonymization", async () => {
  // Create player and match events
  const { data: player } = await supabaseAdmin
    .from("players")
    .insert({ /* ... archived 5+ seasons ago ... */ })
    .select()
    .single();

  const { data: event } = await supabaseAdmin
    .from("match_events")
    .insert({
      session_id: testSessionId,
      player_id: player.id,
      action: "goal",
      zone: "penalty_area"
    })
    .select()
    .single();

  // Anonymize
  await supabaseAdmin.rpc("anonymize_archived_player", { p_player_id: player.id });

  // Verify event still exists and is queryable by player_id
  const { data: events } = await supabaseAdmin
    .from("match_events")
    .select("*")
    .eq("player_id", player.id);

  expect(events).toHaveLength(1);
  expect(events?.[0].action).toBe("goal");
});
```

---

### AC #10: RLS Policies — Photo Storage Deletion

**Given** Edge Function `anonymize-player-photos` executa com service-role client  
**When** deleta arquivo de Storage  
**Then** não é bloqueado por RLS (service-role bypassa)

**And** no `supabase/functions/anonymize-player-photos/deno.json`, declarar permissões:
```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.46.0"
  }
}
```

---

## Tasks / Subtasks

- [ ] **Task 1: Criar migração `000140_players_archived_at.sql`**
  - Adicionar `archived_at timestamptz nullable` com default null
  - Criar índice em `(club_id, archived_at)`
  - Testar `supabase db reset --no-seed` sem erros
  - Cobertura 100% (DDL)

- [ ] **Task 2: Criar migração `000141_anonymize_archived_players_function.sql`**
  - Implementar função PL/pgSQL `anonymize_archived_player(uuid)`
  - Lógica de cálculo de 5 épocas (±275 dias por época)
  - Idempotência garantida (guards e checks)
  - Cobertura 100% (DDL)

- [ ] **Task 3: Criar migração `000142_pg_cron_anonymize_job.sql`**
  - Registar cron job `anonymize_archived_players_monthly` em `'0 1 1 * *'` (1º do mês)
  - Verificar job registado: `SELECT jobid, schedule FROM cron.job WHERE jobname LIKE 'anonymize%'`
  - Cobertura 100% (DDL)

- [ ] **Task 4: Edge Function `anonymize-player-photos`**
  - Criar `supabase/functions/anonymize-player-photos/index.ts`
  - Lógica de query e delete em Storage (service-role)
  - Logging via telemetry
  - Idempotência (não falha se arquivo não existe)
  - Testar manualmente via `supabase functions deploy`

- [ ] **Task 5: Server Action `anonymizePlayer`**
  - Adicionar em `src/lib/actions/players.ts`
  - Chamada a RPC + logging + Edge Function trigger
  - Validação de role (coach/analyst)
  - Testes unitários ≥80% cobertura

- [ ] **Task 6: UI — Metadados em Player Details**
  - Componente `PlayerDetailsHeader` (ou update existente)
  - Display "Será anonimizado em DD/MM/YYYY" ou "Anonimizado em DD/MM/YYYY"
  - Substituir foto com `<CircleDashed>` se `photo_path=NULL`
  - Teste de snapshot + axe-core a11y

- [ ] **Task 7: Testes Unitários — `anonymize_archived_player`**
  - `__tests__/lib/anonymize-archived-player.test.ts` (vitest + @supabase/supabase-js)
  - 5 cases conforme AC #8
  - Cobertura ≥80%

- [ ] **Task 8: Testes Integração — Retenção de Histórico**
  - `__tests__/integration/retention-statistics.test.ts`
  - Validar que match_events/fatigue_responses permanecem após anonimização
  - Cobertura ≥80%

- [ ] **Task 9: Lint, Build & Test**
  - `npm run lint --fix`
  - `npm run typecheck`
  - `npm run test --run` (100% dos testes devem passar)
  - `npm run build` (sem erros)
  - Verificar cobertura total ≥80%

- [ ] **Task 10: Validação de Histórico & Audit Logs**
  - Verificar que `audit_logs` contém entrada para cada anonimização (manual ou cron)
  - Verificar que cron job roda sem erros (logs no Supabase dashboard)
  - Validar que estatísticas históricas ainda consultáveis

---

## Developer Context & Implementation Notes

### Recent Patterns from Story 2.8 (Match Squad Selection)

Story 2.8 estabeleceu padrões que esta história deve seguir:

1. **Migração DDL com RLS & índices:** Nomeação `000XXX_description.sql` com seeds vazias
2. **Server Actions + Zod:** Validação client-side + server-side, upsert logic
3. **Audit logs automáticos:** `logAction('action.name', { context })` no fim da server action
4. **Tests via Vitest:** Fixtures de seeding, cases de edge, 80% cobertura mínima
5. **UI com metadata:** Componentes que refletem estado DB com formatação PT-PT

### Key Technical Constraints & Decisions

**UUIDv7 Client-Generated:** Toda player tem UUID primary key via `uuidv7()` function ou cliente.

**RLS & Multi-Tenant:** `club_id` indexado em todos os queries; função `anonymize_archived_player` roda como postgres role (bypassa RLS) no contexto de cron.

**Edge Functions & Service Role:** Supabase Edge Functions usam service-role client para Storage deletions (permissão total, sem RLS).

**Idempotência Crítica:** Função anonimização é idempotente — pode rodar múltiplas vezes sem duplicatas ou erros. Guard checks garantem: `is_archived=true`, `archived_at NOT NULL`, `full_name != '[anonimizado]'`.

**Aproximação de "Épocas":** 5 épocas ≈ 5 × 9 meses = ~1.36 anos. Implementação usa `EXTRACT(DAY FROM ...) / 275` para cálculo server-side (cada época ~275 dias).

**Storage Paths:** Fotos armazenadas em `players/{club_id}/{player_id}/photo.webp` (conforme Story 2.2). Delete via Edge Function usa batch removal.

### Architecture Notes

**Schema Additions:**
- `players.archived_at timestamptz` (nullable; setado quando `is_archived` muda de false → true)
- Índice `(club_id, archived_at)` para queries rápidas de jogadores prontos para anonimização

**Functions:**
- `anonymize_archived_player(player_id uuid) → boolean` — Idempotente, guards múltiplas, retorna false se não qualificado
- Edge Function `anonymize-player-photos` — Batch delete em Storage com service-role

**Cron Jobs:**
- `anonymize_archived_players_monthly` — 1st of each month at 01:00 UTC; processa batch via RPC + Edge Function

**Server Action:**
- `anonymizePlayer(playerId) → { success, message }` — Para testes e controle manual; chamada RPC + foto cleanup

**UI:**
- Metadados de arquivo em player profile (data de anonimização calculada)
- Substituição de foto com ícone quando `photo_path=NULL`

### Critical Implementation Points

1. **Story 2.4 (Mark Inactive)** já estabeleceu `is_archived` field. Esta história adiciona `archived_at` para rastrear tempo de arquivo.

2. **Story 2.2 (Player Photo Upload)** estabeleceu Storage bucket e RLS policies. Esta história adiciona lógica de limpeza.

3. **Migrations devem rodar em ordem:** `000140` (add field), `000141` (function), `000142` (cron). CI valida via `supabase db reset --no-seed`.

4. **Tests devem usar `supabaseAdmin` (service-role client) para queries de teste** — RLS não bloqueia função porque ela roda como postgres role.

5. **Audit logs:** Story 2.8 estabeleceu pattern de `logAction` — esta história deve criar entries `action='player.anonymized'` ou similar.

6. **Locale PT-PT:** Datas formatadas via `date-fns` com locale `pt-PT`. Exemplo: "Será anonimizado em 17 de maio de 2031".

---

## Completion Checklist

- [ ] Todas as 3 migrações (`000140`, `000141`, `000142`) aplicadas sem erros
- [ ] Função `anonymize_archived_player` testada com ≥80% cobertura
- [ ] Edge Function `anonymize-player-photos` deployada e testada manualmente
- [ ] Server Action `anonymizePlayer` funcionando e logado
- [ ] UI metadados exibindo corretamente em `/plantel/[id]`
- [ ] Testes de retenção validam que histórico permanece intacto
- [ ] `npm run test --run` passa 100%
- [ ] `npm run lint` e `npm run typecheck` com 0 erros
- [ ] `npm run build` sucede
- [ ] Cobertura total ≥80%
- [ ] Sprint-status.yaml atualizado para story 2.9 → done

---

## References

**Épocas & Retenção:**
- FR16: Preservar histórico 5 épocas; depois anonimizar (obrigatório MVP)
- AR23: pg_cron jobs mensais para retenção e anonimização
- NFR16: Retenção de dados pessoais por 5 épocas após saída do clube

**GDPR & Compliance:**
- GDPR Art. 5(1)(e) — Manter PII enquanto necessário para contrato; depois apagar
- Direito ao apagamento (FR47) — Cascata; anonimização é forma de apagamento

**Histórico & Estatísticas:**
- Dados estatísticos sem PII permanecem — eventos, métricas, desempenho continuam consultáveis
- Relatórios históricos funcionam via `player_id` mesmo após anonimização

**Stories Relacionadas:**
- Story 2.1 (Player Records): `is_archived` field e lógica de soft-delete
- Story 2.2 (Player Photo Upload): Storage bucket, foto path, RLS policies
- Story 2.4 (Mark Inactive): Estados soft de inatividade (distinto de arquivo)
- Story 2.8 (Match Squad): Padrão de migrations, server actions, testes

**Git Commits:**
- Ultimos 5 commits em main: Implementação feature X, Story 2-8 fixes, Story 2-7 patches, Story 2-6 in-progress, Story 2-5 done.
