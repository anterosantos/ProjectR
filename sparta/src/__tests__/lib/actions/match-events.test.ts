import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/data/audited", () => ({
  auditedRead: vi.fn((_opts: unknown, fn: () => unknown) => fn()),
}));

vi.mock("@/lib/utils/match-events", () => ({
  isEditWindowOpen: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true }),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { submitMatchEvent, deleteMatchEvent, getRecentMatchEvents } from "@/lib/actions/events";
import { MATCH_ACTIONS, MATCH_ZONES } from "@/lib/schemas/match-events";

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_UUID    = "01920a4b-c8d3-7000-9c4e-000000000010";
const CLUB_UUID    = "01920a4b-c8d3-7000-9c4e-000000000020";
const SESSION_UUID = "01920a4b-c8d3-7000-9c4e-000000000030";
const PLAYER_UUID  = "01920a4b-c8d3-7000-9c4e-000000000040";
const EVENT_UUID   = "01920a4b-c8d3-7000-9c4e-000000000050";

const mockCreateServerClient = createServerClient as ReturnType<typeof vi.fn>;
const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_UUID,
    action: "ball_loss" as const,
    zone: "mid_center" as const,
    player_id: PLAYER_UUID,
    session_id: SESSION_UUID,
    occurred_at: "2026-05-28T16:30:00.000Z", // Past timestamp to avoid future validation errors
    captured_via: "online" as const,
    ...overrides,
  };
}

// ─── Mock Builders ─────────────────────────────────────────────────────────────

function buildServerClient(opts: {
  noUser?: boolean;
  role?: string;
  clubId?: string | null;
  profileError?: boolean;
} = {}) {
  const { noUser, role = "analyst", clubId = CLUB_UUID, profileError } = opts;
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: noUser ? null : { id: USER_UUID } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(
            profileError
              ? { data: null, error: { message: "Not found" } }
              : { data: { role, club_id: clubId }, error: null }
          ),
        }),
      }),
    }),
  };
}

// Chain helpers for service role

function makeSelectChain(data: object | null, error: object | null = null) {
  const chain: Record<string, unknown> = {};
  chain["maybeSingle"] = vi.fn().mockResolvedValue({ data, error });
  chain["eq"] = vi.fn().mockReturnValue(chain);
  chain["select"] = vi.fn().mockReturnValue(chain);
  return chain;
}

function makeUpsertChain(error: object | null = null) {
  return {
    upsert: vi.fn().mockResolvedValue({ error }),
  };
}

function makeUpdateChain(error: object | null = null) {
  // update().eq("id", ...).eq("club_id", ...) — last eq is awaited
  const lastEq = vi.fn().mockResolvedValue({ error });
  const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
  return {
    update: vi.fn().mockReturnValue({ eq: firstEq }),
  };
}

// Service role client for submitMatchEvent
function buildServiceRoleForSubmit(opts: {
  sessionData?: object | null;
  lineupData?: object | null;
  playerData?: object | null;
  upsertError?: object | null;
} = {}) {
  const {
    sessionData = { id: SESSION_UUID, club_id: CLUB_UUID },
    lineupData = { player_id: PLAYER_UUID },
    playerData = { processing_restricted: false },
    upsertError = null,
  } = opts;

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "sessions") return makeSelectChain(sessionData);
      if (table === "match_lineups") return makeSelectChain(lineupData);
      if (table === "players") return makeSelectChain(playerData);
      if (table === "match_events") return makeUpsertChain(upsertError);
      return {};
    }),
  };
}

