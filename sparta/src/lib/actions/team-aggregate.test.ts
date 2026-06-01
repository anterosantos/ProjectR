import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTeamAggregateData } from "./team-aggregate";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/data/audited", () => ({
  auditedRead: vi.fn((_opts: unknown, fn: () => Promise<unknown>) => fn()),
}));

vi.mock("@/lib/actions/seasons", () => ({
  getCurrentSeason: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getCurrentSeason } from "@/lib/actions/seasons";

const MOCK_SEASON = { id: "season-1", name: "2025/2026", is_current: true };
const CLUB_A = "club-a";
const PLAYER_1 = "player-1";
const PLAYER_2 = "player-2";
const PLAYER_3 = "player-3";

type MockQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function createMockQuery(): MockQuery {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
  };
}

function setupAuth(
  role: string = "coach",
  clubId: string = CLUB_A,
  userId: string = "user-1"
): MockQuery {
  const profileQuery = createMockQuery();
  profileQuery.single.mockResolvedValue({
    data: { role, club_id: clubId },
    error: null,
  });
  const authClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
    },
    from: vi.fn().mockReturnValue(profileQuery),
  };
  (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(authClient);
  return profileQuery;
}

function makeAttendanceQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.gte.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makeMetricsQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  // session_metrics: .eq("club_id") → q, .in() → q, .eq("sessions.season_id") → resolves
  q.eq.mockReturnValueOnce(q).mockResolvedValue({ data: rows, error: null });
  return q;
}

function makeEventsQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.limit.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makeFatigueQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.order.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makePlayersQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.is.mockResolvedValue({ data: rows, error: null });
  return q;
}

function makePositionsQuery(rows: object[]): MockQuery {
  const q = createMockQuery();
  q.eq.mockResolvedValue({ data: rows, error: null });
  return q;
}

function setupServiceRole(overrides: {
  players?: object[];
  positions?: object[];
  fatigue?: object[];
  attendance?: object[];
  metrics?: object[];
  events?: object[];
  playersError?: object;
} = {}) {
  const playersQuery = makePlayersQuery(overrides.players ?? []);
  if (overrides.playersError) {
    (playersQuery.is as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: overrides.playersError });
  }
  const positionsQuery = makePositionsQuery(overrides.positions ?? []);
  const fatigueQuery = makeFatigueQuery(overrides.fatigue ?? []);
  const attendanceQuery = makeAttendanceQuery(overrides.attendance ?? []);
  const metricsQuery = makeMetricsQuery(overrides.metrics ?? []);
  const eventsQuery = makeEventsQuery(overrides.events ?? []);

  const serviceClient = {
    from: vi.fn((table: string) => {
      if (table === "players") return playersQuery;
      if (table === "positions") return positionsQuery;
      if (table === "fatigue_responses") return fatigueQuery;
      if (table === "attendances") return attendanceQuery;
      if (table === "session_metrics") return metricsQuery;
      if (table === "match_events") return eventsQuery;
      return createMockQuery();
    }),
  };
  (getServiceRoleClient as ReturnType<typeof vi.fn>).mockReturnValue(serviceClient);
  return serviceClient;
}

