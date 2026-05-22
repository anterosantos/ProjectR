import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";

// Mock updateSession
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";

const mockUpdateSession = updateSession as any;

// Helper: supabase mock — default 'confirmed' bypasses the consent gate in player route tests
function makeSupabaseMock(consentStatus = "granted") {
  const playerChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  };
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { consent_status: consentStatus } }),
  };
  return {
    from: vi.fn((table: string) => (table === "players" ? playerChain : profileChain)),
  };
}

describe("Middleware: Authentication and Route Access", () => {
  beforeEach(() => {
    mockUpdateSession.mockClear();
  });

  describe("Unauthenticated Users", () => {
    it("should redirect unauthenticated users to /login", async () => {
      mockUpdateSession.mockResolvedValue({
        user: null,
        claims: {},
        response: NextResponse.next(),
      });

      const request = new NextRequest(new URL("http://localhost:3000/sessoes"));
      const response = await proxy(request);

      expect(response?.status).toBe(307);
      expect(response?.headers.get("location")).toContain("/login");
    });

    it("should preserve returnTo parameter when redirecting", async () => {
      mockUpdateSession.mockResolvedValue({
        user: null,
        claims: {},
        response: NextResponse.next(),
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/plantel/123")
      );
      const response = await proxy(request);

      expect(response?.headers.get("location")).toContain("returnTo=");
      expect(response?.headers.get("location")).toContain("%2Fplantel%2F123");
    });
  });

  describe("Authenticated Users Without JWT Claims", () => {
    it("should allow access to any route if user is authenticated but has no user_role claim", async () => {
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "test@test.test" },
        claims: {}, // No user_role claim
        response: NextResponse.next(),
      });

      const request = new NextRequest(new URL("http://localhost:3000/sessoes"));
      const response = await proxy(request);

      // Should not redirect, just pass through
      expect(response?.status).not.toBe(307);
    });

    it("should allow access to /configuracoes without user_role claim", async () => {
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "test@test.test" },
        claims: {}, // No user_role claim
        response: NextResponse.next(),
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/configuracoes")
      );
      const response = await proxy(request);

      expect(response?.status).not.toBe(307);
    });
  });

  describe("Authenticated Users With JWT Claims", () => {
    it("analyst should access /sessoes with user_role claim", async () => {
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "analyst@test.test" },
        claims: { user_role: "analyst" },
        response: NextResponse.next(),
      });

      const request = new NextRequest(new URL("http://localhost:3000/sessoes"));
      const response = await proxy(request);

      expect(response?.status).not.toBe(307);
    });

    it("analyst should NOT access /prontidao (coach route)", async () => {
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "analyst@test.test" },
        claims: { user_role: "analyst" },
        response: NextResponse.next(),
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/prontidao")
      );
      const response = await proxy(request);

      expect(response?.status).toBe(307);
      expect(response?.headers.get("location")).toContain("/sessoes");
    });

    it("coach should access /prontidao with user_role claim", async () => {
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "coach@test.test" },
        claims: { user_role: "coach" },
        response: NextResponse.next(),
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/prontidao")
      );
      const response = await proxy(request);

      expect(response?.status).not.toBe(307);
    });

    it("player should access /hoje with user_role claim", async () => {
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "player@test.test" },
        claims: { user_role: "player" },
        response: NextResponse.next(),
        supabase: makeSupabaseMock("granted"),
      });

      const request = new NextRequest(new URL("http://localhost:3000/hoje"));
      const response = await proxy(request);

      expect(response?.status).not.toBe(307);
    });

    it("should redirect to default role route if accessing unauthorized route", async () => {
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "player@test.test" },
        claims: { user_role: "player" },
        response: NextResponse.next(),
        supabase: makeSupabaseMock("granted"),
      });

      // Player trying to access coach route
      const request = new NextRequest(
        new URL("http://localhost:3000/prontidao")
      );
      const response = await proxy(request);

      expect(response?.status).toBe(307);
      expect(response?.headers.get("location")).toContain("/hoje");
    });
  });

  describe("Public Routes", () => {
    it("should allow access to /login without authentication", async () => {
      // updateSession should not be called for public routes
      const request = new NextRequest(new URL("http://localhost:3000/login"));
      const response = await proxy(request);

      expect(mockUpdateSession).not.toHaveBeenCalled();
    });

    it("should allow access to /recuperar-password without authentication", async () => {
      const request = new NextRequest(
        new URL("http://localhost:3000/recuperar-password")
      );
      const response = await proxy(request);

      expect(mockUpdateSession).not.toHaveBeenCalled();
    });

    it("should allow access to /consentimento routes without authentication", async () => {
      const request = new NextRequest(
        new URL("http://localhost:3000/consentimento/gdpr")
      );
      const response = await proxy(request);

      expect(mockUpdateSession).not.toHaveBeenCalled();
    });
  });

  describe("Regression Tests for Known Issues", () => {
    it("should allow authenticated user to navigate to /sessoes even without user_role claim (regression: issue #1)", async () => {
      // This is the specific issue that was blocking login
      mockUpdateSession.mockResolvedValue({
        user: {
          id: "2526a882-6ee6-48d5-8310-b00e6265231e",
          email: "testanalyst@test.test",
        },
        claims: {}, // Auth Hook not configured, no user_role claim
        response: NextResponse.next(),
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/sessoes")
      );
      const response = await proxy(request);

      // Should NOT redirect back to login
      expect(response?.status).not.toBe(307);
    });

    it("should allow navigation after successful password auth without JWT claims", async () => {
      // Simulates the flow: login → API returns role → router.push() → middleware check
      mockUpdateSession.mockResolvedValue({
        user: {
          id: "2526a882-6ee6-48d5-8310-b00e6265231e",
          email: "testanalyst@test.test",
        },
        claims: {
          sub: "2526a882-6ee6-48d5-8310-b00e6265231e",
          email: "testanalyst@test.test",
          // No user_role claim - simulating Auth Hook failure
        },
        response: NextResponse.next(),
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/sessoes")
      );
      const response = await proxy(request);

      // Page should load, then fetch /api/auth/user-role for role info
      expect(response?.status).not.toBe(307);
    });
  });
});
