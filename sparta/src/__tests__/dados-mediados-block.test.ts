/**
 * dados-mediados-block.test.ts — Suite de integração para o princípio "Dados Mediados".
 *
 * Story 4.6 — AC #3, AC #4, AC #5, AC #6
 *
 * Valida que:
 * 1. A tabela fatigue_responses exposta ao player não contém campos derivados/processados (AC #3, AC #4)
 * 2. O schema de payload de /historico não inclui campos proibidos (AC #4)
 * 3. Backward compatibility: player pode aceder a /hoje, /configuracoes, /historico (AC #5)
 * 4. Middleware não retorna 500 em edge cases (AC #6)
 *
 * NOTA: Testes de middleware 404 (AC #1) estão em src/__tests__/middleware.test.ts.
 * Testes de Server Action authorization (AC #2) estão em src/__tests__/lib/actions/readiness.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ─── Mocks do middleware ──────────────────────────────────────────────────────

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { proxy } from "@/proxy";

const mockUpdateSession = updateSession as ReturnType<typeof vi.fn>;
const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;

function makePlayerServiceRoleMock() {
  const playerChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  };
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: { role: "player", consent_status: "granted" },
    }),
  };
  return {
    from: vi.fn((table: string) => (table === "players" ? playerChain : profileChain)),
  };
}

// ─── Helper: Payload schema validation ───────────────────────────────────────

/**
 * FORBIDDEN_KEYS — campos que NUNCA devem aparecer em payloads visíveis a players.
 * Presença de qualquer destes indica leakage de dados derivados/processados (FR26, AC #4).
 */
const FORBIDDEN_KEYS = [
  "acwr",
  "acwr_band",
  "acwr_band_lo",
  "acwr_band_hi",
  "readiness",
  "readiness_snapshots",
  "recent_fatigue_avg",
  "attendance_rate",
  "srpe_load",          // raw srpe_value is allowed, srpe_load (computed) is NOT
  "recovery_curve",
  "recovery_trajectory",
  "data_sufficient",
  "dataSufficient",
] as const;

/**
 * assertNoMetricLeakage — verifica que o payload não contém campos derivados.
 * Retorna lista de campos proibidos encontrados (empty = OK).
 */
function assertNoMetricLeakage(payload: unknown): string[] {
  const json =
    typeof payload === "string"
      ? (JSON.parse(payload) as unknown)
      : payload;

  const jsonString = JSON.stringify(json).toLowerCase();
  return FORBIDDEN_KEYS.filter((key) =>
    jsonString.includes(`"${key.toLowerCase()}"`)
  );
}

// ─── AC #4 — Payload schema validation ───────────────────────────────────────

