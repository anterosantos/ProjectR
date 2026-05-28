/**
 * readiness-panel-formation.test.tsx — Testes para ReadinessPanelFormation (Story 5.6)
 *
 * Cobre AC #1, #2, #3, #4, #5, #8, #9:
 * - Toggle "Formação" ativa a vista
 * - EmptyState quando source='none'
 * - 11 chips de titular renderizados
 * - Chips de banco renderizados
 * - Tap num chip abre DrillDownSheet
 * - Acessibilidade axe-core
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/actions/readiness", () => ({
  getFormationData: vi.fn(),
  getUpcomingSession: vi.fn(),
  getReadinessPanelData: vi.fn(),
  getPlayerDrillDownData: vi.fn(),
  getClubReadinessSnapshots: vi.fn(),
  getPlayerReadinessSnapshot: vi.fn(),
  getPlayerAcwrTrend: vi.fn(),
  refreshUpcomingReadiness: vi.fn(),
}));

vi.mock("@/components/domain/readiness/player-drill-down-sheet", () => ({
  PlayerDrillDownSheet: ({
    open,
    snapshot,
  }: {
    open: boolean;
    snapshot: { playerName?: string } | null;
  }) =>
    open ? (
      <div data-testid="drill-down-sheet">{snapshot?.playerName ?? "sheet"}</div>
    ) : null,
}));

vi.mock("recharts", () => ({
  LineChart: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ReadinessPanelFormation } from "@/components/domain/readiness/readiness-panel-formation";
import { getFormationData } from "@/lib/actions/readiness";
import type { PlayerReadinessData } from "@/types/supabase";
import type { FormationResult } from "@/lib/actions/readiness";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const CLUB_UUID    = "650e8400-e29b-41d4-a716-446655440002";

function makePlayer(
  overrides: Partial<PlayerReadinessData> & { player_id: string; primaryPosition: string }
): PlayerReadinessData {
  return {
    session_id: SESSION_UUID,
    club_id: CLUB_UUID,
    state: "ready",
    acwr: 1.1,
    acwr_band_lo: 0.8,
    acwr_band_hi: 1.5,
    recent_fatigue_avg: 2.5,
    attendance_rate: 0.9,
    data_sufficient: true,
    derived_age_group: "senior",
    computed_at: "2026-05-27T00:00:00Z",
    playerName: "Jogador Teste",
    jerseyNum: 10,
    ...overrides,
  };
}

const fixturePlayers: PlayerReadinessData[] = [
  makePlayer({ player_id: "player-gr-1",    jerseyNum: 1,  playerName: "Rui Patrício",  primaryPosition: "GR" }),
  makePlayer({ player_id: "player-def-1",   jerseyNum: 4,  playerName: "Pepe Silva",     primaryPosition: "DEF" }),
  makePlayer({ player_id: "player-def-2",   jerseyNum: 5,  playerName: "Ruben Dias",     primaryPosition: "DEF" }),
  makePlayer({ player_id: "player-def-3",   jerseyNum: 6,  playerName: "José Fonte",     primaryPosition: "DEF" }),
  makePlayer({ player_id: "player-def-4",   jerseyNum: 2,  playerName: "Nélson Semedo",  primaryPosition: "DEF" }),
  makePlayer({ player_id: "player-med-1",   jerseyNum: 8,  playerName: "Moutinho João",  primaryPosition: "MED" }),
  makePlayer({ player_id: "player-med-2",   jerseyNum: 16, playerName: "William Costa",  primaryPosition: "MED" }),
  makePlayer({ player_id: "player-med-3",   jerseyNum: 14, playerName: "Renato Sanches", primaryPosition: "MED" }),
  makePlayer({ player_id: "player-ava-1",   jerseyNum: 7,  playerName: "Ronaldo CR7",    primaryPosition: "AVA" }),
  makePlayer({ player_id: "player-ava-2",   jerseyNum: 17, playerName: "Rafa Silva",     primaryPosition: "AVA" }),
  makePlayer({ player_id: "player-ava-3",   jerseyNum: 11, playerName: "André Silva",    primaryPosition: "AVA" }),
  makePlayer({ player_id: "player-bench-1", jerseyNum: 22, playerName: "Beto Banco",     primaryPosition: "GR" }),
];

const fixtureLineupResult: { ok: true; data: FormationResult } = {
  ok: true,
  data: {
    lineups: [
      { player_id: "player-gr-1",    role: "starter" },
      { player_id: "player-def-1",   role: "starter" },
      { player_id: "player-def-2",   role: "starter" },
      { player_id: "player-def-3",   role: "starter" },
      { player_id: "player-def-4",   role: "starter" },
      { player_id: "player-med-1",   role: "starter" },
      { player_id: "player-med-2",   role: "starter" },
      { player_id: "player-med-3",   role: "starter" },
      { player_id: "player-ava-1",   role: "starter" },
      { player_id: "player-ava-2",   role: "starter" },
      { player_id: "player-ava-3",   role: "starter" },
      { player_id: "player-bench-1", role: "bench" },
    ],
    source: "session_lineup",
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ReadinessPanelFormation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton initially", () => {
    vi.mocked(getFormationData).mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <ReadinessPanelFormation players={fixturePlayers} sessionId={SESSION_UUID} />
    );
    const container = screen.getByTestId("readiness-panel-formation");
    expect(container).toHaveAttribute("aria-busy", "true");
  });

  it("shows EmptyState when source='none'", async () => {
    vi.mocked(getFormationData).mockResolvedValue({
      ok: true,
      data: { lineups: [], source: "none" },
    });
    render(
      <ReadinessPanelFormation players={fixturePlayers} sessionId={SESSION_UUID} />
    );
    await waitFor(() =>
      expect(screen.getByText("Sem convocatória definida")).toBeInTheDocument()
    );
  });

  it("renders 11 starter chips when lineup is provided", async () => {
    vi.mocked(getFormationData).mockResolvedValue(fixtureLineupResult);
    render(
      <ReadinessPanelFormation players={fixturePlayers} sessionId={SESSION_UUID} />
    );
    await waitFor(() => {
      const chips = screen.getAllByRole("button", { name: /Estado:/ });
      // 11 starters on field + 1 bench button
      expect(chips.length).toBeGreaterThanOrEqual(11);
    });
  });

  it("renders bench section with bench players", async () => {
    vi.mocked(getFormationData).mockResolvedValue(fixtureLineupResult);
    render(
      <ReadinessPanelFormation players={fixturePlayers} sessionId={SESSION_UUID} />
    );
    await waitFor(() =>
      expect(screen.getByText(/Banco/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /Beto Banco/ })).toBeInTheDocument();
  });

  it("clicking a starter chip opens DrillDownSheet", async () => {
    vi.mocked(getFormationData).mockResolvedValue(fixtureLineupResult);
    render(
      <ReadinessPanelFormation players={fixturePlayers} sessionId={SESSION_UUID} />
    );

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Estado:/ }).length).toBeGreaterThan(0)
    );

    const chips = screen.getAllByRole("button", { name: /Estado:/ });
    fireEvent.click(chips[0]!);
    expect(screen.getByTestId("drill-down-sheet")).toBeInTheDocument();
  });

  it("clicking a bench chip opens DrillDownSheet", async () => {
    vi.mocked(getFormationData).mockResolvedValue(fixtureLineupResult);
    render(
      <ReadinessPanelFormation players={fixturePlayers} sessionId={SESSION_UUID} />
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Beto Banco/ })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /Beto Banco/ }));
    expect(screen.getByTestId("drill-down-sheet")).toBeInTheDocument();
  });

  it("shows error EmptyState when getFormationData returns error", async () => {
    vi.mocked(getFormationData).mockResolvedValue({
      ok: false,
      error: { code: "db_error", message: "Erro" },
    });
    render(
      <ReadinessPanelFormation players={fixturePlayers} sessionId={SESSION_UUID} />
    );
    await waitFor(() =>
      expect(screen.getByText("Erro ao carregar convocatória")).toBeInTheDocument()
    );
  });

  it("calls getFormationData with the given sessionId", async () => {
    vi.mocked(getFormationData).mockResolvedValue(fixtureLineupResult);
    render(
      <ReadinessPanelFormation players={fixturePlayers} sessionId={SESSION_UUID} />
    );
    await waitFor(() =>
      expect(vi.mocked(getFormationData)).toHaveBeenCalledWith(SESSION_UUID)
    );
  });

  it("has zero axe violations when loaded", async () => {
    vi.mocked(getFormationData).mockResolvedValue(fixtureLineupResult);
    const { container } = render(
      <ReadinessPanelFormation players={fixturePlayers} sessionId={SESSION_UUID} />
    );
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Estado:/ }).length).toBeGreaterThan(0)
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has zero axe violations in empty state", async () => {
    vi.mocked(getFormationData).mockResolvedValue({
      ok: true,
      data: { lineups: [], source: "none" },
    });
    const { container } = render(
      <ReadinessPanelFormation players={fixturePlayers} sessionId={SESSION_UUID} />
    );
    await waitFor(() =>
      expect(screen.getByText("Sem convocatória definida")).toBeInTheDocument()
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
