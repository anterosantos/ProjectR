import { describe, it, expect, beforeEach, vi } from "vitest";
import { logTelemetry } from "@/lib/actions/telemetry";
import * as logger from "@/lib/logger";

// Mock the Supabase clients and logger
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
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
import { serviceRoleClient } from "@/lib/supabase/service-role";

describe("logTelemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Success path", () => {
    it("should insert valid telemetry event successfully", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

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

      (serviceRoleClient.from as any) = mockFrom;

      const result = await logTelemetry("survey_submitted", {
        playerId: "player-789",
        durationMs: 1500,
      });

      expect(result.ok).toBe(true);
      expect(result.data).toBeUndefined();
      expect(logger.logger.info).toHaveBeenCalledWith("telemetry_logged", {
        kind: "survey_submitted",
      });
    });

    it("should use service-role client to bypass RLS", async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

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

      (serviceRoleClient.from as any) = mockFrom;

      await logTelemetry("app_started", {});

      // Verify service-role client was used (not authenticated client)
      expect(mockFrom).toHaveBeenCalledWith("telemetry_events");
    });
  });

  describe("Failure handling (fire-and-forget)", () => {
    it("should log error but return success if insert fails", async () => {
      const mockInsert = vi.fn().mockResolvedValue({
        error: { message: "Database error", code: "DB_ERROR" },
      });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

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

      (serviceRoleClient.from as any) = mockFrom;

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
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

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

      (serviceRoleClient.from as any) = mockFrom;

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
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

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

      (serviceRoleClient.from as any) = mockFrom;

      await logTelemetry("event", {});

      // Verify club_id was included in the insert call
      const insertCall = mockInsert.mock.calls[0];
      expect(insertCall?.[0]).toMatchObject({
        club_id: expectedClubId,
      });
    });
  });
});
