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

function makeRequest(path: string, cookie?: string): NextRequest {
  const url = `http://localhost:3000${path}`;
  const init: RequestInit = {};
  if (cookie) {
    init.headers = { cookie };
  }
  return new NextRequest(url, init);
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
    it("passes through when user is present", async () => {
      const passthroughResponse = makePassthroughResponse();
      mockUpdateSession.mockResolvedValue({
        user: { id: "user-123", email: "coach@test.test" },
        response: passthroughResponse,
      });

      const { proxy } = await import("@/proxy");
      const response = await proxy(makeRequest("/prontidao", "sb-auth=tok"));

      // Should return the passthrough response (not a redirect)
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
