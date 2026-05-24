import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";

// Mock updateSession
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const mockUpdateSession = updateSession as any;
const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;

// Helper: service role mock for the consent gate
// role="player" + consentStatus="granted" bypasses the gate (consent confirmed)
// role="player" + consentStatus="not_required" with no birthdate would block minors
function makeServiceRoleMock(consentStatus = "granted", role = "player") {
  const playerChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }), // no birthdate → treated as adult (null → isNowAdult=false)
  };
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { role, consent_status: consentStatus } }),
  };
  return {
    from: vi.fn((table: string) => (table === "players" ? playerChain : profileChain)),
  };
}

describe("Middleware: Authentication and Route Access", () => {
  beforeEach(() => {
    mockUpdateSession.mockClear();
    mockGetServiceRoleClient.mockClear();
    // Default: analyst profile — bypasses consent gate for non-player tests
    mockGetServiceRoleClient.mockReturnValue(makeServiceRoleMock("not_required", "analyst"));
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
      mockGetServiceRoleClient.mockReturnValue(makeServiceRoleMock("granted", "player"));
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "player@test.test" },
        claims: { user_role: "player" },
        response: NextResponse.next(),
      });

      const request = new NextRequest(new URL("http://localhost:3000/hoje"));
      const response = await proxy(request);

      expect(response?.status).not.toBe(307);
    });

    it("should return 404 (not redirect) when player accesses staff-only /prontidao (AC #1 — dados mediados)", async () => {
      mockGetServiceRoleClient.mockReturnValue(makeServiceRoleMock("granted", "player"));
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "player@test.test" },
        claims: { user_role: "player" },
        response: NextResponse.next(),
      });

      // Player trying to access staff-only route → 404 (not redirect), avoids resource enumeration
      const request = new NextRequest(
        new URL("http://localhost:3000/prontidao")
      );
      const response = await proxy(request);

      expect(response?.status).toBe(404);
      // Must NOT redirect (no location header leaking the default route)
      expect(response?.headers.get("location")).toBeNull();
    });

    it("player accessing /questionario/[sessionId]/phase should be allowed (AC #5 — backward compat)", async () => {
      mockGetServiceRoleClient.mockReturnValue(makeServiceRoleMock("granted", "player"));
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "player@test.test" },
        claims: { user_role: "player" },
        response: NextResponse.next(),
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/questionario/session-abc/pre")
      );
      const response = await proxy(request);

      expect(response?.status).not.toBe(307);
      expect(response?.status).not.toBe(404);
    });
  });

  describe("Dados Mediados Block — Staff-Only Routes Return 404 for Players (Story 4.6, AC #1)", () => {
    const staffOnlyRoutes = [
      "/prontidao",
      "/tendencias",
      "/relatorios",
      "/plantel",
      "/plantel/player-uuid-123",
      "/plantel/player-uuid-123/fadiga",
      "/relatorios/report-id-456",
    ];

    for (const route of staffOnlyRoutes) {
      it(`player accessing ${route} gets 404 (not redirect)`, async () => {
        mockGetServiceRoleClient.mockReturnValue(makeServiceRoleMock("granted", "player"));
        mockUpdateSession.mockResolvedValue({
          user: { id: "user-123", email: "player@test.test" },
          claims: { user_role: "player" },
          response: NextResponse.next(),
        });

        const request = new NextRequest(new URL(`http://localhost:3000${route}`));
        const response = await proxy(request);

        expect(response?.status).toBe(404);
        expect(response?.headers.get("location")).toBeNull();
      });
    }

    it("coach can access /plantel normally (staff route not blocked for coach)", async () => {
      mockGetServiceRoleClient.mockReturnValue(makeServiceRoleMock("not_required", "coach"));
      mockUpdateSession.mockResolvedValue({
        user: { id: "coach-123", email: "coach@test.test" },
        claims: { user_role: "coach" },
        response: NextResponse.next(),
      });

      const request = new NextRequest(new URL("http://localhost:3000/plantel"));
      const response = await proxy(request);

      expect(response?.status).not.toBe(404);
      expect(response?.status).not.toBe(307);
    });

    it("analyst can access /tendencias normally (staff route not blocked for analyst)", async () => {
      mockGetServiceRoleClient.mockReturnValue(makeServiceRoleMock("not_required", "analyst"));
      mockUpdateSession.mockResolvedValue({
        user: { id: "analyst-123", email: "analyst@test.test" },
        claims: { user_role: "analyst" },
        response: NextResponse.next(),
      });

      const request = new NextRequest(new URL("http://localhost:3000/tendencias"));
      const response = await proxy(request);

      expect(response?.status).not.toBe(404);
      expect(response?.status).not.toBe(307);
    });

    it("coach can access /plantel/id/fadiga (staff fatigue view not blocked for coach)", async () => {
      mockGetServiceRoleClient.mockReturnValue(makeServiceRoleMock("not_required", "coach"));
      mockUpdateSession.mockResolvedValue({
        user: { id: "coach-123", email: "coach@test.test" },
        claims: { user_role: "coach" },
        response: NextResponse.next(),
      });

      const request = new NextRequest(
        new URL("http://localhost:3000/plantel/player-uuid/fadiga")
      );
      const response = await proxy(request);

      expect(response?.status).not.toBe(404);
    });

    it("player without JWT claims (no user_role) does NOT get 404 from dados-mediados block (falls through to RLS)", async () => {
      // When user_role is absent in JWT, the dados-mediados check doesn't fire because
      // the guard is `userRole && userRole !== "coach" && userRole !== "analyst"`.
      // The leading `userRole &&` short-circuits to false when the claim is missing,
      // so users with no JWT claim fall through to page-level auth (intentional design).
      mockGetServiceRoleClient.mockReturnValue(makeServiceRoleMock("granted", "player"));
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "player@test.test" },
        claims: {}, // No user_role claim
        response: NextResponse.next(),
      });

      const request = new NextRequest(new URL("http://localhost:3000/prontidao"));
      const response = await proxy(request);

      // Without JWT claim, the middleware falls through (no 404 from dados-mediados block)
      // but page-level auth will enforce access control
      expect(response?.status).not.toBe(404);
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
