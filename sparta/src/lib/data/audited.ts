import { after } from "next/server";
import type { Json } from "@/lib/supabase/database.types";
import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export interface AuditedReadOptions {
  /** E.g., "fatigue_response", "match_event", "readiness_snapshot", "session_metrics" */
  targetKind: string;
  /** UUID or resource id being accessed */
  targetId: string;
  /** E.g., "viewed_fatigue_response", "read_match_events", "staff.read_fatigue" */
  action: string;
  /** Optional metadata to include in audit_logs.payload */
  payload?: Json;
  /**
   * Pre-resolved authenticated user ID.
   * Must be provided by the caller — cookies() cannot be called inside after() callbacks.
   * See: https://nextjs.org/docs/app/api-reference/functions/after
   */
  actorId: string;
  /**
   * Pre-resolved club_id from the authenticated user's profile.
   * Required for audit_logs.club_id (multi-club isolation, AR9).
   */
  clubId: string;
}

/**
 * Wraps health data reads with automatic audit logging (FR50, AR21).
 *
 * Executes the read, schedules an audit log insert via after(), then returns the result.
 * The audit insert does not block read latency. If fn() throws, the access
 * attempt is still audited before the error propagates.
 *
 * IMPORTANT: actorId and clubId must be resolved by the caller BEFORE calling this
 * function. Resolving them inside after() would call cookies() in a disallowed context.
 *
 * @example
 * const response = await auditedRead(
 *   {
 *     targetKind: 'fatigue_response',
 *     targetId: playerId,
 *     action: 'viewed_fatigue_response',
 *     actorId: user.id,
 *     clubId: profile.club_id,
 *   },
 *   async () => supabase.from('fatigue_responses').select('*').eq('player_id', playerId)
 * );
 */
export async function auditedRead<T>(
  options: AuditedReadOptions,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const result = await fn();
    scheduleAudit(options);
    return result;
  } catch (err) {
    scheduleAudit(options);
    throw err;
  }
}

/**
 * Schedules the audit log insert via after() so it doesn't block response latency.
 * Uses only getServiceRoleClient() inside the callback — no cookies() calls.
 */
function scheduleAudit(options: AuditedReadOptions): void {
  const { actorId, clubId, action, targetKind, targetId, payload } = options;

  const doInsert = async () => {
    try {
      const serviceRole = getServiceRoleClient();
      const { error: insertError } = await serviceRole
        .from("audit_logs")
        .insert({
          club_id: clubId,
          actor_id: actorId,
          action,
          target_kind: targetKind,
          target_id: targetId,
          payload,
          // occurred_at omitted — DB uses DEFAULT now() for server-accurate timestamp
        });

      if (insertError) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            message: "audit_log insert failed",
            action,
            target_kind: targetKind,
            target_id: targetId,
            actor_id: actorId,
            error: insertError.message,
            context: "auditedRead scheduleAudit",
          })
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          message: "audit_log insert failed",
          action,
          target_kind: targetKind,
          target_id: targetId,
          actor_id: actorId,
          error: error instanceof Error ? error.message : String(error),
          context: "auditedRead scheduleAudit",
        })
      );
    }
  };

  try {
    after(doInsert);
  } catch {
    // after() unavailable outside Next.js request context (e.g. tests) — fire-and-forget
    void doInsert().catch(() => {});
  }
}

/**
 * @deprecated Use auditedRead() with explicit actorId/clubId instead.
 * Kept for backwards compatibility during migration; will be removed.
 */
export async function resolveActor(): Promise<{ actorId: string; clubId: string | null }> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) return { actorId: "unknown", clubId: null };

    const { data: profile } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", user.id)
      .single();

    return { actorId: user.id, clubId: profile?.club_id ?? null };
  } catch {
    return { actorId: "unknown", clubId: null };
  }
}
