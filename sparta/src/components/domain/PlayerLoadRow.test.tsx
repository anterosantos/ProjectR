import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlayerLoadData } from "@/lib/actions/load";

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/domain/MonthlyLoadBar", () => ({
  MonthlyLoadBar: () => <div data-testid="monthly-load-bar" />,
}));

import { PlayerLoadRow } from "./PlayerLoadRow";

function makePlayer(overrides: Partial<PlayerLoadData> = {}): PlayerLoadData {
  return {
    playerId: "player-uuid-1",
    playerName: "João Silva",
    position: "MED",
    ageGroup: "senior",
    currentSeasonLoad: 1500,
    currentSeasonSessions: 12,
    currentSeasonMonthly: [],
    totalLoad: 3000,
    totalSessions: 24,
    allTimeMonthly: [],
    ...overrides,
  };
}

describe("PlayerLoadRow", () => {
  it("renderiza nome, posição e escalão", () => {
    const player = makePlayer();
    render(
      <table><tbody>
        <PlayerLoadRow player={player} seasonAvg={1500} load={1500} monthly={[]} sessions={12} />
      </tbody></table>
    );
    expect(screen.getByText("João Silva")).toBeInTheDocument();
    expect(screen.getByText("MED")).toBeInTheDocument();
    expect(screen.getByText("senior")).toBeInTheDocument();
  });

  it("não mostra badge quando carga está na média (0.5x < load < 1.5x)", () => {
    const player = makePlayer();
    render(
      <table><tbody>
        <PlayerLoadRow player={player} seasonAvg={1500} load={1500} monthly={[]} sessions={12} />
      </tbody></table>
    );
    expect(screen.queryByText("Carga baixa")).not.toBeInTheDocument();
    expect(screen.queryByText("Carga alta")).not.toBeInTheDocument();
  });

  it("mostra badge 'Carga baixa' quando total_load < seasonAvg * 0.5", () => {
    const player = makePlayer();
    render(
      <table><tbody>
        <PlayerLoadRow player={player} seasonAvg={1500} load={700} monthly={[]} sessions={12} />
      </tbody></table>
    );
    expect(screen.getByText("Carga baixa")).toBeInTheDocument();
    expect(screen.queryByText("Carga alta")).not.toBeInTheDocument();
  });

  it("mostra badge 'Carga alta' quando total_load > seasonAvg * 1.5", () => {
    const player = makePlayer();
    render(
      <table><tbody>
        <PlayerLoadRow player={player} seasonAvg={1500} load={2300} monthly={[]} sessions={12} />
      </tbody></table>
    );
    expect(screen.getByText("Carga alta")).toBeInTheDocument();
    expect(screen.queryByText("Carga baixa")).not.toBeInTheDocument();
  });

  it("badge 'Carga baixa' tem ícone redundante (UX-DR1)", () => {
    const player = makePlayer();
    const { container } = render(
      <table><tbody>
        <PlayerLoadRow player={player} seasonAvg={1500} load={700} monthly={[]} sessions={12} />
      </tbody></table>
    );
    // Icon should have aria-hidden="true"
    const icons = container.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
    expect(screen.getByText("Carga baixa")).toBeInTheDocument();
  });

  it("badge 'Carga alta' tem ícone redundante (UX-DR1)", () => {
    const player = makePlayer();
    const { container } = render(
      <table><tbody>
        <PlayerLoadRow player={player} seasonAvg={1500} load={2300} monthly={[]} sessions={12} />
      </tbody></table>
    );
    const icons = container.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
    expect(screen.getByText("Carga alta")).toBeInTheDocument();
  });

  it("carga zero não mostra badge 'Carga baixa'", () => {
    const player = makePlayer();
    render(
      <table><tbody>
        <PlayerLoadRow player={player} seasonAvg={1500} load={0} monthly={[]} sessions={0} />
      </tbody></table>
    );
    expect(screen.queryByText("Carga baixa")).not.toBeInTheDocument();
    expect(screen.queryByText("Carga alta")).not.toBeInTheDocument();
  });

  it("renderiza contagem de sessões", () => {
    const player = makePlayer();
    render(
      <table><tbody>
        <PlayerLoadRow player={player} seasonAvg={1500} load={1500} monthly={[]} sessions={12} />
      </tbody></table>
    );
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});
