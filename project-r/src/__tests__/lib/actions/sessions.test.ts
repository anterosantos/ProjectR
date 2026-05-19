import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

vi.mock("@/lib/actions/seasons", () => ({
  getCurrentSeason: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/actions/seasons";
import {
  getSessionsForClub,
  getSessionById,
  createSession,
  updateSession,
  cancelSession,
} from "@/lib/actions/sessions";

const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const CLUB_UUID = "650e8400-e29b-41d4-a716-446655440002";
const USER_UUID = "750e8400-e29b-41d4-a716-446655440003";
const SEASON_UUID = "850e8400-e29b-41d4-a716-446655440004";

const FUTURE_AT = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const mockSession = {
  id: SESSION_UUID,
  club_id: CLUB_UUID,
  season_id: SEASON_UUID,
  type: "training",
  scheduled_at: FUTURE_AT,
  duration_min: 90,
  location: "Campo Municipal",
  status: "scheduled",
  notes: null,
  created_by: USER_UUID,
  created_at: "2026-05-19T00:00:00Z",
};

const mockCurrentSeason = {
  id: SEASON_UUID,
  club_id: CLUB_UUID,
  name: "2026/27",
  start_date: "2026-08-01",
  end_date: "2027-06-30",
  is_current: true,
  created_at: "2026-05-01T00:00:00Z",
};

function makeSupabaseMock({
  user = { id: USER_UUID },
  profile = { club_id: CLUB_UUID, id: USER_UUID },
  sessionData = mockSession,
  sessionsList = [mockSession],
  queryError = null,
}: {
  user?: { id: string } | null;
  profile?: { club_id: string; id: string } | null;
  sessionData?: typeof mockSession | null;
  sessionsList?: typeof mockSession[];
  queryError?: { message: string } | null;
} = {}) {
  const sessionsMock = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: sessionsList,
      error: queryError,
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: sessionData,
      error: queryError,
    }),
    single: vi.fn().mockResolvedValue({
      data: sessionData,
      error: queryError,
    }),
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: profile, error: null }),
        };
      }
      return sessionsMock;
    }),
  };
}

// ─── getSessionsForClub ───────────────────────────────────────────────────────

describe("getSessionsForClub", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve lista de sessões para utilizador autenticado", async () => {
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getSessionsForClub();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.type).toBe("training");
    }
  });

  it("devolve erro unauthorized quando não autenticado", async () => {
    const mock = makeSupabaseMock({ user: null });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getSessionsForClub();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });

  it("devolve erro forbidden quando perfil não encontrado", async () => {
    const mock = makeSupabaseMock({ profile: null });
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {} as never;
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getSessionsForClub();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("aceita filtros opcionais (season_id, status)", async () => {
    // The query chain must be chainable AND awaitable (like the real Supabase client)
    const resolvedData = { data: [], error: null };
    const sessionsMock: Record<string, unknown> = {};
    const chainMethods = ["select", "eq", "gte", "lte", "order"];
    chainMethods.forEach((m) => {
      sessionsMock[m] = vi.fn(() => {
        // Return a thenable + chainable object
        const chain = { ...sessionsMock, then: (resolve: (v: typeof resolvedData) => void) => resolve(resolvedData) };
        return chain;
      });
    });

    const mock = makeSupabaseMock();
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { club_id: CLUB_UUID, id: USER_UUID },
            error: null,
          }),
        };
      }
      return sessionsMock;
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getSessionsForClub({
      season_id: SEASON_UUID,
      status: "scheduled",
    });
    expect(result.ok).toBe(true);
  });
});

// ─── getSessionById ───────────────────────────────────────────────────────────

describe("getSessionById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve sessão quando existe", async () => {
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getSessionById(SESSION_UUID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(SESSION_UUID);
  });

  it("devolve not_found quando sessão não existe", async () => {
    const mock = makeSupabaseMock({ sessionData: null });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getSessionById(SESSION_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

// ─── createSession ────────────────────────────────────────────────────────────

describe("createSession", () => {
  beforeEach(() => vi.clearAllMocks());

  const validInput = {
    type: "training" as const,
    scheduledAt: FUTURE_AT,
    durationMin: 90,
  };

  it("cria sessão com sucesso quando existe época actual", async () => {
    vi.mocked(getCurrentSeason).mockResolvedValue({
      ok: true,
      data: mockCurrentSeason,
    });
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await createSession(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.type).toBe("training");
  });

  it("devolve no_season quando não há época actual", async () => {
    vi.mocked(getCurrentSeason).mockResolvedValue({ ok: true, data: null });
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await createSession(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_season");
  });

  it("devolve validation error com tipo inválido", async () => {
    const result = await createSession({
      ...validInput,
      type: "invalid" as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });

  it("devolve validation error com data muito passada", async () => {
    const oldDate = new Date(
      Date.now() - 48 * 60 * 60 * 1000
    ).toISOString();
    const result = await createSession({ ...validInput, scheduledAt: oldDate });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });

  it("devolve unauthorized quando não autenticado", async () => {
    vi.mocked(getCurrentSeason).mockResolvedValue({
      ok: true,
      data: mockCurrentSeason,
    });
    const mock = makeSupabaseMock({ user: null });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await createSession(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unauthorized");
  });
});

// ─── updateSession ────────────────────────────────────────────────────────────

describe("updateSession", () => {
  beforeEach(() => vi.clearAllMocks());

  const validInput = {
    id: SESSION_UUID,
    type: "match" as const,
    scheduledAt: FUTURE_AT,
    durationMin: 60,
  };

  it("actualiza sessão com sucesso", async () => {
    const mock = makeSupabaseMock();
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await updateSession(validInput);
    expect(result.ok).toBe(true);
  });

  it("bloqueia actualização de sessão cancelada", async () => {
    const cancelledSession = { ...mockSession, status: "cancelled" };
    const mock = makeSupabaseMock({ sessionData: cancelledSession });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await updateSession(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("bloqueia actualização de sessão concluída", async () => {
    const completedSession = { ...mockSession, status: "completed" };
    const mock = makeSupabaseMock({ sessionData: completedSession });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await updateSession(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("devolve validation error com id inválido", async () => {
    const result = await updateSession({ ...validInput, id: "not-a-uuid" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation");
  });
});

// ─── cancelSession ────────────────────────────────────────────────────────────

describe("cancelSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cancela sessão agendada com sucesso", async () => {
    const mock = makeSupabaseMock({
      sessionData: { ...mockSession, status: "cancelled" },
    });
    // First call (getSessionById) returns scheduled, second call (update) returns cancelled
    let callCount = 0;
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { club_id: CLUB_UUID, id: USER_UUID },
            error: null,
          }),
        };
      }
      callCount++;
      if (callCount === 1) {
        // getSessionById call
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { ...mockSession, status: "scheduled" },
            error: null,
          }),
        };
      }
      // cancelSession update call
      return {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...mockSession, status: "cancelled" },
          error: null,
        }),
      };
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await cancelSession(SESSION_UUID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("cancelled");
  });

  it("bloqueia cancelamento de sessão já cancelada", async () => {
    const mock = makeSupabaseMock({
      sessionData: { ...mockSession, status: "cancelled" },
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await cancelSession(SESSION_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
  });

  it("devolve not_found quando sessão não existe", async () => {
    const mock = makeSupabaseMock({ sessionData: null });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await cancelSession(SESSION_UUID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});
