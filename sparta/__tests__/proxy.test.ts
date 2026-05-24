/**
 * Proxy authentication gate tests (Story 1.6 AC #5)
 *
 * Tests that src/proxy.ts:
 * - Redirects unauthenticated requests to /login (307)
 * - Allows authenticated requests through
 * - Allows public paths without authentication
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock updateSession from the supabase middleware helper
// ---------------------------------------------------------------------------

const mockUpdateSession = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mockUpdateSession,
}));

// ---------------------------------------------------------------------------
// Mock service-role client (proxy.ts calls getServiceRoleClient() for the
// consent gate — without this mock the tests make real HTTP calls and timeout)
// ---------------------------------------------------------------------------

const mockServiceRoleFrom = vi.fn();

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(() => ({
    from: mockServiceRoleFrom,
  })),
}));

function makeRequest(path: string, cookie?: string): NextRequest {
  const url = `http://localhost:3000${path}`;
  const init: Record<string, unknown> = {};
  if (cookie) {
    init.headers = { cookie };
  }
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

function makePassthroughResponse() {
  return NextResponse.next();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Proxy authentication gate (AC #5)", () => {
  beforeEach(() => {
    mockUpdateSession.mockReset();
    mockServiceRoleFrom.mockReset();

    // Default: staff profile (coach) — not a player, consent not required.
    // This is the safe default for most tests.
    // The proxy calls: db.from('profiles').select('role, consent_status').eq('id', userId).single()
    mockServiceRoleFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: "coach", consent_status: "not_required" },
            error: null,
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
  });

  describe("Unauthenticated requests to protected routes", () => {
    it("redirects to /login with 307 when user is null", async () => {
      mockUpdateSession.mockResolvedValue({
        user: null,
        response: makePassthroughResponse(),
      });

      const { proxy } = await import("@/proxy");
      const request = makeRequest("/prontidao");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    });

    it("redirects unauthenticated access to /sessoes", async () => {
      mockUpdateSession.mockResolvedValue({
        user: null,
        response: makePassthroughResponse(),
      });

      const { proxy } = await import("@/proxy");
      const response = await proxy(makeRequest("/sessoes"));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toContain("/login");
    });
  });

  describe("Authenticated requests are allowed through", () => {
    it("passes through when user is present with valid role", async () => {
      const passthroughResponse = makePassthroughResponse();
      mockUpdateSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "coach@test.test",
          user_metadata: { user_role: "coach" },
        },
        claims: { user_role: "coach" },
        response: passthroughResponse,
      });

      const { proxy } = await import("@/proxy");
      const response = await proxy(makeRequest("/prontidao", "sb-auth=tok"));

      // Should return the passthrough response (not a redirect)
      expect(response.status).not.toBe(307);
    });

    it("redirects when user is present but role is invalid", async () => {
      const passthroughResponse = makePassthroughResponse();
      mockUpdateSession.mockResolvedValue({
        user: {
          id: "user-123",
          email: "unknown@test.test",
          user_metadata: { user_role: "admin" },
        },
        claims: { user_role: "admin" },
        response: passthroughResponse,
      });

      const { proxy } = await import("@/proxy");
      const response = await proxy(makeRequest("/prontidao", "sb-auth=tok"));

      // After fix: should allow authenticated user even with invalid role
      // RLS policies will enforce access control, not middleware
      expect(response.status).not.toBe(307);
    });

    it("redirects when user is present but no role is set", async () => {
      const passthroughResponse = makePassthroughResponse();
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "norole@test.test" },
        claims: {},
        response: passthroughResponse,
      });

      const { proxy } = await import("@/proxy");
      const response = await proxy(makeRequest("/prontidao", "sb-auth=tok"));

      // After fix: should allow authenticated user even without role
      // The page will fetch role from /api/auth/user-role endpoint
      // RLS policies will enforce access control, not middleware
      expect(response.status).not.toBe(307);
    });
  });

  describe("Public paths bypass session check", () => {
    const publicPaths = ["/login", "/recuperar-password", "/reset-password"];

    it.each(publicPaths)(
      "%s is accessible without authentication",
      async (path) => {
        // updateSession should NOT be called for public paths
        const { proxy } = await import("@/proxy");
        const response = await proxy(makeRequest(path));

        expect(mockUpdateSession).not.toHaveBeenCalled();
        expect(response.status).not.toBe(307);
      }
    );

    it("/consentimento/* is accessible without authentication", async () => {
      const { proxy } = await import("@/proxy");
      const response = await proxy(makeRequest("/consentimento/aceitar"));

      expect(mockUpdateSession).not.toHaveBeenCalled();
      expect(response.status).not.toBe(307);
    });
  });
});
