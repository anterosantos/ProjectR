import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PlayerCreateSchema,
  PlayerUpdateSchema,
  ArchivePlayerSchema,
} from "@/lib/schemas/players";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/uuid", () => ({
  newId: vi.fn().mockReturnValue("new-player-uuid-12345"),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createPlayer, updatePlayer, archivePlayer } from "@/lib/actions/players";
import { logAccess } from "@/lib/actions/audit";

// ─── Zod Schema Tests ────────────────────────────────────────────────────────

describe("PlayerCreateSchema", () => {
  const validInput = {
    fullName: "João Silva",
    birthdate: "2010-03-15",
    jerseyNum: 10,
    ageGroup: "u14" as const,
    positions: [{ position: "GR", isPrimary: true, sortOrder: 0 }],
  };

  it("accepts valid player data", () => {
    const result = PlayerCreateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    const result = PlayerCreateSchema.safeParse({ ...validInput, fullName: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("fullName");
    }
  });

  it("rejects jersey_num below 1", () => {
    const result = PlayerCreateSchema.safeParse({ ...validInput, jerseyNum: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("jerseyNum");
    }
  });

  it("rejects jersey_num above 99", () => {
    const result = PlayerCreateSchema.safeParse({ ...validInput, jerseyNum: 100 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("jerseyNum");
    }
  });

  it("rejects invalid age_group", () => {
    const result = PlayerCreateSchema.safeParse({ ...validInput, ageGroup: "u16" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("ageGroup");
    }
  });

  it("accepts all valid age groups", () => {
    for (const group of ["u14", "u15", "u17", "u19", "senior"] as const) {
      const result = PlayerCreateSchema.safeParse({ ...validInput, ageGroup: group });
      expect(result.success).toBe(true);
    }
  });

  it("rejects empty positions array", () => {
    const result = PlayerCreateSchema.safeParse({ ...validInput, positions: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("positions");
    }
  });

  it("rejects more than 5 positions", () => {
    const tooMany = Array.from({ length: 6 }, (_, i) => ({
      position: "GR",
      isPrimary: i === 0,
      sortOrder: i,
    }));
    const result = PlayerCreateSchema.safeParse({ ...validInput, positions: tooMany });
    expect(result.success).toBe(false);
  });

  it("rejects positions with 0 primary positions", () => {
    const result = PlayerCreateSchema.safeParse({
      ...validInput,
      positions: [
        { position: "GR", isPrimary: false, sortOrder: 0 },
        { position: "DC", isPrimary: false, sortOrder: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects positions with 2 primary positions", () => {
    const result = PlayerCreateSchema.safeParse({
      ...validInput,
      positions: [
        { position: "GR", isPrimary: true, sortOrder: 0 },
        { position: "DC", isPrimary: true, sortOrder: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts up to 4 alternative positions (5 total)", () => {
    const positions = [
      { position: "GR", isPrimary: true, sortOrder: 0 },
      { position: "DC", isPrimary: false, sortOrder: 1 },
      { position: "DD", isPrimary: false, sortOrder: 2 },
      { position: "DE", isPrimary: false, sortOrder: 3 },
      { position: "MC", isPrimary: false, sortOrder: 4 },
    ];
    const result = PlayerCreateSchema.safeParse({ ...validInput, positions });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = PlayerCreateSchema.safeParse({ ...validInput, birthdate: "not-a-date" });
    expect(result.success).toBe(false);
  });
});

describe("PlayerUpdateSchema", () => {
  it("requires playerId UUID", () => {
    const result = PlayerUpdateSchema.safeParse({
      fullName: "João Silva",
      birthdate: "2010-03-15",
      jerseyNum: 10,
      ageGroup: "u14",
      positions: [{ position: "GR", isPrimary: true, sortOrder: 0 }],
      playerId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("playerId");
    }
  });

  it("accepts valid update with UUID", () => {
    const result = PlayerUpdateSchema.safeParse({
      fullName: "João Silva",
      birthdate: "2010-03-15",
      jerseyNum: 10,
      ageGroup: "u14",
      positions: [{ position: "GR", isPrimary: true, sortOrder: 0 }],
      playerId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });
});

describe("ArchivePlayerSchema", () => {
  it("accepts valid UUID", () => {
    const result = ArchivePlayerSchema.safeParse({
      playerId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID", () => {
    const result = ArchivePlayerSchema.safeParse({ playerId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing playerId", () => {
    const result = ArchivePlayerSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── Server Action Tests ──────────────────────────────────────────────────────

describe("createPlayer", () => {
  const validInput = {
    fullName: "João Silva",
    birthdate: "2010-03-15",
    jerseyNum: 10,
    ageGroup: "u14" as const,
    positions: [{ position: "GR", isPrimary: true, sortOrder: 0 }],
  };

  let mockInsert: ReturnType<typeof vi.fn>;
  let mockRpc: ReturnType<typeof vi.fn>;
  let mockSupabase: ReturnType<typeof buildMockSupabase>;

  function buildMockSupabase(overrides?: {
    insertError?: object | null;
    rpcError?: object | null;
  }) {
    mockInsert = vi.fn().mockResolvedValue({ error: overrides?.insertError ?? null });
    mockRpc = vi.fn().mockResolvedValue({ error: overrides?.rpcError ?? null });

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-111" } },
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { club_id: "club-222" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "players") {
          return {
            insert: mockInsert,
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      }),
      rpc: mockRpc,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);
  });

  it("returns validation error for invalid input", async () => {
    const result = await createPlayer({ ...validInput, jerseyNum: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("returns conflict error when jersey is already taken (code 23505)", async () => {
    mockSupabase = buildMockSupabase({ insertError: { code: "23505", message: "unique" } });
    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

    const result = await createPlayer(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("conflict");
      expect(result.error.details?.field).toBe("jerseyNum");
    }
  });

  it("compensates (deletes player) if RPC fails", async () => {
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockRpc = vi.fn().mockResolvedValue({ error: { message: "rpc error" } });

    const supabaseWithDelete = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-111" } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { club_id: "club-222" }, error: null }),
              }),
            }),
          };
        }
        return { insert: mockInsert, delete: mockDelete };
      }),
      rpc: mockRpc,
    };

    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(supabaseWithDelete);

    const result = await createPlayer(validInput);
    expect(result.ok).toBe(false);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("redirects on success", async () => {
    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

    await createPlayer(validInput).catch(() => {
      // redirect() throws in Next.js — catch expected
    });

    expect(redirect).toHaveBeenCalledWith(
      expect.stringContaining("/plantel/new-player-uuid-12345")
    );
  });
});

describe("updatePlayer", () => {
  const validInput = {
    playerId: "550e8400-e29b-41d4-a716-446655440000",
    fullName: "João Silva Editado",
    birthdate: "2010-03-15",
    jerseyNum: 11,
    ageGroup: "u15" as const,
    positions: [{ position: "DC", isPrimary: true, sortOrder: 0 }],
  };

  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockRpc: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockRpc = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-111" } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "players") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { full_name: "João Silva", birthdate: "2010-03-15", jersey_num: 10, age_group: "u14" },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        return {};
      }),
      rpc: mockRpc,
    };

    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);
  });

  it("returns validation error for invalid playerId", async () => {
    const result = await updatePlayer({ ...validInput, playerId: "bad-id" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("calls logAccess after successful update", async () => {
    await updatePlayer(validInput).catch(() => {});
    expect(logAccess).toHaveBeenCalledWith("player.updated", "player", validInput.playerId);
  });

  it("returns conflict error when jersey duplicated", async () => {
    const mockUpdateWithError = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { code: "23505", message: "unique" } }),
    });
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-111" } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "players") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { full_name: "João Silva", birthdate: "2010-03-15", jersey_num: 10, age_group: "u14" },
                  error: null,
                }),
              }),
            }),
            update: mockUpdateWithError,
          };
        }
        return {};
      }),
      rpc: mockRpc,
    };
    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

    const result = await updatePlayer(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("conflict");
    }
  });

  it("redirects to player detail on success", async () => {
    await updatePlayer(validInput).catch(() => {});
    expect(redirect).toHaveBeenCalledWith(
      `/plantel/${validInput.playerId}?updated=1`
    );
  });
});

describe("archivePlayer", () => {
  const validInput = { playerId: "550e8400-e29b-41d4-a716-446655440000" };

  beforeEach(() => {
    vi.clearAllMocks();

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-111" } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { club_id: "club-222" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "players") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);
  });

  it("returns validation error for invalid playerId", async () => {
    const result = await archivePlayer({ playerId: "not-a-uuid" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("redirects to /plantel on success", async () => {
    await archivePlayer(validInput).catch(() => {});
    expect(redirect).toHaveBeenCalledWith("/plantel");
  });

  it("returns unauthorized error when not logged in", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    (createServerClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

    const result = await archivePlayer(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });
});
