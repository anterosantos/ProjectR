import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPlayerProfileHeader,
  getPlayerFatigueTabData,
  getPlayerLoadAcwrTabData,
  getPlayerPhysicalMetricsTabData,
  getPlayerAttendanceTabData,
  getPlayerStatisticsTabData,
  getPlayerDataDecisionsTabData,
} from "./player-profile";

vi.mock("@/lib/actions/auth", () => ({
  requireStaffRole: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/data/audited", () => ({
  auditedRead: vi.fn((_opts: unknown, fn: () => Promise<unknown>) => fn()),
}));

import { requireStaffRole } from "@/lib/actions/auth";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const MOCK_AUTH = { userId: "user-1", clubId: "club-1", role: "coach" };
const PLAYER_ID = "player-uuid-1";
const CLUB_ID = "club-1";

function createChainableMock(resolvedValue: unknown = { data: null, error: null }) {
  // Build a thenable chainable mock: `await anyMethod()` always resolves to resolvedValue.
  // All chain methods return `this` so `.eq().in().order()` etc. all work.
  // The mock itself is thenable so `await mock` also resolves.
  const m: Record<string, unknown> = {};
  const methods = ["select", "eq", "neq", "in", "gte", "lte", "gt", "lt", "order", "limit"];
  for (const method of methods) {
    m[method] = vi.fn().mockReturnThis();
  }
  // Terminal methods return resolved promises
  m.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  m.single = vi.fn().mockResolvedValue(resolvedValue);
  // Make the mock itself thenable so `await m` resolves to resolvedValue
  m.then = (onFulfilled: (v: unknown) => void, onRejected?: (v: unknown) => void) =>
    Promise.resolve(resolvedValue).then(onFulfilled, onRejected);
  m.catch = (onRejected: (v: unknown) => void) =>
    Promise.resolve(resolvedValue).catch(onRejected);
  return m;
}

function setupAuth(override: Partial<typeof MOCK_AUTH> = {}) {
  (requireStaffRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    data: { ...MOCK_AUTH, ...override },
  });
}

function setupAuthFailure(code = "unauthorized") {
  (requireStaffRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: false,
    error: { code, message: "Não autorizado" },
  });
}

