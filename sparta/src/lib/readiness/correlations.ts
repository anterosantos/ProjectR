import type { SupabaseClient } from "@supabase/supabase-js";

export type FatigueDimension = "energy" | "focus" | "sleep" | "soreness" | "mood";

export type ActionMetric =
  | "ball_loss"
  | "ball_recovery"
  | "shot_total"
  | "shot_on_target"
  | "pass_completed"
  | "def_pressure"
  | "def_action_success"
  | "off_action_success";

export interface CorrelationFinding {
  dimension: FatigueDimension;
  action: ActionMetric;
  rho: number;
  pValue: number;
  n: number;
}

export interface CorrelationsResult {
  findings: CorrelationFinding[];
  totalSessionsAnalyzed: number;
}

// ── Internal types (not exported) ────────────────────────────────────────────

type FatigueRow = {
  session_id: string;
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
};

type EventRow = {
  session_id: string;
  action: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

const EMPTY: CorrelationsResult = { findings: [], totalSessionsAnalyzed: 0 };

const FATIGUE_DIMS: FatigueDimension[] = ["energy", "focus", "sleep", "soreness", "mood"];

const DIM_KEY_MAP: Record<FatigueDimension, keyof FatigueRow> = {
  energy: "dim_energy",
  focus: "dim_focus",
  sleep: "dim_sleep",
  soreness: "dim_soreness",
  mood: "dim_mood",
};

const ACTION_METRICS: ActionMetric[] = [
  "ball_loss",
  "ball_recovery",
  "shot_total",
  "shot_on_target",
  "pass_completed",
  "def_pressure",
  "def_action_success",
  "off_action_success",
];

// ── Main function ────────────────────────────────────────────────────────────

export async function detectCorrelations(
  supabase: SupabaseClient,
  {
    playerId,
    clubId,
    lookbackDays = 120,
  }: { playerId: string; clubId: string; lookbackDays?: number }
): Promise<CorrelationsResult> {
  const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString();

  // Step 1: Post-session fatigue responses within window
  // eslint-disable-next-line custom/no-direct-health-data-read -- called from getPlayerCorrelationsTabData via auditedRead()
  const { data: fatigueData, error: fatigueError } = await supabase
    .from("fatigue_responses")
    .select("session_id, dim_energy, dim_focus, dim_sleep, dim_soreness, dim_mood")
    .eq("player_id", playerId)
    .eq("club_id", clubId)
    .eq("phase", "post")
    .gte("submitted_at", cutoff);

  if (fatigueError || !fatigueData?.length) return EMPTY;
  const fatigueRows = fatigueData as FatigueRow[];

  const fatigueBySess = new Map<string, FatigueRow>();
  for (const row of fatigueRows) {
    if (row.session_id) fatigueBySess.set(row.session_id, row);
  }

  const sessionIds = Array.from(fatigueBySess.keys());
  if (sessionIds.length === 0) return EMPTY;

  // Step 2: Match events for those sessions
  // eslint-disable-next-line custom/no-direct-health-data-read -- called from getPlayerCorrelationsTabData via auditedRead()
  const { data: eventsData, error: eventsError } = await supabase
    .from("match_events")
    .select("session_id, action")
    .eq("player_id", playerId)
    .eq("club_id", clubId)
    .in("session_id", sessionIds)
    .eq("is_deleted", false);

  if (eventsError) return EMPTY;

  // Step 3: Aggregate events by session
  const eventsBySess = new Map<string, Map<string, number>>();
  for (const row of (eventsData ?? []) as EventRow[]) {
    if (!row.session_id || !row.action) continue;
    const sessMap = eventsBySess.get(row.session_id) ?? new Map<string, number>();
    sessMap.set(row.action, (sessMap.get(row.action) ?? 0) + 1);
    eventsBySess.set(row.session_id, sessMap);
  }

  // Step 4: Only sessions where player has BOTH fatigue AND at least one match event
  const pairedSessionIds = sessionIds.filter((sid) => eventsBySess.has(sid));
  if (pairedSessionIds.length === 0) return EMPTY;

  // Step 5: Compute Spearman for each (dim, action) pair
  const findings: CorrelationFinding[] = [];

  for (const dim of FATIGUE_DIMS) {
    const dimKey = DIM_KEY_MAP[dim];
    for (const action of ACTION_METRICS) {
      const xs: number[] = [];
      const ys: number[] = [];

      for (const sid of pairedSessionIds) {
        const fatigueRow = fatigueBySess.get(sid);
        const dimVal = fatigueRow?.[dimKey];
        if (dimVal === null || dimVal === undefined) continue;
        const actionCount = eventsBySess.get(sid)?.get(action) ?? 0;
        xs.push(dimVal as number);
        ys.push(actionCount);
      }

      if (xs.length < 10) continue;

      const rho = spearmanRho(xs, ys);
      const p = spearmanPValue(rho, xs.length);

      if (Math.abs(rho) >= 0.5 && p < 0.05) {
        findings.push({ dimension: dim, action, rho, pValue: p, n: xs.length });
      }
    }
  }

  findings.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));

  return { findings, totalSessionsAnalyzed: pairedSessionIds.length };
}

// ── Statistical algorithms (not exported) ────────────────────────────────────

function rankArray(values: number[]): number[] {
  const n = values.length;
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && indexed[j]!.v === indexed[i]!.v) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[indexed[k]!.i] = avgRank;
    i = j;
  }
  return ranks;
}

function pearsonR(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0,
    dx2 = 0,
    dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den === 0 ? 0 : num / den;
}

function spearmanRho(x: number[], y: number[]): number {
  return pearsonR(rankArray(x), rankArray(y));
}

function spearmanPValue(rho: number, n: number): number {
  if (n <= 2) return 1;
  if (Math.abs(rho) >= 1) return 0;
  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho));
  return 2 * studentTSurvival(Math.abs(t), n - 2);
}

function studentTSurvival(t: number, df: number): number {
  const x = df / (df + t * t);
  return 0.5 * incompleteBeta(x, df / 2, 0.5);
}

// Regularized incomplete beta function I(x; a, b)
// Lentz continued-fraction algorithm (Numerical Recipes §6.4)
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x > (a + 1) / (a + b + 2)) return 1 - incompleteBeta(1 - x, b, a);
  const lbeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const factor = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta) / a;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1,
    d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-7) break;
  }
  return factor * h;
}

// Lanczos log-gamma approximation (Numerical Recipes §6.1)
function logGamma(x: number): number {
  const coef = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    1.20865097386618e-3,
    -5.395239384953e-6,
  ];
  let y = x;
  const tmp = x + 5.5;
  const ser = coef.reduce((acc, c) => {
    y += 1;
    return acc + c / y;
  }, 1.000000000190015);
  return (x + 0.5) * Math.log(tmp) - tmp + Math.log(2.5066282746310005 * ser / x);
}