// Service role client for deleteMatchEvent
function buildServiceRoleForDelete(opts: {
  eventData?: object | null;
  updateError?: object | null;
} = {}) {
  const {
    eventData = { id: EVENT_UUID, is_deleted: false, session_id: SESSION_UUID },
    updateError = null,
  } = opts;

  let matchEventsCallCount = 0;
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "match_events") {
        matchEventsCallCount++;
        if (matchEventsCallCount === 1) {
          return makeSelectChain(eventData);
        }
        return makeUpdateChain(updateError);
      }
      if (table === "sessions") {
        return makeSelectChain({ scheduled_at: "2026-05-31T10:00:00Z", duration_min: 90 });
      }
      if (table === "notification_settings") {
        return makeSelectChain({ event_edit_window_hours: 24 });
      }
      return {};
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MATCH_ACTIONS e MATCH_ZONES — enums exportados", () => {
  it("MATCH_ACTIONS tem 8 acções", () => {
    expect(MATCH_ACTIONS).toHaveLength(8);
  });

  it("MATCH_ZONES tem 9 zonas", () => {
    expect(MATCH_ZONES).toHaveLength(9);
  });
});

describe("submitMatchEvent", () => {
  beforeEach(() => {
    mockCreateServerClient.mockClear();
    mockGetServiceRoleClient.mockClear();
  });

  // ── Zod validation ─────────────────────────────────────────────────────────

  it("retorna erro se action inválida", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const result = await submitMatchEvent(makePayload({ action: "invalid_action" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("retorna erro se zone inválida", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const result = await submitMatchEvent(makePayload({ zone: "invalid_zone" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("retorna erro se id não é UUID", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const result = await submitMatchEvent(makePayload({ id: "not-a-uuid" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("retorna erro se occurred_at não é datetime válido", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const result = await submitMatchEvent(makePayload({ occurred_at: "not-a-date" }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  // ── Auth / role ─────────────────────────────────────────────────────────────

  it("retorna unauthorized se não autenticado", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ noUser: true }));
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const result = await submitMatchEvent(makePayload());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });

  it("retorna forbidden se role é player", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ role: "player" }));
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const result = await submitMatchEvent(makePayload());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("retorna forbidden se club_id é null", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ clubId: null }));
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const result = await submitMatchEvent(makePayload());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  // ── Business validation ─────────────────────────────────────────────────────

  it("retorna not_found se sessão não pertence ao clube", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRoleForSubmit({ sessionData: null })
    );

    const result = await submitMatchEvent(makePayload());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
      expect(result.error.message).toContain("Sessão");
    }
  });

  it("retorna validation error se player não está em match_lineups", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRoleForSubmit({ lineupData: null })
    );

    const result = await submitMatchEvent(makePayload());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toContain("convocatória");
    }
  });

  it("retorna forbidden se player tem processing_restricted=true", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRoleForSubmit({ playerData: { processing_restricted: true } })
    );

    const result = await submitMatchEvent(makePayload());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
      expect(result.error.message).toContain("Tratamento limitado");
    }
  });

  // ── Success & idempotency ────────────────────────────────────────────────────

  it("retorna { ok: true, data: { id } } em sucesso", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const result = await submitMatchEvent(makePayload());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(EVENT_UUID);
    }
  });

  it("upsert idempotente — mesmo id duas vezes não retorna erro", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const payload = makePayload();
    const first = await submitMatchEvent(payload);

    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const second = await submitMatchEvent(payload);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      // Ambos retornam o mesmo id — sem duplicação
      expect(first.data.id).toBe(second.data.id);
    }
  });

  it("retorna erro desconhecido se upsert falha", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRoleForSubmit({ upsertError: { message: "DB error" } })
    );

    const result = await submitMatchEvent(makePayload());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("aceita role coach além de analyst", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ role: "coach" }));
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const result = await submitMatchEvent(makePayload());

    expect(result.ok).toBe(true);
  });

  it("aceita captured_via offline-drain", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForSubmit());

    const result = await submitMatchEvent(
      makePayload({ captured_via: "offline-drain" })
    );

    expect(result.ok).toBe(true);
  });
});

