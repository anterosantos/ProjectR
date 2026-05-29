/**
 * realtime-readiness.test.tsx — Testes para Story 5.7: Realtime + janela 4h pré-sessão
 *
 * AC #1: Subscrição Realtime dentro da janela 4h
 * AC #2: Flash 200ms ease-out via data-flashed
 * AC #3: Botão "Atualizar" fora da janela
 * AC #5: isInPreSessionWindow boundary math + ciclo de vida subscribe/cleanup
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";

// ── UUIDs ─────────────────────────────────────────────────────────────────────
const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const CLUB_UUID    = "650e8400-e29b-41d4-a716-446655440002";

// ── Fixtures temporais ────────────────────────────────────────────────────────
/** 2h no futuro — dentro da janela 4h */
const FUTURE_IN_WINDOW  = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
/** 6h no futuro — fora da janela 4h */
const FUTURE_OUT_WINDOW = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

// ── Mocks hoisted (disponíveis antes do vi.mock factory) ──────────────────────
const { mockSubscribe, mockRemoveChannel } = vi.hoisted(() => ({
  mockSubscribe: vi.fn().mockReturnValue({ status: "SUBSCRIBED" }),
  mockRemoveChannel: vi.fn().mockResolvedValue({ error: null }),
}));

/** Handler capturado quando .on() é chamado — atualizado dentro do mock factory */
let capturedHandler: ((payload: Record<string, unknown>) => void) | null = null;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockImplementation(
        (
          _event: string,
          _filter: unknown,
          handler: (payload: Record<string, unknown>) => void
        ) => {
          capturedHandler = handler;
          return { subscribe: mockSubscribe };
        }
      ),
      subscribe: mockSubscribe,
    }),
    removeChannel: mockRemoveChannel,
  }),
}));

vi.mock("@/lib/actions/readiness", () => ({
  getReadinessPanelData: vi.fn(),
  getUpcomingSession: vi.fn(),
  getClubReadinessSnapshots: vi.fn(),
  getPlayerReadinessSnapshot: vi.fn(),
  getPlayerAcwrTrend: vi.fn(),
  refreshUpcomingReadiness: vi.fn(),
  getPlayerDrillDownData: vi.fn(),
  getFormationData: vi.fn(),
}));

// Importar após mocks
import { isInPreSessionWindow, PRE_SESSION_WINDOW_MS } from "@/lib/readiness/realtime-window";
import { getReadinessPanelData } from "@/lib/actions/readiness";
import { ReadinessPanel } from "@/components/domain/readiness/readiness-panel";
import type { PlayerReadinessData } from "@/types/supabase";

// ── Fixture helper ────────────────────────────────────────────────────────────
function makeSnapshot(
  overrides: Partial<PlayerReadinessData> & {
    player_id: string;
    state: PlayerReadinessData["state"];
  }
): PlayerReadinessData {
  return {
    session_id: SESSION_UUID,
    club_id: CLUB_UUID,
    acwr: null,
    acwr_band_lo: null,
    acwr_band_hi: null,
    recent_fatigue_avg: null,
    attendance_rate: null,
    data_sufficient: true,
    derived_age_group: "senior",
    computed_at: new Date().toISOString(),
    playerName: "Jogador Teste",
    jerseyNum: 10,
    primaryPosition: "MED",
    ...overrides,
  };
}

// ── Testes da função pura isInPreSessionWindow ────────────────────────────────
describe("isInPreSessionWindow — boundary math (AC #5)", () => {
  it("retorna true a meio da janela (2h antes)", () => {
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    expect(isInPreSessionWindow(scheduledAt)).toBe(true);
  });

  it("retorna false antes da janela (5h antes)", () => {
    const scheduledAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    expect(isInPreSessionWindow(scheduledAt)).toBe(false);
  });

  it("retorna false após a sessão ter passado (1min atrás)", () => {
    const scheduledAt = new Date(Date.now() - 60 * 1000).toISOString();
    expect(isInPreSessionWindow(scheduledAt)).toBe(false);
  });

  it("retorna true exactamente no início da janela (scheduledAt - 4h + 1ms)", () => {
    const now = Date.now();
    // scheduledAt = agora + 4h - 1ms → now está 1ms depois de (scheduledAt - 4h)
    const scheduledAt = new Date(now + PRE_SESSION_WINDOW_MS - 1).toISOString();
    expect(isInPreSessionWindow(scheduledAt)).toBe(true);
  });

  it("retorna false exactamente antes da janela (scheduledAt - 4h - 1ms)", () => {
    const now = Date.now();
    // scheduledAt = agora + 4h + 1ms → now está 1ms antes de (scheduledAt - 4h)
    const scheduledAt = new Date(now + PRE_SESSION_WINDOW_MS + 1).toISOString();
    expect(isInPreSessionWindow(scheduledAt)).toBe(false);
  });

  it("exporta PRE_SESSION_WINDOW_MS = 4 horas em ms", () => {
    expect(PRE_SESSION_WINDOW_MS).toBe(4 * 60 * 60 * 1000);
  });
});

