import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const mockSignOut = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
});

describe("Auth: Logout Flow", () => {
  beforeEach(() => {
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue({ error: null });
  });

  describe("AC #3: Logout revokes session", () => {
    it("calls signOut on the Supabase client", async () => {
      const { logout } = await import("@/lib/supabase/client");
      await logout();
      expect(mockSignOut).toHaveBeenCalledOnce();
    });

    it("propagates errors from signOut so LogoutButton can handle them", async () => {
      mockSignOut.mockRejectedValue(new Error("network failure"));
      const { logout } = await import("@/lib/supabase/client");
      await expect(logout()).rejects.toThrow("network failure");
    });
  });
});
