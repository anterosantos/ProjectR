import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/readiness/snapshot", () => ({
  refreshSnapshotForSession: vi.fn().mockResolvedValue(undefined),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  upsertAttendance,
  getSessionAttendances,
  getPlayersForAttendance,
} from "@/lib/actions/attendance";

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_UUID    = "01920a4b-c8d3-7000-9c4e-000000000001";
const CLUB_UUID    = "01920a4b-c8d3-7000-9c4e-000000000002";
const SESSION_UUID = "01920a4b-c8d3-7000-9c4e-000000000003";
const PLAYER_UUID  = "01920a4b-c8d3-7000-9c4e-000000000004";
const ATT_UUID     = "01920a4b-c8d3-7000-9c4e-000000000005";
const PLAYER2_UUID = "01920a4b-c8d3-7000-9c4e-000000000006";

const mockCreateServerClient = createServerClient as ReturnType<typeof vi.fn>;
const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function buildServerClient(opts: {
  noUser?: boolean;
  role?: string;
  clubId?: string | null;
} = {}) {
  const { noUser, role = "analyst", clubId = CLUB_UUID } = opts;
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: noUser ? null : { id: USER_UUID } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role, club_id: clubId },
            error: null,
          }),
        }),
      }),
    }),
  };
}

// ─── upsertAttendance ─────────────────────────────────────────────────────────

describe("upsertAttendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: upserts with status 'present'", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: SESSION_UUID, club_id: CLUB_UUID }, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };
    const upsertChain = { error: null };

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "sessions") return sessionChain;
        return { upsert: vi.fn().mockResolvedValue(upsertChain) };
      }),
    });

    const result = await upsertAttendance({
      id: ATT_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      status: "present",
    });

    expect(result.ok).toBe(true);
  });

  it("idempotência: chamar 2x mesma sessão+jogador retorna ok ambas", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());

    const sessionData = { id: SESSION_UUID, club_id: CLUB_UUID };
    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: sessionData, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };
    const upsertChain = { error: null };

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "sessions") return sessionChain;
        return { upsert: vi.fn().mockResolvedValue(upsertChain) };
      }),
    });

    const input = {
      id: ATT_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      status: "absent",
    };

    const r1 = await upsertAttendance(input);
    const r2 = await upsertAttendance(input);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });

  it("sessão não encontrada → retorna not_found", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());

    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockReturnValue(sessionChain),
    });

    const result = await upsertAttendance({
      id: ATT_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      status: "present",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error?.code).toBe("not_found");
    }
  });

  it("requireStaffRole falha → retorna unauthorized", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ noUser: true }));

    const result = await upsertAttendance({
      id: ATT_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      status: "present",
    });

    expect(result.ok).toBe(false);
  });

  it("validação inválida (status inválido) → retorna validation error", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());

    const result = await upsertAttendance({
      id: ATT_UUID,
      session_id: SESSION_UUID,
      player_id: PLAYER_UUID,
      status: "unknown_status",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error?.code).toBe("validation");
    }
  });
});

// ─── getSessionAttendances ────────────────────────────────────────────────────

describe("getSessionAttendances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: retorna 3 registos", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());

    const rows = [
      { player_id: PLAYER_UUID, status: "present", note: null, recorded_at: "2026-05-31T10:00:00Z" },
      { player_id: PLAYER2_UUID, status: "absent", note: "lesão", recorded_at: "2026-05-31T10:00:00Z" },
      { player_id: "01920a4b-c8d3-7000-9c4e-000000000007", status: "late", note: null, recorded_at: "2026-05-31T10:00:00Z" },
    ];

    const chain: Record<string, unknown> = {};
    chain["eq"] = vi.fn().mockReturnValue(chain);
    chain["data"] = rows;
    chain["error"] = null;
    // Make the final .eq return the data directly (resolved)
    const eqFn = vi.fn().mockImplementation(() => Promise.resolve({ data: rows, error: null }));
    const firstEqFn = vi.fn().mockReturnValue({ eq: eqFn });

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: firstEqFn,
        }),
      }),
    });

    const result = await getSessionAttendances(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
      expect(result.data[0]?.status).toBe("present");
    }
  });

  it("lista vazia → retorna array vazio", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());

    const eqFn = vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null }));
    const firstEqFn = vi.fn().mockReturnValue({ eq: eqFn });

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: firstEqFn,
        }),
      }),
    });

    const result = await getSessionAttendances(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });

  it("requireStaffRole falha → retorna unauthorized", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ noUser: true }));

    const result = await getSessionAttendances(SESSION_UUID);

    expect(result.ok).toBe(false);
  });
});

// ─── getPlayersForAttendance ──────────────────────────────────────────────────

describe("getPlayersForAttendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: retorna activos e inativos", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());

    const playerRows = [
      { id: PLAYER_UUID, full_name: "João Silva", jersey_num: 10, is_active: true },
      { id: PLAYER2_UUID, full_name: "Carlos Matos", jersey_num: 14, is_active: false },
    ];
    const posRows = [
      { player_id: PLAYER_UUID, position: "MID" },
      { player_id: PLAYER2_UUID, position: "DEF" },
    ];

    const playersOrderChain = {
      data: playerRows,
      error: null,
    };
    const playersEqIsArchived = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue(playersOrderChain),
    });
    const playersEqClub = vi.fn().mockReturnValue({
      eq: playersEqIsArchived,
    });
    const playersSelectChain = {
      eq: playersEqClub,
    };

    const posInChain = {
      eq: vi.fn().mockResolvedValue({ data: posRows, error: null }),
    };
    const posSelectChain = {
      in: vi.fn().mockReturnValue(posInChain),
    };

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "players") return { select: vi.fn().mockReturnValue(playersSelectChain) };
        return { select: vi.fn().mockReturnValue(posSelectChain) };
      }),
    });

    const result = await getPlayersForAttendance(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      const joao = result.data.find((p) => p.id === PLAYER_UUID);
      expect(joao?.primary_position).toBe("MID");
      expect(joao?.is_active).toBe(true);
      const carlos = result.data.find((p) => p.id === PLAYER2_UUID);
      expect(carlos?.is_active).toBe(false);
    }
  });

  it("lista vazia → retorna array vazio", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());

    const playersOrderChain = { data: [], error: null };
    const playersEqIsArchived = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue(playersOrderChain),
    });
    const playersEqClub = vi.fn().mockReturnValue({ eq: playersEqIsArchived });

    mockGetServiceRoleClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: playersEqClub }),
      }),
    });

    const result = await getPlayersForAttendance(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(0);
    }
  });
});