// ── Testes do ciclo de vida da subscrição Realtime ────────────────────────────
describe("Ciclo de vida Realtime (AC #1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
  });

  it("subscreve ao Realtime quando inWindow=true", async () => {
    render(
      <ReadinessPanel
        players={[]}
        history={{}}
        sessionId={SESSION_UUID}
        scheduledAt={FUTURE_IN_WINDOW}
      />
    );
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalledTimes(1));
  });

  it("NÃO subscreve ao Realtime quando inWindow=false", async () => {
    render(
      <ReadinessPanel
        players={[]}
        history={{}}
        sessionId={SESSION_UUID}
        scheduledAt={FUTURE_OUT_WINDOW}
      />
    );
    await act(async () => {});
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("remove canal no cleanup (unmount)", async () => {
    const { unmount } = render(
      <ReadinessPanel
        players={[]}
        history={{}}
        sessionId={SESSION_UUID}
        scheduledAt={FUTURE_IN_WINDOW}
      />
    );
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalled());
    unmount();
    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});

// ── Testes do estado players + flash após evento Realtime ─────────────────────
describe("Evento Realtime — atualização de players e flash (AC #2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
  });

  it("atualiza players e activa data-flashed após evento Realtime", async () => {
    const updatedPlayers = [makeSnapshot({ player_id: "p-1", state: "caution" })];
    vi.mocked(getReadinessPanelData).mockResolvedValue({
      ok: true,
      data: { players: updatedPlayers, history: {} },
    });

    render(
      <ReadinessPanel
        players={[makeSnapshot({ player_id: "p-1", state: "ready" })]}
        history={{}}
        sessionId={SESSION_UUID}
        scheduledAt={FUTURE_IN_WINDOW}
      />
    );

    await waitFor(() => expect(capturedHandler).toBeTruthy());

    await act(async () => {
      capturedHandler!({
        new: { player_id: "p-1", state: "caution" },
        old: { player_id: "p-1", state: "ready" },
      });
    });

    await waitFor(() => {
      const flashedEl = document.querySelector("[data-flashed=\"true\"]");
      expect(flashedEl).toBeInTheDocument();
    });
  });

  it("remove data-flashed após 600ms (timers reais)", async () => {
    const updatedPlayers = [makeSnapshot({ player_id: "p-2", state: "alert" })];
    vi.mocked(getReadinessPanelData).mockResolvedValue({
      ok: true,
      data: { players: updatedPlayers, history: {} },
    });

    render(
      <ReadinessPanel
        players={[makeSnapshot({ player_id: "p-2", state: "ready" })]}
        history={{}}
        sessionId={SESSION_UUID}
        scheduledAt={FUTURE_IN_WINDOW}
      />
    );

    await waitFor(() => expect(capturedHandler).toBeTruthy());

    await act(async () => {
      capturedHandler!({
        new: { player_id: "p-2", state: "alert" },
        old: { player_id: "p-2", state: "ready" },
      });
    });

    // Flash está ativo após o evento
    await waitFor(() => {
      expect(document.querySelector("[data-flashed=\"true\"]")).toBeInTheDocument();
    });

    // Aguardar remoção natural do flash (setTimeout 600ms real)
    await waitFor(
      () => {
        expect(document.querySelector("[data-flashed=\"true\"]")).not.toBeInTheDocument();
      },
      { timeout: 1500 }
    );
  }, 10_000);
});

// ── Testes do botão "Atualizar" manual ────────────────────────────────────────
describe("Botão Atualizar (AC #3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra botão Atualizar fora da janela", () => {
    render(
      <ReadinessPanel
        players={[]}
        history={{}}
        sessionId={SESSION_UUID}
        scheduledAt={FUTURE_OUT_WINDOW}
      />
    );
    expect(
      screen.getByRole("button", { name: /atualizar dados de prontidão/i })
    ).toBeInTheDocument();
  });

  it("NÃO mostra botão Atualizar dentro da janela", async () => {
    render(
      <ReadinessPanel
        players={[]}
        history={{}}
        sessionId={SESSION_UUID}
        scheduledAt={FUTURE_IN_WINDOW}
      />
    );
    await act(async () => {});
    expect(
      screen.queryByRole("button", { name: /atualizar dados de prontidão/i })
    ).not.toBeInTheDocument();
  });

  it("refresh manual chama getReadinessPanelData e atualiza players", async () => {
    const newPlayers = [makeSnapshot({ player_id: "p-x", state: "alert" })];
    vi.mocked(getReadinessPanelData).mockResolvedValue({
      ok: true,
      data: { players: newPlayers, history: {} },
    });

    render(
      <ReadinessPanel
        players={[]}
        history={{}}
        sessionId={SESSION_UUID}
        scheduledAt={FUTURE_OUT_WINDOW}
      />
    );

    // act(async) flushes pending microtasks (Promise resolution from mockResolvedValue)
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /atualizar dados de prontidão/i })
      );
    });

    expect(vi.mocked(getReadinessPanelData)).toHaveBeenCalledWith(SESSION_UUID);
  });
});
