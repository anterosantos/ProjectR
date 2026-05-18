import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PlayerMetricCreateSchema,
  PlayerMetricUpdateSchema,
} from "@/lib/schemas/metrics";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

import { createServerClient } from "@/lib/supabase/server";
import { addPlayerMetric, getPlayerMetrics, updatePlayerMetric } from "@/lib/actions/metrics";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const PLAYER_UUID = "650e8400-e29b-41d4-a716-446655440001";
const METRIC_UUID = "750e8400-e29b-41d4-a716-446655440002";
const CLUB_UUID = "850e8400-e29b-41d4-a716-446655440003";
const USER_UUID = "950e8400-e29b-41d4-a716-446655440004";

// ─── Zod Schema Tests ─────────────────────────────────────────────────────────

describe("PlayerMetricCreateSchema", () => {
  const validBase = {
    player_id: VALID_UUID,
    recorded_at: new Date().toISOString(),
  };

  it("rejects when neither weight nor height provided", () => {
    const result = PlayerMetricCreateSchema.safeParse(validBase);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("weight_kg");
    }
  });

  it("accepts when only weight_kg provided", () => {
    const result = PlayerMetricCreateSchema.safeParse({
      ...validBase,
      weight_kg: 72.5,
    });
    expect(result.success).toBe(true);
  });

  it("accepts when only height_cm provided", () => {
    const result = PlayerMetricCreateSchema.safeParse({
      ...validBase,
      height_cm: 178.0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts when both weight and height provided", () => {
    const result = PlayerMetricCreateSchema.safeParse({
      ...validBase,
      weight_kg: 72.5,
      height_cm: 178.0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects weight below 30", () => {
    const result = PlayerMetricCreateSchema.safeParse({
      ...validBase,
      weight_kg: 20,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("weight_kg");
    }
  });

  it("rejects weight above 150", () => {
    const result = PlayerMetricCreateSchema.safeParse({
      ...validBase,
      weight_kg: 160,
    });
    expect(result.success).toBe(false);
  });

  it("rejects height below 100", () => {
    const result = PlayerMetricCreateSchema.safeParse({
      ...validBase,
      height_cm: 50,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("height_cm");
    }
  });

  it("rejects height above 220", () => {
    const result = PlayerMetricCreateSchema.safeParse({
      ...validBase,
      height_cm: 250,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid player_id UUID", () => {
    const result = PlayerMetricCreateSchema.safeParse({
      ...validBase,
      player_id: "not-a-uuid",
      weight_kg: 72.5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("player_id");
    }
  });
});

describe("PlayerMetricUpdateSchema", () => {
  it("accepts valid update with just id", () => {
    const result = PlayerMetricUpdateSchema.safeParse({
      id: VALID_UUID,
      weight_kg: 73.0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID id", () => {
    const result = PlayerMetricUpdateSchema.safeParse({
      id: "not-a-uuid",
      weight_kg: 73.0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("id");
    }
  });
});

// ─── Server Action Tests ───────────────────────────────────────────────────────

function buildMockSupabase(opts?: {
  userError?: boolean;
  playerData?: object | null;
  insertError?: object | null;
  insertData?: object | null;
  metricsData?: object[] | null;
  metricsError?: object | null;
  existingMetric?: object | null;
  updateError?: object | null;
}) {
  const mockSingle = vi.fn();
  const mockOrder = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        opts?.userError
          ? { data: { user: null } }
          : { data: { user: { id: USER_UUID } } }
      ),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "players") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data:
                  opts?.playerData !== undefined
                    ? opts.playerData
                    : { id: PLAYER_UUID, club_id: CLUB_UUID },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "player_metrics") {
        mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle.mockResolvedValue({
              data: opts?.existingMetric ?? null,
              error: null,
            }),
            order: mockOrder.mockResolvedValue({
              data: opts?.metricsData ?? [],
              error: opts?.metricsError ?? null,
            }),
          }),
        });

        return {
          select: mockSelect,
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: opts?.insertData ?? { id: METRIC_UUID },
                error: opts?.insertError ?? null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: opts?.updateError ?? null,
            }),
          }),
        };
      }
      return {};
    }),
  };
}

describe("addPlayerMetric", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validInput = {
    player_id: PLAYER_UUID,
    weight_kg: 72.5,
    recorded_at: new Date().toISOString(),
  };

  it("returns ok with id on successful insert", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockSupabase() as never
    );
    const result = await addPlayerMetric(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(METRIC_UUID);
    }
  });

  it("returns validation error for invalid input (no weight or height)", async () => {
    const result = await addPlayerMetric({
      player_id: PLAYER_UUID,
      recorded_at: new Date().toISOString(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("returns unauthorized when user not authenticated", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockSupabase({ userError: true }) as never
    );
    const result = await addPlayerMetric(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });

  it("returns forbidden when player not found (club isolation)", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockSupabase({ playerData: null }) as never
    );
    const result = await addPlayerMetric(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns error on database insert failure", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockSupabase({
        insertData: null,
        insertError: { message: "DB error" },
      }) as never
    );
    const result = await addPlayerMetric(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("getPlayerMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no metrics exist", async () => {
    const mock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    const result = await getPlayerMetrics(PLAYER_UUID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("returns metrics ordered by recorded_at ascending", async () => {
    const metricsData = [
      {
        id: METRIC_UUID,
        player_id: PLAYER_UUID,
        club_id: CLUB_UUID,
        weight_kg: 70.0,
        height_cm: 175.0,
        recorded_at: "2026-01-01T10:00:00Z",
        created_by: USER_UUID,
        created_at: "2026-01-01T10:00:00Z",
      },
    ];
    const mock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: metricsData, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    const result = await getPlayerMetrics(PLAYER_UUID);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.weight_kg).toBe(70.0);
    }
  });

  it("returns error on database failure", async () => {
    const mock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "DB error" },
            }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    const result = await getPlayerMetrics(PLAYER_UUID);
    expect(result.ok).toBe(false);
  });
});

describe("updatePlayerMetric — 24h window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validInput = {
    id: METRIC_UUID,
    weight_kg: 73.0,
  };

  it("allows update within 24h window", async () => {
    const recentTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1h ago
    const mock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_UUID } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: METRIC_UUID,
                player_id: PLAYER_UUID,
                recorded_at: recentTime,
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    const result = await updatePlayerMetric(validInput);
    expect(result.ok).toBe(true);
  });

  it("rejects update older than 24h", async () => {
    const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
    const mock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_UUID } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: METRIC_UUID,
                player_id: PLAYER_UUID,
                recorded_at: oldTime,
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    const result = await updatePlayerMetric(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns not_found when metric does not exist", async () => {
    const mock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_UUID } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    const result = await updatePlayerMetric(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("returns unauthorized when user not authenticated", async () => {
    const mock = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockResolvedValue(mock as never);
    const result = await updatePlayerMetric(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });
});
