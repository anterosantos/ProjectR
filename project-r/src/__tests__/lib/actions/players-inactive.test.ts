import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MarkInactiveSchema,
  ReactivatePlayerSchema,
} from "@/lib/schemas/players";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { markPlayerInactive, reactivatePlayer, getPlayers } from "@/lib/actions/players";
import { logAccess } from "@/lib/actions/audit";

// ─── Zod Schema Tests ────────────────────────────────────────────────────────

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("MarkInactiveSchema", () => {
  it("aceita playerId UUID sem motivo (opcional)", () => {
    const result = MarkInactiveSchema.safeParse({ playerId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("aceita motivo preenchido até 200 chars", () => {
    const result = MarkInactiveSchema.safeParse({
      playerId: VALID_UUID,
      inactive_reason: "lesão no joelho",
    });
    expect(result.success).toBe(true);
  });

  it("aceita motivo com exactamente 200 chars", () => {
    const result = MarkInactiveSchema.safeParse({
      playerId: VALID_UUID,
      inactive_reason: "x".repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it("rejeita motivo com mais de 200 chars", () => {
    const result = MarkInactiveSchema.safeParse({
      playerId: VALID_UUID,
      inactive_reason: "x".repeat(201),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/200/);
    }
  });

  it("rejeita playerId inválido (não UUID)", () => {
    const result = MarkInactiveSchema.safeParse({ playerId: "not-a-uuid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("playerId");
    }
  });

  it("rejeita playerId ausente", () => {
    const result = MarkInactiveSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ReactivatePlayerSchema", () => {
  it("aceita UUID válido", () => {
    const result = ReactivatePlayerSchema.safeParse({ playerId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejeita playerId inválido", () => {
    const result = ReactivatePlayerSchema.safeParse({ playerId: "not-uuid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("playerId");
    }
  });

  it("rejeita playerId ausente", () => {
    const result = ReactivatePlayerSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── Server Action Tests ──────────────────────────────────────────────────────

function buildProfilesFrom() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { club_id: "club-a" }, error: null }),
      }),
    }),
  };
}

describe("markPlayerInactive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna err quando input inválido", async () => {
    const result = await markPlayerInactive({ playerId: "not-uuid" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("retorna err quando utilizador não autenticado", async () => {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createServerClient>>);

    const result = await markPlayerInactive({ playerId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });

  it("actualiza is_active=false com isolamento multi-tenant e chama logAccess", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") return buildProfilesFrom();
        return { update: mockUpdate };
      }),
    } as unknown as Awaited<ReturnType<typeof createServerClient>>);

    await markPlayerInactive({ playerId: VALID_UUID, inactive_reason: "lesão" }).catch(() => {});

    expect(mockUpdate).toHaveBeenCalledWith({
      is_active: false,
      inactive_reason: "lesão",
    });
    expect(logAccess).toHaveBeenCalledWith("player.marked_inactive", "player", VALID_UUID);
    expect(redirect).toHaveBeenCalledWith("/plantel");
  });

  it("retorna err quando update falha no Supabase", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: "DB error" } }),
      }),
    });

    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") return buildProfilesFrom();
        return { update: mockUpdate };
      }),
    } as unknown as Awaited<ReturnType<typeof createServerClient>>);

    const result = await markPlayerInactive({ playerId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("reactivatePlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna err quando input inválido", async () => {
    const result = await reactivatePlayer({ playerId: "bad" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("retorna err quando utilizador não autenticado", async () => {
    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createServerClient>>);

    const result = await reactivatePlayer({ playerId: VALID_UUID });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });

  it("actualiza is_active=true e inactive_reason=null com isolamento multi-tenant", async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") return buildProfilesFrom();
        return { update: mockUpdate };
      }),
    } as unknown as Awaited<ReturnType<typeof createServerClient>>);

    await reactivatePlayer({ playerId: VALID_UUID }).catch(() => {});

    expect(mockUpdate).toHaveBeenCalledWith({
      is_active: true,
      inactive_reason: null,
    });
    expect(logAccess).toHaveBeenCalledWith("player.reactivated", "player", VALID_UUID);
    expect(redirect).toHaveBeenCalledWith(`/plantel/${VALID_UUID}?reativado=1`);
  });
});

describe("getPlayers com showInactive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra is_active=false quando showInactive=true", async () => {
    const isActiveEqCalls: Array<[string, unknown]> = [];
    const eqMock = vi.fn().mockImplementation(function (col: string, val: unknown) {
      isActiveEqCalls.push([col, val]);
      return { eq: eqMock, order: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") return buildProfilesFrom();
        return {
          select: vi.fn().mockReturnValue({ eq: eqMock }),
        };
      }),
    } as unknown as Awaited<ReturnType<typeof createServerClient>>);

    const result = await getPlayers({ showInactive: true });
    expect(result.ok).toBe(true);
    const isActiveCall = isActiveEqCalls.find(([col]) => col === "is_active");
    expect(isActiveCall?.[1]).toBe(false);
  });

  it("filtra is_active=true por defeito (sem options)", async () => {
    const isActiveEqCalls: Array<[string, unknown]> = [];
    const eqMock = vi.fn().mockImplementation(function (col: string, val: unknown) {
      isActiveEqCalls.push([col, val]);
      return { eq: eqMock, order: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "profiles") return buildProfilesFrom();
        return {
          select: vi.fn().mockReturnValue({ eq: eqMock }),
        };
      }),
    } as unknown as Awaited<ReturnType<typeof createServerClient>>);

    const result = await getPlayers();
    expect(result.ok).toBe(true);
    const isActiveCall = isActiveEqCalls.find(([col]) => col === "is_active");
    expect(isActiveCall?.[1]).toBe(true);
  });
});
