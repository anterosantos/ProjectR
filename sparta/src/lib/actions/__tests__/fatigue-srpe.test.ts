/**
 * fatigue-srpe.test.ts — Testes de integração para upsert de session_metrics
 * em submitFatigueResponse() (Story 5.1, AC #2, AC #3, AC #5)
 *
 * Cobre:
 * - Upsert idempotente em session_metrics após submissão pós-sessão com srpe_value
 * - Caso null srpe_value → nenhum upsert em session_metrics
 * - Lookup de duration_min da sessão antes do upsert
 * - Erro não-bloqueante: falha em session_metrics não afecta resultado principal
 * - Falha no lookup da sessão: log de erro, sem upsert
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { logger } from "@/lib/logger";
import { submitFatigueResponse } from "@/lib/actions/fatigue";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLAYER_UUID  = "550e8400-e29b-41d4-a716-446655440001";
const SESSION_UUID = "650e8400-e29b-41d4-a716-446655440002";
const FATIGUE_UUID = "750e8400-e29b-41d4-a716-446655440003";
const CLUB_UUID    = "850e8400-e29b-41d4-a716-446655440004";
const USER_UUID    = "950e8400-e29b-41d4-a716-446655440005";
const DURATION_MIN = 90;

/** Payload pós-sessão com srpe_value */
const POST_PAYLOAD_WITH_SRPE = {
  id: FATIGUE_UUID,
  player_id: PLAYER_UUID,
  session_id: SESSION_UUID,
  phase: "post" as const,
  dim_energy: 4,
  dim_focus: 3,
  dim_sleep: 5,
  dim_soreness: 2,
  dim_mood: 4,
  srpe_value: 7,
  submitted_via: "online" as const,
};

/** Payload pós-sessão sem srpe_value (null) */
const POST_PAYLOAD_NULL_SRPE = {
  ...POST_PAYLOAD_WITH_SRPE,
  srpe_value: null,
};

// ─── Helpers de mock ──────────────────────────────────────────────────────────

/** Mock do server client (auth + player lookup) */
function buildMockServerClient(opts?: {
  noUser?: boolean;
  playerData?: object | null;
}) {
  const playerRow =
    opts?.playerData !== undefined
      ? opts.playerData
      : { id: PLAYER_UUID, club_id: CLUB_UUID, processing_restricted: false };

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

/**
 * Mock do service-role client com suporte a múltiplas tabelas.
 * Distingue por nome de tabela para permitir assertions granulares.
 */
function buildMockServiceRoleClient(opts?: {
  fatigueUpsertError?: { message: string } | null;
  sessionData?: { duration_min: number } | null;
  sessionError?: { message: string } | null;
  sessionMetricsUpsertError?: { message: string } | null;
}) {
  const mockFatigueUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: opts?.fatigueUpsertError ?? null,
  });

  const mockSessionMaybeSingle = vi.fn().mockResolvedValue({
    data: opts?.sessionData !== undefined ? opts.sessionData : { duration_min: DURATION_MIN },
    error: opts?.sessionError ?? null,
  });

  const mockSessionMetricsUpsert = vi.fn().mockResolvedValue({
    data: null,
    error: opts?.sessionMetricsUpsertError ?? null,
  });

  const mockAuditInsert = vi.fn().mockResolvedValue({ data: null, error: null });

  const mockFrom = vi.fn((table: string) => {
    if (table === "fatigue_responses") {
      return { upsert: mockFatigueUpsert };
    }
    if (table === "sessions") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: mockSessionMaybeSingle,
          }),
        }),
      };
    }
    if (table === "session_metrics") {
      return { upsert: mockSessionMetricsUpsert };
    }
    if (table === "audit_logs") {
      return { insert: mockAuditInsert };
    }
    return { upsert: vi.fn(), insert: vi.fn() };
  });

  return {
    from: mockFrom,
    mockFatigueUpsert,
    mockSessionMaybeSingle,
    mockSessionMetricsUpsert,
    mockAuditInsert,
  };
}

