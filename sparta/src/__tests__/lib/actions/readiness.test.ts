/**
 * readiness.test.ts — Testes unitários para Server Actions de readiness.
 *
 * Garante que o princípio "dados mediados" é tecnicamente enforçado:
 * - Players recebem "Não autorizado" — sem dados derivados directos
 * - Staff (coach/analyst) pode chamar as actions
 * - Utilizadores não autenticados recebem erro
 *
 * AC #2 (Story 4.6): Server Action authorization check
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getPlayerReadinessSnapshot, getPlayerAcwrTrend } from "@/lib/actions/readiness";

const mockCreateServerClient = createServerClient as ReturnType<typeof vi.fn>;

const PLAYER_UUID = "550e8400-e29b-41d4-a716-446655440001";
const COACH_UUID  = "950e8400-e29b-41d4-a716-446655440005";
const CLUB_UUID   = "850e8400-e29b-41d4-a716-446655440004";

function buildMockClient(opts: {
  userId?: string | null;
  role?: string | null;
  clubId?: string | null;
  profileError?: boolean;
} = {}) {
  // Use !== undefined to distinguish between "not provided" and explicitly null
  const userId = opts.userId !== undefined ? opts.userId : COACH_UUID;
  const role   = opts.role   !== undefined ? opts.role   : "coach";
  const clubId = opts.clubId !== undefined ? opts.clubId : CLUB_UUID;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        opts.profileError
          ? { data: null, error: { message: "Not found" } }
          : {
              data: { role, club_id: clubId },
              error: null,
            }
      ),
    }),
  };
}

describe("readiness Server Actions — Dados Mediados Authorization (AC #2)", () => {
  beforeEach(() => {
    mockCreateServerClient.mockClear();
  });

  // ─── getPlayerReadinessSnapshot ────────────────────────────────────────────

  describe("getPlayerReadinessSnapshot", () => {
    it("returns unauthorized error for player role (AC #2 — dados mediados block)", async () => {
      mockCreateServerClient.mockResolvedValue(
        buildMockClient({ role: "player" })
      );

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
        // Generic error message — does NOT reveal data structure (FR26)
        expect(result.error.message).toBe("Não autorizado");
      }
    });

    it("returns unauthorized error for unknown role", async () => {
      mockCreateServerClient.mockResolvedValue(
        buildMockClient({ role: "unknown" })
      );

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
      }
    });

    it("returns unauthorized error for unauthenticated user", async () => {
      mockCreateServerClient.mockResolvedValue(
        buildMockClient({ userId: null })
      );

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
        expect(result.error.message).toBe("Não autorizado");
      }
    });

    it("returns unauthorized error when profile fetch fails", async () => {
      mockCreateServerClient.mockResolvedValue(
        buildMockClient({ profileError: true })
      );

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
      }
    });

    it("returns unauthorized error when club_id is missing", async () => {
      mockCreateServerClient.mockResolvedValue(
        buildMockClient({ role: "coach", clubId: null })
      );

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
      }
    });

    it("returns not_found for empty playerId", async () => {
      mockCreateServerClient.mockResolvedValue(buildMockClient());

      const result = await getPlayerReadinessSnapshot("");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("not_found");
      }
    });

    it("returns ok (stub) for coach with valid playerId (AC #2 — staff allowed)", async () => {
      mockCreateServerClient.mockResolvedValue(buildMockClient({ role: "coach" }));

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.playerId).toBe(PLAYER_UUID);
        // Stub returns null snapshot (table created in Story 5.3)
        expect(result.data?.snapshot).toBeNull();
      }
    });

    it("returns ok (stub) for analyst with valid playerId (AC #2 — staff allowed)", async () => {
      mockCreateServerClient.mockResolvedValue(buildMockClient({ role: "analyst" }));

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);

      expect(result.ok).toBe(true);
    });
  });

  // ─── getPlayerAcwrTrend ─────────────────────────────────────────────────────

  describe("getPlayerAcwrTrend", () => {
    it("returns unauthorized error for player role (ACWR is derived/processed data)", async () => {
      mockCreateServerClient.mockResolvedValue(
        buildMockClient({ role: "player" })
      );

      const result = await getPlayerAcwrTrend(PLAYER_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("unauthorized");
        expect(result.error.message).toBe("Não autorizado");
      }
    });

    it("returns ok (stub) for coach (staff may access ACWR trend)", async () => {
      mockCreateServerClient.mockResolvedValue(buildMockClient({ role: "coach" }));

      const result = await getPlayerAcwrTrend(PLAYER_UUID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.playerId).toBe(PLAYER_UUID);
        expect(result.data?.trend).toBeNull();
      }
    });
  });

  // ─── Error message integrity ───────────────────────────────────────────────

  describe("Error message integrity (AC #2 — no data structure leakage)", () => {
    it("unauthorized error message is generic — does not reveal resource existence", async () => {
      mockCreateServerClient.mockResolvedValue(
        buildMockClient({ role: "player" })
      );

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Must NOT contain hints like "you don't have permission" vs "data doesn't exist"
        expect(result.error.message).toBe("Não autorizado");
        expect(result.error.message).not.toContain("permissão");
        expect(result.error.message).not.toContain("exists");
        expect(result.error.message).not.toContain("found");
      }
    });

    it("unauthorized response does not include status code that reveals resource existence", async () => {
      mockCreateServerClient.mockResolvedValue(
        buildMockClient({ role: "player" })
      );

      const result = await getPlayerReadinessSnapshot(PLAYER_UUID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Code is "unauthorized", not "not_found" — consistent for all player attempts
        expect(result.error.code).toBe("unauthorized");
      }
    });
  });
});
