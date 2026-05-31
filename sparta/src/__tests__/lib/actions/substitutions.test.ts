import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => void) => fn()),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  registerSubstitution,
  closeMatchRecord,
  getMatchLineupForSubs,
} from "@/lib/actions/substitutions";

// ─── Constants ───────────────────────────────────────────────────────────────

const USER_UUID    = "01920a4b-c8d3-7000-9c4e-000000000001";
const CLUB_UUID    = "01920a4b-c8d3-7000-9c4e-000000000002";
const SESSION_UUID = "01920a4b-c8d3-7000-9c4e-000000000003";
const OUT_UUID     = "01920a4b-c8d3-7000-9c4e-000000000004";
const IN_UUID      = "01920a4b-c8d3-7000-9c4e-000000000005";
const LINE_OUT_ID  = "01920a4b-c8d3-7000-9c4e-000000000006";
const LINE_IN_ID   = "01920a4b-c8d3-7000-9c4e-000000000007";

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

// ─── Service role builders ────────────────────────────────────────────────────

function makeMaybeSingleChain(data: object | null, error: object | null = null) {
  const chain: Record<string, unknown> = {};
  chain["maybeSingle"] = vi.fn().mockResolvedValue({ data, error });
  chain["eq"] = vi.fn().mockReturnValue(chain);
  chain["is"] = vi.fn().mockReturnValue(chain);
  chain["select"] = vi.fn().mockReturnValue(chain);
  return chain;
}

function makeUpdateSelectChain(
  data: object[] | null = [],
  error: object | null = null
) {
  const selectChain = { data, error };
  const lastEqChain: Record<string, unknown> = {};
  lastEqChain["select"] = vi.fn().mockResolvedValue(selectChain);
  lastEqChain["is"] = vi.fn().mockReturnValue(lastEqChain);
  lastEqChain["eq"] = vi.fn().mockReturnValue(lastEqChain);

  const updateChain: Record<string, unknown> = {};
  updateChain["eq"] = vi.fn().mockReturnValue(lastEqChain);
  return { update: vi.fn().mockReturnValue(updateChain) };
}

function makeUpdateNoSelectChain(error: object | null = null) {
  const resolved = vi.fn().mockResolvedValue({ error });
  const eqChain: Record<string, unknown> = {};
  eqChain["eq"] = vi.fn().mockReturnValue(eqChain);
  eqChain["_resolved"] = resolved;
  // The chain ends with .eq("id", ...) → awaited
  const lastEq = vi.fn().mockResolvedValue({ error });
  const firstEq = vi.fn().mockReturnValue({ eq: lastEq });
  return { update: vi.fn().mockReturnValue({ eq: firstEq }) };
}

// ─── registerSubstitution ─────────────────────────────────────────────────────

