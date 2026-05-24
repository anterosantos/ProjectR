import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FatigueResponse, SessionInfo } from "@/lib/actions/fatigue-staff";

// Mock recharts — ResizeObserver/SVG unavailable in jsdom (same pattern as player-metrics-chart.test.tsx)
vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ReferenceDot: () => null,
}));

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

import { FatigueChart, FatigueChartSkeleton } from "@/components/domain/FatigueChart";

const PLAYER_ID = "650e8400-e29b-41d4-a716-446655440001";
const SESSION_ID = "750e8400-e29b-41d4-a716-446655440002";

function makeResponse(overrides: Partial<FatigueResponse> = {}): FatigueResponse {
  return {
    id: "850e8400-e29b-41d4-a716-446655440003",
    player_id: PLAYER_ID,
    session_id: SESSION_ID,
    phase: "pre",
    dim_energy: 3,
    dim_focus: 4,
    dim_sleep: 2,
    dim_soreness: 3,
    dim_mood: 4,
    srpe_value: null,
    submitted_at: "2026-05-20T10:00:00Z",
    submitted_via: "app",
    ...overrides,
  };
}

const SESSION_MAP: Record<string, SessionInfo> = {
  [SESSION_ID]: {
    id: SESSION_ID,
    type: "training",
    scheduled_at: "2026-05-20T09:00:00Z",
  },
};

describe("FatigueChart", () => {
  it("renders empty state when no responses", () => {
    render(
      <FatigueChart
        playerId={PLAYER_ID}
        playerName="Tomás Silva"
        responses={[]}
        sessions={{}}
      />
    );
    expect(screen.getByText("Sem respostas ainda")).toBeInTheDocument();
    expect(screen.getByText(/Tomás Silva/)).toBeInTheDocument();
  });

  it("renders chart when responses exist (AC #3)", () => {
    render(
      <FatigueChart
        playerId={PLAYER_ID}
        playerName="Tomás Silva"
        responses={[makeResponse()]}
        sessions={SESSION_MAP}
      />
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Gráfico de fadiga dos últimos 28 dias")
    );
  });

  it("has role=img with descriptive aria-label (AC #8)", () => {
    render(
      <FatigueChart
        playerId={PLAYER_ID}
        playerName="Tomás Silva"
        responses={[makeResponse()]}
        sessions={SESSION_MAP}
      />
    );
    const chart = screen.getByRole("img");
    expect(chart).toHaveAttribute("aria-label", expect.stringContaining("Tomás Silva"));
  });

  it("renders sRPE note when responses have srpe_value", () => {
    render(
      <FatigueChart
        playerId={PLAYER_ID}
        playerName="Tomás Silva"
        responses={[makeResponse({ srpe_value: 7, phase: "post" })]}
        sessions={SESSION_MAP}
      />
    );
    expect(screen.getByText(/sRPE/)).toBeInTheDocument();
  });

  it("does not show sRPE note when all srpe_value are null", () => {
    render(
      <FatigueChart
        playerId={PLAYER_ID}
        playerName="Tomás Silva"
        responses={[makeResponse({ srpe_value: null })]}
        sessions={SESSION_MAP}
      />
    );
    expect(screen.queryByText(/sRPE/)).not.toBeInTheDocument();
  });

  it("filters by phase prop (activePhase=pre hides post responses)", () => {
    const responses = [
      makeResponse({ phase: "pre",  submitted_at: "2026-05-20T08:00:00Z" }),
      makeResponse({ id: "x", phase: "post", submitted_at: "2026-05-20T11:00:00Z" }),
    ];
    // With activePhase="pre": only 1 response, chart should still render
    const { rerender } = render(
      <FatigueChart
        playerId={PLAYER_ID}
        playerName="Tomás"
        responses={responses}
        sessions={SESSION_MAP}
        activePhase="pre"
      />
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();

    // With activePhase="post": 1 response
    rerender(
      <FatigueChart
        playerId={PLAYER_ID}
        playerName="Tomás"
        responses={responses}
        sessions={SESSION_MAP}
        activePhase="post"
      />
    );
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("shows empty state when phase filter removes all results", () => {
    const responses = [makeResponse({ phase: "pre" })];
    render(
      <FatigueChart
        playerId={PLAYER_ID}
        playerName="Tomás Silva"
        responses={responses}
        sessions={SESSION_MAP}
        activePhase="post"
      />
    );
    expect(screen.getByText("Sem respostas ainda")).toBeInTheDocument();
  });
});

describe("FatigueChartSkeleton", () => {
  it("renders loading skeleton with aria-busy", () => {
    render(<FatigueChartSkeleton />);
    const skeleton = screen.getByRole("img", { name: /A carregar/ });
    expect(skeleton).toHaveAttribute("aria-busy", "true");
  });
});
