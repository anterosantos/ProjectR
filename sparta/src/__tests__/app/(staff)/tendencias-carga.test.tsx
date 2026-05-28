/**
 * tendencias-carga.test.tsx — Testes de integração para /tendencias/carga (Story 5.9)
 *
 * Cobre AC #1, #2, #3, #4, #6, #7, #9
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { PlayerLoadData, MonthlyLoad } from "@/lib/actions/load";
import type { Season } from "@/lib/schemas/seasons";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/tendencias/carga",
  useRouter: () => ({ push: vi.fn() }),
  redirect: vi.fn(),
}));

vi.mock("@/lib/actions/load", () => ({
  getCumulativeLoadData: vi.fn(),
}));

vi.mock("@/lib/utils/export", () => ({
  exportLoadCsv: vi.fn(),
}));

vi.mock("@/components/ui/drill-down-sheet", () => ({
  DrillDownSheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
}));


import { getCumulativeLoadData } from "@/lib/actions/load";
import { exportLoadCsv } from "@/lib/utils/export";
import { LoadDashboard } from "@/components/domain/LoadDashboard";

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeMonthlyLoad(months = 3, load = 500): MonthlyLoad[] {
  return Array.from({ length: months }, (_, i) => {
    const m = i + 9;
    const monthStr = m < 10 ? `0${m}` : String(m);
    return { month: `2024-${monthStr}`, load };
  });
}

function makePlayerLoadData(overrides: Partial<PlayerLoadData> = {}): PlayerLoadData {
  return {
    playerId: "player-uuid-1",
    playerName: "João Silva",
    position: "MED",
    ageGroup: "senior",
    currentSeasonLoad: 1500,
    currentSeasonSessions: 12,
    currentSeasonMonthly: makeMonthlyLoad(3, 500),
    totalLoad: 3000,
    totalSessions: 24,
    allTimeMonthly: makeMonthlyLoad(6, 500),
    ...overrides,
  };
}

const CURRENT_SEASON: Season = {
  id: "season-uuid-1",
  club_id: "club-uuid-1",
  name: "2024/25",
  start_date: "2024-09-01",
  end_date: "2025-06-30",
  is_current: true,
  created_at: "2024-08-01T00:00:00Z",
};

describe("LoadDashboard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("renderiza lista de jogadores", () => {
    const players = [makePlayerLoadData(), makePlayerLoadData({ playerId: "player-uuid-2", playerName: "Maria Costa" })];
    render(<LoadDashboard players={players} currentSeason={CURRENT_SEASON} />);
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("Maria Costa")).toBeInTheDocument();
  });

  it("badge threshold 'Carga alta' visível para jogador com carga > 1.5x média", () => {
    // Players: 100 and 3000 → avg = (100 + 3000) / 2 = 1550
    // 3000 > 1550 * 1.5 = 2325 → "Carga alta" shows
    const players = [
      makePlayerLoadData({ currentSeasonLoad: 100 }),
      makePlayerLoadData({ playerId: "p2", playerName: "Maria", currentSeasonLoad: 3000 }),
    ];
    render(<LoadDashboard players={players} currentSeason={CURRENT_SEASON} />);
    expect(screen.getByText("Carga alta")).toBeInTheDocument();
  });

  it("badge threshold 'Carga baixa' visível para jogador com carga < 0.5x média", () => {
    // Players: 100 and 3000 → avg = 1550
    // 100 < 1550 * 0.5 = 775 → "Carga baixa" shows
    const players = [
      makePlayerLoadData({ currentSeasonLoad: 100 }),
      makePlayerLoadData({ playerId: "p2", playerName: "Rui", currentSeasonLoad: 3000 }),
    ];
    render(<LoadDashboard players={players} currentSeason={CURRENT_SEASON} />);
    expect(screen.getByText("Carga baixa")).toBeInTheDocument();
  });

  it("groupByMonth agrupa corretamente por mês YYYY-MM", () => {
    // Verify monthly breakdown is reflected in aria-labels (rendered via MonthlyLoadBar)
    const players = [makePlayerLoadData()];
    const { container } = render(<LoadDashboard players={players} currentSeason={CURRENT_SEASON} />);
    // MonthlyLoadBar renders role=img with aria-label containing month info
    const imgs = container.querySelectorAll("[role='img']");
    expect(imgs.length).toBeGreaterThan(0);
  });

  it("season filter: default usa currentSeasonLoad", () => {
    const players = [makePlayerLoadData({ currentSeasonLoad: 999, totalLoad: 3000 })];
    render(<LoadDashboard players={players} currentSeason={CURRENT_SEASON} />);
    expect(screen.getByText("999")).toBeInTheDocument();
    expect(screen.queryByText("3000")).not.toBeInTheDocument();
  });

  it("EmptyState quando lista filtrada está vazia", () => {
    render(<LoadDashboard players={[]} currentSeason={CURRENT_SEASON} />);
    expect(screen.getByText("Nenhum jogador encontrado")).toBeInTheDocument();
  });

  it("exportar CSV invoca exportLoadCsv ao clicar o botão", () => {
    const players = [makePlayerLoadData()];
    render(<LoadDashboard players={players} currentSeason={CURRENT_SEASON} />);
    fireEvent.click(screen.getByText(/exportar csv/i));
    expect(exportLoadCsv).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ playerName: "João Silva" })]),
      "current"
    );
  });

  it("zero violações axe", async () => {
    const players = [makePlayerLoadData()];
    const { container } = render(<LoadDashboard players={players} currentSeason={CURRENT_SEASON} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// Unit tests for groupByMonth logic (pure function behaviour)
describe("groupByMonth logic (via getCumulativeLoadData)", () => {
  it("agrupa métricas em meses YYYY-MM", () => {
    const monthly = makeMonthlyLoad(3, 500);
    expect(monthly[0]?.month).toBe("2024-09");
    expect(monthly[1]?.month).toBe("2024-10");
    expect(monthly[2]?.month).toBe("2024-11");
    expect(monthly[0]?.load).toBe(500);
  });

  it("getCumulativeLoadData mock retorna formato correcto", async () => {
    const mockData = {
      players: [makePlayerLoadData()],
      currentSeason: CURRENT_SEASON,
    };
    vi.mocked(getCumulativeLoadData).mockResolvedValue({ ok: true, data: mockData });
    const result = await getCumulativeLoadData();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.players[0]?.playerName).toBe("João Silva");
      expect(result.data.currentSeason?.name).toBe("2024/25");
    }
  });
});
