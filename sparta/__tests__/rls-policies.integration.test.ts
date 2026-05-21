/**
 * RLS Policies Integration Tests
 *
 * Validates that Row-Level Security policies correctly enforce:
 * - Club isolation (users can only access their club's data)
 * - Role-based access (only coach/analyst can create/modify players)
 * - Relationship constraints (positions belong to players, metrics belong to players)
 *
 * These tests prevent regression of the RLS policy migration from JWT custom claims
 * to direct database lookups (see docs/RLS_POLICY_FIX.md)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient, SupportedStorage } from "@supabase/supabase-js";

// In jsdom, all createClient() instances share the same localStorage origin.
// After signing in coach → analyst → player, the player's session overwrites all others,
// causing every client (including adminClient) to use the player's JWT.
// Fix: give each client its own isolated in-memory storage.
function makeMemoryStorage(): SupportedStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
}

// Test fixtures
const TEST_DATA = {
  club1: { name: "Test Club 1", country: "PT" },
  club2: { name: "Test Club 2", country: "ES" },
  coach_email: `coach-${Date.now()}@test.local`,
  analyst_email: `analyst-${Date.now()}@test.local`,
  player_email: `player-${Date.now()}@test.local`,
};

interface TestUsers {
  coach: { id: string; email: string; client: SupabaseClient };
  analyst: { id: string; email: string; client: SupabaseClient };
  player: { id: string; email: string; client: SupabaseClient };
}

interface TestClubs {
  club1: { id: string; name: string };
  club2: { id: string; name: string };
}

let adminClient: SupabaseClient;
let users: TestUsers;
let clubs: TestClubs;

describe("RLS Policies", () => {
  beforeAll(async () => {
    // Initialize admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase credentials");
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { storage: makeMemoryStorage(), persistSession: false, autoRefreshToken: false },
    });

    // Create test clubs
    const { data: clubData, error: clubError } = await adminClient
      .from("clubs")
      .insert([TEST_DATA.club1, TEST_DATA.club2])
      .select();

    if (clubError) throw clubError;
    if (!clubData || clubData.length < 2) throw new Error("Failed to create test clubs");

    clubs = {
      club1: { id: clubData[0].id, name: clubData[0].name },
      club2: { id: clubData[1].id, name: clubData[1].name },
    };

    // Create test auth users
    const coachSignup = await adminClient.auth.admin.createUser({
      email: TEST_DATA.coach_email,
      password: "TestPassword123!",
      email_confirm: true,
    });

    const analystSignup = await adminClient.auth.admin.createUser({
      email: TEST_DATA.analyst_email,
      password: "TestPassword123!",
      email_confirm: true,
    });

    const playerSignup = await adminClient.auth.admin.createUser({
      email: TEST_DATA.player_email,
      password: "TestPassword123!",
      email_confirm: true,
    });

    if (!coachSignup.data.user || !analystSignup.data.user || !playerSignup.data.user) {
      throw new Error("Failed to create test users");
    }

    // Create profiles
    const { error: profileError } = await adminClient.from("profiles").insert([
      {
        id: coachSignup.data.user.id,
        club_id: clubs.club1.id,
        role: "coach",
        full_name: "Test Coach",
      },
      {
        id: analystSignup.data.user.id,
        club_id: clubs.club1.id,
        role: "analyst",
        full_name: "Test Analyst",
      },
      {
        id: playerSignup.data.user.id,
        club_id: clubs.club1.id,
        role: "player",
        full_name: "Test Player",
      },
    ]);

    if (profileError) throw profileError;

    // Create authenticated clients — each with its own isolated storage so
    // sign-ins don't overwrite each other's session in the shared jsdom localStorage.
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    users = {
      coach: {
        id: coachSignup.data.user.id,
        email: TEST_DATA.coach_email,
        client: createClient(supabaseUrl, anonKey, {
          auth: { storage: makeMemoryStorage() },
        }),
      },
      analyst: {
        id: analystSignup.data.user.id,
        email: TEST_DATA.analyst_email,
        client: createClient(supabaseUrl, anonKey, {
          auth: { storage: makeMemoryStorage() },
        }),
      },
      player: {
        id: playerSignup.data.user.id,
        email: TEST_DATA.player_email,
        client: createClient(supabaseUrl, anonKey, {
          auth: { storage: makeMemoryStorage() },
        }),
      },
    };

    // Sign in each user
    for (const [role, user] of Object.entries(users)) {
      const { error } = await user.client.auth.signInWithPassword({
        email: user.email,
        password: "TestPassword123!",
      });
      if (error) throw new Error(`Failed to sign in ${role}: ${error.message}`);
    }
  });

  afterAll(async () => {
    // Cleanup: delete test data
    if (adminClient && clubs) {
      await adminClient.from("clubs").delete().eq("id", clubs.club1.id);
      await adminClient.from("clubs").delete().eq("id", clubs.club2.id);
    }

    // Delete auth users
    if (users) {
      for (const user of Object.values(users)) {
        await adminClient.auth.admin.deleteUser(user.id);
      }
    }
  });

  describe("Players table", () => {
    it("Coach can create player in own club", async () => {
      const { data, error } = await users.coach.client.from("players").insert({
        club_id: clubs.club1.id,
        full_name: "Test Player",
        birthdate: "2010-05-15",
        jersey_num: 10,
        age_group: "u14",
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it("Analyst can create player in own club", async () => {
      const { data, error } = await users.analyst.client.from("players").insert({
        club_id: clubs.club1.id,
        full_name: "Another Player",
        birthdate: "2011-03-20",
        jersey_num: 11,
        age_group: "u14",
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it("Player cannot create player (insufficient role)", async () => {
      const { error } = await users.player.client.from("players").insert({
        club_id: clubs.club1.id,
        full_name: "Unauthorized Player",
        birthdate: "2012-01-10",
        jersey_num: 20,
        age_group: "u14",
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("42501"); // RLS violation at DB level (direct profile lookup)
    });

    it("Coach cannot create player in other club", async () => {
      const { error } = await users.coach.client.from("players").insert({
        club_id: clubs.club2.id, // Different club
        full_name: "Cross-Club Player",
        birthdate: "2009-06-30",
        jersey_num: 5,
        age_group: "u15",
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("42501"); // RLS violation at DB level (direct profile lookup)
    });

    it("Coach can read players in own club", async () => {
      const { data, error } = await users.coach.client
        .from("players")
        .select("id")
        .eq("club_id", clubs.club1.id);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it("Coach cannot read players in other club", async () => {
      const { data, error } = await users.coach.client
        .from("players")
        .select("id")
        .eq("club_id", clubs.club2.id);

      // RLS filters rows, not queries — should return empty array, not error
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  });

  describe("Positions table", () => {
    let playerId: string;

    beforeAll(async () => {
      // Create a player for position tests
      const { data, error } = await adminClient
        .from("players")
        .insert({
          club_id: clubs.club1.id,
          full_name: "Position Test Player",
          birthdate: "2010-09-15",
          jersey_num: 15,
          age_group: "u14",
        })
        .select("id")
        .single();

      if (error || !data) throw error;
      playerId = data.id;
    });

    it("Coach can create position for player in own club", async () => {
      const { data, error } = await users.coach.client.from("positions").insert({
        player_id: playerId,
        position: "GK",
        is_primary: true,
        sort_order: 0,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it("Player cannot create position (insufficient role)", async () => {
      const { error } = await users.player.client.from("positions").insert({
        player_id: playerId,
        position: "FW",
        is_primary: false,
        sort_order: 1,
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("42501"); // RLS violation at DB level (direct profile lookup)
    });
  });

  describe("Player Metrics table", () => {
    let playerId: string;

    beforeAll(async () => {
      // Create a player for metrics tests
      const { data, error } = await adminClient
        .from("players")
        .insert({
          club_id: clubs.club1.id,
          full_name: "Metrics Test Player",
          birthdate: "2010-07-10",
          jersey_num: 25,
          age_group: "u14",
        })
        .select("id")
        .single();

      if (error || !data) throw error;
      playerId = data.id;
    });

    it("Coach can record metrics for player in own club", async () => {
      const { data, error } = await users.coach.client.from("player_metrics").insert({
        club_id: clubs.club1.id,
        player_id: playerId,
        weight_kg: 65.5,
        height_cm: 175,
        created_by: users.coach.id,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it("Analyst can record metrics for player in own club", async () => {
      const { data, error } = await users.analyst.client.from("player_metrics").insert({
        club_id: clubs.club1.id,
        player_id: playerId,
        weight_kg: 66.0,
        height_cm: 175,
        created_by: users.analyst.id,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it("Player cannot record metrics (insufficient role)", async () => {
      const { error } = await users.player.client.from("player_metrics").insert({
        club_id: clubs.club1.id,
        player_id: playerId,
        weight_kg: 60.0,
        height_cm: 170,
        created_by: users.player.id,
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("42501"); // RLS violation at DB level (direct profile lookup)
    });

    it("Coach cannot record metrics for other club", async () => {
      const { error } = await users.coach.client.from("player_metrics").insert({
        club_id: clubs.club2.id,
        player_id: playerId,
        weight_kg: 64.0,
        height_cm: 173,
        created_by: users.coach.id,
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("42501"); // RLS violation at DB level (direct profile lookup)
    });

    it("Coach can read metrics for players in own club", async () => {
      const { data, error } = await users.coach.client
        .from("player_metrics")
        .select("id")
        .eq("club_id", clubs.club1.id);

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("Club Isolation", () => {
    it("Coach from club1 cannot see players from club2", async () => {
      // Create player in club2 as admin
      await adminClient.from("players").insert({
        club_id: clubs.club2.id,
        full_name: "Club2 Player",
        birthdate: "2010-04-25",
        jersey_num: 7,
        age_group: "u14",
      });

      // Try to read as coach from club1
      const { data, error } = await users.coach.client
        .from("players")
        .select("id")
        .eq("club_id", clubs.club2.id);

      expect(error).toBeNull();
      expect(data).toEqual([]); // RLS filters rows silently
    });
  });
});
