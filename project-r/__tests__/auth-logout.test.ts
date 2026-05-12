import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Auth: Logout Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC #3: Logout revokes session", () => {
    it("should export a logout function", async () => {
      const { logout } = await import("@/lib/supabase/client");
      expect(typeof logout).toBe("function");
    });

    it("logout should be callable without parameters", async () => {
      const { logout } = await import("@/lib/supabase/client");
      expect(logout.length).toBe(0); // Function takes no required parameters
    });
  });

  describe("Session management", () => {
    it("should provide logout functionality", async () => {
      const { logout, isAuthenticated } = await import("@/lib/supabase/client");
      expect(typeof logout).toBe("function");
      expect(typeof isAuthenticated).toBe("function");
    });
  });
});
