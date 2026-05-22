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
}

interface AuditErrorLog {
  timestamp: string;
  level: "error";
  message: string;
  action: string;
  target_kind: string;
  target_id: string;
  actor_id: string;
  error: string;
  context: string;
}

// Uses after() to keep the serverless function alive until the audit insert completes.
// Falls back to fire-and-forget void when outside a Next.js request context (e.g. tests).
function scheduleAudit(options: AuditedReadOptions): void {
  try {
    after(async () => {
      await logAccessAsync(options);
    });
  } catch {
    void logAccessAsync(options).catch(() => {});
  }
}

/**
 * Wraps health data reads with automatic audit logging (FR50, AR21).
 *
 * Executes the read, schedules an audit log insert, then returns the result.
 * The audit insert does not block read latency. If fn() throws, the access
 * attempt is still audited before the error propagates.
 *
 * @example
 * const response = await auditedRead(
 *   { targetKind: 'fatigue_response', targetId: playerId, action: 'viewed_fatigue_response' },
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

async function logAccessAsync(options: AuditedReadOptions): Promise<void> {
  let actorId = "unknown";
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      console.warn("[auditedRead] No authenticated user - audit log skipped");
      return;
    }

    actorId = user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", actorId)
      .single();

    if (profileError || !profile?.club_id) {
      const errorMsg = profileError?.message ?? "No club_id in profile";
      const errorLog: AuditErrorLog = {
        timestamp: new Date().toISOString(),
        level: "error",
        message: "audit_log insert failed",
        action: options.action,
        target_kind: options.targetKind,
        target_id: options.targetId,
        actor_id: actorId,
        error: `Could not fetch club_id: ${errorMsg}`,
        context: "auditedRead wrapper",
      };
      console.error(JSON.stringify(errorLog));
      return;
    }

    const serviceRole = getServiceRoleClient();
    const { error: insertError } = await serviceRole
      .from("audit_logs")
      .insert({
        club_id: profile.club_id,
        actor_id: actorId,
        action: options.action,
        target_kind: options.targetKind,
        target_id: options.targetId,
        payload: options.payload,
        // occurred_at omitted — DB uses DEFAULT now() for server-accurate timestamp
      });

    if (insertError) {
      const errorLog: AuditErrorLog = {
        timestamp: new Date().toISOString(),
        level: "error",
        message: "audit_log insert failed",
        action: options.action,
        target_kind: options.targetKind,
        target_id: options.targetId,
        actor_id: actorId,
        error: insertError.message,
        context: "auditedRead wrapper",
      };
      console.error(JSON.stringify(errorLog));
    }
  } catch (error) {
    const errorLog: AuditErrorLog = {
      timestamp: new Date().toISOString(),
      level: "error",
      message: "audit_log insert failed",
      action: options.action,
      target_kind: options.targetKind,
      target_id: options.targetId,
      actor_id: actorId,
      error: error instanceof Error ? error.message : String(error),
      context: "auditedRead wrapper",
    };
    console.error(JSON.stringify(errorLog));
  }
}