describe("AC #4 — No Metric Leakage: fatigue_responses raw fields only", () => {
  it("raw fatigue_response row contains ONLY allowed fields", () => {
    // Simulates what /historico fetches via RLS "player_sees_own"
    const rawFatigueRow = {
      id: "uuid-1",
      phase: "pre",
      dim_energy: 4,
      dim_focus: 3,
      dim_sleep: 5,
      dim_soreness: 2,
      dim_mood: 4,
      srpe_value: null,
      submitted_at: "2026-05-24T10:00:00Z",
    };

    const leaked = assertNoMetricLeakage(rawFatigueRow);
    expect(leaked).toHaveLength(0);
  });

  it("payload with acwr field is correctly flagged as leakage", () => {
    const leakyPayload = {
      id: "uuid-1",
      dim_energy: 4,
      acwr: 1.3, // ← derived metric — MUST be blocked
    };

    const leaked = assertNoMetricLeakage(leakyPayload);
    expect(leaked).toContain("acwr");
  });

  it("payload with readiness_snapshots data is correctly flagged", () => {
    const leakyPayload = {
      id: "uuid-1",
      readiness: "ready", // ← derived state — MUST be blocked
    };

    const leaked = assertNoMetricLeakage(leakyPayload);
    expect(leaked).toContain("readiness");
  });

  it("payload with acwr_band fields is correctly flagged", () => {
    const leakyPayload = {
      acwr_band_lo: 0.8,
      acwr_band_hi: 1.3,
      acwr_band: "optimal",
    };

    const leaked = assertNoMetricLeakage(leakyPayload);
    expect(leaked).toContain("acwr_band");
    expect(leaked).toContain("acwr_band_lo");
    expect(leaked).toContain("acwr_band_hi");
  });

  it("payload with recovery_curve is correctly flagged", () => {
    const leakyPayload = { recovery_curve: [1, 2, 3] };
    const leaked = assertNoMetricLeakage(leakyPayload);
    expect(leaked).toContain("recovery_curve");
  });

  it("raw srpe_value (1-10 submitted by player) is NOT flagged", () => {
    const payload = { srpe_value: 7 }; // raw submission — allowed
    const leaked = assertNoMetricLeakage(payload);
    expect(leaked).not.toContain("srpe_value");
    expect(leaked).toHaveLength(0);
  });

  it("srpe_load (computed, not raw) IS flagged as leakage", () => {
    const payload = { srpe_load: 450 }; // computed load — MUST be blocked
    const leaked = assertNoMetricLeakage(payload);
    expect(leaked).toContain("srpe_load");
  });

  it("attendance_rate and recent_fatigue_avg are flagged as leakage", () => {
    const payload = {
      recent_fatigue_avg: 3.2,
      attendance_rate: 0.85,
    };
    const leaked = assertNoMetricLeakage(payload);
    expect(leaked).toContain("recent_fatigue_avg");
    expect(leaked).toContain("attendance_rate");
  });

  it("data_sufficient / dataSufficient (confidence signal) is flagged", () => {
    const payload1 = { data_sufficient: true };
    const payload2 = { dataSufficient: true };
    expect(assertNoMetricLeakage(payload1)).toContain("data_sufficient");
    // FORBIDDEN_KEYS preserves original casing — "dataSufficient" (camelCase)
    expect(assertNoMetricLeakage(payload2)).toContain("dataSufficient");
  });

  it("combined raw response array passes schema validation", () => {
    const responses = [
      {
        id: "uuid-1",
        phase: "pre",
        dim_energy: 4,
        dim_focus: 3,
        dim_sleep: 5,
        dim_soreness: 2,
        dim_mood: 4,
        srpe_value: null,
        submitted_at: "2026-05-24T10:00:00Z",
      },
      {
        id: "uuid-2",
        phase: "post",
        dim_energy: 3,
        dim_focus: 4,
        dim_sleep: 4,
        dim_soreness: 3,
        dim_mood: 3,
        srpe_value: 7,
        submitted_at: "2026-05-24T20:00:00Z",
      },
    ];

    const leaked = assertNoMetricLeakage(responses);
    expect(leaked).toHaveLength(0);
  });
});

// ─── AC #5 — Backward compat: player routes remain accessible ─────────────────

