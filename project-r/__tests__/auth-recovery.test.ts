import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const mockResetPasswordForEmail = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
});

describe("Auth: Password Recovery Flow", () => {
  beforeEach(() => {
    mockResetPasswordForEmail.mockReset();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  describe("AC #4: Password recovery request", () => {
    it("calls resetPasswordForEmail with the provided email", async () => {
      const { requestPasswordRecovery } = await import("@/lib/supabase/client");
      await requestPasswordRecovery("user@example.com");
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "user@example.com",
        expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password") })
      );
    });

    it("returns success: true even when Supabase returns an error (non-enumeration)", async () => {
      mockResetPasswordForEmail.mockResolvedValue({
        error: { message: "User not found" },
      });
      const { requestPasswordRecovery } = await import("@/lib/supabase/client");
      const result = await requestPasswordRecovery("unknown@example.com");
      expect(result.success).toBe(true);
    });

    it("returns success: true even when resetPasswordForEmail throws (non-enumeration)", async () => {
      mockResetPasswordForEmail.mockRejectedValue(new Error("network failure"));
      const { requestPasswordRecovery } = await import("@/lib/supabase/client");
      const result = await requestPasswordRecovery("user@example.com");
      expect(result.success).toBe(true);
    });
  });
});
