import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
});

describe("Auth: Password Reset Flow", () => {
  beforeEach(() => {
    mockUpdateUser.mockReset();
    mockSignOut.mockReset();
    mockUpdateUser.mockResolvedValue({ error: null, data: { user: { id: "u1" } } });
    mockSignOut.mockResolvedValue({ error: null });
  });

  describe("AC #5: Password reset updates the password", () => {
    it("calls updateUser with the new password", async () => {
      const { updatePassword } = await import("@/lib/supabase/client");
      await updatePassword("newpassword123");
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "newpassword123" });
    });

    it("returns success: true when both updateUser and signOut succeed", async () => {
      const { updatePassword } = await import("@/lib/supabase/client");
      const result = await updatePassword("newpassword123");
      expect(result.success).toBe(true);
    });

    it("returns success: false when updateUser fails", async () => {
      mockUpdateUser.mockResolvedValue({ error: { message: "weak password" }, data: null });
      const { updatePassword } = await import("@/lib/supabase/client");
      const result = await updatePassword("weak");
      expect(result.success).toBe(false);
    });
  });

  describe("Session invalidation (NFR18)", () => {
    it("calls signOut with scope global to invalidate all sessions", async () => {
      const { updatePassword } = await import("@/lib/supabase/client");
      await updatePassword("newpassword123");
      expect(mockSignOut).toHaveBeenCalledWith({ scope: "global" });
    });

    it("returns success: false when signOut fails — NFR18 unmet", async () => {
      mockSignOut.mockResolvedValue({ error: { message: "signout failed" } });
      const { updatePassword } = await import("@/lib/supabase/client");
      const result = await updatePassword("newpassword123");
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("invalidar");
    });
  });
});