function setupServiceRole(tableHandlers: Record<string, object>) {
  const client = {
    from: vi.fn((table: string) => {
      return tableHandlers[table] ?? createChainableMock({ data: [], error: null });
    }),
  };
  (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(client);
  return client;
}

// ── getPlayerProfileHeader ──────────────────────────────────────────────────

describe("getPlayerProfileHeader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna erro quando não autenticado", async () => {
    setupAuthFailure("unauthorized");
    const result = await getPlayerProfileHeader(PLAYER_ID);
    expect(result.ok).toBe(false);
  });

  it("retorna erro quando playerId vazio", async () => {
    setupAuth();
    const result = await getPlayerProfileHeader("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("retorna erro quando jogador não encontrado", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: null, error: null });
    const positionsMock = createChainableMock({ data: [], error: null });
    setupServiceRole({ players: playerMock, positions: positionsMock });

    const result = await getPlayerProfileHeader(PLAYER_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("retorna header com posições quando jogador existe", async () => {
    setupAuth();
    const playerData = {
      id: PLAYER_ID,
      full_name: "João Silva",
      age_group: "senior",
      jersey_num: 10,
      photo_path: null,
    };
    const playerMock = createChainableMock({ data: playerData, error: null });
    const positionsData = [
      { position: "MED", is_primary: true },
      { position: "AVA", is_primary: false },
    ];
    const positionsMock = createChainableMock({ data: positionsData, error: null });
    setupServiceRole({ players: playerMock, positions: positionsMock });

    const result = await getPlayerProfileHeader(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.full_name).toBe("João Silva");
      expect(result.data.primary_position).toBe("MED");
      expect(result.data.alt_positions).toEqual(["AVA"]);
      expect(result.data.jersey_num).toBe(10);
    }
  });

  it("retorna posição primária null quando sem posições", async () => {
    setupAuth();
    const playerData = { id: PLAYER_ID, full_name: "Maria", age_group: "u14", jersey_num: 5, photo_path: null };
    const playerMock = createChainableMock({ data: playerData, error: null });
    const positionsMock = createChainableMock({ data: [], error: null });
    setupServiceRole({ players: playerMock, positions: positionsMock });

    const result = await getPlayerProfileHeader(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.primary_position).toBeNull();
      expect(result.data.alt_positions).toEqual([]);
    }
  });
});

// ── getPlayerFatigueTabData ─────────────────────────────────────────────────

describe("getPlayerFatigueTabData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna erro quando não autenticado", async () => {
    setupAuthFailure();
    const result = await getPlayerFatigueTabData(PLAYER_ID);
    expect(result.ok).toBe(false);
  });

  it("retorna respostas de fadiga quando jogador existe", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, full_name: "João", club_id: CLUB_ID }, error: null });
    const fatigueData = [
      {
        id: "resp-1",
        player_id: PLAYER_ID,
        session_id: "sess-1",
        phase: "pre",
        dim_energy: 3,
        dim_focus: 4,
        dim_sleep: 3,
        dim_soreness: 2,
        dim_mood: 4,
        srpe_value: null,
        submitted_at: "2026-05-01T10:00:00Z",
        submitted_via: "app",
      },
    ];
    const fatigueMock = createChainableMock({ data: fatigueData, error: null });
    const sessionsMock = createChainableMock({ data: [{ id: "sess-1", type: "training", scheduled_at: "2026-05-01T09:00:00Z" }], error: null });

    setupServiceRole({
      players: playerMock,
      fatigue_responses: fatigueMock,
      sessions: sessionsMock,
    });

    const result = await getPlayerFatigueTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.responses).toHaveLength(1);
      expect(result.data.playerName).toBe("João");
    }
  });

  it("retorna lista vazia quando sem respostas", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, full_name: "João", club_id: CLUB_ID }, error: null });
    const fatigueMock = createChainableMock({ data: [], error: null });
    setupServiceRole({ players: playerMock, fatigue_responses: fatigueMock, sessions: createChainableMock({ data: [], error: null }) });

    const result = await getPlayerFatigueTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.responses).toHaveLength(0);
  });
});

// ── getPlayerPhysicalMetricsTabData ─────────────────────────────────────────

describe("getPlayerPhysicalMetricsTabData (continued)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna array vazio quando sem métricas registadas", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, club_id: CLUB_ID }, error: null });
    const metricsMock = createChainableMock({ data: [], error: null });
    setupServiceRole({ players: playerMock, player_metrics: metricsMock });

    const result = await getPlayerPhysicalMetricsTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(0);
  });
});

// ── getPlayerLoadAcwrTabData ────────────────────────────────────────────────

describe("getPlayerLoadAcwrTabData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna erro quando não autenticado", async () => {
    setupAuthFailure();
    const result = await getPlayerLoadAcwrTabData(PLAYER_ID);
    expect(result.ok).toBe(false);
  });

  it("retorna pontos de dados ACWR+sRPE quando existem snapshots e métricas", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, age_group: "senior", club_id: CLUB_ID }, error: null });
    const snapshotsMock = createChainableMock({
      data: [{ session_id: "sess-1", acwr: 1.2, computed_at: "2026-05-01T10:00:00Z" }],
      error: null,
    });
    const metricsMock = createChainableMock({
      data: [{ session_id: "sess-1", srpe_load: 350, computed_at: "2026-05-01T10:00:00Z" }],
      error: null,
    });
    const sessionsMock = createChainableMock({
      data: [{ id: "sess-1", scheduled_at: "2026-05-01T09:00:00Z" }],
      error: null,
    });

    setupServiceRole({
      players: playerMock,
      readiness_snapshots: snapshotsMock,
      session_metrics: metricsMock,
      sessions: sessionsMock,
    });

    const result = await getPlayerLoadAcwrTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dataPoints).toHaveLength(1);
      expect(result.data.dataPoints[0]?.acwr).toBe(1.2);
      expect(result.data.dataPoints[0]?.srpe_load).toBe(350);
      expect(result.data.ageGroup).toBe("senior");
      expect(result.data.acwrBandLo).toBe(0.8);
      expect(result.data.acwrBandHi).toBe(1.5);
    }
  });

  it("retorna thresholds corretos para u14", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, age_group: "u14", club_id: CLUB_ID }, error: null });
    setupServiceRole({
      players: playerMock,
      seasons: createChainableMock({ data: null, error: null }),
      readiness_snapshots: createChainableMock({ data: [], error: null }),
      session_metrics: createChainableMock({ data: [], error: null }),
      sessions: createChainableMock({ data: [], error: null }),
    });

    const result = await getPlayerLoadAcwrTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.acwrBandHi).toBe(1.3);
    }
  });

  it("retorna dataPoints vazio quando sem snapshots nem métricas", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, age_group: "senior", club_id: CLUB_ID }, error: null });
    setupServiceRole({
      players: playerMock,
      seasons: createChainableMock({ data: null, error: null }),
      readiness_snapshots: createChainableMock({ data: [], error: null }),
      session_metrics: createChainableMock({ data: [], error: null }),
      sessions: createChainableMock({ data: [], error: null }),
    });

    const result = await getPlayerLoadAcwrTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.dataPoints).toHaveLength(0);
    }
  });
});

