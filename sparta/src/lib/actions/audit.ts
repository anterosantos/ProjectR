"use server";

import { createServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Result, AppError } from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";
import { ok } from "@/lib/types";
import { AuditLogInputSchema } from "@/lib/schemas/audit";

/**
 * Log an audit entry (access to protected data)
 *
 * Fire-and-forget pattern: always returns success immediately,
 * even if database insert fails. Errors are logged for ops monitoring.
 *
 * Used to track who accessed what (health data, decisions, exports).
 * Supports GDPR Art. 15 (subject visibility) and compliance auditing.
 *
 * Usage in a Server Action:
 *   await logAccess('health_data.read', 'fatigue_response', playerId)
 *   await logAccess('decision.marked', 'readiness_snapshot', snapshotId, { reason })
 */
export async function logAccess(
  action: string,
  targetKind: string,
  targetId?: string | null,
  context?: Record<string, unknown>
): Promise<Result<void, AppError>> {
  try {
    const validated = AuditLogInputSchema.parse({
      action,
      targetKind,
      targetId,
      context,
    });

    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(`Failed to get authenticated user: ${userError?.message}`);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error(`Failed to fetch user profile: ${profileError?.message}`);
    }

    const { error: insertError } = await supabase
      .from("audit_logs")
      .insert({
        club_id: profile.club_id,
        actor_id: user.id,
        action: validated.action,
        target_kind: validated.targetKind,
        target_id: validated.targetId ?? null,
        payload: (validated.context ?? null) as Json,
        occurred_at: new Date().toISOString(),
      });

    if (insertError) {
      logger.error("audit_log_insert_failed", {
        action: validated.action,
        target_kind: validated.targetKind,
        target_id: validated.targetId,
        actor_id: user.id,
        error_message: insertError.message,
        error_code: insertError.code,
      });
      return ok(undefined);
    }

    logger.info("audit_logged", {
      action: validated.action,
      target_kind: validated.targetKind,
      actor_id: user.id,
    });

    return ok(undefined);
  } catch (error) {
    logger.error("audit_unexpected_error", {
      action,
      target_kind: targetKind,
      error_message: error instanceof Error ? error.message : String(error),
    });
    return ok(undefined);
  }
}
