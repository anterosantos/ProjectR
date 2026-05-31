import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isEditWindowOpen } from "@/lib/utils/match-events";

describe("isEditWindowOpen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna true quando agora < deadline (janela aberta)", () => {
    const scheduledAt = new Date("2026-05-31T10:00:00Z").toISOString();
    vi.setSystemTime(new Date("2026-05-31T22:00:00Z")); // 12h após início, dentro de 24h
    expect(isEditWindowOpen(scheduledAt, 90, 24)).toBe(true);
  });

  it("retorna false quando agora > deadline (janela encerrada)", () => {
    const scheduledAt = new Date("2026-05-30T10:00:00Z").toISOString();
    vi.setSystemTime(new Date("2026-05-31T22:00:00Z")); // 36h depois, fora de 24h
    expect(isEditWindowOpen(scheduledAt, 90, 24)).toBe(false);
  });

  it("retorna true exactamente no limite (now === deadline)", () => {
    const scheduledAt = new Date("2026-05-31T10:00:00Z").toISOString();
    // sessionEnd = 10:00 + 90min = 11:30; deadline = 11:30 + 24h = 2026-06-01T11:30Z
    const deadlineMs =
      new Date("2026-05-31T10:00:00Z").getTime() +
      90 * 60_000 +
      24 * 3_600_000;
    vi.setSystemTime(deadlineMs);
    expect(isEditWindowOpen(scheduledAt, 90, 24)).toBe(true);
  });

  it("sessionDurationMin=0: deadline = scheduledAt + windowHours", () => {
    const scheduledAt = new Date("2026-05-31T10:00:00Z").toISOString();
    vi.setSystemTime(new Date("2026-05-31T11:00:00Z")); // 1h depois, dentro de 24h
    expect(isEditWindowOpen(scheduledAt, 0, 24)).toBe(true);
  });

  it("windowHours=168 (7 dias): janela muito longa", () => {
    const scheduledAt = new Date("2026-05-24T10:00:00Z").toISOString();
    vi.setSystemTime(new Date("2026-05-31T10:00:00Z")); // exactamente 7 dias depois
    // sessionEnd = scheduledAt + 90min; deadline = sessionEnd + 168h
    expect(isEditWindowOpen(scheduledAt, 90, 168)).toBe(true);
  });

  it("windowHours=1: janela mínima, encerra rapidamente", () => {
    const scheduledAt = new Date("2026-05-31T10:00:00Z").toISOString();
    // sessionEnd = 10:00 + 90min = 11:30; deadline = 11:30 + 1h = 12:30
    vi.setSystemTime(new Date("2026-05-31T12:31:00Z")); // 1 minuto após deadline
    expect(isEditWindowOpen(scheduledAt, 90, 1)).toBe(false);
  });
});
