"use server";

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ok, err } from "@/lib/types";
import type { Result, AppError } from "@/lib/types";
import { logger } from "@/lib/logger";
import {
  FatigueResponseSchema,
  type FatigueResponseInput,
} from "@/lib/schemas/fatigue";

/**
 * submitFatigueResponse — Server Action idempotente para submissão de questionário de fadiga.
 *
 * - Valida payload via Zod (FatigueResponseSchema)
 * - Verifica autenticação e registo de jogador
 * - Verifica restrição de tratamento (RGPD Art. 18, Story 3.9)
 * - Upsert com client-generated UUIDv7 como chave de idempotência (NFR48, AR4)
 * - Submeter o mesmo id duas vezes é um no-op (ON CONFLICT (id) DO UPDATE)
 *
 * **Deduplicação por UUIDv7 (Story 4.4, AC #2):**
 * - O `id` é um UUIDv7 gerado no cliente e é a chave primária
 * - Chamadas repetidas com o mesmo UUID são idempotentes — o banco ignora segundas tentativas
 * - Crítico para offline-drain: se uma submissão é feita offline e depois retentada no drain,
 *   o servidor garante que existe apenas 1 row mesmo após múltiplas chamadas com o mesmo UUID
 * - Exemplo: enfileirar offline com UUID abc123 → drain retenta → servidor de-duplica → 1 row
 *
 * Usado em Story 4.2 (UI online) e Story 4.4 (offline-drain).
 */
export async function submitFatigueResponse(
  payload: FatigueResponseInput
): Promise<Result<{ id: string }, AppError>> {
  // 3.3.1 — Validação Zod
  const validated = FatigueResponseSchema.safeParse(payload);
  if (!validated.success) {
    return err({
      code: "validation",
      message:
        validated.error.issues[0]?.message ?? "Dados de fadiga inválidos",
      details: { issues: validated.error.issues },
    });
  }

  // 3.3.2 — Autenticação
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err({ code: "unauthorized", message: "Não autenticado" });
  }

  // 3.3.3 — Lookup do jogador pelo profile_id do utilizador autenticado
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, club_id, processing_restricted")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (playerError) {
    logger.error("fatigue_response.player_lookup_failed", {
      user_id: user.id,
      error: playerError.message,
    });
    return err({
      code: "internal",
      message: "Erro ao procurar registo de jogador",
    });
  }

  if (!player) {
    return err({
      code: "not_found",
      message: "Sem registo de jogador para este utilizador",
    });
  }

  // 3.3.4 — Verificar que o player_id do payload coincide com o do jogador autenticado
  if (validated.data.player_id !== player.id) {
    return err({
      code: "forbidden",
      message: "Não tens permissão para submeter respostas por outro jogador",
    });
  }

  // 3.3.5 — Verificar restrição de tratamento (RGPD Art. 18, Story 3.9)
  if (player.processing_restricted === true) {
    return err({
      code: "processing_restricted",
      message:
        "O tratamento dos teus dados está limitado. Não é possível registar respostas.",
    });
  }

  // 3.3.6–3.3.7 — Upsert via service-role (ON CONFLICT (id) DO UPDATE — idempotência)
  // O id é gerado pelo cliente (UUIDv7, NFR48), por isso não há necessidade de .select('id')
  // após o upsert — retornamos validated.data.id directamente.
  const serviceRole = getServiceRoleClient();
  const { error } = await serviceRole
    .from("fatigue_responses")
    .upsert(
      {
        id: validated.data.id,
        club_id: player.club_id,
        player_id: validated.data.player_id,
        session_id: validated.data.session_id,
        phase: validated.data.phase,
        dim_energy: validated.data.dim_energy,
        dim_focus: validated.data.dim_focus,
        dim_sleep: validated.data.dim_sleep,
        dim_soreness: validated.data.dim_soreness,
        dim_mood: validated.data.dim_mood,
        srpe_value: validated.data.srpe_value ?? null,
        submitted_via: validated.data.submitted_via,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "id", ignoreDuplicates: false }
    );

  // 3.3.8 — Tratar erro de DB
  if (error) {
    logger.error("fatigue_response.upsert_failed", {
      player_id: validated.data.player_id,
      session_id: validated.data.session_id,
      phase: validated.data.phase,
      error: error.message,
    });
    return err({
      code: "internal",
      message: error.message ?? "Erro ao guardar resposta de fadiga",
    });
  }

  // 3.3.9 — Log de sucesso (NFR56) + Audit log de escrita (AR21, Decision #2 from code-review)
  logger.info("fatigue_response.submitted", {
    player_id: validated.data.player_id,
    session_id: validated.data.session_id,
    phase: validated.data.phase,
  });

  // Fire-and-forget audit log para escrita de dados de saúde (Story 3.11 + Decision #2)
  // Não await — operação assíncrona em background; falha não bloqueia resposta
  void (async () => {
    try {
      await serviceRole.from("audit_logs").insert({
        actor_id: user.id,
        action: "submitted_fatigue_response",
        target_kind: "fatigue_response",
        target_id: validated.data.player_id,
        club_id: player.club_id,
        payload: {
          session_id: validated.data.session_id,
          phase: validated.data.phase,
          submitted_via: validated.data.submitted_via,
        },
      });
    } catch (e) {
      logger.error("fatigue_response.audit_log_failed", {
        player_id: validated.data.player_id,
        error: e instanceof Error ? e.message : String(e),
      });
      // Silently fail — write already succeeded; audit failure doesn't rollback
    }
  })();

  // O id é o UUIDv7 fornecido pelo cliente — idempotente por design (NFR48)
  return ok({ id: validated.data.id });
}
