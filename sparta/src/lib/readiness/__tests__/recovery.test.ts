import { describe, it, expect, vi } from "vitest";
import { computeRecoveryCurve } from "@/lib/readiness/recovery";
import type { RecoveryCurveResult } from "@/lib/readiness/recovery";

// ── Helpers ─────────────────────────────────────────────────────────────────

const PLAYER_ID = "player-1";
const CLUB_ID = "club-1";

function makeSession(id: string, date: string) {
  return { id, scheduled_at: `${date}T10:00:00Z` };
}

function makeMetric(sessionId: string, srpeLoad: number) {
  return { session_id: sessionId, srpe_load: srpeLoad };
}

function makeResponse(
  sessionId: string,
  phase: string,
  submittedAt: string,
  dims: { energy?: number; focus?: number; sleep?: number; soreness?: number; mood?: number } = {}
) {
  return {
    session_id: sessionId,
    phase,
    dim_energy: dims.energy ?? 5,
    dim_focus: dims.focus ?? 5,
    dim_sleep: dims.sleep ?? 5,
    dim_soreness: dims.soreness ?? 5,
    dim_mood: dims.mood ?? 5,
    submitted_at: submittedAt,
  };
}

function makeSupabase(tables: Record<string, unknown[]>) {
  const makeChain = (data: unknown[]) => {
    const chain: Record<string, unknown> = {};
    const methods = ["select", "eq", "in", "gt", "gte", "lte", "order", "limit"];
    for (const method of methods) {
      chain[method] = vi.fn().mockReturnThis();
    }
    // Await-able: resolves to { data, error: null }
    chain.then = (onFulfilled: (v: unknown) => void) =>
      Promise.resolve({ data, error: null }).then(onFulfilled);
    return chain;
  };

  return {
    from: vi.fn((table: string) => makeChain(tables[table] ?? [])),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("computeRecoveryCurve", () => {
  // ── AC #8: Sem sessões ──────────────────────────────────────────────────

  it("retorna resultado vazio quando jogador não tem session_metrics", async () => {
    const supabase = makeSupabase({ session_metrics: [], sessions: [], fatigue_responses: [] });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    expect(result.totalHighIntensitySessions).toBe(0);
    expect(result.sampleSize).toBe(0);
    expect(result.points).toHaveLength(0);
  });

  // ── AC #8: Sem sessões de alta intensidade ──────────────────────────────

  it("retorna resultado vazio quando não há sessões de alta intensidade", async () => {
    // All sessions have the same srpe_load (none exceed avg × 1.2)
    const metrics = [
      makeMetric("sess-1", 100),
      makeMetric("sess-2", 100),
      makeMetric("sess-3", 100),
    ];
    const supabase = makeSupabase({ session_metrics: metrics, sessions: [], fatigue_responses: [] });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    expect(result.totalHighIntensitySessions).toBe(0);
    expect(result.sampleSize).toBe(0);
    expect(result.points).toHaveLength(0);
  });

  // ── AC #8: Identificação correcta de sessões de alta intensidade ────────

  it("identifica sessões de alta intensidade: srpe_load > avg × 1.2", async () => {
    // avg = (100 + 100 + 200) / 3 = 133.3; threshold = 133.3 × 1.2 = 160
    // Only sess-3 (200) qualifies
    const metrics = [
      makeMetric("sess-1", 100),
      makeMetric("sess-2", 100),
      makeMetric("sess-3", 200),
    ];
    const sessions = [makeSession("sess-3", "2026-05-10")];
    const responses = [
      makeResponse("sess-3", "post", "2026-05-10T11:00:00Z"),
    ];

    const supabase = makeSupabase({ session_metrics: metrics, sessions, fatigue_responses: responses });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    expect(result.totalHighIntensitySessions).toBe(1);
    expect(result.points.some((p) => p.day === 0)).toBe(true);
  });

  // ── AC #8: Agrupamento por dia ──────────────────────────────────────────

  it("agrupa respostas de day 0 pelo phase=post + session_id", async () => {
    const metrics = [makeMetric("sess-1", 300), makeMetric("sess-2", 100)];
    const sessions = [makeSession("sess-1", "2026-05-10")];
    const responses = [
      // Day 0 — post for high-intensity session
      makeResponse("sess-1", "post", "2026-05-10T11:00:00Z", { energy: 8, focus: 7, sleep: 6, soreness: 9, mood: 7 }),
      // pre — should not be counted as day 0
      makeResponse("sess-1", "pre", "2026-05-10T08:00:00Z", { energy: 4, focus: 4, sleep: 4, soreness: 4, mood: 4 }),
    ];

    const supabase = makeSupabase({ session_metrics: metrics, sessions, fatigue_responses: responses });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    const day0 = result.points.find((p) => p.day === 0);
    expect(day0).toBeDefined();
    expect(day0?.sampleSize).toBe(1);
    // avgFatigue = mean of (8, 7, 6, 9, 7) = 37/5 = 7.4
    expect(day0?.avgFatigue).toBeCloseTo(7.4, 5);
    expect(day0?.dimensions.energy).toBeCloseTo(8);
    expect(day0?.dimensions.soreness).toBeCloseTo(9);
  });

  it("agrupa respostas de day 1 por submitted_at no intervalo correcto (UTC)", async () => {
    const metrics = [makeMetric("sess-1", 300), makeMetric("sess-2", 100)];
    const sessions = [makeSession("sess-1", "2026-05-10")]; // base = 2026-05-10T00:00:00Z
    const responses = [
      // Day 0 post — to have at least day 0 data
      makeResponse("sess-1", "post", "2026-05-10T11:00:00Z"),
      // Day 1: submitted_at between 2026-05-11T00:00:00Z and 2026-05-11T23:59:59.999Z
      makeResponse("sess-1", "pre", "2026-05-11T09:00:00Z", { energy: 6, focus: 6, sleep: 6, soreness: 6, mood: 6 }),
      // Day 2: should NOT appear in day 1
      makeResponse("sess-1", "pre", "2026-05-12T09:00:00Z", { energy: 3, focus: 3, sleep: 3, soreness: 3, mood: 3 }),
    ];

    const supabase = makeSupabase({ session_metrics: metrics, sessions, fatigue_responses: responses });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    const day1 = result.points.find((p) => p.day === 1);
    expect(day1).toBeDefined();
    expect(day1?.sampleSize).toBe(1);
    expect(day1?.dimensions.energy).toBeCloseTo(6);

    const day2 = result.points.find((p) => p.day === 2);
    expect(day2).toBeDefined();
    expect(day2?.dimensions.energy).toBeCloseTo(3);
  });

  it("não inclui ponto para dias sem respostas", async () => {
    const metrics = [makeMetric("sess-1", 300), makeMetric("sess-2", 100)];
    const sessions = [makeSession("sess-1", "2026-05-10")];
    const responses = [
      // Only day 0 post
      makeResponse("sess-1", "post", "2026-05-10T11:00:00Z"),
      // No day 1, 2, 3 responses
    ];

    const supabase = makeSupabase({ session_metrics: metrics, sessions, fatigue_responses: responses });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    expect(result.points.find((p) => p.day === 1)).toBeUndefined();
    expect(result.points.find((p) => p.day === 2)).toBeUndefined();
    expect(result.points.find((p) => p.day === 3)).toBeUndefined();
  });

  // ── AC #8: Média por dimensão através das N sessões ─────────────────────

  it("calcula a média das dimensões através de múltiplas sessões de alta intensidade", async () => {
    // avg = (300 + 300 + 100) / 3 = 233; threshold = 233 × 1.2 = 280 → sess-1 e sess-2 são HI
    const metrics = [
      makeMetric("sess-1", 300),
      makeMetric("sess-2", 300),
      makeMetric("sess-3", 100),
    ];
    const sessions = [
      makeSession("sess-1", "2026-05-10"),
      makeSession("sess-2", "2026-05-17"),
    ];
    const responses = [
      // sess-1 day 0: energy=8, rest=5
      makeResponse("sess-1", "post", "2026-05-10T11:00:00Z", { energy: 8, focus: 5, sleep: 5, soreness: 5, mood: 5 }),
      // sess-2 day 0: energy=4, rest=5
      makeResponse("sess-2", "post", "2026-05-17T11:00:00Z", { energy: 4, focus: 5, sleep: 5, soreness: 5, mood: 5 }),
    ];

    const supabase = makeSupabase({ session_metrics: metrics, sessions, fatigue_responses: responses });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    expect(result.totalHighIntensitySessions).toBe(2);
    const day0 = result.points.find((p) => p.day === 0);
    expect(day0).toBeDefined();
    expect(day0?.sampleSize).toBe(2);
    // energy avg = (8 + 4) / 2 = 6; other dims avg = 5
    expect(day0?.dimensions.energy).toBeCloseTo(6, 5);
    // avgFatigue = (6 + 5 + 5 + 5 + 5) / 5 = 26/5 = 5.2
    expect(day0?.avgFatigue).toBeCloseTo(5.2, 5);
  });

  // ── AC #8: sampleSize por ponto reflecte disponibilidade real ───────────

  it("sampleSize por ponto reflecte apenas as sessões com dados nesse dia", async () => {
    const metrics = [
      makeMetric("sess-1", 300),
      makeMetric("sess-2", 300),
      makeMetric("sess-3", 100),
    ];
    const sessions = [
      makeSession("sess-1", "2026-05-10"),
      makeSession("sess-2", "2026-05-17"),
    ];
    const responses = [
      // sess-1: day 0 + day 1
      makeResponse("sess-1", "post", "2026-05-10T11:00:00Z"),
      makeResponse("sess-1", "pre", "2026-05-11T09:00:00Z"),
      // sess-2: day 0 only (no day 1)
      makeResponse("sess-2", "post", "2026-05-17T11:00:00Z"),
    ];

    const supabase = makeSupabase({ session_metrics: metrics, sessions, fatigue_responses: responses });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    const day0 = result.points.find((p) => p.day === 0);
    expect(day0?.sampleSize).toBe(2); // both sessions have day 0

    const day1 = result.points.find((p) => p.day === 1);
    expect(day1?.sampleSize).toBe(1); // only sess-1 has day 1
  });

  // ── AC #3: Threshold de amostra insuficiente ────────────────────────────

  it("sampleSize global = totalHighIntensitySessions (para threshold check)", async () => {
    // Spec pitfall #3 chooses conservative approach: use total HI sessions, not min of point sample sizes.
    // If < 5 high-intensity sessions, EmptyState ("Sem amostra suficiente") is shown.
    const metrics = [makeMetric("sess-1", 300), makeMetric("sess-2", 100)];
    const sessions = [makeSession("sess-1", "2026-05-10")];
    const responses = [makeResponse("sess-1", "post", "2026-05-10T11:00:00Z")];

    const supabase = makeSupabase({ session_metrics: metrics, sessions, fatigue_responses: responses });
    const result: RecoveryCurveResult = await computeRecoveryCurve(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });

    expect(result.sampleSize).toBe(result.totalHighIntensitySessions);
    expect(result.sampleSize).toBe(1); // 1 < 5 → threshold não atingido
  });

  // ── AC #8: Sessão de alta intensidade sem respostas ─────────────────────

  it("retorna points vazio quando há sessões HI mas nenhuma resposta de fadiga", async () => {
    const metrics = [makeMetric("sess-1", 300), makeMetric("sess-2", 100)];
    const sessions = [makeSession("sess-1", "2026-05-10")];

    const supabase = makeSupabase({ session_metrics: metrics, sessions, fatigue_responses: [] });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    expect(result.totalHighIntensitySessions).toBe(1);
    expect(result.sampleSize).toBe(1);
    expect(result.points).toHaveLength(0);
  });

  // ── lookbackSessions limita o número de sessões HI analisadas ───────────

  it("respeita o limite lookbackSessions", async () => {
    // 3 HI sessions but lookbackSessions=2
    const metrics = [
      makeMetric("sess-1", 300),
      makeMetric("sess-2", 300),
      makeMetric("sess-3", 300),
      makeMetric("sess-4", 50), // below threshold
    ];
    const sessions = [
      makeSession("sess-3", "2026-05-24"),
      makeSession("sess-2", "2026-05-17"),
      // sess-1 would be the oldest but limit=2 cuts it
    ];
    const responses = [
      makeResponse("sess-2", "post", "2026-05-17T11:00:00Z"),
      makeResponse("sess-3", "post", "2026-05-24T11:00:00Z"),
    ];

    const supabase = makeSupabase({ session_metrics: metrics, sessions, fatigue_responses: responses });
    // The sessions mock already returns only 2 (simulating DB limit)
    const result = await computeRecoveryCurve(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
      lookbackSessions: 2,
    });

    expect(result.totalHighIntensitySessions).toBe(2);
  });

  // ── Dimensões nulas — media parcial ────────────────────────────────────

  it("calcula avgFatigue excluindo dimensões nulas", async () => {
    const metrics = [makeMetric("sess-1", 300), makeMetric("sess-2", 100)];
    const sessions = [makeSession("sess-1", "2026-05-10")];
    const responses = [
      {
        session_id: "sess-1",
        phase: "post",
        dim_energy: 8,
        dim_focus: null, // null dimension
        dim_sleep: 6,
        dim_soreness: null, // null dimension
        dim_mood: 7,
        submitted_at: "2026-05-10T11:00:00Z",
      },
    ];

    const supabase = makeSupabase({ session_metrics: metrics, sessions, fatigue_responses: responses });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    const day0 = result.points.find((p) => p.day === 0);
    expect(day0).toBeDefined();
    expect(day0?.dimensions.focus).toBeNull();
    expect(day0?.dimensions.soreness).toBeNull();
    // avgFatigue = mean(8, 6, 7) = 21/3 = 7
    expect(day0?.avgFatigue).toBeCloseTo(7, 5);
  });

  // ── Sessões sem HI identificadas mas sem sessões retornadas do DB ───────

  it("retorna resultado vazio quando sessions DB não retorna registos", async () => {
    const metrics = [makeMetric("sess-1", 300), makeMetric("sess-2", 100)];
    // sessions table returns nothing (e.g., no matching club_id)
    const supabase = makeSupabase({ session_metrics: metrics, sessions: [], fatigue_responses: [] });
    const result = await computeRecoveryCurve(supabase as never, { playerId: PLAYER_ID, clubId: CLUB_ID });

    expect(result.totalHighIntensitySessions).toBe(0);
    expect(result.points).toHaveLength(0);
  });
});
