import { describe, it, expect, beforeEach, vi } from "vitest";
import { auditedRead } from "./audited";
import * as authModule from "@/lib/supabase/server";
import * as serviceRoleModule from "@/lib/supabase/service-role";

// Mock console methods
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

// Helper to create mock clients
function createMockClients(
  insertError: { message: string } | null = null,
  profileError: { message: string } | null = null,
  profileData: { club_id: string } | null = { club_id: "test-club-id" }
) {
  const mockInsert = vi.fn().mockResolvedValue({
    data: null,
    error: insertError,
  });
  const mockSelectSingle = vi
    .fn()
    .mockResolvedValue({ data: profileData, error: profileError });
  const mockEq = vi.fn().mockReturnValue({ single: mockSelectSingle });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return { insert: mockInsert };
    }
    if (table === "profiles") {
      return { select: mockSelect };
    }
    return {};
  });

  return {
    mockInsert,
    mockSelectSingle,
    mockEq,
    mockSelect,
    mockFrom,
    serviceRoleClient: { from: mockFrom },
    serverClient: {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "test-user-id" } },
          error: null,
        }),
      },
      from: mockFrom,
    },
  };
}

describe("auditedRead()", () => {
  beforeEach(() => {
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  describe("AC #1: Correct audit log insertion", () => {
    it("3.3.1-3.3.3: inserts audit log with correct payload and returns data from fn()", async () => {
      const mocks = createMockClients();

      vi.spyOn(serviceRoleModule, "getServiceRoleClient").mockReturnValue(
        mocks.serviceRoleClient as any
      );

      vi.spyOn(authModule, "createServerClient").mockResolvedValue(
        mocks.serverClient as any
      );

      const testData = { id: "123", value: 42 };
      const result = await auditedRead(
        {
          targetKind: "fatigue_response",
          targetId: "player-uuid",
          action: "viewed_fatigue_response",
          payload: { session_id: "session-uuid" },
        },
        async () => testData
      );

      // Assert return value is from fn()
      expect(result).toEqual(testData);

      // Poll until fire-and-forget audit insert completes
      await vi.waitFor(() => {
        expect(mocks.mockInsert).toHaveBeenCalledWith({
          club_id: "test-club-id",
          actor_id: "test-user-id",
          action: "viewed_fatigue_response",
          target_kind: "fatigue_response",
          target_id: "player-uuid",
          payload: { session_id: "session-uuid" },
        });
      });
    });
  });

  describe("AC #2: Fire-and-forget on insert failure", () => {
    it("3.4.1-3.4.4: returns result even if audit insert fails silently", async () => {
      const mocks = createMockClients({
        message: "FK constraint failed",
      });

      vi.spyOn(serviceRoleModule, "getServiceRoleClient").mockReturnValue(
        mocks.serviceRoleClient as any
      );

      vi.spyOn(authModule, "createServerClient").mockResolvedValue(
        mocks.serverClient as any
      );

      const testData = { id: "456", value: 99 };

      const result = await auditedRead(
        {
          targetKind: "match_event",
          targetId: "event-uuid",
          action: "read_match_events",
        },
        async () => testData
      );

      // Result still returned even though insert failed
      expect(result).toEqual(testData);
    });

    it("3.4.5: emits structured JSON error log on failure", async () => {
      const mocks = createMockClients({ message: "Database error" });

      vi.spyOn(serviceRoleModule, "getServiceRoleClient").mockReturnValue(
        mocks.serviceRoleClient as any
      );

      vi.spyOn(authModule, "createServerClient").mockResolvedValue(
        mocks.serverClient as any
      );

      await auditedRead(
        {
          targetKind: "fatigue_response",
          targetId: "player-uuid",
          action: "viewed_fatigue_response",
        },
        async () => ({ data: "test" })
      );

      // Poll until fire-and-forget audit error log emits
      await vi.waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
      const errorCall = consoleErrorSpy.mock.calls[0]?.[0];
      if (errorCall && typeof errorCall === "string") {
        const parsed = JSON.parse(errorCall);
        expect(parsed).toMatchObject({
          level: "error",
          message: "audit_log insert failed",
          action: "viewed_fatigue_response",
          target_kind: "fatigue_response",
          context: "auditedRead wrapper",
        });
      }
    });
  });

  describe("AC #3: No logging when auth.uid() is null", () => {
    it("3.5.1-3.5.4: skips audit and returns result when no authenticated user", async () => {
      const mockServiceRoleClient = { from: vi.fn() };
      vi.spyOn(serviceRoleModule, "getServiceRoleClient").mockReturnValue(
        mockServiceRoleClient as any
      );

      vi.spyOn(authModule, "createServerClient").mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      } as any);

      const testData = { id: "789", value: 77 };
      const result = await auditedRead(
        {
          targetKind: "readiness_snapshot",
          targetId: "snapshot-uuid",
          action: "read_readiness",
        },
        async () => testData
      );

      // Poll until fire-and-forget audit check completes
      await vi.waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("No authenticated user - audit log skipped")
        );
      });

      // Result still returned
      expect(result).toEqual(testData);

      // audit_logs.insert() should NOT have been called
      expect(mockServiceRoleClient.from).not.toHaveBeenCalled();

    });
  });

  describe("AC #4-6: Multiple concurrent reads and payload serialization", () => {
    it("3.6.1-3.6.2: multiple concurrent reads accumulate separate audit rows", async () => {
      const mocks = createMockClients();

      vi.spyOn(serviceRoleModule, "getServiceRoleClient").mockReturnValue(
        mocks.serviceRoleClient as any
      );

      vi.spyOn(authModule, "createServerClient").mockResolvedValue(
        mocks.serverClient as any
      );

      const results = await Promise.all([
        auditedRead(
          {
            targetKind: "fatigue_response",
            targetId: "player-1",
            action: "read_fatigue_1",
          },
          async () => ({ data: 1 })
        ),
        auditedRead(
          {
            targetKind: "fatigue_response",
            targetId: "player-2",
            action: "read_fatigue_2",
          },
          async () => ({ data: 2 })
        ),
        auditedRead(
          {
            targetKind: "fatigue_response",
            targetId: "player-3",
            action: "read_fatigue_3",
          },
          async () => ({ data: 3 })
        ),
      ]);

      // All results returned
      expect(results).toEqual([{ data: 1 }, { data: 2 }, { data: 3 }]);

      // Poll until all 3 fire-and-forget audit inserts complete
      await vi.waitFor(() => {
        expect(mocks.mockInsert).toHaveBeenCalledTimes(3);
      });
    });

    it("3.7.1-3.7.2: payload field serializes JSON correctly", async () => {
      const mocks = createMockClients();

      vi.spyOn(serviceRoleModule, "getServiceRoleClient").mockReturnValue(
        mocks.serviceRoleClient as any
      );

      vi.spyOn(authModule, "createServerClient").mockResolvedValue(
        mocks.serverClient as any
      );

      const complexPayload = {
        session_id: "session-uuid",
        level: "info",
        nested: { count: 42 },
        array: [1, 2, 3],
      };

      await auditedRead(
        {
          targetKind: "session_metrics",
          targetId: "metric-uuid",
          action: "read_metrics",
          payload: complexPayload,
        },
        async () => ({ data: "test" })
      );

      // Poll until fire-and-forget audit insert completes
      await vi.waitFor(() => {
        expect(mocks.mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: complexPayload,
          })
        );
      });
    });
  });
});
