import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const mockUpdateSession = updateSession as ReturnType<typeof vi.fn>;
const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;

const PLAYER_ID = "aa000000-0000-7000-8000-000000000001";

function makeServiceRoleMock(role: string, consentStatus: string, birthdate: string | null) {
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { role, consent_status: consentStatus } }),
  };
  const playerChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: birthdate ? { birthdate } : null }),
  };
  return {
    from: vi.fn((table: string) => (table === "players" ? playerChain : profileChain)),
  };
}

function sessionForPlayer(consentStatus: string, birthdate: string | null) {
  mockGetServiceRoleClient.mockReturnValue(
    makeServiceRoleMock("player", consentStatus, birthdate)
  );
  return {
    user: { id: PLAYER_ID, email: "player@test.test" },
    claims: { user_role: "player" },
    response: NextResponse.next(),
  };
}

const BIRTHDATE_14 = "2012-01-01"; // ~14 anos em 2026
const BIRTHDATE_16 = "2009-01-01"; // ~17 anos em 2026

describe("Consent Gate — proxy.ts", () => {
  beforeEach(() => {
    mockUpdateSession.mockClear();
    mockGetServiceRoleClient.mockClear();
  });

  it("pending + birthdate < 16 → redireciona para /aguardar-consentimento", async () => {
    mockUpdateSession.mockResolvedValue(sessionForPlayer("pending", BIRTHDATE_14));
    const req = new NextRequest(new URL("http://localhost:3000/hoje"));
    const res = await proxy(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/aguardar-consentimento");
  });

  it("pending + birthdate >= 16 → bypass (não redireciona)", async () => {
    mockUpdateSession.mockResolvedValue(sessionForPlayer("pending", BIRTHDATE_16));
    const req = new NextRequest(new URL("http://localhost:3000/hoje"));
    const res = await proxy(req);
    expect(res?.status).not.toBe(307);
  });

  it("pending + birthdate null → bloqueia (redireciona para /aguardar-consentimento)", async () => {
    mockUpdateSession.mockResolvedValue(sessionForPlayer("pending", null));
    const req = new NextRequest(new URL("http://localhost:3000/hoje"));
    const res = await proxy(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/aguardar-consentimento");
  });

  it("not_required + birthdate < 16 → redireciona (consentimento ainda não pedido)", async () => {
    mockUpdateSession.mockResolvedValue(sessionForPlayer("not_required", BIRTHDATE_14));
    const req = new NextRequest(new URL("http://localhost:3000/hoje"));
    const res = await proxy(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/aguardar-consentimento");
  });

  it("not_required + birthdate >= 16 → flow normal (adulto sem consentimento obrigatório)", async () => {
    mockUpdateSession.mockResolvedValue(sessionForPlayer("not_required", BIRTHDATE_16));
    const req = new NextRequest(new URL("http://localhost:3000/hoje"));
    const res = await proxy(req);
    expect(res?.status).not.toBe(307);
  });

  it("granted → flow normal (consentimento confirmado, não redireciona)", async () => {
    mockUpdateSession.mockResolvedValue(sessionForPlayer("granted", BIRTHDATE_14));
    const req = new NextRequest(new URL("http://localhost:3000/hoje"));
    const res = await proxy(req);
    expect(res?.status).not.toBe(307);
  });

  it("pending + já está em /aguardar-consentimento → não redireciona (loop prevention)", async () => {
    mockUpdateSession.mockResolvedValue(sessionForPlayer("pending", BIRTHDATE_14));
    const req = new NextRequest(new URL("http://localhost:3000/aguardar-consentimento"));
    const res = await proxy(req);
    expect(res?.status).not.toBe(307);
    const location = res?.headers.get("location");
    if (location) {
      expect(location).not.toContain("/aguardar-consentimento");
    }
  });

  it("role coach com consent_status pending → não aplica gate (apenas para players)", async () => {
    mockGetServiceRoleClient.mockReturnValue(
      makeServiceRoleMock("coach", "pending", BIRTHDATE_14)
    );
    mockUpdateSession.mockResolvedValue({
      user: { id: PLAYER_ID, email: "coach@test.test" },
      claims: { user_role: "coach" },
      response: NextResponse.next(),
    });
    const req = new NextRequest(new URL("http://localhost:3000/prontidao"));
    const res = await proxy(req);
    expect(res?.headers.get("location") ?? "").not.toContain("/aguardar-consentimento");
  });

  it("sem JWT claims + player menor → redireciona (auth hook desativado, fallback via DB)", async () => {
    // Reproduz o bug real: auth hook não configurado → userRole undefined → gate ignorava
    // Fix: gate usa service role client que não depende de JWT/RLS
    mockGetServiceRoleClient.mockReturnValue(
      makeServiceRoleMock("player", "not_required", BIRTHDATE_14)
    );
    mockUpdateSession.mockResolvedValue({
      user: { id: PLAYER_ID, email: "player@test.test" },
      claims: {}, // sem user_role — auth hook ausente
      response: NextResponse.next(),
    });
    const req = new NextRequest(new URL("http://localhost:3000/hoje"));
    const res = await proxy(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/aguardar-consentimento");
  });

  it("apenas claims.role='authenticated' (sem user_role) + player menor → redireciona", async () => {
    // Regression: claims.role is the Supabase DB role ("authenticated"), NOT the app role.
    // Previously proxy.ts fell back to claims.role, causing effectiveRole="authenticated"
    // which bypassed the gate for all players. Fix: only use claims.user_role.
    mockGetServiceRoleClient.mockReturnValue(
      makeServiceRoleMock("player", "not_required", BIRTHDATE_14)
    );
    mockUpdateSession.mockResolvedValue({
      user: { id: PLAYER_ID, email: "player@test.test" },
      claims: { role: "authenticated" }, // Supabase DB role, no app role
      response: NextResponse.next(),
    });
    const req = new NextRequest(new URL("http://localhost:3000/hoje"));
    const res = await proxy(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/aguardar-consentimento");
  });

  it("sem JWT claims + analyst → não aplica gate (DB confirma role não-player)", async () => {
    mockGetServiceRoleClient.mockReturnValue(
      makeServiceRoleMock("analyst", "not_required", null)
    );
    mockUpdateSession.mockResolvedValue({
      user: { id: PLAYER_ID, email: "analyst@test.test" },
      claims: {}, // sem user_role
      response: NextResponse.next(),
    });
    const req = new NextRequest(new URL("http://localhost:3000/sessoes"));
    const res = await proxy(req);
    expect(res?.headers.get("location") ?? "").not.toContain("/aguardar-consentimento");
  });
});
