# FULL DIFF — Story 6-1: Match Events Schema & Idempotent Server Action

## Summary
- 5 new files created
- 2 files modified
- ~776 lines added
- Comprehensive test coverage (23 test cases)

---

## FILE 1: sparta/supabase/migrations/000270_match_events.sql

```sql
-- 000270_match_events.sql
-- Story 6.1: Match Events Schema — captura de eventos de performance (touchscreen)
-- player_id ON DELETE SET NULL — histórico preservado se jogador apagado (GDPR)
-- session_id ON DELETE CASCADE — apagar sessão apaga eventos associados

CREATE TABLE IF NOT EXISTS match_events (
  id            uuid        PRIMARY KEY DEFAULT uuidv7(),
  club_id       uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  session_id    uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id     uuid        REFERENCES players(id) ON DELETE SET NULL,
  action        text        NOT NULL
    CHECK (action IN (
      'ball_loss','ball_recovery','shot_total','shot_on_target',
      'pass_completed','def_pressure','def_action_success','off_action_success'
    )),
  zone          text        NOT NULL
    CHECK (zone IN (
      'def_left','def_center','def_right',
      'mid_left','mid_center','mid_right',
      'att_left','att_center','att_right'
    )),
  occurred_at   timestamptz NOT NULL,
  captured_at   timestamptz NOT NULL DEFAULT now(),
  captured_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  captured_via  text        NOT NULL
    CHECK (captured_via IN ('online', 'offline-drain')),
  is_deleted    boolean     NOT NULL DEFAULT false,
  deleted_at    timestamptz,
  deleted_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "staff read own club" ON match_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'analyst') AND club_id = match_events.club_id)
  );

CREATE POLICY "staff insert own club" ON match_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'analyst') AND club_id = match_events.club_id)
  );

CREATE POLICY "staff update own club" ON match_events
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'analyst') AND club_id = match_events.club_id))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'analyst') AND club_id = match_events.club_id));

GRANT SELECT, INSERT, UPDATE ON match_events TO authenticated;

-- Indices
CREATE INDEX IF NOT EXISTS idx_match_events_session ON match_events (session_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_events_player_session ON match_events (player_id, session_id);
CREATE INDEX IF NOT EXISTS idx_match_events_club_deleted ON match_events (club_id, is_deleted);
```

**Issues to Check:**
- GRANT statement lacks DELETE permission (only SELECT, INSERT, UPDATE)
- No explicit CHECK constraint on session_id existence validation (FK handles it)
- No trigger for audit logging on create/update (fire-and-forget pattern from Story 1.12?)

---

## FILE 2: sparta/src/lib/schemas/match-events.ts

```typescript
import { z } from "zod";

export const MATCH_ACTIONS = [
  "ball_loss", "ball_recovery", "shot_total", "shot_on_target",
  "pass_completed", "def_pressure", "def_action_success", "off_action_success",
] as const;

export const MATCH_ZONES = [
  "def_left", "def_center", "def_right",
  "mid_left", "mid_center", "mid_right",
  "att_left", "att_center", "att_right",
] as const;

export const MatchEventInputSchema = z.object({
  id: z.string().uuid("ID deve ser UUID válido"),
  action: z.enum(MATCH_ACTIONS),
  zone: z.enum(MATCH_ZONES),
  player_id: z.string().uuid("ID do jogador inválido"),
  session_id: z.string().uuid("ID da sessão inválido"),
  occurred_at: z.string().datetime("Horário inválido"),
  captured_via: z.enum(["online", "offline-drain"]).default("online"),
});

export type MatchEventInput = z.infer<typeof MatchEventInputSchema>;
```

---

## FILE 3: sparta/src/lib/actions/events.ts

