import { describe, it, expect, vi, beforeEach } from "vitest";
import { FatigueResponseSchema } from "@/lib/schemas/fatigue";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { createServerClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { submitFatigueResponse } from "@/lib/actions/fatigue";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLAYER_UUID   = "550e8400-e29b-41d4-a716-446655440001";
const SESSION_UUID  = "650e8400-e29b-41d4-a716-446655440002";
const FATIGUE_UUID  = "750e8400-e29b-41d4-a716-446655440003";
const CLUB_UUID     = "850e8400-e29b-41d4-a716-446655440004";
const USER_UUID     = "950e8400-e29b-41d4-a716-446655440005";

const VALID_PAYLOAD = {
  id: FATIGUE_UUID,
  player_id: PLAYER_UUID,
  session_id: SESSION_UUID,
  phase: "pre" as const,
  dim_energy: 4,
  dim_focus: 3,
  dim_sleep: 5,
  dim_soreness: 2,
  dim_mood: 4,
  submitted_via: "online" as const,
};

// ─── Helpers de mock ──────────────────────────────────────────────────────────

function buildMockServerClient(opts?: {
  noUser?: boolean;
  playerData?: object | null;
  processingRestricted?: boolean;
}) {
  const playerRow =
    opts?.playerData !== undefined
      ? opts.playerData
      : {
          id: PLAYER_UUID,
          club_id: CLUB_UUID,
          processing_restricted: opts?.processingRestricted ?? false,
        };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts?.noUser ? null : { id: USER_UUID } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: playerRow,
            error: null,
          }),
        }),
      }),
    }),
  };
}

function buildMockServiceRoleClient(opts?: {
  upsertError?: object | null;
}) {
  const mockUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: opts?.upsertError ?? null,
  });

  return { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) };
}

// ─── Zod Schema Tests ─────────────────────────────────────────────────────────

describe("FatigueResponseSchema — validação Zod", () => {
  const validBase = {
    id: FATIGUE_UUID,
    player_id: PLAYER_UUID,
    session_id: SESSION_UUID,
    phase: "pre" as const,
    dim_energy: 3,
    dim_focus: 3,
    dim_sleep: 3,
    dim_soreness: 3,
    dim_mood: 3,
  };

  it("aceita payload mínimo válido (fase pre)", () => {
    expect(FatigueResponseSchema.safeParse(validBase).success).toBe(true);
  });

  it("aceita payload válido de fase post com srpe_value", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      phase: "post",
      srpe_value: 7,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita fase post sem srpe_value (srpe obrigatório pós-sessão, Story 5-1)", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      phase: "post",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita fase post com srpe_value=null (srpe obrigatório pós-sessão, Story 5-1)", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      phase: "post",
      srpe_value: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita srpe_value não-null em fase pre (refinement)", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      phase: "pre",
      srpe_value: 5,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("srpe_value");
    }
  });

  it("rejeita dimensão abaixo de 1", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      dim_energy: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("dim_energy");
    }
  });

  it("rejeita dimensão acima de 5", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      dim_focus: 6,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("dim_focus");
    }
  });

  it("rejeita dimensão não-inteira", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      dim_sleep: 2.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita phase inválida", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      phase: "during",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("phase");
    }
  });

  it("rejeita srpe_value abaixo de 1", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      phase: "post",
      srpe_value: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejeita srpe_value acima de 10", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      phase: "post",
      srpe_value: 11,
    });
    expect(result.success).toBe(false);
  });

  it("aceita srpe_value no limite inferior (1)", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      phase: "post",
      srpe_value: 1,
    });
    expect(result.success).toBe(true);
  });

  it("aceita srpe_value no limite superior (10)", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      phase: "post",
      srpe_value: 10,
    });
    expect(result.success).toBe(true);
  });

  it("aplica default submitted_via='online' quando omitido", () => {
    const result = FatigueResponseSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.submitted_via).toBe("online");
    }
  });

  it("aceita submitted_via='offline-drain'", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      submitted_via: "offline-drain",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita id não-UUID", () => {
    const result = FatigueResponseSchema.safeParse({
      ...validBase,
      id: "nao-e-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("id");
    }
  });
});

// ─── submitFatigueResponse — testes de integração com mocks ──────────────────

describe("submitFatigueResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna ok({ id }) em submissão bem-sucedida", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockServerClient() as never
    );
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildMockServiceRoleClient() as never
    );

    const result = await submitFatigueResponse(VALID_PAYLOAD);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(FATIGUE_UUID);
    }
  });

  it("retorna unauthorized quando não há sessão", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockServerClient({ noUser: true }) as never
    );

    const result = await submitFatigueResponse(VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });

  it("retorna not_found quando não há registo de jogador para o utilizador", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockServerClient({ playerData: null }) as never
    );

    const result = await submitFatigueResponse(VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("retorna forbidden quando player_id do payload não coincide com o do utilizador", async () => {
    const OTHER_PLAYER = "aaaaaaaa-e29b-41d4-a716-446655440099";
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockServerClient({
        playerData: { id: OTHER_PLAYER, club_id: CLUB_UUID, processing_restricted: false },
      }) as never
    );

    const result = await submitFatigueResponse(VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("retorna processing_restricted quando jogador tem tratamento limitado", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockServerClient({ processingRestricted: true }) as never
    );

    const result = await submitFatigueResponse(VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("processing_restricted");
    }
  });

  it("retorna validation error para payload Zod inválido (dimensão fora de range)", async () => {
    const result = await submitFatigueResponse({
      ...VALID_PAYLOAD,
      dim_energy: 0, // inválido
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("retorna validation error para srpe_value na fase pre", async () => {
    const result = await submitFatigueResponse({
      ...VALID_PAYLOAD,
      phase: "pre",
      srpe_value: 5, // não permitido em pre
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("idempotência: mesmo UUIDv7 submetido duas vezes retorna o mesmo id", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockServerClient() as never
    );
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildMockServiceRoleClient() as never
    );

    const result1 = await submitFatigueResponse(VALID_PAYLOAD);
    const result2 = await submitFatigueResponse(VALID_PAYLOAD);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (result1.ok && result2.ok) {
      // O id é o UUIDv7 fornecido pelo cliente — idempotente por design
      expect(result1.data.id).toBe(result2.data.id);
      expect(result1.data.id).toBe(FATIGUE_UUID);
    }
  });

  it("retorna internal error em falha de DB", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockServerClient() as never
    );
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildMockServiceRoleClient({
        upsertError: { message: "DB error simulado" },
      }) as never
    );

    const result = await submitFatigueResponse(VALID_PAYLOAD);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("internal");
    }
  });

  it("aceita submitted_via='offline-drain' (Story 4.4)", async () => {
    vi.mocked(createServerClient).mockResolvedValue(
      buildMockServerClient() as never
    );
    vi.mocked(getServiceRoleClient).mockReturnValue(
      buildMockServiceRoleClient() as never
    );

    const result = await submitFatigueResponse({
      ...VALID_PAYLOAD,
      submitted_via: "offline-drain",
    });
    expect(result.ok).toBe(true);
  });
});
