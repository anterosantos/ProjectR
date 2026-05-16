"use server";

import { logAccess } from "./audit";

/**
 * Placeholder: Read health data with automatic audit logging
 *
 * Full implementation (auditedRead wrapper) deferred to Story 3.11.
 * For now, this demonstrates the pattern: fetch data + call logAccess.
 *
 * Future: Story 3.11 will introduce a wrapper that auto-logs all health reads.
 */
export async function getHealthDataForPlayer(playerId: string) {
  // Log this access for compliance (FR50, NFR16)
  // Note: Fire-and-forget, doesn't block the response
  logAccess("health_data.read", "fatigue_response", playerId, {
    source: "ui_dashboard",
  }).catch(() => {
    // Ignore errors in audit logging (non-critical)
  });

  // In a real implementation, would fetch from:
  // - fatigue_responses
  // - match_events
  // - readiness_snapshots
  // etc.

  // For now, return empty placeholder
  return {
    fatigueResponses: [],
    matchEvents: [],
  };
}