describe("registerSubstitution", () => {
  beforeEach(() => {
    mockCreateServerClient.mockClear();
    mockGetServiceRoleClient.mockClear();
  });

  function buildServiceForSub(opts: {
    sessionData?: object | null;
    outRowData?: object | null;
    inRowData?: object | null;
    outUpdateError?: object | null;
    inUpdateError?: object | null;
  } = {}) {
    const {
      sessionData = { id: SESSION_UUID, duration_min: 90 },
      outRowData = { id: LINE_OUT_ID, role: "starter", ended_minute: null },
      inRowData = { id: LINE_IN_ID, role: "bench" },
      outUpdateError = null,
      inUpdateError = null,
    } = opts;

    let lineupCallCount = 0;
    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "sessions") return makeMaybeSingleChain(sessionData);
        if (table === "match_lineups") {
          lineupCallCount++;
          if (lineupCallCount === 1) return makeMaybeSingleChain(outRowData);
          if (lineupCallCount === 2) return makeMaybeSingleChain(inRowData);
          // Update calls: 3rd = outUpdate, 4th = inUpdate
          if (lineupCallCount === 3)
            return makeUpdateNoSelectChain(outUpdateError);
          return makeUpdateNoSelectChain(inUpdateError);
        }
        return {};
      }),
    };
  }

  it("substitui jogadores com sucesso (happy path)", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceForSub());

    const result = await registerSubstitution(SESSION_UUID, OUT_UUID, IN_UUID, 45);

    expect(result.ok).toBe(true);
  });

  it("rejeita minuto > 120", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceForSub());

    const result = await registerSubstitution(SESSION_UUID, OUT_UUID, IN_UUID, 121);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toContain("120");
    }
  });

  it("rejeita minuto < 0", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceForSub());

    const result = await registerSubstitution(SESSION_UUID, OUT_UUID, IN_UUID, -1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("rejeita sessão de outro clube (sessionData null)", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForSub({ sessionData: null })
    );

    const result = await registerSubstitution(SESSION_UUID, OUT_UUID, IN_UUID, 45);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("rejeita outPlayer já substituído (ended_minute !== null)", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForSub({
        outRowData: { id: LINE_OUT_ID, role: "starter", ended_minute: 30 },
      })
    );

    const result = await registerSubstitution(SESSION_UUID, OUT_UUID, IN_UUID, 45);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toContain("sai");
    }
  });

  it("rejeita outPlayer não é starter", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForSub({
        outRowData: { id: LINE_OUT_ID, role: "bench", ended_minute: null },
      })
    );

    const result = await registerSubstitution(SESSION_UUID, OUT_UUID, IN_UUID, 45);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("rejeita inPlayer não é bench", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForSub({
        inRowData: { id: LINE_IN_ID, role: "starter" },
      })
    );

    const result = await registerSubstitution(SESSION_UUID, OUT_UUID, IN_UUID, 45);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
      expect(result.error.message).toContain("entra");
    }
  });

  it("retorna unauthorized se não autenticado", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ noUser: true }));
    mockGetServiceRoleClient.mockReturnValue(buildServiceForSub());

    const result = await registerSubstitution(SESSION_UUID, OUT_UUID, IN_UUID, 45);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });

  it("retorna forbidden para role player", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ role: "player" }));
    mockGetServiceRoleClient.mockReturnValue(buildServiceForSub());

    const result = await registerSubstitution(SESSION_UUID, OUT_UUID, IN_UUID, 45);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
    }
  });
});

// ─── closeMatchRecord ─────────────────────────────────────────────────────────

describe("closeMatchRecord", () => {
  beforeEach(() => {
    mockCreateServerClient.mockClear();
    mockGetServiceRoleClient.mockClear();
  });

  function buildServiceForClose(opts: {
    sessionData?: object | null;
    updatedRows?: object[];
    updateError?: object | null;
  } = {}) {
    const {
      sessionData = { id: SESSION_UUID, duration_min: 90 },
      updatedRows = [{ id: LINE_OUT_ID }, { id: LINE_IN_ID }],
      updateError = null,
    } = opts;

    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "sessions") return makeMaybeSingleChain(sessionData);
        if (table === "match_lineups")
          return makeUpdateSelectChain(updatedRows, updateError);
        return {};
      }),
    };
  }

  it("actualiza ended_minute para todos os starters em campo (happy path)", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceForClose());

    const result = await closeMatchRecord(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.updated_count).toBe(2);
    }
  });

  it("idempotente: 0 rows actualizados quando já encerrado", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForClose({ updatedRows: [] })
    );

    const result = await closeMatchRecord(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.updated_count).toBe(0);
    }
  });

  it("retorna not_found se sessão não existe", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForClose({ sessionData: null })
    );

    const result = await closeMatchRecord(SESSION_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("retorna erro se update falha", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForClose({ updateError: { message: "DB error" } })
    );

    const result = await closeMatchRecord(SESSION_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("retorna unauthorized se não autenticado", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient({ noUser: true }));
    mockGetServiceRoleClient.mockReturnValue(buildServiceForClose());

    const result = await closeMatchRecord(SESSION_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });
});

// ─── getMatchLineupForSubs ────────────────────────────────────────────────────

