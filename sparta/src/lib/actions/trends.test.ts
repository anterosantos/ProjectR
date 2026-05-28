import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFatigueTrendsData, type TrendFilters } from "./trends";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/data/audited", () => ({
  auditedRead: vi.fn((_opts: unknown, fn: () => Promise<unknown>) => fn()),
}));

import { createServerClient } from "@/lib/supabase/server";
import { auditedRead } from "@/lib/data/audited";

describe("getFatigueTrendsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockTableQuery() {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
  }

  it("retorna erro quando utilizador não está autenticado", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    (createServerClient as any).mockResolvedValue(mockClient);

    const result = await getFatigueTrendsData();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });

  it("retorna erro quando utilizador não é staff", async () => {
    const mockQuery = createMockTableQuery();
    mockQuery.single.mockResolvedValue({
      data: { role: "player", club_id: "club-1" },
      error: null,
    });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn().mockReturnValue(mockQuery),
    };
    (createServerClient as any).mockResolvedValue(mockClient);

    const result = await getFatigueTrendsData();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });

  it("retorna lista de jogadores com sparklines quando dados disponíveis", async () => {
    const profileQuery = createMockTableQuery();
    profileQuery.single.mockResolvedValue({
      data: { role: "coach", club_id: "club-1" },
      error: null,
    });

    const playersQuery = createMockTableQuery();
    playersQuery.order.mockResolvedValue({
      data: [
        {
          id: "player-1",
          full_name: "João Silva",
          age_group: "senior",
        },
      ],
      error: null,
    });

    const positionsQuery = createMockTableQuery();
    positionsQuery.eq.mockResolvedValue({
      data: [
        {
          player_id: "player-1",
          position: "MED",
        },
      ],
      error: null,
    });

    const responsesQuery = createMockTableQuery();
    responsesQuery.order.mockResolvedValue({
      data: [
        {
          player_id: "player-1",
          submitted_at: new Date().toISOString(),
          dim_energy: 3,
          dim_focus: 4,
          dim_sleep: 3,
          dim_soreness: 2,
          dim_mood: 4,
        },
      ],
      error: null,
    });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn((table) => {
        if (table === "profiles") return profileQuery;
        if (table === "players") return playersQuery;
        if (table === "positions") return positionsQuery;
        if (table === "fatigue_responses") return responsesQuery;
        return createMockTableQuery();
      }),
    };
    (createServerClient as any).mockResolvedValue(mockClient);

    const result = await getFatigueTrendsData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.players).toHaveLength(1);
      expect(result.data.players[0]?.playerName).toBe("João Silva");
      expect(result.data.players[0]?.hasFatigueData).toBe(true);
    }
  });

  it("retorna jogador com hasFatigueData=false quando sem respostas", async () => {
    const profileQuery = createMockTableQuery();
    profileQuery.single.mockResolvedValue({
      data: { role: "analyst", club_id: "club-1" },
      error: null,
    });

    const playersQuery = createMockTableQuery();
    playersQuery.order.mockResolvedValue({
      data: [
        {
          id: "player-1",
          full_name: "João Silva",
          age_group: "senior",
        },
      ],
      error: null,
    });

    const positionsQuery = createMockTableQuery();
    positionsQuery.eq.mockResolvedValue({
      data: [
        {
          player_id: "player-1",
          position: "MED",
        },
      ],
      error: null,
    });

    const responsesQuery = createMockTableQuery();
    responsesQuery.order.mockResolvedValue({
      data: [],
      error: null,
    });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn((table) => {
        if (table === "profiles") return profileQuery;
        if (table === "players") return playersQuery;
        if (table === "positions") return positionsQuery;
        if (table === "fatigue_responses") return responsesQuery;
        return createMockTableQuery();
      }),
    };
    (createServerClient as any).mockResolvedValue(mockClient);

    const result = await getFatigueTrendsData();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.players.length).toBeGreaterThan(0);
      expect(result.data.players[0]?.hasFatigueData).toBe(false);
    }
  });

  it("ordena por delta quando sortBy='delta'", async () => {
    const profileQuery = createMockTableQuery();
    profileQuery.single.mockResolvedValue({
      data: { role: "coach", club_id: "club-1" },
      error: null,
    });

    const playersQuery = createMockTableQuery();
    playersQuery.order.mockResolvedValue({
      data: [
        { id: "p1", full_name: "A", age_group: "senior" },
        { id: "p2", full_name: "B", age_group: "senior" },
      ],
      error: null,
    });

    const positionsQuery = createMockTableQuery();
    positionsQuery.eq.mockResolvedValue({
      data: [
        { player_id: "p1", position: "MED" },
        { player_id: "p2", position: "DEF" },
      ],
      error: null,
    });

    const responsesQuery = createMockTableQuery();
    responsesQuery.order.mockResolvedValue({
      data: [],
      error: null,
    });

    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn((table) => {
        if (table === "profiles") return profileQuery;
        if (table === "players") return playersQuery;
        if (table === "positions") return positionsQuery;
        if (table === "fatigue_responses") return responsesQuery;
        return createMockTableQuery();
      }),
    };
    (createServerClient as any).mockResolvedValue(mockClient);

    const filters: TrendFilters = { position: "all", ageGroup: "all", sortBy: "delta" };
    const result = await getFatigueTrendsData(filters);

    expect(result.ok).toBe(true);
  });
});