// ── getPlayerPhysicalMetricsTabData ─────────────────────────────────────────

describe("getPlayerPhysicalMetricsTabData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna erro quando não autenticado", async () => {
    setupAuthFailure();
    const result = await getPlayerPhysicalMetricsTabData(PLAYER_ID);
    expect(result.ok).toBe(false);
  });

  it("retorna métricas ordenadas por data", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, club_id: CLUB_ID }, error: null });
    const metricsData = [
      { id: "m1", player_id: PLAYER_ID, club_id: CLUB_ID, weight_kg: 70, height_cm: 175, recorded_at: "2026-01-01", created_by: "u1", created_at: "2026-01-01T10:00:00Z" },
      { id: "m2", player_id: PLAYER_ID, club_id: CLUB_ID, weight_kg: 71, height_cm: null, recorded_at: "2026-02-01", created_by: "u1", created_at: "2026-02-01T10:00:00Z" },
    ];
    const metricsMock = createChainableMock({ data: metricsData, error: null });
    setupServiceRole({ players: playerMock, player_metrics: metricsMock });

    const result = await getPlayerPhysicalMetricsTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.weight_kg).toBe(70);
    }
  });
});

// ── getPlayerAttendanceTabData ──────────────────────────────────────────────

describe("getPlayerAttendanceTabData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna erro quando não autenticado", async () => {
    setupAuthFailure();
    const result = await getPlayerAttendanceTabData(PLAYER_ID);
    expect(result.ok).toBe(false);
  });

  it("retorna meses agrupados com presenças", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, club_id: CLUB_ID }, error: null });
    const sessions = [
      { id: "sess-1", type: "training", scheduled_at: "2026-05-10T09:00:00Z" },
      { id: "sess-2", type: "match", scheduled_at: "2026-05-15T15:00:00Z" },
    ];
    const sessionsMock = createChainableMock({ data: sessions, error: null });
    const attendances = [
      { session_id: "sess-1", status: "present", note: null },
      { session_id: "sess-2", status: "absent", note: null },
    ];
    const attendanceMock = createChainableMock({ data: attendances, error: null });

    setupServiceRole({
      players: playerMock,
      sessions: sessionsMock,
      attendances: attendanceMock,
    });

    const result = await getPlayerAttendanceTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalSessions).toBe(2);
      expect(result.data.totalPresent).toBe(1);
      expect(result.data.months).toHaveLength(1);
      expect(result.data.months[0]?.month).toBe("2026-05");
    }
  });

  it("retorna estrutura vazia quando sem sessões", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, club_id: CLUB_ID }, error: null });
    setupServiceRole({
      players: playerMock,
      sessions: createChainableMock({ data: [], error: null }),
      attendances: createChainableMock({ data: [], error: null }),
    });

    const result = await getPlayerAttendanceTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.months).toHaveLength(0);
      expect(result.data.totalSessions).toBe(0);
    }
  });
});

