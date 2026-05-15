import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
});

describe("Auth: Protected Routes", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  describe("AC #6: isAuthenticated reflects session state", () => {
    it("returns false when no session exists", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      const { isAuthenticated } = await import("@/lib/supabase/client");
      expect(await isAuthenticated()).toBe(false);
    });

    it("returns true when a valid session exists", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: { id: "u1" }, access_token: "tok" } },
      });
      const { isAuthenticated } = await import("@/lib/supabase/client");
      expect(await isAuthenticated()).toBe(true);
    });

    it("returns false when getSession throws (network error)", async () => {
      mockGetSession.mockRejectedValue(new Error("offline"));
      const { isAuthenticated } = await import("@/lib/supabase/client");
      expect(await isAuthenticated()).toBe(false);
    });
  });

  describe("getSession", () => {
    it("returns the session object when authenticated", async () => {
      const fakeSession = { user: { id: "u1" }, access_token: "tok" };
      mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
      const { getSession } = await import("@/lib/supabase/client");
      expect(await getSession()).toEqual(fakeSession);
    });

    it("returns null when no session", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });
      const { getSession } = await import("@/lib/supabase/client");
      expect(await getSession()).toBeNull();
    });
  });
});
