import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/actions/auth", () => ({
  requireStaffRole: vi.fn().mockResolvedValue({
    ok: true,
    data: { userId: "user-uuid", clubId: "club-uuid" },
  }),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/utils/match-events", () => ({
  isEditWindowOpen: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/data/audited", () => ({
  auditedRead: vi.fn().mockImplementation((_opts: unknown, fn: () => unknown) => fn()),
}));

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { requireStaffRole } from "@/lib/actions/auth";
import { logAccess } from "@/lib/actions/audit";
import { isEditWindowOpen } from "@/lib/utils/match-events";
import {
  getMatchEventsForSession,
  updateMatchEvent,
  deleteMatchEvent,
} from "@/lib/actions/events";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLUB_UUID    = "club-uuid";
const SESSION_UUID = "session-uuid";
const EVENT_UUID   = "event-uuid";

const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;
const mockRequireStaffRole     = requireStaffRole as ReturnType<typeof vi.fn>;
const mockIsEditWindowOpen     = isEditWindowOpen as ReturnType<typeof vi.fn>;
const mockLogAccess            = logAccess as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(data: unknown, error: unknown = null) {
  const resolved = Promise.resolve({ data, error });
  const chain: Record<string, unknown> = {};
  chain["maybeSingle"] = vi.fn().mockResolvedValue({ data, error });
  chain["single"]      = vi.fn().mockResolvedValue({ data, error });
  chain["eq"]          = vi.fn().mockReturnValue(chain);
  // .in() and .order() are terminal in getMatchEventsForSession — make them awaitable
  chain["in"]          = vi.fn().mockResolvedValue({ data, error });
  chain["order"]       = vi.fn().mockResolvedValue({ data, error });
  chain["limit"]       = vi.fn().mockReturnValue(chain);
  chain["select"]      = vi.fn().mockReturnValue(chain);
  // Make chain itself thenable so `await chain` works when order/in aren't called
  chain["then"]        = resolved.then.bind(resolved);
  chain["catch"]       = resolved.catch.bind(resolved);
  return chain;
}

// ─── getMatchEventsForSession ─────────────────────────────────────────────────

describe("getMatchEventsForSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireStaffRole.mockResolvedValue({
      ok: true,
      data: { userId: "user-uuid", clubId: CLUB_UUID },
    });
    mockIsEditWindowOpen.mockReturnValue(true);
  });

  it("happy path — 3 eventos mapeados correctamente", async () => {
    const events = [
      { id: "e1", action: "ball_loss", zone: "mid_center", occurred_at: "2026-05-31T10:00:00Z", player_id: "p1", captured_via: "online" },
      { id: "e2", action: "shot_total", zone: "att_center", occurred_at: "2026-05-31T10:01:00Z", player_id: "p1", captured_via: "online" },
      { id: "e3", action: "ball_recovery", zone: "def_left", occurred_at: "2026-05-31T10:02:00Z", player_id: null, captured_via: "offline-drain" },
    ];
    const lineups = [
      { player_id: "p1", shirt_num: 10, players: { name: "João", jersey_num: 10 } },
    ];

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "match_events") return makeSelectChain(events);
        if (table === "match_lineups") return makeSelectChain(lineups);
        return makeSelectChain(null);
      }),
    });

    const result = await getMatchEventsForSession(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);
    expect(result.data[0]?.player_name).toBe("João");
    expect(result.data[0]?.jersey_number).toBe(10);
    expect(result.data[2]?.player_id).toBeNull();
  });

  it("lista vazia quando não há eventos", async () => {
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "match_events") return makeSelectChain([]);
        return makeSelectChain(null);
      }),
    });

    const result = await getMatchEventsForSession(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });

  it("requireStaffRole falha → retorna unauthorized", async () => {
    mockRequireStaffRole.mockResolvedValue({
      ok: false,
      error: { code: "unauthorized", message: "Não autenticado" },
    });

    const result = await getMatchEventsForSession(SESSION_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unauthorized");
  });
});

// ─── updateMatchEvent ─────────────────────────────────────────────────────────

