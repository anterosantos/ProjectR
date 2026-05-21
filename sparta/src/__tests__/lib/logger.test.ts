import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger } from "@/lib/logger";

describe("logger", () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("logger.info", () => {
    it("should emit valid JSON to stdout with info level", () => {
      logger.info("test_event", { userId: "123", action: "test" });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0]?.[0];
      expect(output).toBeDefined();

      const parsed = JSON.parse(output as string);
      expect(parsed).toMatchObject({
        level: "info",
        message: "test_event",
        context: { userId: "123", action: "test" },
      });
      expect(parsed.timestamp).toBeDefined();
      expect(new Date(parsed.timestamp as string).getTime()).toBeLessThanOrEqual(
        Date.now()
      );
    });

    it("should handle empty context", () => {
      logger.info("event", {});

      const output = consoleSpy.log.mock.calls[0]?.[0];
      const parsed = JSON.parse(output as string);
      expect(parsed.context).toEqual({});
    });

    it("should preserve context data types", () => {
      logger.info("event", {
        count: 42,
        enabled: true,
        value: null,
        items: [1, 2, 3],
      });

      const output = consoleSpy.log.mock.calls[0]?.[0];
      const parsed = JSON.parse(output as string);
      expect(parsed.context).toEqual({
        count: 42,
        enabled: true,
        value: null,
        items: [1, 2, 3],
      });
    });

    it("should format ISO 8601 timestamp", () => {
      logger.info("event", {});

      const output = consoleSpy.log.mock.calls[0]?.[0];
      const parsed = JSON.parse(output as string);
      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      expect(parsed.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe("logger.warn", () => {
    it("should emit valid JSON to stdout (console.log) with warn level", () => {
      logger.warn("degraded_state", { reason: "timeout" });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0]?.[0];
      const parsed = JSON.parse(output as string);
      expect(parsed).toMatchObject({
        level: "warn",
        message: "degraded_state",
        context: { reason: "timeout" },
      });
    });
  });

  describe("logger.error", () => {
    it("should emit valid JSON to stdout (console.log) with error level", () => {
      logger.error("operation_failed", { error_message: "DB connection lost" });

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const output = consoleSpy.log.mock.calls[0]?.[0];
      const parsed = JSON.parse(output as string);
      expect(parsed).toMatchObject({
        level: "error",
        message: "operation_failed",
        context: { error_message: "DB connection lost" },
      });
    });
  });

  describe("PII safety", () => {
    it("should allow UUIDs in context (no PII restriction)", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      logger.info("user_action", { userId: uuid });

      const output = consoleSpy.log.mock.calls?.[0]?.[0];
      const parsed = JSON.parse(output as string);
      expect(parsed.context.userId).toBe(uuid);
    });

    it("should not filter allowed context fields", () => {
      logger.info("event", {
        actor_id: "uuid",
        action: "read",
        target_kind: "data",
        count: 10,
        error_message: "timeout",
      });

      const output = consoleSpy.log.mock.calls[0]?.[0];
      const parsed = JSON.parse(output as string);
      expect(parsed.context).toEqual({
        actor_id: "uuid",
        action: "read",
        target_kind: "data",
        count: 10,
        error_message: "timeout",
      });
    });
  });
});