/** Aguarda microtasks e macrotasks pendentes (necessário para fire-and-forget) */
async function flushAsync() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("submitFatigueResponse — session_metrics upsert (Story 5.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC #2 — Upsert session_metrics após submissão pós-sessão com srpe_value
  describe("AC #2: Upsert session_metrics com srpe_value presente", () => {
    it("faz upsert em session_metrics após fatigue_responses bem-sucedido", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient();
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      const result = await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      expect(result.ok).toBe(true);
      // Verifica que buscou duration_min da sessão
      expect(srMock.from).toHaveBeenCalledWith("sessions");
      expect(srMock.mockSessionMaybeSingle).toHaveBeenCalled();
      // Verifica que fez upsert em session_metrics
      expect(srMock.from).toHaveBeenCalledWith("session_metrics");
      expect(srMock.mockSessionMetricsUpsert).toHaveBeenCalledOnce();
    });

    it("upserta com os campos correctos (club_id, session_id, player_id, srpe_value, duration_min)", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient();
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      const upsertCall = srMock.mockSessionMetricsUpsert.mock.calls[0];
      expect(upsertCall).toBeDefined();
      const payload = upsertCall?.[0] as Record<string, unknown>;
      expect(payload).toMatchObject({
        club_id: CLUB_UUID,
        session_id: SESSION_UUID,
        player_id: PLAYER_UUID,
        srpe_value: 7,
        duration_min: DURATION_MIN,
      });
      // srpe_load NÃO deve ser incluído no payload (coluna GENERATED STORED)
      expect(payload).not.toHaveProperty("srpe_load");
    });

    it("upserta com ON CONFLICT session_id,player_id (idempotência)", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient();
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      const conflictOptions = srMock.mockSessionMetricsUpsert.mock.calls[0]?.[1];
      expect(conflictOptions).toMatchObject({
        onConflict: "session_id,player_id",
        ignoreDuplicates: false,
      });
    });

    it("upsert idempotente: segunda submissão com srpe diferente actualiza o valor", async () => {
      // Simula duas chamadas — o mock retorna sucesso ambas as vezes
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient();
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      // Primeira submissão (srpe=7)
      const r1 = await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      // Segunda submissão (srpe=9 — mesmo session_id + player_id)
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock2 = buildMockServiceRoleClient();
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock2 as never);

      const r2 = await submitFatigueResponse({
        ...POST_PAYLOAD_WITH_SRPE,
        id: "850e8400-e29b-41d4-a716-446655440099", // novo UUIDv7 de fatigue
        srpe_value: 9,
      });
      await flushAsync();

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);

      // Cada submissão chama upsert uma vez com ignoreDuplicates: false → actualiza
      expect(srMock.mockSessionMetricsUpsert).toHaveBeenCalledOnce();
      expect(srMock2.mockSessionMetricsUpsert).toHaveBeenCalledOnce();

      // Confirmar srpe_value correcto em cada chamada
      const payload1 = srMock.mockSessionMetricsUpsert.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload1?.["srpe_value"]).toBe(7);

      const payload2 = srMock2.mockSessionMetricsUpsert.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload2?.["srpe_value"]).toBe(9);
    });

    it("loga session_metrics.upserted em sucesso", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient();
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        "session_metrics.upserted",
        expect.objectContaining({
          player_id: PLAYER_UUID,
          session_id: SESSION_UUID,
          srpe_value: 7,
          duration_min: DURATION_MIN,
          srpe_load: 630, // 7 × 90
        })
      );
    });

    it("lookup de duration_min usa o session_id do payload", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient({ sessionData: { duration_min: 120 } });
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      // Verifica que duration_min é o que veio da sessão (120), não outro valor
      const upsertPayload = srMock.mockSessionMetricsUpsert.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(upsertPayload?.["duration_min"]).toBe(120);
    });
  });

  // AC #3 — srpe_value null → sem upsert em session_metrics
  describe("AC #3: srpe_value null → nenhum upsert em session_metrics", () => {
    it("não faz upsert em session_metrics quando srpe_value é null", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient();
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      const result = await submitFatigueResponse(POST_PAYLOAD_NULL_SRPE);
      await flushAsync();

      expect(result.ok).toBe(true);
      // Não deve chamar sessões nem session_metrics
      expect(srMock.from).not.toHaveBeenCalledWith("sessions");
      expect(srMock.mockSessionMetricsUpsert).not.toHaveBeenCalled();
    });

    it("loga session_metrics.skipped_null_srpe quando srpe_value é null", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient();
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      await submitFatigueResponse(POST_PAYLOAD_NULL_SRPE);
      await flushAsync();

      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        "session_metrics.skipped_null_srpe",
        expect.objectContaining({
          player_id: PLAYER_UUID,
          session_id: SESSION_UUID,
        })
      );
    });

    it("não toca em session_metrics para fase pre (sem srpe_value)", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient();
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      const prePayload = {
        ...POST_PAYLOAD_WITH_SRPE,
        phase: "pre" as const,
        srpe_value: undefined,
      };

      const result = await submitFatigueResponse(prePayload);
      await flushAsync();

      expect(result.ok).toBe(true);
      expect(srMock.mockSessionMetricsUpsert).not.toHaveBeenCalled();
    });
  });

  // Erros não-bloqueantes
  describe("Erros não-bloqueantes: falha em session_metrics não afecta resultado", () => {
    it("retorna ok mesmo quando o upsert de session_metrics falha", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient({
        sessionMetricsUpsertError: { message: "constraint violation simulado" },
      });
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      const result = await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      // fatigue_response foi gravada com sucesso → ok
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe(FATIGUE_UUID);
      }
    });

    it("loga session_metrics.upsert_failed quando o upsert falha", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient({
        sessionMetricsUpsertError: { message: "DB error" },
      });
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        "session_metrics.upsert_failed",
        expect.objectContaining({ player_id: PLAYER_UUID, session_id: SESSION_UUID })
      );
    });

    it("retorna ok quando o lookup da sessão falha (não encontrada)", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient({
        sessionData: null, // sessão não encontrada
      });
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      const result = await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      expect(result.ok).toBe(true);
      // session_metrics NÃO deve ser chamado quando a sessão não existe
      expect(srMock.mockSessionMetricsUpsert).not.toHaveBeenCalled();
    });

    it("loga session_metrics.session_lookup_failed quando sessão não existe", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient({
        sessionData: null,
      });
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        "session_metrics.session_lookup_failed",
        expect.objectContaining({
          player_id: PLAYER_UUID,
          session_id: SESSION_UUID,
        })
      );
    });

    it("retorna ok quando o lookup da sessão retorna erro de DB", async () => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient({
        sessionError: { message: "DB connection error" },
        sessionData: null,
      });
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      const result = await submitFatigueResponse(POST_PAYLOAD_WITH_SRPE);
      await flushAsync();

      expect(result.ok).toBe(true);
      expect(srMock.mockSessionMetricsUpsert).not.toHaveBeenCalled();
    });
  });

  // srpe_load calculado correctamente (via log)
  describe("srpe_load calculado: srpe_value × duration_min", () => {
    it.each([
      { srpe: 1, dur: 15, expectedLoad: 15 },
      { srpe: 10, dur: 240, expectedLoad: 2400 },
      { srpe: 7, dur: 90, expectedLoad: 630 },
      { srpe: 5, dur: 60, expectedLoad: 300 },
    ])("srpe=$srpe, dur=$dur → srpe_load=$expectedLoad", async ({ srpe, dur, expectedLoad }) => {
      vi.mocked(createServerClient).mockResolvedValue(
        buildMockServerClient() as never
      );
      const srMock = buildMockServiceRoleClient({ sessionData: { duration_min: dur } });
      vi.mocked(getServiceRoleClient).mockReturnValue(srMock as never);

      await submitFatigueResponse({
        ...POST_PAYLOAD_WITH_SRPE,
        srpe_value: srpe,
      });
      await flushAsync();

      // srpe_load é logado (usado para verificação sem query à BD)
      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        "session_metrics.upserted",
        expect.objectContaining({ srpe_load: expectedLoad })
      );
    });
  });
});
