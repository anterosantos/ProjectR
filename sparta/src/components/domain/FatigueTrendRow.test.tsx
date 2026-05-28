import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FatigueTrendRow } from "./FatigueTrendRow";
import type { PlayerTrendData } from "@/lib/actions/trends";

vi.mock("./FatigueSparkline", () => ({
  FatigueSparkline: ({ data, dimension }: any) => (
    <div data-testid={`sparkline-${dimension}`}>{data.length > 0 ? "chart" : "—"}</div>
  ),
}));

vi.mock("lucide-react", () => ({
  TrendingUp: () => <span data-testid="trending-up">↑</span>,
  TrendingDown: () => <span data-testid="trending-down">↓</span>,
  Minus: () => <span data-testid="minus">−</span>,
}));

describe("FatigueTrendRow", () => {
  function makePlayerTrendData(overrides: Partial<PlayerTrendData> = {}): PlayerTrendData {
    return {
      playerId: "player-uuid-1",
      playerName: "João Silva",
      position: "MED",
      ageGroup: "senior",
      sparklines: {
        dim_energy: [{ date: "2026-05-01", value: 3.5 }],
        dim_focus: [{ date: "2026-05-01", value: 4.0 }],
        dim_sleep: [{ date: "2026-05-01", value: 3.0 }],
        dim_soreness: [{ date: "2026-05-01", value: 2.0 }],
        dim_mood: [{ date: "2026-05-01", value: 3.8 }],
      },
      delta: 0.3,
      hasFatigueData: true,
      ...overrides,
    };
  }

  it("renderiza nome, posição e escalão do jogador", () => {
    const player = makePlayerTrendData();
    render(<FatigueTrendRow player={player} />);
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("MED")).toBeInTheDocument();
    expect(screen.getByText("senior")).toBeInTheDocument();
  });

  it("renderiza 5 sparklines quando hasFatigueData=true", () => {
    const player = makePlayerTrendData();
    render(<FatigueTrendRow player={player} />);
    expect(screen.getByTestId("sparkline-dim_energy")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-dim_focus")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-dim_sleep")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-dim_soreness")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-dim_mood")).toBeInTheDocument();
  });

  it("renderiza — placeholders quando hasFatigueData=false", () => {
    const player = makePlayerTrendData({ hasFatigueData: false });
    const { container } = render(<FatigueTrendRow player={player} />);
    const dashes = container.querySelectorAll("span");
    // Should have multiple dashes for empty sparklines
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("delta positivo mostra verde + ícone TrendingUp", () => {
    const player = makePlayerTrendData({ delta: 0.5 });
    render(<FatigueTrendRow player={player} />);
    const indicator = screen.getByTestId("trending-up");
    expect(indicator).toBeInTheDocument();
    expect(screen.getByText("+0.5")).toBeInTheDocument();
  });

  it("delta negativo mostra vermelho + ícone TrendingDown", () => {
    const player = makePlayerTrendData({ delta: -0.5 });
    render(<FatigueTrendRow player={player} />);
    const indicator = screen.getByTestId("trending-down");
    expect(indicator).toBeInTheDocument();
    expect(screen.getByText("-0.5")).toBeInTheDocument();
  });

  it("delta nulo mostra —", () => {
    const player = makePlayerTrendData({ delta: null });
    const { container } = render(<FatigueTrendRow player={player} />);
    expect(container.textContent).toMatch(/—/);
  });

  it("delta próximo de zero mostra ~0 com Minus icon", () => {
    const player = makePlayerTrendData({ delta: 0.05 });
    render(<FatigueTrendRow player={player} />);
    const indicator = screen.getByTestId("minus");
    expect(indicator).toBeInTheDocument();
    expect(screen.getByText("~0")).toBeInTheDocument();
  });

  it("renderiza player name com fallback —", () => {
    const player = makePlayerTrendData({ playerName: "—" });
    render(<FatigueTrendRow player={player} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
