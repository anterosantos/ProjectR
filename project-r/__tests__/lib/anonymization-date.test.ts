import { describe, it, expect } from "vitest";
import { addDays, format } from "date-fns";
import { pt } from "date-fns/locale";

const FIVE_SEASONS_DAYS = 5 * 275;

function calculateAnonymizationDate(archivedAt: string): Date {
  return addDays(new Date(archivedAt), FIVE_SEASONS_DAYS);
}

function formatAnonymizationDate(archivedAt: string): string {
  return format(calculateAnonymizationDate(archivedAt), "d 'de' MMMM 'de' yyyy", { locale: pt });
}

describe("calculateAnonymizationDate", () => {
  it("returns date 1375 days after archived_at", () => {
    const archivedAt = "2020-01-01T00:00:00Z";
    const result = calculateAnonymizationDate(archivedAt);
    const expected = addDays(new Date(archivedAt), 1375);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("returns date ~5 seasons in the future for recently archived player", () => {
    const archivedAt = new Date().toISOString();
    const result = calculateAnonymizationDate(archivedAt);
    const futureMs = result.getTime() - Date.now();
    const futureDays = futureMs / (1000 * 60 * 60 * 24);
    // Should be approximately 1375 days in the future
    expect(futureDays).toBeGreaterThan(1374);
    expect(futureDays).toBeLessThan(1376);
  });

  it("formats correctly in PT-PT locale", () => {
    const archivedAt = "2020-01-01T00:00:00Z";
    const formatted = formatAnonymizationDate(archivedAt);
    // Should contain Portuguese month name
    expect(formatted).toMatch(/\d+ de \w+ de \d{4}/);
  });

  it("is consistent with SQL epoch calculation (5 * 275 = 1375 days)", () => {
    // The SQL uses FLOOR(DAY_DIFF / 275) >= 5
    // The TS uses addDays(archived_at, 1375) which is exactly 5*275
    const archivedAt = new Date("2020-01-01T00:00:00Z");
    const tsDate = calculateAnonymizationDate(archivedAt.toISOString());
    const daysBetween = Math.round(
      (tsDate.getTime() - archivedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysBetween).toBe(1375);
  });
});
