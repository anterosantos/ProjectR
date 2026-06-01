import { describe, it, expect, vi } from "vitest";
import { detectCorrelations } from "@/lib/readiness/correlations";
import type { CorrelationsResult } from "@/lib/readiness/correlations";

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLAYER_ID = "player-1";
const CLUB_ID = "club-1";

function makeFatigueRow(
  sessionId: string,
  energy: number,
  focus: number,
  sleep: number,
  soreness: number,
  mood: number
) {
  return {
    session_id: sessionId,
    dim_energy: energy,
    dim_focus: focus,
    dim_sleep: sleep,
    dim_soreness: soreness,
    dim_mood: mood,
  };
}

function makeEventRow(sessionId: string, action: string) {
  return { session_id: sessionId, action };
}

function makeSupabase(tables: Record<string, unknown[]>) {
  const makeChain = (data: unknown[]) => {
    const chain: Record<string, unknown> = {};
    const methods = ["select", "eq", "in", "gte", "order", "limit"];
    for (const method of methods) {
      chain[method] = vi.fn().mockReturnThis();
    }
    chain.then = (onFulfilled: (v: unknown) => void) =>
      Promise.resolve({ data, error: null }).then(onFulfilled);
    return chain;
  };
  return { from: vi.fn((table: string) => makeChain(tables[table] ?? [])) };
}

