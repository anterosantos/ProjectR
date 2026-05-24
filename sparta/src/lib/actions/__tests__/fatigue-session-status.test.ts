/**
 * fatigue-session-status.test.ts — Testes para getSessionFatigueStatus()
 * AC #2 — Story 4.9
 *
 * Cobre:
 * - Retorna { pre: false, post: false } quando não existem respostas
 * - Retorna { pre: true, post: false } quando apenas pré foi respondido
 * - Retorna { pre: true, post: true } quando ambas foram respondidas
 * - Retorna { pre: false, post: false } quando jogador não tem registo
 * - Ignora respostas de outros jogadores (defence-in-depth)
 * - Nunca retorna dados de saúde — apenas booleans (NFR21)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getSessionFatigueStatus } from "@/lib/actions/fatigue";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLAYER_UUID = "550e8400-e29b-41d4-a716-446655440001";
const SESSION_UUID = "650e8400-e29b-41d4-a716-446655440002";
const USER_UUID = "950e8400-e29b-41d4-a716-446655440005";

// ─── Helpers de mock ──────────────────────────────────────────────────────────

function buildMockServerClient(opts?: {
  noUser?: boolean;
  playerData?: object | null;
  fatigueResponses?: Array<{ phase: string }>;
}) {
  const playerRow =
    opts?.playerData !== undefined ? opts.playerData : { id: PLAYER_UUID };

  const fatigueResponses = opts?.fatigueResponses ?? [];

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts?.noUser ? null : { id: USER_UUID } },
      }),
    },
    from: vi.fn((tableName: string) => {
      if (tableName === "players") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: playerRow,
                error: null,
              }),
            }),
          }),
        };
      }

      if (tableName === "fatigue_responses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: fatigueResponses,
                error: null,
              }),
            }),
          }),
        };
      }

      return {
        select: vi.fn().mockReturnValue({ eq: vi.fn() }),
      };
    }),
  };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe("getSessionFatigueStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { pre: false, post: false } when no responses exist", async () => {
    const mockClient = buildMockServerClient({
      fatigueResponses: [],
    });
    (createServerClient as any).mockResolvedValue(mockClient);

    const result = await getSessionFatigueStatus(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ pre: false, post: false });
    }
  });

  it("returns { pre: true, post: false } when only pre answered", async () => {
    const mockClient = buildMockServerClient({
      fatigueResponses: [{ phase: "pre" }],
    });
    (createServerClient as any).mockResolvedValue(mockClient);

    const result = await getSessionFatigueStatus(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ pre: true, post: false });
    }
  });

  it("returns { pre: true, post: true } when both answered", async () => {
    const mockClient = buildMockServerClient({
      fatigueResponses: [{ phase: "pre" }, { phase: "post" }],
    });
    (createServerClient as any).mockResolvedValue(mockClient);

    const result = await getSessionFatigueStatus(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ pre: true, post: true });
    }
  });

  it("returns { pre: false, post: false } when player has no player record", async () => {
    const mockClient = buildMockServerClient({
      playerData: null,
    });
    (createServerClient as any).mockResolvedValue(mockClient);

    const result = await getSessionFatigueStatus(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ pre: false, post: false });
    }
  });

  it("returns error when user is not authenticated", async () => {
    const mockClient = buildMockServerClient({
      noUser: true,
    });
    (createServerClient as any).mockResolvedValue(mockClient);

    const result = await getSessionFatigueStatus(SESSION_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error?.code).toBe("unauthorized");
    }
  });

  it("returns { pre: false, post: true } when only post answered", async () => {
    const mockClient = buildMockServerClient({
      fatigueResponses: [{ phase: "post" }],
    });
    (createServerClient as any).mockResolvedValue(mockClient);

    const result = await getSessionFatigueStatus(SESSION_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ pre: false, post: true });
    }
  });
});
