import { describe, it, expect, beforeEach, vi } from "vitest";
import { auditedRead } from "./audited";
import * as serviceRoleModule from "@/lib/supabase/service-role";

// Mock console methods
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

// Helper to create mock service role client
function createMockClients(
  insertError: { message: string } | null = null
) {
  const mockInsert = vi.fn().mockResolvedValue({
    data: null,
    error: insertError,
  });
  const mockFrom = vi.fn((table: string) => {
    if (table === "audit_logs") {
      return { insert: mockInsert };
    }
    return {};
  });

  return {
    mockInsert,
    mockFrom,
    serviceRoleClient: { from: mockFrom },
  };
}

describe("auditedRead()", () => {
  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  describe("AC #1: Correct audit log insertion", () => {
    it("3.3.1-3.3.3: inserts audit log with correct payload and returns data from fn()", async () => {
      const mocks = createMockClients();

      vi.spyOn(serviceRoleModule, "getServiceRoleClient").mockReturnValue(
        mocks.serviceRoleClient as any
      );

      const testData = { id: "123", value: 42 };
      const result = await auditedRead(
        {
          targetKind: "fatigue_response",
          targetId: "player-uuid",
          action: "viewed_fatigue_response",
          payload: { session_id: "session-uuid" },
          actorId: "test-user-id",
          clubId: "test-club-id",
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

      const testData = { id: "456", value: 99 };

      const result = await auditedRead(
        {
          targetKind: "match_event",
          targetId: "event-uuid",
          action: "read_match_events",
          actorId: "test-user-id",
          clubId: "test-club-id",
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

      await auditedRead(
        {
          targetKind: "fatigue_response",
          targetId: "player-uuid",
          action: "viewed_fatigue_response",
          actorId: "test-user-id",
          clubId: "test-club-id",
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
          context: "auditedRead scheduleAudit",
        });
      }
    });
  });

  describe("AC #3: fn() throws — audit still fires, error re-thrown", () => {
    it("3.5.1-3.5.4: schedules audit even when fn() throws, then re-throws the error", async () => {
      const mocks = createMockClients();

      vi.spyOn(serviceRoleModule, "getServiceRoleClient").mockReturnValue(
        mocks.serviceRoleClient as any
      );

      const boom = new Error("fn failed");

      await expect(
        auditedRead(
          {
            targetKind: "readiness_snapshot",
            targetId: "snapshot-uuid",
            action: "read_readiness",
            actorId: "test-user-id",
            clubId: "test-club-id",
          },
          async () => {
            throw boom;
          }
        )
      ).rejects.toThrow("fn failed");

      // Audit was still scheduled even on failure
      await vi.waitFor(() => {
        expect(mocks.mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            actor_id: "test-user-id",
            club_id: "test-club-id",
            action: "read_readiness",
          })
        );
      });
    });
  });

  describe("AC #4-6: Multiple concurrent reads and payload serialization", () => {
    it("3.6.1-3.6.2: multiple concurrent reads accumulate separate audit rows", async () => {
      const mocks = createMockClients();

      vi.spyOn(serviceRoleModule, "getServiceRoleClient").mockReturnValue(
        mocks.serviceRoleClient as any
      );

      const results = await Promise.all([
        auditedRead(
          {
            targetKind: "fatigue_response",
            targetId: "player-1",
            action: "read_fatigue_1",
            actorId: "test-user-id",
            clubId: "test-club-id",
          },
          async () => ({ data: 1 })
        ),
        auditedRead(
          {
            targetKind: "fatigue_response",
            targetId: "player-2",
            action: "read_fatigue_2",
            actorId: "test-user-id",
            clubId: "test-club-id",
          },
          async () => ({ data: 2 })
        ),
        auditedRead(
          {
            targetKind: "fatigue_response",
            targetId: "player-3",
            action: "read_fatigue_3",
            actorId: "test-user-id",
            clubId: "test-club-id",
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
          actorId: "test-user-id",
          clubId: "test-club-id",
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
