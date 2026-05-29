import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlayerGrid } from "@/components/domain/match-event-capture/player-grid";
import { useMatchSession } from "@/lib/stores/match-session";

vi.mock("@/lib/actions/lineups", () => ({
  getLineupForSession: vi.fn(),
}));

const { getLineupForSession } = await import("@/lib/actions/lineups");

const makePlayers = (count: number, overrides: Partial<(typeof mockPlayers)[0]> = {}) =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    session_id: "session-1",
    player_id: `player-${i}`,
    name: `Jogador ${i + 1}`,
    jersey_number: i + 1,
    position: "Avançado",
    age_group: "Senior",
    processing_restricted: false,
    role: "starter" as const,
    ...overrides,
  }));

const mockPlayers = makePlayers(11);

describe("<PlayerGrid>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMatchSession.setState({ selectedPlayer: null, selectedAction: null, lastActionPolarity: null });
    vi.mocked(getLineupForSession).mockResolvedValue({ ok: true, data: mockPlayers });
  });

  it("renderiza 11 botões de jogadores", async () => {
    render(<PlayerGrid sessionId="session-1" />);
    const buttons = await screen.findAllByRole("button");
    expect(buttons).toHaveLength(11);
  });

  it("desabilita botão para jogador com processing_restricted", async () => {
    const restricted = makePlayers(11);
    restricted[0] = { ...restricted[0]!, processing_restricted: true };
    vi.mocked(getLineupForSession).mockResolvedValue({ ok: true, data: restricted });

    render(<PlayerGrid sessionId="session-1" />);
    const buttons = await screen.findAllByRole("button");
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });

  it("mostra estado de carregamento inicial", () => {
    vi.mocked(getLineupForSession).mockReturnValue(new Promise(() => {}));
    render(<PlayerGrid sessionId="session-1" />);
    expect(screen.getByText("Carregando jogadores...")).toBeInTheDocument();
  });

  it("mostra erro quando a ação falha", async () => {
    vi.mocked(getLineupForSession).mockResolvedValue({
      ok: false,
      error: { code: "unknown", message: "Erro de rede" },
    });
    render(<PlayerGrid sessionId="session-1" />);
    await waitFor(() => {
      expect(screen.getByText("Erro ao carregar convocatória.")).toBeInTheDocument();
    });
  });

  it("seleciona jogador ao clicar", async () => {
    render(<PlayerGrid sessionId="session-1" />);
    const buttons = await screen.findAllByRole("button");
    buttons[0]!.click();
    expect(useMatchSession.getState().selectedPlayer?.jersey_number).toBe(1);
  });

  it("chama getLineupForSession exatamente uma vez por mount", async () => {
    render(<PlayerGrid sessionId="session-1" />);
    await screen.findAllByRole("button");
    expect(getLineupForSession).toHaveBeenCalledTimes(1);
    expect(getLineupForSession).toHaveBeenCalledWith("session-1");
  });
});
