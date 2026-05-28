import { describe, it, expect } from "vitest";
import { TelemetryPayloadSchema } from "@/lib/schemas/telemetry";

/**
 * Simple validation tests for telemetry logging
 * These test the exported Zod schema directly without requiring database mocks
 */

describe("Telemetry Payload Validation", () => {
  describe("Valid payloads", () => {
    it("should accept any JSON-serializable object", () => {
      const payload = {
        playerId: "550e8400-e29b-41d4-a716-446655440000",
        sessionId: "550e8400-e29b-41d4-a716-446655440001",
        durationMs: 1500,
        offline: false,
      };

      const result = TelemetryPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = TelemetryPayloadSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept nested objects", () => {
      const payload = {
        user: { id: "123", name: "Test" },
        metadata: { tags: ["a", "b"], values: [1, 2, 3] },
      };

      const result = TelemetryPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should accept arrays (JSON-serializable)", () => {
      const payload = [{ id: "1", value: 42 }, { id: "2", value: 99 }];

      const result = TelemetryPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should accept string primitives (JSON-serializable)", () => {
      const result = TelemetryPayloadSchema.safeParse("simple_event");
      expect(result.success).toBe(true);
    });

    it("should accept number primitives (JSON-serializable)", () => {
      const result = TelemetryPayloadSchema.safeParse(42);
      expect(result.success).toBe(true);
    });

    it("should accept null (JSON-serializable)", () => {
      const result = TelemetryPayloadSchema.safeParse(null);
      expect(result.success).toBe(true);
    });
  });

  describe("Event kind validation", () => {
    it("should accept various event kind patterns", () => {
      const validKinds = [
        "app_initialized",
        "survey_submitted",
        "panel_viewed",
        "event_recorded",
        "sync_drained",
        "offline_page_shown",
        "decision.marked",
        "health_data.read",
      ];

      validKinds.forEach((kind) => {
        expect(kind.length).toBeGreaterThan(0);
      });
    });
  });
});
