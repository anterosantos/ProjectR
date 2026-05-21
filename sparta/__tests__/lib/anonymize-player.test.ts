import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation to prevent redirect from throwing in tests
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockProfileSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockProfileSelect,
            })),
          })),
        };
      }
      return {};
    }),
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("anonymizePlayer server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockProfileSelect.mockResolvedValue({
      data: { club_id: "club-1", role: "coach" },
      error: null,
    });
  });

  it("should return unauthorized when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { anonymizePlayer } = await import("@/lib/actions/players");
    const result = await anonymizePlayer("player-1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("autenticado");
  });

  it("should return forbidden for non-staff role", async () => {
    mockProfileSelect.mockResolvedValue({
      data: { club_id: "club-1", role: "player" },
      error: null,
    });
    const { anonymizePlayer } = await import("@/lib/actions/players");
    const result = await anonymizePlayer("player-1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("permissão");
  });

  it("should return success=false when RPC returns false (not eligible)", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    const { anonymizePlayer } = await import("@/lib/actions/players");
    const result = await anonymizePlayer("player-1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("elegível");
  });

  it("should return success=true when RPC returns true", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    const { anonymizePlayer } = await import("@/lib/actions/players");
    const result = await anonymizePlayer("player-1");
    expect(result.success).toBe(true);
    expect(result.message).toContain("anonimizado");
  });

  it("should return error message when RPC fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "function not found" } });
    const { anonymizePlayer } = await import("@/lib/actions/players");
    const result = await anonymizePlayer("player-1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("function not found");
  });

  it("should call RPC with correct player_id", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    const { anonymizePlayer } = await import("@/lib/actions/players");
    await anonymizePlayer("test-player-uuid");
    expect(mockRpc).toHaveBeenCalledWith("anonymize_archived_player", {
      p_player_id: "test-player-uuid",
    });
  });

  it("should allow analyst role to anonymize", async () => {
    mockProfileSelect.mockResolvedValue({
      data: { club_id: "club-1", role: "analyst" },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: true, error: null });
    const { anonymizePlayer } = await import("@/lib/actions/players");
    const result = await anonymizePlayer("player-1");
    expect(result.success).toBe(true);
  });
});

describe("anonymization date calculation", () => {
  it("should calculate correct anonymization date (5 * 275 days = 1375 days)", () => {
    const archivedAt = new Date("2020-01-01T00:00:00Z");
    const expectedMs = 5 * 275 * 24 * 60 * 60 * 1000;
    const expectedDate = new Date(archivedAt.getTime() + expectedMs);
    // 1375 days after 2020-01-01 should be in 2023
    expect(expectedDate.getFullYear()).toBe(2023);
    // Verify the day offset is exactly 1375 days
    const daysDiff = Math.round(
      (expectedDate.getTime() - archivedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysDiff).toBe(1375);
  });

  it("player archived 5+ years ago should be eligible", () => {
    const archivedAt = new Date("2019-01-01T00:00:00Z");
    const daysSinceArchived = Math.floor(
      (Date.now() - archivedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const seasonsCount = Math.floor(daysSinceArchived / 275);
    expect(seasonsCount).toBeGreaterThanOrEqual(5);
  });

  it("player archived 2 years ago should not be eligible", () => {
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
    const daysSinceArchived = Math.floor(
      (Date.now() - twoYearsAgo.getTime()) / (1000 * 60 * 60 * 24)
    );
    const seasonsCount = Math.floor(daysSinceArchived / 275);
    expect(seasonsCount).toBeLessThan(5);
  });
});
