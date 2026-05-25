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
import { calculateSrpeLoad, isSrpeInputValid } from "@/lib/readiness/srpe";
import { refreshSnapshotForSession } from "@/lib/readiness/snapshot";

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

  // 3.3.10 — Upsert session_metrics (Story 5.1, FR33)
  // Apenas para fase 'post' (Zod schema agora forbids post sem srpe_value).
  // Operação secundária: erros são logados mas NÃO propagados — fatigue_responses já gravada.
  //
  // Extrair srpeValue para const local para que o TypeScript consiga narrowar o tipo
  // dentro da async closure (propriedades de objectos não são narrowadas em closures).
  const srpeValue = validated.data.srpe_value;
  if (validated.data.phase === "post" && srpeValue != null) {
    const sessionId = validated.data.session_id;
    const playerId = validated.data.player_id;
    const clubId = player.club_id;

    void (async () => {
      try {
        // PATCH 2: Separate try-catch para session lookup (exceções aqui não conflam com upsert)
        let session: { duration_min?: number | null } | null;
        try {
          const { data, error: sessionError } = await serviceRole
            .from("sessions")
            .select("duration_min")
            .eq("id", sessionId)
            .maybeSingle();

          if (sessionError) {
            logger.error("session_metrics.session_lookup_failed", {
              player_id: playerId,
              session_id: sessionId,
              error: sessionError.message,
            });
            return;
          }
          session = data;
        } catch (e) {
          logger.error("session_metrics.session_lookup_failed", {
            player_id: playerId,
            session_id: sessionId,
            error: e instanceof Error ? e.message : String(e),
          });
          return;
        }

        // PATCH 4: Type narrowing — explicit null/undefined check para duration_min
        if (!session || session.duration_min == null) {
          logger.error("session_metrics.invalid_duration", {
            player_id: playerId,
            session_id: sessionId,
            error: "session.duration_min is null or undefined",
          });
          return;
        }

        // PATCH 3, PATCH 7: Validação pré-flight usando isSrpeInputValid
        if (!isSrpeInputValid(srpeValue, session.duration_min)) {
          logger.error("session_metrics.invalid_inputs", {
            player_id: playerId,
            session_id: sessionId,
            srpe_value: srpeValue,
            duration_min: session.duration_min,
            error: "inputs fail validation (srpe 1–10, duration 15–240)",
          });
          return;
        }

        // Calcular sRPE load via função pura (não inline)
        const srpeLoad = calculateSrpeLoad(srpeValue, session.duration_min);

        // PATCH 5: onConflict syntax — manter formato para compatibilidade com Supabase
        // Upsert idempotente: ON CONFLICT (session_id, player_id) DO UPDATE
        const { error: smError } = await serviceRole
          .from("session_metrics")
          .upsert(
            {
              club_id: clubId,
              session_id: sessionId,
              player_id: playerId,
              srpe_value: srpeValue,
              duration_min: session.duration_min,
              computed_at: new Date().toISOString(),
            },
            { onConflict: "session_id,player_id", ignoreDuplicates: false }
          );

        // PATCH 6: Distinct logging codes para sucesso vs falha
        if (smError) {
          logger.error("session_metrics.upsert_failed", {
            player_id: playerId,
            session_id: sessionId,
            error: smError.message,
          });
        } else {
          logger.info("session_metrics.upserted", {
            player_id: playerId,
            session_id: sessionId,
            srpe_value: srpeValue,
            duration_min: session.duration_min,
            srpe_load: srpeLoad,
          });
        }
      } catch (e) {
        // PATCH 2: Generic catch distingue entre diferentes falhas
        logger.error("session_metrics.upsert_failed", {
          player_id: playerId,
          session_id: sessionId,
          error: e instanceof Error ? e.message : String(e),
        });
        // Silently fail — fatigue_response já foi gravada com sucesso
      }
    })();
  }

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

  // Fire-and-forget refresh de readiness snapshot (Story 5.3)
  // Triggerado após sucesso de fatigue_responses upsert
  // Não await — operação assíncrona; falha não afecta resposta da submissão
  void (async () => {
    try {
      await refreshSnapshotForSession(
        serviceRole,
        validated.data.session_id
      );
    } catch (e) {
      logger.error("readiness_snapshot.refresh_failed", {
        session_id: validated.data.session_id,
        player_id: validated.data.player_id,
        context: "submitFatigueResponse after()",
        error: e instanceof Error ? e.message : String(e),
      });
      // Silently fail — fatigue response já foi gravada com sucesso
    }
  })();

  // O id é o UUIDv7 fornecido pelo cliente — idempotente por design (NFR48)
  return ok({ id: validated.data.id });
}

/**
 * getSessionFatigueStatus — Verifica se o jogador autenticado já respondeu ao questionário
 * de fadiga para uma dada sessão (pré e/ou pós-sessão).
 *
 * Retorna apenas booleans — nunca devolve dados de saúde (NFR21).
 * RLS garante que o player vê apenas os seus próprios rows.
 * Defence-in-depth: filtro explícito por player_id.
 *
 * AC #2 — Story 4.9
 */
export async function getSessionFatigueStatus(
  sessionId: string
): Promise<Result<{ pre: boolean; post: boolean }, AppError>> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err({ code: "unauthorized", message: "Não autenticado" });

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  // Implicit role guard: apenas jogadores têm registo em players.
  // Staff/analistas sem registo retornam ok() por graceful degradation — esta função
  // retorna apenas booleans (sem dados de saúde, NFR21) e é chamada exclusivamente
  // de rotas da zona (player), onde o role já foi verificado upstream.
  if (!player) return ok({ pre: false, post: false });

  // eslint-disable-next-line custom/no-direct-health-data-read -- player reads own boolean status only; no metric derived
  const { data: rows, error: rowsError } = await supabase
    .from("fatigue_responses")
    .select("phase")
    .eq("session_id", sessionId)
    .eq("player_id", player.id);

  if (rowsError) {
    return err({ code: "db_error", message: rowsError.message });
  }

  const phases = new Set((rows ?? []).map((r) => r.phase));
  return ok({ pre: phases.has("pre"), post: phases.has("post") });
}