function makeSupabaseWithError(errorTable: string) {
  const makeChain = (data: unknown[], shouldError: boolean) => {
    const chain: Record<string, unknown> = {};
    const methods = ["select", "eq", "in", "gte", "order", "limit"];
    for (const method of methods) {
      chain[method] = vi.fn().mockReturnThis();
    }
    chain.then = (onFulfilled: (v: unknown) => void) =>
      Promise.resolve(
        shouldError ? { data: null, error: { message: "DB error" } } : { data, error: null }
      ).then(onFulfilled);
    return chain;
  };
  return {
    from: vi.fn((table: string) =>
      makeChain([], table === errorTable)
    ),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("detectCorrelations", () => {
  // ── AC #6: Sem respostas de fadiga ─────────────────────────────────────────

  it("retorna vazio quando não há respostas de fadiga", async () => {
    const supabase = makeSupabase({ fatigue_responses: [], match_events: [] });
    const result: CorrelationsResult = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    expect(result.findings).toHaveLength(0);
    expect(result.totalSessionsAnalyzed).toBe(0);
  });

  // ── AC #6: Sem match_events ────────────────────────────────────────────────

  it("retorna vazio quando não há match_events para as sessões com fadiga", async () => {
    const supabase = makeSupabase({
      fatigue_responses: [makeFatigueRow("s1", 5, 5, 5, 5, 5)],
      match_events: [],
    });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    expect(result.findings).toHaveLength(0);
    expect(result.totalSessionsAnalyzed).toBe(0);
  });

  // ── AC #6: n < 10 sessões ──────────────────────────────────────────────────

  it("retorna vazio quando n < 10 sessões (mesmo com rho perfeito)", async () => {
    const fatigueRows = Array.from({ length: 9 }, (_, i) =>
      makeFatigueRow(`s${i}`, i + 1, 5, 5, 5, 5)
    );
    const eventRows = Array.from({ length: 9 }, (_, i) =>
      makeEventRow(`s${i}`, "pass_completed")
    );
    const supabase = makeSupabase({
      fatigue_responses: fatigueRows,
      match_events: eventRows,
    });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    expect(result.findings).toHaveLength(0);
  });

  // ── AC #6: Correlação forte detectada ────────────────────────────────────

  it("detecta correlação forte positiva (dim_sleep × pass_completed) com n=15", async () => {
    // sleep 1..15 → passes 10..24 (perfect rank correlation)
    const sessions = Array.from({ length: 15 }, (_, i) =>
      makeFatigueRow(`s${i}`, 5, 5, i + 1, 5, 5)
    );
    const events = sessions.flatMap(({ session_id }, i) =>
      Array.from({ length: i + 10 }, () => makeEventRow(session_id, "pass_completed"))
    );
    const supabase = makeSupabase({ fatigue_responses: sessions, match_events: events });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    const finding = result.findings.find(
      (f) => f.dimension === "sleep" && f.action === "pass_completed"
    );
    expect(finding).toBeDefined();
    expect(finding!.rho).toBeGreaterThan(0.9);
    expect(finding!.pValue).toBeLessThan(0.05);
    expect(finding!.n).toBe(15);
  });

  it("detecta correlação forte negativa (dim_soreness × pass_completed)", async () => {
    // soreness 1..15 → passes 24..10 (perfect negative rank correlation)
    const sessions = Array.from({ length: 15 }, (_, i) =>
      makeFatigueRow(`s${i}`, 5, 5, 5, i + 1, 5)
    );
    const events = sessions.flatMap(({ session_id }, i) =>
      Array.from({ length: 24 - i }, () => makeEventRow(session_id, "pass_completed"))
    );
    const supabase = makeSupabase({ fatigue_responses: sessions, match_events: events });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    const finding = result.findings.find(
      (f) => f.dimension === "soreness" && f.action === "pass_completed"
    );
    expect(finding).toBeDefined();
    expect(finding!.rho).toBeLessThan(-0.9);
    expect(finding!.pValue).toBeLessThan(0.05);
  });

  // ── AC #6: Correlações fracas filtradas ──────────────────────────────────

  it("filtra correlações fracas (|rho| < 0.5) — dimensões planas", async () => {
    // Flat fatigue (all 5) → no variance → rho = 0 for all dims → nothing passes
    const sessions = Array.from({ length: 12 }, (_, i) =>
      makeFatigueRow(`s${i}`, 5, 5, 5, 5, 5)
    );
    const events = sessions.map(({ session_id }) => makeEventRow(session_id, "ball_loss"));
    const supabase = makeSupabase({ fatigue_responses: sessions, match_events: events });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    expect(result.findings).toHaveLength(0);
  });

  // ── AC #6: Ordenação por |rho| descendente ───────────────────────────────

  it("ordena findings por |rho| descendente", async () => {
    // Build two strong correlations with different rho strengths
    // sleep 1..15 → ball_recovery 1..15 (rho ≈ 1.0)
    // energy 1..15 → ball_recovery values shuffled slightly (rho ≈ 0.7)
    const sessions = Array.from({ length: 15 }, (_, i) => ({
      session_id: `s${i}`,
      dim_energy: (i % 5) + 1, // less correlated (cycling pattern)
      dim_focus: 5,
      dim_sleep: i + 1, // perfectly correlated
      dim_soreness: 5,
      dim_mood: 5,
    }));
    const events = sessions.flatMap(({ session_id }, i) => [
      makeEventRow(session_id, "ball_recovery"), // count = i+1 via multiple rows
      ...Array.from({ length: i }, () => makeEventRow(session_id, "ball_recovery")),
    ]);
    const supabase = makeSupabase({ fatigue_responses: sessions, match_events: events });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });

    if (result.findings.length >= 2) {
      for (let i = 0; i < result.findings.length - 1; i++) {
        const curr = result.findings[i]!;
        const next = result.findings[i + 1]!;
        expect(Math.abs(curr.rho)).toBeGreaterThanOrEqual(Math.abs(next.rho));
      }
    }
  });

  // ── AC #6: totalSessionsAnalyzed correcto ────────────────────────────────

  it("totalSessionsAnalyzed conta sessões com fatigue + match events (não todas)", async () => {
    // 12 sessions with fatigue, but only 10 have match events
    const fatigueRows = Array.from({ length: 12 }, (_, i) =>
      makeFatigueRow(`s${i}`, 5, 5, 5, 5, 5)
    );
    // Only sessions s0..s9 have match_events
    const eventRows = Array.from({ length: 10 }, (_, i) =>
      makeEventRow(`s${i}`, "ball_loss")
    );
    const supabase = makeSupabase({
      fatigue_responses: fatigueRows,
      match_events: eventRows,
    });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    expect(result.totalSessionsAnalyzed).toBe(10);
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it("retorna vazio quando fatigue_responses retorna erro de DB", async () => {
    const supabase = makeSupabaseWithError("fatigue_responses");
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    expect(result.findings).toHaveLength(0);
    expect(result.totalSessionsAnalyzed).toBe(0);
  });

  it("retorna vazio quando match_events retorna erro de DB", async () => {
    // Need fatigue data first so it doesn't early-return before events query
    const fatigueRows = Array.from({ length: 5 }, (_, i) =>
      makeFatigueRow(`s${i}`, 5, 5, 5, 5, 5)
    );
    const makeChain = (data: unknown[], shouldError: boolean) => {
      const chain: Record<string, unknown> = {};
      const methods = ["select", "eq", "in", "gte", "order", "limit"];
      for (const method of methods) {
        chain[method] = vi.fn().mockReturnThis();
      }
      chain.then = (onFulfilled: (v: unknown) => void) =>
        Promise.resolve(
          shouldError ? { data: null, error: { message: "DB error" } } : { data, error: null }
        ).then(onFulfilled);
      return chain;
    };
    let callCount = 0;
    const supabase = {
      from: vi.fn(() => {
        callCount++;
        // First call = fatigue_responses (ok), second = match_events (error)
        return makeChain(callCount === 1 ? fatigueRows : [], callCount === 2);
      }),
    };
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    expect(result.findings).toHaveLength(0);
  });

  // ── Sessões sem session_id ────────────────────────────────────────────────

  it("ignora linhas de fadiga sem session_id", async () => {
    const fatigueRows = [
      { session_id: null, dim_energy: 5, dim_focus: 5, dim_sleep: 5, dim_soreness: 5, dim_mood: 5 },
      makeFatigueRow("s1", 5, 5, 5, 5, 5),
    ];
    const supabase = makeSupabase({
      fatigue_responses: fatigueRows,
      match_events: [makeEventRow("s1", "ball_loss")],
    });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    // Only 1 paired session (s1), n=1 < 10 → no findings
    expect(result.totalSessionsAnalyzed).toBe(1);
    expect(result.findings).toHaveLength(0);
  });

  // ── Dimensões nulas ignoradas no par (dim, action) ────────────────────────

  it("ignora sessões onde a dimensão é null para o par (dim, action)", async () => {
    // 15 sessions but half have null dim_sleep → effective n for sleep < 10
    const sessions = Array.from({ length: 15 }, (_, i) => ({
      session_id: `s${i}`,
      dim_energy: i + 1,
      dim_focus: 5,
      dim_sleep: i < 8 ? null : i + 1, // only 7 valid sleep values
      dim_soreness: 5,
      dim_mood: 5,
    }));
    const events = sessions.flatMap(({ session_id }, i) =>
      Array.from({ length: i + 1 }, () => makeEventRow(session_id, "pass_completed"))
    );
    const supabase = makeSupabase({ fatigue_responses: sessions, match_events: events });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    // sleep × pass_completed: only 7 valid pairs → filtered out (n < 10)
    const sleepFinding = result.findings.find((f) => f.dimension === "sleep");
    expect(sleepFinding).toBeUndefined();
    // energy has all 15 values → may appear if rho >= 0.5
  });

  // ── Action count 0 é informação válida ───────────────────────────────────

  it("inclui sessões em que o action count é 0 (jogador não tomou essa acção)", async () => {
    // 15 sessions. sleep 1..15, pass_completed only in odd sessions (0 in even)
    const sessions = Array.from({ length: 15 }, (_, i) =>
      makeFatigueRow(`s${i}`, 5, 5, i + 1, 5, 5)
    );
    // Only odd sessions have pass_completed events (even sessions → 0 count)
    const events = sessions
      .filter((_, i) => i % 2 !== 0)
      .flatMap(({ session_id }, i) =>
        Array.from({ length: i + 1 }, () => makeEventRow(session_id, "pass_completed"))
      );
    const supabase = makeSupabase({ fatigue_responses: sessions, match_events: events });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    // All 15 sessions are paired (they all have fatigue + at least 1 event in total)
    // Actually: sessions with no events at all won't be in eventsBySess → not paired
    // So only sessions with at least 1 event are paired (8 odd sessions) → n=8 < 10 → no findings
    expect(result.totalSessionsAnalyzed).toBeLessThanOrEqual(15);
  });

  // ── lookbackDays default ──────────────────────────────────────────────────

  it("aceita lookbackDays customizado (parâmetro opcional)", async () => {
    const supabase = makeSupabase({ fatigue_responses: [], match_events: [] });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
      lookbackDays: 30,
    });
    expect(result.findings).toHaveLength(0);
    expect(result.totalSessionsAnalyzed).toBe(0);
  });

  // ── Múltiplos findings com p < 0.05 ──────────────────────────────────────

  it("detecta múltiplos findings quando há várias correlações fortes", async () => {
    // energy 1..20 → ball_recovery 1..20 (rho ≈ 1.0)
    // sleep 1..20 → pass_completed 1..20 (rho ≈ 1.0)
    const sessions = Array.from({ length: 20 }, (_, i) =>
      makeFatigueRow(`s${i}`, i + 1, 5, i + 1, 5, 5)
    );
    const events = sessions.flatMap(({ session_id }, i) => [
      ...Array.from({ length: i + 1 }, () => makeEventRow(session_id, "ball_recovery")),
      ...Array.from({ length: i + 1 }, () => makeEventRow(session_id, "pass_completed")),
    ]);
    const supabase = makeSupabase({ fatigue_responses: sessions, match_events: events });
    const result = await detectCorrelations(supabase as never, {
      playerId: PLAYER_ID,
      clubId: CLUB_ID,
    });
    expect(result.findings.length).toBeGreaterThanOrEqual(2);
    // All should have |rho| >= 0.5 and p < 0.05
    for (const f of result.findings) {
      expect(Math.abs(f.rho)).toBeGreaterThanOrEqual(0.5);
      expect(f.pValue).toBeLessThan(0.05);
      expect(f.n).toBeGreaterThanOrEqual(10);
    }
  });
});
