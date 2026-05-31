/**
 * isEditWindowOpen — pure helper (no server deps) for Story 6.6 window enforcement.
 *
 * Returns true if the current time is before the edit deadline:
 *   deadline = sessionEnd + windowHours
 * where sessionEnd = scheduledAt + durationMin.
 *
 * @param sessionScheduledAt ISO string in UTC (e.g., "2026-05-31T10:00:00Z")
 * @param sessionDurationMin duration in minutes (default 90 if null)
 * @param windowHours edit window in hours (1-168, default 24)
 *
 * IMPORTANT: sessionScheduledAt MUST be in UTC (ends with 'Z'). Both Date.now() and
 * the parsed timestamp are epoch milliseconds, so the comparison is correct across timezones.
 */
export function isEditWindowOpen(
  sessionScheduledAt: string,
  sessionDurationMin: number,
  windowHours: number
): boolean {
  const sessionEndMs =
    new Date(sessionScheduledAt).getTime() + sessionDurationMin * 60_000;
  const deadlineMs = sessionEndMs + windowHours * 3_600_000;
  return Date.now() <= deadlineMs;
}