describe("getMatchLineupForSubs", () => {
  beforeEach(() => {
    mockCreateServerClient.mockClear();
    mockGetServiceRoleClient.mockClear();
  });

  const mockRows = [
    {
      id: LINE_OUT_ID,
      player_id: OUT_UUID,
      role: "starter",
      shirt_num: 10,
      started_minute: 0,
      ended_minute: null,
      players: { full_name: "João Silva", jersey_num: 10 },
    },
    {
      id: "lid-2",
      player_id: "pid-2",
      role: "starter",
      shirt_num: 7,
      started_minute: 30,
      ended_minute: 60, // já saiu — não deve aparecer como starter activo
      players: { full_name: "Pedro Costa", jersey_num: 7 },
    },
    {
      id: LINE_IN_ID,
      player_id: IN_UUID,
      role: "bench",
      shirt_num: 14,
      started_minute: 0,
      ended_minute: null,
      players: { full_name: "Carlos Matos", jersey_num: 14 },
    },
  ];

  function buildServiceForLineup(opts: {
    sessionData?: object | null;
    rows?: object[] | null;
    rowsError?: object | null;
  } = {}) {
    const {
      sessionData = { id: SESSION_UUID },
      rows = mockRows,
      rowsError = null,
    } = opts;

    const rowsChain: Record<string, unknown> = {};
    rowsChain["eq"] = vi.fn().mockReturnValue(rowsChain);
    rowsChain["select"] = vi.fn().mockReturnValue(rowsChain);
    // Last eq is awaited
    rowsChain["eq"] = vi.fn().mockImplementation(() => {
      // Second call to .eq() is awaited
      return { ...rowsChain, then: undefined };
    });
    // Simpler: just mock as resolved directly
    const lineupChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: rows, error: rowsError }),
      }),
    };

    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "sessions") return makeMaybeSingleChain(sessionData);
        if (table === "match_lineups") return lineupChain;
        return {};
      }),
    };
  }

  it("separa starters activos e bench correctamente", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceForLineup());

    const result = await getMatchLineupForSubs(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Apenas o starter com ended_minute IS NULL
      expect(result.data.starters).toHaveLength(1);
      expect(result.data.starters[0]?.player_id).toBe(OUT_UUID);

      // Bench
      expect(result.data.bench).toHaveLength(1);
      expect(result.data.bench[0]?.player_id).toBe(IN_UUID);
    }
  });

  it("exclui starters que já saíram (ended_minute set)", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(buildServiceForLineup());

    const result = await getMatchLineupForSubs(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // "Pedro Costa" tem ended_minute=60, não deve estar como starter activo
      const playerIds = result.data.starters.map((s) => s.player_id);
      expect(playerIds).not.toContain("pid-2");
    }
  });

  it("retorna not_found se sessão não pertence ao clube", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForLineup({ sessionData: null })
    );

    const result = await getMatchLineupForSubs(SESSION_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("retorna starters e bench vazios quando sem rows", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForLineup({ rows: null })
    );

    const result = await getMatchLineupForSubs(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.starters).toHaveLength(0);
      expect(result.data.bench).toHaveLength(0);
    }
  });

  it("retorna erro se query falha", async () => {
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForLineup({ rowsError: { message: "DB error" } })
    );

    const result = await getMatchLineupForSubs(SESSION_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unknown");
    }
  });

  it("usa shirt_num da lineup, fallback para players.jersey_num", async () => {
    const rowsWithNull = [
      {
        id: LINE_OUT_ID,
        player_id: OUT_UUID,
        role: "starter",
        shirt_num: null,
        started_minute: 0,
        ended_minute: null,
        players: { full_name: "João Silva", jersey_num: 9 },
      },
    ];
    mockCreateServerClient.mockResolvedValue(buildServerClient());
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceForLineup({ rows: rowsWithNull })
    );

    const result = await getMatchLineupForSubs(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.starters[0]?.jersey_number).toBe(9);
    }
  });
});
