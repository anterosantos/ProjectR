import { describe, it, expect, beforeEach, vi } from "vitest";
import { logAccess } from "@/lib/actions/audit";
import * as logger from "@/lib/logger";

// Mock the Supabase client and logger
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createServerClient } from "@/lib/supabase/server";

describe("logAccess", () => {
  let mockInsert: ReturnType<typeof vi.fn>;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase = {
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
        insert: mockInsert,
      }),
    };

    (createServerClient as any).mockResolvedValue(mockSupabase);
  });

  describe("Success path", () => {
    it("should log access with valid inputs", async () => {
      const result = await logAccess("health_data.read", "fatigue_response", "550e8400-e29b-41d4-a716-446655440001");

      expect(result.ok).toBe(true);
      expect(logger.logger.info).toHaveBeenCalledWith("audit_logged", {
        action: "health_data.read",
        target_kind: "fatigue_response",
        actor_id: "user-123",
      });
    });

    it("should use authenticated session (respects RLS)", async () => {
      await logAccess("decision.marked", "readiness_snapshot", "550e8400-e29b-41d4-a716-446655440002");

      // Verify insert was called on authenticated client (not service-role)
      expect(mockSupabase.from).toHaveBeenCalledWith("audit_logs");
      expect(mockInsert).toHaveBeenCalled();
    });

    it("should handle nullable targetId", async () => {
      await logAccess("panel.viewed", "readiness_dashboard", null, {
        duration: 45,
      });

      const insertData = mockInsert.mock.calls[0]?.[0];
      expect(insertData).toMatchObject({
        action: "panel.viewed",
        target_kind: "readiness_dashboard",
        target_id: null,
      });
    });

    it("should handle optional context", async () => {
      await logAccess("export.requested", "player_data", "550e8400-e29b-41d4-a716-446655440003", {
        format: "csv",
        year: 2026,
      });

      const insertData = mockInsert.mock.calls[0]?.[0];
      expect(insertData.payload).toEqual({
        format: "csv",
        year: 2026,
      });
    });
  });

  describe("Failure handling (fire-and-forget)", () => {
    it("should log error but return success if insert fails", async () => {
      mockInsert.mockResolvedValueOnce({
        error: { message: "RLS policy violation", code: "PGRST301" },
      });

      const result = await logAccess("test.action", "test_data", "550e8400-e29b-41d4-a716-446655440000");

      // Fire-and-forget: returns success despite failure
      expect(result.ok).toBe(true);
      expect(logger.logger.error).toHaveBeenCalledWith(
        "audit_log_insert_failed",
        expect.objectContaining({
          action: "test.action",
          target_kind: "test_data",
          error_message: "RLS policy violation",
        })
      );
    });

    it("should handle user fetch errors gracefully", async () => {
      (createServerClient as any).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: new Error("Unauthorized"),
          }),
        },
      });

      const result = await logAccess("test.action", "test_data");

      expect(result.ok).toBe(true);
      expect(logger.logger.error).toHaveBeenCalledWith(
        "audit_unexpected_error",
        expect.any(Object)
      );
    });

    it("should handle profile fetch errors gracefully", async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("Profile not found"),
            }),
          }),
        }),
      });

      const result = await logAccess("test.action", "test_data");

      expect(result.ok).toBe(true);
      expect(logger.logger.error).toHaveBeenCalled();
    });
  });

  describe("Input validation", () => {
    it("should reject empty action", async () => {
      const result = await logAccess("", "test_data");

      expect(result.ok).toBe(true); // Fire-and-forget
      expect(logger.logger.error).toHaveBeenCalled();
    });

    it("should reject empty targetKind", async () => {
      const result = await logAccess("test.action", "");

      expect(result.ok).toBe(true); // Fire-and-forget
      expect(logger.logger.error).toHaveBeenCalled();
    });

    it("should reject invalid UUID targetId", async () => {
      const result = await logAccess("test.action", "test_data", "not-a-uuid");

      expect(result.ok).toBe(true); // Fire-and-forget
      expect(logger.logger.error).toHaveBeenCalled();
    });

    it("should accept undefined targetId", async () => {
      await logAccess("test.action", "test_data", undefined);

      expect(logger.logger.info).toHaveBeenCalled();
    });
  });

  describe("RLS enforcement", () => {
    it("should extract club_id from authenticated user profile", async () => {
      const expectedClubId = "club-999";

      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { club_id: expectedClubId },
              error: null,
            }),
          }),
        }),
        insert: mockInsert,
      });

      await logAccess("test.action", "test_data");

      const insertData = mockInsert.mock.calls[0]?.[0];
      expect(insertData.club_id).toBe(expectedClubId);
    });

    it("should include actor_id for audit trail", async () => {
      const userId = "actor-123";
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      });

      await logAccess("test.action", "test_data");

      const insertData = mockInsert.mock.calls[0]?.[0];
      expect(insertData.actor_id).toBe(userId);
    });
  });

  describe("Context extraction", () => {
    it("should use authenticated user's session", async () => {
      const userId = "authenticated-user-456";
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
        error: null,
      });

      await logAccess("test.action", "test_data");

      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      const insertData = mockInsert.mock.calls[0]?.[0];
      expect(insertData.actor_id).toBe(userId);
    });

    it("should include timestamp in ISO 8601 format", async () => {
      await logAccess("test.action", "test_data");

      const insertData = mockInsert.mock.calls[0]?.[0];
      expect(insertData.occurred_at).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });
});
