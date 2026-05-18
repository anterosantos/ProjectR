import { describe, it, expect, beforeEach, vi } from "vitest";
import { logTelemetry } from "@/lib/actions/telemetry";
import * as logger from "@/lib/logger";

// Mock the Supabase clients and logger
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(() => ({
    from: vi.fn(),
  })),
  serviceRoleClient: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient, serviceRoleClient } from "@/lib/supabase/service-role";

describe("logTelemetry", () => {
  let mockInsert: ReturnType<typeof vi.fn>;
  let mockServiceRoleClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockServiceRoleClient = {
      from: vi.fn().mockReturnValue({ insert: mockInsert }),
    };
    (getServiceRoleClient as any).mockReturnValue(mockServiceRoleClient);
  });

  describe("Success path", () => {
    it("should insert valid telemetry event successfully", async () => {
      (createServerClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { club_id: "club-456" },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await logTelemetry("survey_submitted", {
        playerId: "player-789",
        durationMs: 1500,
      });

      expect(result.ok).toBe(true);
      expect(result.ok ? result.data : undefined).toBeUndefined();
      expect(logger.logger.info).toHaveBeenCalledWith("telemetry_logged", {
        kind: "survey_submitted",
      });
    });

    it("should use service-role client to bypass RLS", async () => {
      (createServerClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { club_id: "club-456" },
                error: null,
              }),
            }),
          }),
        }),
      });

      await logTelemetry("app_started", {});

      // Verify service-role client was used (not authenticated client)
      expect(mockServiceRoleClient.from).toHaveBeenCalledWith("telemetry_events");
    });
  });

  describe("Failure handling (fire-and-forget)", () => {
    it("should log error but return success if insert fails", async () => {
      const mockInsertError = vi.fn().mockResolvedValue({
        error: { message: "Database error", code: "DB_ERROR" },
      });
      mockServiceRoleClient.from = vi.fn().mockReturnValue({ insert: mockInsertError });
      (getServiceRoleClient as any).mockReturnValue(mockServiceRoleClient);

      (createServerClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { club_id: "club-456" },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await logTelemetry("event", {});

      // Fire-and-forget: still returns success even though insert failed
      expect(result.ok).toBe(true);
      // Error is logged for ops monitoring
      expect(logger.logger.error).toHaveBeenCalledWith(
        "telemetry_insert_failed",
        expect.objectContaining({
          kind: "event",
          error_message: "Database error",
        })
      );
    });

    it("should handle unexpected errors gracefully", async () => {
      (createServerClient as any).mockRejectedValue(
        new Error("Connection timeout")
      );

      const result = await logTelemetry("event", {});

      // Fire-and-forget: returns success despite error
      expect(result.ok).toBe(true);
      expect(logger.logger.error).toHaveBeenCalledWith(
        "telemetry_unexpected_error",
        expect.objectContaining({
          kind: "event",
          error_message: "Connection timeout",
        })
      );
    });
  });

  describe("Input validation", () => {
    it("should reject empty kind string", async () => {
      const result = await logTelemetry("", {});

      expect(result.ok).toBe(true); // Fire-and-forget still returns success
      expect(logger.logger.error).toHaveBeenCalled();
    });

    it("should accept any JSON-serializable payload", async () => {
      (createServerClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { club_id: "club-456" },
                error: null,
              }),
            }),
          }),
        }),
      });

      const payload = {
        nested: { data: [1, 2, 3] },
        boolean: true,
        nullValue: null,
      };

      await logTelemetry("complex_event", payload);

      expect(logger.logger.info).toHaveBeenCalled();
    });
  });

  describe("Context extraction", () => {
    it("should extract club_id from user profile", async () => {
      const mockInsertWithClubId = vi.fn().mockResolvedValue({ error: null });
      mockServiceRoleClient.from = vi.fn().mockReturnValue({ insert: mockInsertWithClubId });
      (getServiceRoleClient as any).mockReturnValue(mockServiceRoleClient);

      const expectedClubId = "club-789";

      (createServerClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-123" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { club_id: expectedClubId },
                error: null,
              }),
            }),
          }),
        }),
      });

      await logTelemetry("event", {});

      // Verify club_id was included in the insert call
      const insertCall = mockInsertWithClubId.mock.calls[0];
      expect(insertCall?.[0]).toMatchObject({
        club_id: expectedClubId,
      });
    });
  });
});
