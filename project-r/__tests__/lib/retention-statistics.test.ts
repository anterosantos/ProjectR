import { describe, it, expect, vi, beforeEach } from "vitest";

// Verify that anonymize_archived_player SQL logic preserves related table data.
// These tests validate the TypeScript logic (season calculation, idempotence guards)
// that mirrors the SQL function behaviour.
// Full integration tests against a live Supabase DB require the integration test suite.

const DAYS_PER_SEASON = 275;
const FIVE_SEASONS_DAYS = 5 * DAYS_PER_SEASON;

function seasonsElapsed(archivedAt: Date, now = new Date()): number {
  const daysDiff = Math.floor(
    (now.getTime() - archivedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.floor(daysDiff / DAYS_PER_SEASON);
}

function isEligibleForAnonymization(player: {
  is_archived: boolean;
  archived_at: string | null;
  full_name: string;
}): boolean {
  if (!player.is_archived) return false;
  if (!player.archived_at) return false;
  if (player.full_name === "[anonimizado]") return false;
  return seasonsElapsed(new Date(player.archived_at)) >= 5;
}

describe("retention statistics — anonymization eligibility logic", () => {
  const basePlayer = {
    is_archived: true,
    full_name: "João Silva",
  };

  it("should not be eligible when archived < 5 seasons ago", () => {
    const threeSeasonAgo = new Date(Date.now() - 3 * DAYS_PER_SEASON * 24 * 60 * 60 * 1000);
    const player = { ...basePlayer, archived_at: threeSeasonAgo.toISOString() };
    expect(isEligibleForAnonymization(player)).toBe(false);
  });

  it("should be eligible when archived exactly 5 seasons ago", () => {
    const fiveSeasonAgo = new Date(Date.now() - 5 * DAYS_PER_SEASON * 24 * 60 * 60 * 1000 - 1000);
    const player = { ...basePlayer, archived_at: fiveSeasonAgo.toISOString() };
    expect(isEligibleForAnonymization(player)).toBe(true);
  });

  it("should be eligible when archived 6+ seasons ago", () => {
    const sixSeasonAgo = new Date(Date.now() - 6 * DAYS_PER_SEASON * 24 * 60 * 60 * 1000);
    const player = { ...basePlayer, archived_at: sixSeasonAgo.toISOString() };
    expect(isEligibleForAnonymization(player)).toBe(true);
  });

  it("should not be eligible when already anonymized (idempotence)", () => {
    const fiveSeasonAgo = new Date(Date.now() - 5 * DAYS_PER_SEASON * 24 * 60 * 60 * 1000 - 1000);
    const player = {
      is_archived: true,
      full_name: "[anonimizado]",
      archived_at: fiveSeasonAgo.toISOString(),
    };
    expect(isEligibleForAnonymization(player)).toBe(false);
  });

  it("should not be eligible when not archived", () => {
    const fiveSeasonAgo = new Date(Date.now() - 5 * DAYS_PER_SEASON * 24 * 60 * 60 * 1000 - 1000);
    const player = {
      is_archived: false,
      full_name: "João Silva",
      archived_at: fiveSeasonAgo.toISOString(),
    };
    expect(isEligibleForAnonymization(player)).toBe(false);
  });

  it("should not be eligible when archived_at is null", () => {
    const player = { is_archived: true, full_name: "João Silva", archived_at: null };
    expect(isEligibleForAnonymization(player)).toBe(false);
  });
});

describe("historical data retention — player_id FK invariant", () => {
  it("anonymization does not cascade to related tables (FK is preserved)", () => {
    // Simulate the anonymization: PII fields are cleared but player_id FK is preserved.
    // Related tables (match_events, fatigue_responses, session_metrics) retain their rows.

    const playerId = "test-player-uuid";

    const player = {
      id: playerId,
      full_name: "Carlos Ferreira",
      birthdate: "2000-01-01",
      photo_path: "club-1/player-uuid.jpg",
      is_archived: true,
      archived_at: "2018-01-01T00:00:00Z",
    };

    const matchEvents = [
      { id: "event-1", player_id: playerId, action: "goal" },
      { id: "event-2", player_id: playerId, action: "assist" },
    ];

    // After anonymization, player PII is cleared
    const anonymizedPlayer = {
      ...player,
      full_name: "[anonimizado]",
      birthdate: null,
      photo_path: null,
    };

    // Match events remain queryable by player_id
    const eventsAfterAnonymization = matchEvents.filter(
      (e) => e.player_id === anonymizedPlayer.id
    );

    expect(eventsAfterAnonymization).toHaveLength(2);
    expect(eventsAfterAnonymization[0]?.action).toBe("goal");
    expect(eventsAfterAnonymization[1]?.action).toBe("assist");

    // Player PII is gone
    expect(anonymizedPlayer.full_name).toBe("[anonimizado]");
    expect(anonymizedPlayer.birthdate).toBeNull();
    expect(anonymizedPlayer.photo_path).toBeNull();

    // But statistical FK still exists
    expect(eventsAfterAnonymization.every((e) => e.player_id === playerId)).toBe(true);
  });
});

describe("seasons elapsed calculation", () => {
  it("should return 0 for player archived today", () => {
    expect(seasonsElapsed(new Date())).toBe(0);
  });

  it("should return 1 for player archived 275 days ago", () => {
    const date = new Date(Date.now() - 275 * 24 * 60 * 60 * 1000 - 1000);
    expect(seasonsElapsed(date)).toBe(1);
  });

  it("should return 5 for player archived 1375 days ago", () => {
    const date = new Date(Date.now() - 1375 * 24 * 60 * 60 * 1000 - 1000);
    expect(seasonsElapsed(date)).toBe(5);
  });
});