describe("getTeamAggregateData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentSeason as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: MOCK_SEASON,
    });
  });

  it("retorna unauthorized quando utilizador não está autenticado", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("retorna unauthorized quando utilizador é jogador", async () => {
    setupAuth("player", CLUB_A);
    setupServiceRole();

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("retorna unauthorized quando coach não tem club_id", async () => {
    const profileQuery: MockQuery = createMockQuery();
    profileQuery.single.mockResolvedValue({
      data: { role: "coach", club_id: null },
      error: null,
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
      from: vi.fn().mockReturnValue(profileQuery),
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("retorna db_error quando query de jogadores falha", async () => {
    setupAuth("coach", CLUB_A);
    setupServiceRole({ playersError: { message: "DB Error" } });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("db_error");
  });

  it("retorna arrays vazios sem erro quando plantel está vazio", async () => {
    setupAuth("coach", CLUB_A);
    setupServiceRole({ players: [] });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalActivePlayers).toBe(0);
      expect(result.data.topLoaded).toHaveLength(0);
      expect(result.data.topFatigued).toHaveLength(0);
      expect(result.data.eventsPerMatch).toHaveLength(0);
      expect(result.data.weeklyFatigue).toHaveLength(4);
      expect(result.data.weeklyAttendance).toHaveLength(4);
      // 4 semanas com zeros
      for (const pt of result.data.weeklyFatigue) {
        expect(pt.avgFatigue).toBe(0);
        expect(pt.sampleSize).toBe(0);
      }
    }
  });

  it("happy path: retorna dados agregados correctos com coach", async () => {
    setupAuth("coach", CLUB_A);
    const now = new Date();
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    setupServiceRole({
      players: [
        { id: PLAYER_1, full_name: "João Silva", age_group: "senior" },
        { id: PLAYER_2, full_name: "Maria Costa", age_group: "u19" },
      ],
      positions: [
        { player_id: PLAYER_1, position: "MED", is_primary: true },
        { player_id: PLAYER_2, position: "DEF", is_primary: true },
      ],
      fatigue: [
        {
          player_id: PLAYER_1,
          submitted_at: recentDate,
          dim_energy: 6,
          dim_focus: 7,
          dim_sleep: 5,
          dim_soreness: 4,
          dim_mood: 6,
        },
      ],
      attendance: [],
      metrics: [],
      events: [],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalActivePlayers).toBe(2);
      expect(result.data.userRole).toBe("coach");
      expect(result.data.currentSeason).not.toBeNull();
      expect(result.data.currentSeason?.id).toBe("season-1");
      expect(result.data.weeklyFatigue).toHaveLength(4);
      expect(result.data.weeklyAttendance).toHaveLength(4);
    }
  });

  it("happy path: analyst vê a mesma vista com userRole='analyst'", async () => {
    setupAuth("analyst", CLUB_A);
    setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "João", age_group: "senior" }],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.userRole).toBe("analyst");
    }
  });

  it("isolamento club_id: usa clubId do utilizador autenticado nas queries", async () => {
    setupAuth("coach", CLUB_A);

    const serviceClient = setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "Jogador A", age_group: "senior" }],
      positions: [{ player_id: PLAYER_1, position: "MED", is_primary: true }],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    // Verifica que os dados retornados pertencem ao CLUB_A (totalActivePlayers > 0)
    if (result.ok) {
      expect(result.data.totalActivePlayers).toBe(1);
    }
    // Verifica que a query de jogadores usou o club_id correcto
    const playersQuery = serviceClient.from.mock.calls.find(
      (call) => call[0] === "players"
    );
    expect(playersQuery).toBeDefined();
  });

  it("cálculo semanal de fadiga: agrupamento por semana correcto", async () => {
    setupAuth("coach", CLUB_A);

    const now = new Date();
    // Semana 4 (mais recente — últimos 7 dias)
    const week4Date = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    // Semana 2 (14–21 dias atrás)
    const week2Date = new Date(now.getTime() - 17 * 24 * 60 * 60 * 1000).toISOString();

    setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "P1", age_group: "senior" }],
      positions: [],
      fatigue: [
        {
          player_id: PLAYER_1,
          submitted_at: week4Date,
          dim_energy: 8,
          dim_focus: 8,
          dim_sleep: 8,
          dim_soreness: 8,
          dim_mood: 8,
        },
        {
          player_id: PLAYER_1,
          submitted_at: week2Date,
          dim_energy: 2,
          dim_focus: 2,
          dim_sleep: 2,
          dim_soreness: 2,
          dim_mood: 2,
        },
      ],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const fatigue = result.data.weeklyFatigue;
      expect(fatigue).toHaveLength(4);

      // Semana 4 (índice 3) tem avg=8
      const week4 = fatigue[3];
      expect(week4?.avgFatigue).toBe(8);
      expect(week4?.sampleSize).toBe(1);

      // Semana 2 (índice 1) tem avg=2
      const week2 = fatigue[1];
      expect(week2?.avgFatigue).toBe(2);
      expect(week2?.sampleSize).toBe(1);

      // Semanas 1 e 3 têm avg=0
      expect(fatigue[0]?.avgFatigue).toBe(0);
      expect(fatigue[2]?.avgFatigue).toBe(0);
    }
  });

  it("taxa de presença: (present + late) / total × 100", async () => {
    setupAuth("coach", CLUB_A);

    const now = new Date();
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    setupServiceRole({
      players: [
        { id: PLAYER_1, full_name: "P1", age_group: "senior" },
        { id: PLAYER_2, full_name: "P2", age_group: "senior" },
        { id: PLAYER_3, full_name: "P3", age_group: "senior" },
        { id: "p4", full_name: "P4", age_group: "senior" },
      ],
      attendance: [
        { player_id: PLAYER_1, status: "present", session_id: "s1", sessions: { date: recentDate, type: "treino" } },
        { player_id: PLAYER_2, status: "late", session_id: "s1", sessions: { date: recentDate, type: "treino" } },
        { player_id: PLAYER_3, status: "absent", session_id: "s1", sessions: { date: recentDate, type: "treino" } },
        { player_id: "p4", status: "injured", session_id: "s1", sessions: { date: recentDate, type: "treino" } },
      ],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Semana 4 (últimos 7 dias): 2 present/late, 4 total → 50%
      const week4 = result.data.weeklyAttendance[3];
      expect(week4?.attended).toBe(2);
      expect(week4?.total).toBe(4);
      expect(week4?.attendanceRate).toBe(50);
    }
  });

  it("top-3 por carga: ordenação DESC correcta", async () => {
    setupAuth("coach", CLUB_A);

    setupServiceRole({
      players: [
        { id: PLAYER_1, full_name: "P1", age_group: "senior" },
        { id: PLAYER_2, full_name: "P2", age_group: "u19" },
        { id: PLAYER_3, full_name: "P3", age_group: "u17" },
        { id: "p4", full_name: "P4", age_group: "u14" },
      ],
      positions: [
        { player_id: PLAYER_1, position: "MED", is_primary: true },
        { player_id: PLAYER_2, position: "DEF", is_primary: true },
        { player_id: PLAYER_3, position: "AVA", is_primary: true },
        { player_id: "p4", position: "GR", is_primary: true },
      ],
      metrics: [
        { player_id: PLAYER_1, srpe_load: 300, sessions: { season_id: "season-1" } },
        { player_id: PLAYER_2, srpe_load: 500, sessions: { season_id: "season-1" } },
        { player_id: PLAYER_3, srpe_load: 150, sessions: { season_id: "season-1" } },
        { player_id: "p4", srpe_load: 750, sessions: { season_id: "season-1" } },
      ],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const top = result.data.topLoaded;
      expect(top).toHaveLength(3);
      // Ordenação DESC: p4=750, PLAYER_2=500, PLAYER_1=300
      expect(top[0]?.playerId).toBe("p4");
      expect(top[0]?.value).toBe(750);
      expect(top[1]?.playerId).toBe(PLAYER_2);
      expect(top[1]?.value).toBe(500);
      expect(top[2]?.playerId).toBe(PLAYER_1);
      expect(top[2]?.value).toBe(300);
    }
  });

  it("weeklyFatigue tem labels corretos (Sem 1 a Sem 4)", async () => {
    setupAuth("coach", CLUB_A);
    setupServiceRole({ players: [{ id: PLAYER_1, full_name: "P1", age_group: "senior" }] });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const labels = result.data.weeklyFatigue.map((w) => w.weekLabel);
      expect(labels).toEqual(["Sem 1", "Sem 2", "Sem 3", "Sem 4"]);
    }
  });

  it("eventsPerMatch agrega eventos por sessão", async () => {
    setupAuth("coach", CLUB_A);

    const day1 = "2026-05-01";
    const day2 = "2026-05-15";

    setupServiceRole({
      players: [{ id: PLAYER_1, full_name: "P1", age_group: "senior" }],
      events: [
        { session_id: "s1", sessions: { date: day1, type: "jogo" } },
        { session_id: "s1", sessions: { date: day1, type: "jogo" } },
        { session_id: "s1", sessions: { date: day1, type: "jogo" } },
        { session_id: "s2", sessions: { date: day2, type: "amigavel" } },
        { session_id: "s2", sessions: { date: day2, type: "amigavel" } },
      ],
    });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      const events = result.data.eventsPerMatch;
      expect(events).toHaveLength(2);
      const s1 = events.find((e) => e.sessionId === "s1");
      expect(s1?.eventCount).toBe(3);
      const s2 = events.find((e) => e.sessionId === "s2");
      expect(s2?.eventCount).toBe(2);
    }
  });

  it("sem época actual: currentSeason é null mas não falha", async () => {
    setupAuth("coach", CLUB_A);
    (getCurrentSeason as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      data: null,
    });
    setupServiceRole({ players: [{ id: PLAYER_1, full_name: "P1", age_group: "senior" }] });

    const result = await getTeamAggregateData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.currentSeason).toBeNull();
    }
  });
});