// ── getPlayerStatisticsTabData ──────────────────────────────────────────────

describe("getPlayerStatisticsTabData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna erro quando não autenticado", async () => {
    setupAuthFailure();
    const result = await getPlayerStatisticsTabData(PLAYER_ID);
    expect(result.ok).toBe(false);
  });

  it("retorna rows agregados por sessão com totalizadores", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, club_id: CLUB_ID }, error: null });
    const events = [
      { session_id: "sess-1", action: "ball_loss", zone: "mid_center", occurred_at: "2026-05-10T16:00:00Z" },
      { session_id: "sess-1", action: "ball_recovery", zone: "def_center", occurred_at: "2026-05-10T16:05:00Z" },
      { session_id: "sess-1", action: "shot_total", zone: "att_center", occurred_at: "2026-05-10T16:10:00Z" },
    ];
    const eventsMock = createChainableMock({ data: events, error: null });
    const sessionInfo = [{ id: "sess-1", type: "match", scheduled_at: "2026-05-10T15:00:00Z", duration_min: 90 }];
    const sessionsMock = createChainableMock({ data: sessionInfo, error: null });
    const minutesMock = createChainableMock({ data: [{ session_id: "sess-1", player_id: PLAYER_ID, minutes_played: 90 }], error: null });

    const serviceClient = {
      from: vi.fn((table: string) => {
        if (table === "players") return playerMock;
        if (table === "match_events") return eventsMock;
        if (table === "sessions") return sessionsMock;
        if (table === "match_minutes_played") return minutesMock;
        return createChainableMock({ data: [], error: null });
      }),
    };
    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceClient);

    const result = await getPlayerStatisticsTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]?.losses).toBe(1);
      expect(result.data.rows[0]?.recoveries).toBe(1);
      expect(result.data.rows[0]?.shots).toBe(1);
      expect(result.data.totals.losses).toBe(1);
      expect(result.data.zoneHeatmap["mid_center"]).toBe(1);
    }
  });

  it("retorna estrutura vazia quando sem eventos", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, club_id: CLUB_ID }, error: null });
    const eventsMock = createChainableMock({ data: [], error: null });

    const serviceClient = {
      from: vi.fn((table: string) => {
        if (table === "players") return playerMock;
        if (table === "match_events") return eventsMock;
        return createChainableMock({ data: [], error: null });
      }),
    };
    (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceClient);

    const result = await getPlayerStatisticsTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.rows).toHaveLength(0);
      expect(result.data.totals.minutes).toBe(0);
    }
  });
});

// ── getPlayerDataDecisionsTabData ───────────────────────────────────────────

describe("getPlayerDataDecisionsTabData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna erro quando não autenticado", async () => {
    setupAuthFailure();
    const result = await getPlayerDataDecisionsTabData(PLAYER_ID);
    expect(result.ok).toBe(false);
  });

  it("retorna lista de decisões ordenadas por data desc", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, club_id: CLUB_ID }, error: null });
    const decisionsData = [
      { id: "d1", decision_kind: "rest", note: "Descanso preventivo", was_data_driven: true, created_at: "2026-05-10T10:00:00Z", actor_id: "user-1" },
      { id: "d2", decision_kind: "roster", note: null, was_data_driven: false, created_at: "2026-05-05T10:00:00Z", actor_id: "user-2" },
    ];
    const decisionsMock = createChainableMock({ data: decisionsData, error: null });
    setupServiceRole({ players: playerMock, data_decisions: decisionsMock });

    const result = await getPlayerDataDecisionsTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.decisions).toHaveLength(2);
      expect(result.data.decisions[0]?.decisionKind).toBe("rest");
      expect(result.data.decisions[0]?.note).toBe("Descanso preventivo");
    }
  });

  it("retorna lista vazia quando sem decisões", async () => {
    setupAuth();
    const playerMock = createChainableMock({ data: { id: PLAYER_ID, club_id: CLUB_ID }, error: null });
    setupServiceRole({ players: playerMock, data_decisions: createChainableMock({ data: [], error: null }) });

    const result = await getPlayerDataDecisionsTabData(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.decisions).toHaveLength(0);
  });
});