describe("updateMatchEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireStaffRole.mockResolvedValue({
      ok: true,
      data: { userId: "user-uuid", clubId: CLUB_UUID },
    });
    mockIsEditWindowOpen.mockReturnValue(true);
  });

  it("happy path — action alterada, logAccess chamado", async () => {
    const existingEvent = {
      id: EVENT_UUID, action: "ball_loss", zone: "mid_center",
      is_deleted: false, session_id: SESSION_UUID,
    };
    const sessionData = { scheduled_at: "2026-05-31T10:00:00Z", duration_min: 90 };
    const settingsData = { event_edit_window_hours: 24 };

    let matchEventsSelectCount = 0;
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "match_events") {
          matchEventsSelectCount++;
          if (matchEventsSelectCount === 1) return makeSelectChain(existingEvent);
          // update chain
          const lastEq = vi.fn().mockResolvedValue({ error: null });
          const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
          return { update: vi.fn().mockReturnValue({ eq: firstEq }) };
        }
        if (table === "sessions") return makeSelectChain(sessionData);
        if (table === "notification_settings") return makeSelectChain(settingsData);
        return makeSelectChain(null);
      }),
    });

    const result = await updateMatchEvent(EVENT_UUID, { action: "ball_recovery" });

    expect(result.ok).toBe(true);
    expect(mockLogAccess).toHaveBeenCalledWith(
      "event.edited", "match_event", EVENT_UUID,
      expect.objectContaining({ before: expect.any(Object), after: expect.any(Object) })
    );
  });

  it("janela encerrada → retorna forbidden", async () => {
    mockIsEditWindowOpen.mockReturnValue(false);

    const existingEvent = {
      id: EVENT_UUID, action: "ball_loss", zone: "mid_center",
      is_deleted: false, session_id: SESSION_UUID,
    };
    const sessionData = { scheduled_at: "2026-05-30T10:00:00Z", duration_min: 90 };
    const settingsData = { event_edit_window_hours: 24 };

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "match_events") return makeSelectChain(existingEvent);
        if (table === "sessions") return makeSelectChain(sessionData);
        if (table === "notification_settings") return makeSelectChain(settingsData);
        return makeSelectChain(null);
      }),
    });

    const result = await updateMatchEvent(EVENT_UUID, { action: "ball_recovery" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("forbidden");
  });

  it("evento não encontrado → retorna not_found", async () => {
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "match_events") return makeSelectChain(null);
        if (table === "notification_settings") return makeSelectChain({ event_edit_window_hours: 24 });
        return makeSelectChain(null);
      }),
    });

    const result = await updateMatchEvent(EVENT_UUID, { action: "ball_recovery" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("evento já apagado → retorna not_found", async () => {
    const existingEvent = {
      id: EVENT_UUID, action: "ball_loss", zone: "mid_center",
      is_deleted: true, session_id: SESSION_UUID,
    };

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "match_events") return makeSelectChain(existingEvent);
        if (table === "notification_settings") return makeSelectChain({ event_edit_window_hours: 24 });
        return makeSelectChain(null);
      }),
    });

    const result = await updateMatchEvent(EVENT_UUID, { action: "ball_recovery" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("validação falha quando nenhum campo fornecido", async () => {
    const result = await updateMatchEvent(EVENT_UUID, {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation");
  });
});

// ─── deleteMatchEvent — janela encerrada ──────────────────────────────────────

describe("deleteMatchEvent — window check (Story 6.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireStaffRole.mockResolvedValue({
      ok: true,
      data: { userId: "user-uuid", clubId: CLUB_UUID },
    });
  });

  it("janela encerrada → retorna forbidden", async () => {
    mockIsEditWindowOpen.mockReturnValue(false);

    const existingEvent = {
      id: EVENT_UUID, is_deleted: false, session_id: SESSION_UUID,
    };
    const sessionData = { scheduled_at: "2026-05-30T10:00:00Z", duration_min: 90 };

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "match_events") return makeSelectChain(existingEvent);
        if (table === "sessions") return makeSelectChain(sessionData);
        if (table === "notification_settings") return makeSelectChain({ event_edit_window_hours: 24 });
        return makeSelectChain(null);
      }),
    });

    const result = await deleteMatchEvent(EVENT_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("forbidden");
  });

  it("happy path — logAccess chamado com event.deleted", async () => {
    mockIsEditWindowOpen.mockReturnValue(true);

    const existingEvent = {
      id: EVENT_UUID, is_deleted: false, session_id: SESSION_UUID,
    };
    const sessionData = { scheduled_at: "2026-05-31T10:00:00Z", duration_min: 90 };
    const settingsData = { event_edit_window_hours: 24 };

    let matchEventsCallCount = 0;
    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "match_events") {
          matchEventsCallCount++;
          if (matchEventsCallCount === 1) return makeSelectChain(existingEvent);
          // update chain
          const lastEq = vi.fn().mockResolvedValue({ error: null });
          const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
          return { update: vi.fn().mockReturnValue({ eq: firstEq }) };
        }
        if (table === "sessions") return makeSelectChain(sessionData);
        if (table === "notification_settings") return makeSelectChain(settingsData);
        return makeSelectChain(null);
      }),
    });

    const result = await deleteMatchEvent(EVENT_UUID);

    expect(result.ok).toBe(true);
    expect(mockLogAccess).toHaveBeenCalledWith("event.deleted", "match_event", EVENT_UUID);
  });

  it("evento já apagado → retorna not_found (sem chamar logAccess)", async () => {
    const existingEvent = {
      id: EVENT_UUID, is_deleted: true, session_id: SESSION_UUID,
    };

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "match_events") return makeSelectChain(existingEvent);
        return makeSelectChain(null);
      }),
    });

    const result = await deleteMatchEvent(EVENT_UUID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
    expect(mockLogAccess).not.toHaveBeenCalled();
  });
});
