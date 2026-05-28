export const PRE_SESSION_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 horas

export function isInPreSessionWindow(scheduledAt: string): boolean {
  const sessionTime = new Date(scheduledAt).getTime();
  if (isNaN(sessionTime)) {
    console.error("Invalid scheduledAt date:", scheduledAt);
    return false;
  }
  const now = Date.now();
  return now >= sessionTime - PRE_SESSION_WINDOW_MS && now <= sessionTime;
}
