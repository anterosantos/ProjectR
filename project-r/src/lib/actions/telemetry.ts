"use server";

import { z } from "zod";
import { serviceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";
import type { Result, AppError } from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";
import { ok } from "@/lib/types";

/**
 * Zod schema for telemetry payload validation.
 * Accepts any JSON-serializable value (object, array, primitive).
 * Exported so tests can import directly without re-declaring.
 */
export const TelemetryPayloadSchema = z.custom<unknown>(
  (val) => {
    try {
      JSON.stringify(val);
      return true;
    } catch {
      return false;
    }
  },
  "payload must be JSON-serializable"
);

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;

/**
 * Log a telemetry event to the database
 *
 * Fire-and-forget pattern: always returns success immediately,
 * even if database insert fails. Errors are logged for ops monitoring.
 *
 * Usage in a Server Action:
 *   await logTelemetry('survey_submitted', { playerId, sessionId, durationMs, offline })
 */
export async function logTelemetry(
  kind: string,
  payload: unknown
): Promise<Result<void, AppError>> {
  try {
    // Validate inputs
    if (!kind || typeof kind !== "string") {
      throw new Error("kind must be a non-empty string");
    }

    // Validate payload is JSON-serializable
    let validatedPayload: unknown;
    try {
      validatedPayload = TelemetryPayloadSchema.parse(payload);
    } catch (validationError) {
      throw new Error(
        `Payload validation failed: ${
          validationError instanceof Error
            ? validationError.message
            : "unknown"
        }`
      );
    }

    // Extract club_id from authenticated context
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User must be authenticated to log telemetry");
    }

    // Get user's profile to extract club_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("club_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error(`Failed to fetch user profile: ${profileError?.message}`);
    }

    // Insert into telemetry_events using service-role client
    // Service-role bypasses RLS; telemetry is system-internal
    const { error: insertError } = await serviceRoleClient
      .from("telemetry_events")
      .insert({
        club_id: profile.club_id,
        kind,
        payload_json: validatedPayload as Json,
        occurred_at: new Date().toISOString(),
      });

    if (insertError) {
      // Log error but don't throw — fire-and-forget pattern
      logger.error("telemetry_insert_failed", {
        kind,
        error_message: insertError.message,
        error_code: insertError.code,
      });
      // Return success anyway (fire-and-forget)
      return ok(undefined);
    }

    logger.info("telemetry_logged", { kind });
    return ok(undefined);
  } catch (error) {
    // Unexpected error — log it but don't throw
    logger.error("telemetry_unexpected_error", {
      kind,
      error_message: error instanceof Error ? error.message : String(error),
    });
    // Return success anyway (fire-and-forget pattern)
    return ok(undefined);
  }
}