```typescript
"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { auditedRead } from "@/lib/data/audited";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { MatchEventInputSchema, type MatchEventInput } from "@/lib/schemas/match-events";

async function requireStaffRole(): Promise<Result<{ userId: string; clubId: string; role: string }, AppError>> {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return err({ code: "unauthorized", message: "Autenticação necessária." });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return err({ code: "unauthorized", message: "Perfil não encontrado." });
  if (profile.role !== "coach" && profile.role !== "analyst") return err({ code: "forbidden", message: "Acesso restrito a staff." });
  if (!profile.club_id) return err({ code: "forbidden", message: "Clube não atribuído." });

  return ok({ userId: user.id, clubId: profile.club_id, role: profile.role as string });
}

export async function submitMatchEvent(payload: MatchEventInput): Promise<Result<{ id: string }, AppError>> {
  const validated = MatchEventInputSchema.safeParse(payload);
  if (!validated.success) return err({ code: "validation", message: validated.error.issues[0]?.message ?? "Dados inválidos" });

  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  // Verificar sessão pertence ao clube do staff
  const { data: session } = await serviceRole
    .from("sessions").select("id, club_id").eq("id", validated.data.session_id).eq("club_id", clubId).maybeSingle();

  if (!session) return err({ code: "not_found", message: "Sessão não encontrada ou não pertence ao clube." });

  // Verificar player em match_lineups
  const { data: lineup } = await (serviceRole.from as any)("match_lineups")
    .select("player_id").eq("session_id", validated.data.session_id).eq("player_id", validated.data.player_id).maybeSingle();

  if (!lineup) return err({ code: "validation", message: "Jogador não está na convocatória desta sessão." });

  // Verificar processing_restricted
  const { data: player } = await serviceRole
    .from("players").select("processing_restricted").eq("id", validated.data.player_id).eq("club_id", clubId).maybeSingle();

  if (player?.processing_restricted === true) {
    return err({ code: "forbidden", message: "Tratamento limitado — não é possível registar eventos para este jogador." });
  }

  const { error: upsertError } = await serviceRole.from("match_events").upsert(
    {
      id: validated.data.id, club_id: clubId, session_id: validated.data.session_id, 
      player_id: validated.data.player_id, action: validated.data.action, zone: validated.data.zone,
      occurred_at: validated.data.occurred_at, captured_by: userId, captured_via: validated.data.captured_via,
    },
    { onConflict: "id" }
  );

  if (upsertError) return err({ code: "unknown", message: "Erro ao guardar evento." });
  return ok({ id: validated.data.id });
}

export async function deleteMatchEvent(id: string): Promise<Result<void, AppError>> {
  const authResult = await requireStaffRole();
  if (!authResult.ok) return authResult;
  const { userId, clubId } = authResult.data;

  const serviceRole = getServiceRoleClient();

  const { data: existing } = await auditedRead(
    { targetKind: "match_event", targetId: id, action: "match_event.delete_check", actorId: userId, clubId },
    async () =>
      serviceRole.from("match_events").select("id, is_deleted").eq("id", id).eq("club_id", clubId).maybeSingle()
  );

  if (!existing) return err({ code: "not_found", message: "Evento não encontrado." });

  const { error: updateError } = await serviceRole.from("match_events").update({
    is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: userId,
  }).eq("id", id).eq("club_id", clubId);

  if (updateError) return err({ code: "unknown", message: "Erro ao apagar evento." });
  return ok(undefined);
}
```

---

## FILE 4: sparta/src/__tests__/lib/actions/match-events.test.ts

23 comprehensive test cases covering:
- Zod validation (action, zone, id, occurred_at)
- Auth/role (unauthorized, forbidden, missing club_id)
- Business logic (session isolation, lineup validation, processing_restricted)
- Success & idempotency (upsert replay)
- Soft delete scenarios
- Role variations (coach, analyst)
- Offline-drain support

---

## FILE 5: sparta/src/lib/supabase/database.types.ts (MODIFIED)

Added match_events table type definition with Row, Insert, Update variants.

---

## FILE 6: sprint-status.yaml (MODIFIED)

- epic-6: backlog → in-progress
- 6-1: backlog → review
