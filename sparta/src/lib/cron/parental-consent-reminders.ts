import type { SupabaseClient } from "@supabase/supabase-js";

export type ReminderKind = "day_7" | "day_14" | "staff_alert";

// =============================================================================
// Pure helpers — testáveis sem mocks
// =============================================================================

export function classifyConsentAge(
  createdAt: Date,
  now: Date
): ReminderKind | null {
  const diffMs = now.getTime() - createdAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 7) return "day_7";
  if (diffDays === 14) return "day_14";
  if (diffDays > 14) return "staff_alert";
  return null;
}

export function buildReminderSubject(kind: "day_7" | "day_14"): string {
  if (kind === "day_14") return "2º Lembrete: Consentimento parental — SPARTA";
  return "[Lembrete] Consentimento parental — SPARTA";
}

export function buildReminderCopy(kind: "day_7" | "day_14"): string {
  if (kind === "day_14") {
    return "Esta é a última tentativa de reenvio automático.";
  }
  return "Se já confirmou, pode ignorar este lembrete.";
}

export function buildStaffAlertBody(players: { name: string }[]): string {
  const total = players.length;
  const displayed = players.slice(0, 5).map((p) => p.name);
  const remaining = total - displayed.length;
  const list =
    displayed.join(", ") + (remaining > 0 ? ` ... e mais ${remaining}` : "");
  return `${total} jogador${total !== 1 ? "es têm" : " tem"} consentimento parental por confirmar: ${list}. Contacta as famílias ou rejeita a participação na plataforma.`;
}

// =============================================================================
// DB helpers — testáveis com mocks
// =============================================================================

export async function getStaffEmailsForClub(
  serviceRole: SupabaseClient,
  clubId: string
): Promise<string[]> {
  const { data } = await serviceRole
    .from("profiles")
    .select("email")
    .eq("club_id", clubId)
    .in("role", ["coach", "analyst"]);
  return (data ?? [])
    .map((p: { email: string }) => p.email)
    .filter(Boolean) as string[];
}

export async function hasReminderBeenSentToday(
  serviceRole: SupabaseClient,
  consentId: string,
  kind: ReminderKind
): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await serviceRole
    .from("parental_consent_reminders_log")
    .select("id")
    .eq("consent_id", consentId)
    .eq("kind", kind)
    .gte("sent_at", todayStart.toISOString())
    .maybeSingle();

  return data !== null;
}

export async function getPendingConsentsByAge(
  serviceRole: SupabaseClient,
  targetDays: 7 | 14,
  now = new Date()
): Promise<{ id: string; club_id: string }[]> {
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() - targetDays);
  const dateStr = targetDate.toISOString().split("T")[0] ?? "";

  const { data } = await serviceRole
    .from("parental_consents")
    .select("id, club_id")
    .eq("status", "pending")
    .gte("created_at", `${dateStr}T00:00:00Z`)
    .lt("created_at", `${dateStr}T23:59:59Z`);

  return (data ?? []) as { id: string; club_id: string }[];
}

export async function getOverdueConsentClubs(
  serviceRole: SupabaseClient,
  now = new Date()
): Promise<string[]> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 14);

  const { data } = await serviceRole
    .from("parental_consents")
    .select("club_id")
    .eq("status", "pending")
    .lt("created_at", cutoff.toISOString());

  const clubs = [...new Set((data ?? []).map((r: { club_id: string }) => r.club_id))];
  return clubs;
}
