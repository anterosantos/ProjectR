import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlayerMetric } from "@/lib/actions/metrics";

// Mock recharts — uses ResizeObserver and SVG APIs unavailable in jsdom
vi.mock("recharts", () => ({
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
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
}));

// ResizeObserver polyfill
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

import { PlayerMetricsChart } from "@/components/ui/player-metrics-chart";

const PLAYER_ID = "650e8400-e29b-41d4-a716-446655440001";
const CLUB_ID = "850e8400-e29b-41d4-a716-446655440003";
const USER_ID = "950e8400-e29b-41d4-a716-446655440004";

function makeMetric(overrides: Partial<PlayerMetric> = {}): PlayerMetric {
  return {
    id: "750e8400-e29b-41d4-a716-446655440002",
    player_id: PLAYER_ID,
    club_id: CLUB_ID,
    weight_kg: 72.5,
    height_cm: 178.0,
    recorded_at: "2026-05-01T10:00:00Z",
    created_by: USER_ID,
    created_at: "2026-05-01T10:00:00Z",
    ...overrides,
  };
}

describe("PlayerMetricsChart", () => {
  it("renders EmptyState when no metrics", () => {
    render(<PlayerMetricsChart metrics={[]} />);
    expect(screen.getByText("Sem leituras ainda")).toBeInTheDocument();
    expect(screen.getByText(/Adiciona a primeira leitura/i)).toBeInTheDocument();
  });

  it("renders EmptyState CTA button when onAddReading provided", () => {
    const onAdd = vi.fn();
    render(<PlayerMetricsChart metrics={[]} onAddReading={onAdd} />);
    expect(screen.getByRole("button", { name: /Adicionar leitura/i })).toBeInTheDocument();
  });

  it("renders chart when metrics exist", () => {
    const metrics = [makeMetric()];
    render(<PlayerMetricsChart metrics={metrics} />);
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("shows latest weight value in summary", () => {
    const metrics = [makeMetric({ weight_kg: 72.5, height_cm: null })];
    render(<PlayerMetricsChart metrics={metrics} />);
    expect(screen.getByText(/72.5 kg/i)).toBeInTheDocument();
  });

  it("shows latest height value in summary", () => {
    const metrics = [makeMetric({ weight_kg: null, height_cm: 178.0 })];
    render(<PlayerMetricsChart metrics={metrics} />);
    expect(screen.getByText(/178 cm/i)).toBeInTheDocument();
  });

  it("shows most recent weight when multiple readings", () => {
    const metrics = [
      makeMetric({
        id: "id-1",
        weight_kg: 70.0,
        recorded_at: "2026-04-01T10:00:00Z",
      }),
      makeMetric({
        id: "id-2",
        weight_kg: 72.5,
        recorded_at: "2026-05-01T10:00:00Z",
      }),
    ];
    render(<PlayerMetricsChart metrics={metrics} />);
    expect(screen.getByText(/72.5 kg/i)).toBeInTheDocument();
  });

  it("does not show weight summary when all weight_kg values are null", () => {
    const metrics = [makeMetric({ weight_kg: null, height_cm: 178.0 })];
    render(<PlayerMetricsChart metrics={metrics} />);
    expect(screen.queryByText(/Peso actual/i)).not.toBeInTheDocument();
  });

  it("does not show height summary when all height_cm values are null", () => {
    const metrics = [makeMetric({ weight_kg: 72.5, height_cm: null })];
    render(<PlayerMetricsChart metrics={metrics} />);
    expect(screen.queryByText(/Altura actual/i)).not.toBeInTheDocument();
  });
});
