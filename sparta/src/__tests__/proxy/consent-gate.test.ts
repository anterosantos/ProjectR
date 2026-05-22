import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "@/proxy";

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

import { updateSession } from "@/lib/supabase/middleware";

const mockUpdateSession = updateSession as ReturnType<typeof vi.fn>;

const PLAYER_ID = "aa000000-0000-7000-8000-000000000001";

function makeProfileChain(consentStatus: string, role = "player") {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { role, consent_status: consentStatus } }),
  };
}

function makePlayerChain(birthdate: string | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: birthdate ? { birthdate } : null }),
  };
}

function makeSupabase(consentStatus: string, birthdate: string | null) {
  const profileChain = makeProfileChain(consentStatus);
  const playerChain = makePlayerChain(birthdate);
  return {
    from: vi.fn((table: string) => (table === "players" ? playerChain : profileChain)),
  };
}

function sessionForPlayer(consentStatus: string, birthdate: string | null) {
  return {
    user: { id: PLAYER_ID, email: "player@test.test" },
    claims: { user_role: "player" },
    response: NextResponse.next(),
    supabase: makeSupabase(consentStatus, birthdate),
  };
}

const BIRTHDATE_14 = "2012-01-01"; // ~14 anos em 2026
const BIRTHDATE_16 = "2009-01-01"; // ~17 anos em 2026

describe("Consent Gate — proxy.ts", () => {
  beforeEach(() => {
    mockUpdateSession.mockClear();
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
    // Sem redirect: status != 307 e sem header location apontando para a mesma página
    expect(res?.status).not.toBe(307);
    const location = res?.headers.get("location");
    if (location) {
      expect(location).not.toContain("/aguardar-consentimento");
    }
  });

  it("role coach com consent_status pending → não aplica gate (apenas para players)", async () => {
    mockUpdateSession.mockResolvedValue({
      user: { id: PLAYER_ID, email: "coach@test.test" },
      claims: { user_role: "coach" },
      response: NextResponse.next(),
      supabase: makeSupabase("pending", BIRTHDATE_14),
    });
    const req = new NextRequest(new URL("http://localhost:3000/prontidao"));
    const res = await proxy(req);
    // Não deve redirecionar para /aguardar-consentimento
    expect(res?.headers.get("location") ?? "").not.toContain("/aguardar-consentimento");
  });

  it("sem JWT claims + player menor → redireciona (auth hook desativado, fallback via DB)", async () => {
    // Reproduz o bug real: auth hook não configurado → userRole undefined → gate ignorado
    // Fix: gate consulta profiles diretamente e usa role da DB como fallback
    mockUpdateSession.mockResolvedValue({
      user: { id: PLAYER_ID, email: "player@test.test" },
      claims: {}, // sem user_role — auth hook ausente
      response: NextResponse.next(),
      supabase: makeSupabase("not_required", BIRTHDATE_14), // minor, sem consentimento
    });
    const req = new NextRequest(new URL("http://localhost:3000/hoje"));
    const res = await proxy(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toContain("/aguardar-consentimento");
  });

  it("sem JWT claims + analyst → não aplica gate (DB confirma role não-player)", async () => {
    const analystSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "analyst", consent_status: "not_required" } }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      })),
    };
    mockUpdateSession.mockResolvedValue({
      user: { id: PLAYER_ID, email: "analyst@test.test" },
      claims: {}, // sem user_role
      response: NextResponse.next(),
      supabase: analystSupabase,
    });
    const req = new NextRequest(new URL("http://localhost:3000/sessoes"));
    const res = await proxy(req);
    expect(res?.headers.get("location") ?? "").not.toContain("/aguardar-consentimento");
  });
});
