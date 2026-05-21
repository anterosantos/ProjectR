import { describe, it, expect } from "vitest";
import { AuditLogInputSchema } from "@/lib/schemas/audit";

/**
 * Simple validation tests for audit logging
 * These test the exported Zod schema directly without requiring database mocks
 */

describe("Audit Log Input Validation", () => {
  describe("Valid inputs", () => {
    it("should accept valid action and targetKind", () => {
      const result = AuditLogInputSchema.safeParse({
        action: "health_data.read",
        targetKind: "fatigue_response",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.action).toBe("health_data.read");
        expect(result.data.targetKind).toBe("fatigue_response");
      }
    });

    it("should accept optional targetId as UUID", () => {
      const result = AuditLogInputSchema.safeParse({
        action: "decision.marked",
        targetKind: "readiness_snapshot",
        targetId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.targetId).toBe("550e8400-e29b-41d4-a716-446655440000");
      }
    });

    it("should accept optional context object", () => {
      const result = AuditLogInputSchema.safeParse({
        action: "export.requested",
        targetKind: "player_data",
        context: { format: "csv", year: 2026 },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.context).toEqual({ format: "csv", year: 2026 });
      }
    });

    it("should accept null targetId", () => {
      const result = AuditLogInputSchema.safeParse({
        action: "panel.viewed",
        targetKind: "dashboard",
        targetId: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.targetId).toBeNull();
      }
    });
  });

  describe("Invalid inputs", () => {
    it("should reject empty action", () => {
      const result = AuditLogInputSchema.safeParse({
        action: "",
        targetKind: "test",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("action");
      }
    });

    it("should reject empty targetKind", () => {
      const result = AuditLogInputSchema.safeParse({
        action: "test.action",
        targetKind: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("targetKind");
      }
    });

    it("should reject action without dot (not domain.verb format)", () => {
      const result = AuditLogInputSchema.safeParse({
        action: "healthdataread",
        targetKind: "test_data",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("action");
      }
    });

    it("should reject invalid UUID targetId", () => {
      const result = AuditLogInputSchema.safeParse({
        action: "test.action",
        targetKind: "test_data",
        targetId: "not-a-uuid",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain("targetId");
      }
    });

    it("should reject missing action", () => {
      const result = AuditLogInputSchema.safeParse({
        targetKind: "test",
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing targetKind", () => {
      const result = AuditLogInputSchema.safeParse({
        action: "test.action",
      });

      expect(result.success).toBe(false);
    });
  });
});
