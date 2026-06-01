import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecoveryCurvePoint {
  day: 0 | 1 | 2 | 3;
  avgFatigue: number;
  sampleSize: number;
  dimensions: {
    energy: number | null;
    focus: number | null;
    sleep: number | null;
    soreness: number | null;
    mood: number | null;
  };
}

export interface RecoveryCurveResult {
  points: RecoveryCurvePoint[];
  totalHighIntensitySessions: number;
  sampleSize: number;
}

type FatigueResponseRow = {
  session_id: string;
  phase: string;
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
  submitted_at: string;
};

type SessionMetricRow = {
  session_id: string;
  srpe_load: number;
};

type SessionRow = {
  id: string;
  scheduled_at: string;
};

type DimKey = "dim_energy" | "dim_focus" | "dim_sleep" | "dim_soreness" | "dim_mood";

function avgDim(responses: FatigueResponseRow[], key: DimKey): number | null {
  const vals = responses.map((r) => r[key]).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return vals.reduce((sum, v) => sum + v, 0) / vals.length;
}

const EMPTY_RESULT: RecoveryCurveResult = { points: [], totalHighIntensitySessions: 0, sampleSize: 0 };

export async function computeRecoveryCurve(
  supabase: SupabaseClient,
  {
    playerId,
    clubId,
    lookbackSessions = 10,
  }: { playerId: string; clubId: string; lookbackSessions?: number }
): Promise<RecoveryCurveResult> {
  // Step 1: All session_metrics for player — calculate avg and identify high intensity
  // eslint-disable-next-line custom/no-direct-health-data-read
  const { data: metricsData, error: metricsError } = await supabase
    .from("session_metrics")
    .select("session_id, srpe_load")
    .eq("player_id", playerId)
    .eq("club_id", clubId);

  if (metricsError) return EMPTY_RESULT;
  const allMetrics = (metricsData ?? []) as SessionMetricRow[];
  if (allMetrics.length === 0) return EMPTY_RESULT;

  const totalLoad = allMetrics.reduce((sum, m) => sum + m.srpe_load, 0);
  const avgSrpeLoad = totalLoad / allMetrics.length;
  if (avgSrpeLoad <= 0) return EMPTY_RESULT;

  const hiThreshold = avgSrpeLoad * 1.2;
  const hiSessionIds = allMetrics
    .filter((m) => m.srpe_load > hiThreshold)
    .map((m) => m.session_id);

  if (hiSessionIds.length === 0) return EMPTY_RESULT;

  // Step 2: Get session dates for high intensity sessions (latest lookbackSessions, sorted DESC)
  const { data: sessionsData, error: sessionsError } = await supabase
    .from("sessions")
    .select("id, scheduled_at")
    .in("id", hiSessionIds)
    .eq("club_id", clubId)
    .order("scheduled_at", { ascending: false })
    .limit(lookbackSessions);

  if (sessionsError) return EMPTY_RESULT;
  const hiSessions = (sessionsData ?? []) as SessionRow[];
  if (hiSessions.length === 0) return EMPTY_RESULT;

  const totalHighIntensitySessions = hiSessions.length;

  // Step 3: All fatigue_responses for player
  // eslint-disable-next-line custom/no-direct-health-data-read
  const { data: responsesData, error: responsesError } = await supabase
    .from("fatigue_responses")
    .select("session_id, phase, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood, submitted_at")
    .eq("player_id", playerId)
    .eq("club_id", clubId);

  if (responsesError) return EMPTY_RESULT;
  const allResponses = (responsesData ?? []) as FatigueResponseRow[];

  // Step 4: Group responses by day per high-intensity session
  type SessionDayEntry = { sessionId: string; responses: FatigueResponseRow[] };
  // dayBuckets[N] = list of (sessionId, responses) for day N
  const dayBuckets: SessionDayEntry[][] = [[], [], [], []];

  for (const session of hiSessions) {
    const baseDate = new Date(`${session.scheduled_at.slice(0, 10)}T00:00:00Z`);
    const baseMs = baseDate.getTime();

    // Day 0: phase='post' linked to this specific session
    const day0 = allResponses.filter(
      (r) => r.session_id === session.id && r.phase === "post"
    );
    if (day0.length > 0) {
      dayBuckets[0]?.push({ sessionId: session.id, responses: day0 });
    }

    // Days 1–3: submitted_at within the calendar day (UTC)
    for (const dayN of [1, 2, 3] as const) {
      const dayStartMs = baseMs + dayN * 86400000;
      const dayEndMs = baseMs + (dayN + 1) * 86400000 - 1;
      const dayResponses = allResponses.filter((r) => {
        const t = new Date(r.submitted_at).getTime();
        return t >= dayStartMs && t <= dayEndMs;
      });
      if (dayResponses.length > 0) {
        dayBuckets[dayN]?.push({ sessionId: session.id, responses: dayResponses });
      }
    }
  }

  // Step 5: Build RecoveryCurvePoint for each day
  const points: RecoveryCurvePoint[] = [];

  for (const dayN of [0, 1, 2, 3] as const) {
    const bucket = dayBuckets[dayN] ?? [];
    if (bucket.length === 0) continue;

    const sampleSize = bucket.length;
    const allDayResponses = bucket.flatMap((e) => e.responses);

    const energy = avgDim(allDayResponses, "dim_energy");
    const focus = avgDim(allDayResponses, "dim_focus");
    const sleep = avgDim(allDayResponses, "dim_sleep");
    const soreness = avgDim(allDayResponses, "dim_soreness");
    const mood = avgDim(allDayResponses, "dim_mood");

    const nonNull = [energy, focus, sleep, soreness, mood].filter((v): v is number => v !== null);
    const avgFatigue = nonNull.length > 0 ? nonNull.reduce((sum, v) => sum + v, 0) / nonNull.length : 0;

    points.push({
      day: dayN,
      avgFatigue,
      sampleSize,
      dimensions: { energy, focus, sleep, soreness, mood },
    });
  }

  return {
    points,
    totalHighIntensitySessions,
    sampleSize: totalHighIntensitySessions,
  };
}
