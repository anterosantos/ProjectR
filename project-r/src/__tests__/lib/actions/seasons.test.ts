import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/actions/audit", () => ({
  logAccess: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

import { createServerClient } from "@/lib/supabase/server";
import {
  getSeasonsForClub,
  getCurrentSeason,
  createSeason,
  updateSeason,
} from "@/lib/actions/seasons";

const SEASON_UUID = "550e8400-e29b-41d4-a716-446655440001";
const CLUB_UUID = "650e8400-e29b-41d4-a716-446655440002";
const USER_UUID = "750e8400-e29b-41d4-a716-446655440003";

const mockSeason = {
  id: SEASON_UUID,
  club_id: CLUB_UUID,
  name: "2026/27",
  start_date: "2026-08-01",
  end_date: "2027-06-30",
  is_current: false,
  created_at: "2026-05-18T00:00:00Z",
};

function makeSupabaseMock({
  user = { id: USER_UUID },
  profile = { club_id: CLUB_UUID, role: "coach" },
  seasons = [mockSeason],
  singleSeason = mockSeason,
  rpcError = null,
  queryError = null,
  maybeSingleData = mockSeason,
}: {
  user?: { id: string } | null;
  profile?: { club_id: string; role: string } | null;
  seasons?: typeof mockSeason[];
  singleSeason?: typeof mockSeason | null;
  rpcError?: { message: string } | null;
  queryError?: { message: string } | null;
  maybeSingleData?: typeof mockSeason | null;
} = {}) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: maybeSingleData,
      error: queryError,
    }),
    single: vi.fn(),
  };

  // single returns different data based on table
  mockChain.single.mockImplementation(() => {
    return Promise.resolve({
      data: singleSeason ?? profile,
      error: queryError,
    });
  });

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
      return mockChain;
    }),
    rpc: vi.fn().mockResolvedValue({ error: rpcError }),
  };
}

describe("getSeasonsForClub", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve lista de épocas para utilizador autenticado", async () => {
    const mock = makeSupabaseMock();
    // Override order to return seasons list
    const seasonsMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [mockSeason], error: null }),
    };
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { club_id: CLUB_UUID },
            error: null,
          }),
        };
      }
      return seasonsMock;
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getSeasonsForClub();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe("2026/27");
    }
  });

  it("devolve erro unauthorized quando não autenticado", async () => {
    const mock = makeSupabaseMock({ user: null });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getSeasonsForClub();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
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

    const result = await getSeasonsForClub();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
    }
  });
});

describe("getCurrentSeason", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve época atual quando existe", async () => {
    const mock = makeSupabaseMock({ maybeSingleData: mockSeason });
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { club_id: CLUB_UUID },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: mockSeason, error: null }),
      };
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getCurrentSeason();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.name).toBe("2026/27");
    }
  });

  it("devolve null quando não existe época atual", async () => {
    const mock = makeSupabaseMock({ maybeSingleData: null });
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { club_id: CLUB_UUID },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await getCurrentSeason();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });
});

describe("createSeason", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria época com sucesso", async () => {
    const mock = makeSupabaseMock({ singleSeason: mockSeason });
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { club_id: CLUB_UUID },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSeason, error: null }),
      };
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await createSeason({
      name: "2026/27",
      startDate: "2026-08-01",
      endDate: "2027-06-30",
      setAsCurrent: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("2026/27");
    }
  });

  it("chama RPC set_current_season quando setAsCurrent=true", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null });
    const mock = makeSupabaseMock({ singleSeason: mockSeason });
    mock.rpc = rpcMock;
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { club_id: CLUB_UUID },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSeason, error: null }),
      };
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    await createSeason({
      name: "2026/27",
      startDate: "2026-08-01",
      endDate: "2027-06-30",
      setAsCurrent: true,
    });
    expect(rpcMock).toHaveBeenCalledWith("set_current_season", {
      p_season_id: mockSeason.id,
    });
  });

  it("devolve erro de validação quando dados inválidos", async () => {
    const result = await createSeason({
      name: "",
      startDate: "2026-08-01",
      endDate: "2027-06-30",
      setAsCurrent: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("devolve erro unauthorized quando não autenticado", async () => {
    const mock = makeSupabaseMock({ user: null });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await createSeason({
      name: "2026/27",
      startDate: "2026-08-01",
      endDate: "2027-06-30",
      setAsCurrent: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });
});

describe("updateSeason", () => {
  const validUpdate = {
    id: SEASON_UUID,
    name: "2026/27 Actualizada",
    startDate: "2026-08-01",
    endDate: "2027-06-30",
    setAsCurrent: false,
  };

  beforeEach(() => vi.clearAllMocks());

  it("actualiza época com sucesso", async () => {
    const updatedSeason = { ...mockSeason, name: "2026/27 Actualizada" };
    const mock = makeSupabaseMock();
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { club_id: CLUB_UUID },
            error: null,
          }),
        };
      }
      return {
        update: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedSeason, error: null }),
      };
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await updateSeason(validUpdate);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("2026/27 Actualizada");
    }
  });

  it("devolve erro quando época não encontrada (null do single)", async () => {
    const mock = makeSupabaseMock();
    mock.from = vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { club_id: CLUB_UUID },
            error: null,
          }),
        };
      }
      return {
        update: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Row not found" },
        }),
      };
    });
    vi.mocked(createServerClient).mockResolvedValue(mock as never);

    const result = await updateSeason(validUpdate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unknown");
    }
  });
});