describe("deleteMatchEvent", () => {
  beforeEach(() => {
    mockCreateServerClient.mockClear();
    mockGetServiceRoleClient.mockClear();
  });

  it("retorna not_found se evento não existe", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRoleForDelete({ eventData: null })
    );

    const result = await deleteMatchEvent(EVENT_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
      expect(result.error.message).toContain("Evento");
    }
  });

  it("retorna not_found se evento pertence a outro clube (club_id filter)", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    // club_id filter no query retorna null para eventos de outros clubes
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRoleForDelete({ eventData: null })
    );

    const result = await deleteMatchEvent(EVENT_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("retorna { ok: true } em sucesso (soft delete)", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForDelete());

    const result = await deleteMatchEvent(EVENT_UUID);

    expect(result.ok).toBe(true);
  });

  it("retorna unauthorized se não autenticado", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ noUser: true }));
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForDelete());

    const result = await deleteMatchEvent(EVENT_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });

  it("retorna erro desconhecido se update falha", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRoleForDelete({ updateError: { message: "DB error" } })
    );

    const result = await deleteMatchEvent(EVENT_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("aceita role coach para soft delete", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ role: "coach" }));
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForDelete());

    const result = await deleteMatchEvent(EVENT_UUID);

    expect(result.ok).toBe(true);
  });
});

// ─── getRecentMatchEvents ──────────────────────────────────────────────────────

function buildServiceRoleForRecentEvents(opts: {
  eventsData?: object[] | null;
  eventsError?: object | null;
  lineupData?: object[] | null;
} = {}) {
  const {
    eventsData = [
      {
        id: EVENT_UUID,
        action: "ball_loss",
        zone: "mid_center",
        occurred_at: "2026-05-30T15:00:00Z",
        player_id: PLAYER_UUID,
      },
    ],
    eventsError = null,
    lineupData = [
      { player_id: PLAYER_UUID, shirt_num: 10, players: { jersey_num: 7 } },
    ],
  } = opts;

  const orderChain: Record<string, unknown> = {};
  orderChain["limit"] = vi.fn().mockResolvedValue({ data: eventsData, error: eventsError });
  orderChain["order"] = vi.fn().mockReturnValue(orderChain);
  orderChain["eq"] = vi.fn().mockReturnValue(orderChain);
  orderChain["select"] = vi.fn().mockReturnValue(orderChain);

  const lineupChain: Record<string, unknown> = {};
  lineupChain["in"] = vi.fn().mockResolvedValue({ data: lineupData });
  lineupChain["eq"] = vi.fn().mockReturnValue(lineupChain);
  lineupChain["select"] = vi.fn().mockReturnValue(lineupChain);

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "match_events") return orderChain;
      if (table === "match_lineups") return lineupChain;
      return {};
    }),
  };
}

describe("getRecentMatchEvents", () => {
  beforeEach(() => {
    mockCreateServerClient.mockClear();
    mockGetServiceRoleClient.mockClear();
  });

  it("retorna array vazio quando não há eventos", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRoleForRecentEvents({ eventsData: [] })
    );

    const result = await getRecentMatchEvents(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("retorna eventos com jersey_number da lineup", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForRecentEvents());

    const result = await getRecentMatchEvents(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.jersey_number).toBe(10);
      expect(result.data[0]?.action).toBe("ball_loss");
      expect(result.data[0]?.zone).toBe("mid_center");
    }
  });

  it("usa shirt_num da lineup se disponível, senão jersey_num do player", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRoleForRecentEvents({
        lineupData: [
          { player_id: PLAYER_UUID, shirt_num: null, players: { jersey_num: 9 } },
        ],
      })
    );

    const result = await getRecentMatchEvents(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]?.jersey_number).toBe(9);
    }
  });

  it("retorna erro se query de eventos falha", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRoleForRecentEvents({
        eventsData: null,
        eventsError: { message: "DB error" },
      })
    );

    const result = await getRecentMatchEvents(SESSION_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("retorna unauthorized se não autenticado", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ noUser: true }));
    mockGetServiceRoleClient.mockReturnValue(buildServiceRoleForRecentEvents());

    const result = await getRecentMatchEvents(SESSION_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });
});