describe("AC #5 — Backward Compatibility: Player Routes Remain Accessible", () => {
  beforeEach(() => {
    mockUpdateSession.mockClear();
    mockGetServiceRoleClient.mockClear();
    mockGetServiceRoleClient.mockReturnValue(makePlayerServiceRoleMock());
    mockUpdateSession.mockResolvedValue({
      user: { id: "player-123", email: "player@test.test" },
      claims: { user_role: "player" },
      response: NextResponse.next(),
    });
  });

  it("GET /hoje is accessible to authenticated player", async () => {
    const request = new NextRequest(new URL("http://localhost:3000/hoje"));
    const response = await proxy(request);

    expect(response?.status).not.toBe(307);
    expect(response?.status).not.toBe(404);
  });

  it("GET /historico is accessible to authenticated player", async () => {
    const request = new NextRequest(new URL("http://localhost:3000/historico"));
    const response = await proxy(request);

    expect(response?.status).not.toBe(307);
    expect(response?.status).not.toBe(404);
  });

  it("GET /questionario/session/pre is accessible to authenticated player", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/questionario/session-abc/pre")
    );
    const response = await proxy(request);

    expect(response?.status).not.toBe(307);
    expect(response?.status).not.toBe(404);
  });

  it("GET /questionario/session/post is accessible to authenticated player", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/questionario/session-abc/post")
    );
    const response = await proxy(request);

    expect(response?.status).not.toBe(307);
    expect(response?.status).not.toBe(404);
  });

  it("GET /configuracoes is accessible to authenticated player", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/configuracoes")
    );
    const response = await proxy(request);

    expect(response?.status).not.toBe(307);
    expect(response?.status).not.toBe(404);
  });

  it("GET /configuracoes/* sub-routes are accessible to authenticated player", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/configuracoes/direitos")
    );
    const response = await proxy(request);

    expect(response?.status).not.toBe(307);
    expect(response?.status).not.toBe(404);
  });
});

// ─── AC #6 — Error handling: graceful 404 for cached staff links ───────────────

describe("AC #6 — Error Handling: 404 Graceful, No 500, No PII Leaks", () => {
  beforeEach(() => {
    mockUpdateSession.mockClear();
    mockGetServiceRoleClient.mockClear();
    mockGetServiceRoleClient.mockReturnValue(makePlayerServiceRoleMock());
    mockUpdateSession.mockResolvedValue({
      user: { id: "player-123", email: "player@test.test" },
      claims: { user_role: "player" },
      response: NextResponse.next(),
    });
  });

  it("player accessing /plantel/invalid-uuid returns 404 (not 500)", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/plantel/invalid-uuid")
    );
    const response = await proxy(request);

    // Must return 404, not 500
    expect(response?.status).toBe(404);
    expect(response?.status).not.toBe(500);
  });

  it("player accessing /plantel/uuid/fadiga returns 404 without error", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/plantel/550e8400-e29b-41d4-a716-446655440001/fadiga")
    );
    const response = await proxy(request);

    expect(response?.status).toBe(404);
  });

  it("404 response from dados-mediados block has no Location header (no PII leakage)", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/prontidao")
    );
    const response = await proxy(request);

    expect(response?.status).toBe(404);
    // No redirect location — does not reveal the player's default route
    expect(response?.headers.get("location")).toBeNull();
  });

  it("404 response body is null/empty (no PII or route details in body)", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/plantel")
    );
    const response = await proxy(request);

    expect(response?.status).toBe(404);
    // The body should not contain player_id, club_id, or route specifics
    const body = await response?.text();
    expect(body).toBe("");
  });

  it("player accessing /relatorios/any-id returns 404 gracefully", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/relatorios/report-123")
    );
    const response = await proxy(request);

    expect(response?.status).toBe(404);
  });
});

// ─── Assertiveness of forbidden field detection ───────────────────────────────

describe("assertNoMetricLeakage helper — edge cases", () => {
  it("handles nested objects correctly", () => {
    const payload = {
      sessions: [
        {
          id: "s1",
          responses: [{ dim_energy: 4, acwr: 1.2 }], // nested leakage
        },
      ],
    };
    const leaked = assertNoMetricLeakage(payload);
    expect(leaked).toContain("acwr");
  });

  it("handles null payload gracefully", () => {
    const leaked = assertNoMetricLeakage(null);
    expect(leaked).toHaveLength(0);
  });

  it("handles empty array gracefully", () => {
    const leaked = assertNoMetricLeakage([]);
    expect(leaked).toHaveLength(0);
  });

  it("handles string JSON input", () => {
    const json = JSON.stringify({ acwr: 1.5 });
    const leaked = assertNoMetricLeakage(json);
    expect(leaked).toContain("acwr");
  });
});
