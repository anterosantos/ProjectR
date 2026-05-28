import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FatigueSparkline } from "./FatigueSparkline";
import type { SparklinePoint } from "@/lib/actions/trends";

vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("FatigueSparkline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza aria-label com trend crescente quando last > first", () => {
    const data: SparklinePoint[] = [
      { date: "2026-05-01", value: 2 },
      { date: "2026-05-02", value: 4.5 },
    ];
    render(<FatigueSparkline data={data} dimension="dim_energy" />);
    const elem = screen.getByRole("img");
    expect(elem).toHaveAttribute("aria-label", expect.stringContaining("crescente"));
  });

  it("renderiza aria-label com trend decrescente quando last < first", () => {
    const data: SparklinePoint[] = [
      { date: "2026-05-01", value: 4 },
      { date: "2026-05-02", value: 2 },
    ];
    render(<FatigueSparkline data={data} dimension="dim_focus" />);
    const elem = screen.getByRole("img");
    expect(elem).toHaveAttribute("aria-label", expect.stringContaining("decrescente"));
  });

  it("renderiza aria-label com trend estável quando diferença <= 0.2", () => {
    const data: SparklinePoint[] = [
      { date: "2026-05-01", value: 3 },
      { date: "2026-05-02", value: 3.1 },
    ];
    render(<FatigueSparkline data={data} dimension="dim_sleep" />);
    const elem = screen.getByRole("img");
    expect(elem).toHaveAttribute("aria-label", expect.stringContaining("estável"));
  });

  it("renderiza — quando data está vazio", () => {
    const data: SparklinePoint[] = [];
    const { container } = render(<FatigueSparkline data={data} dimension="dim_soreness" />);
    expect(container.textContent).toContain("—");
  });

  it("renderiza role=img no container", () => {
    const data: SparklinePoint[] = [{ date: "2026-05-01", value: 3 }];
    render(<FatigueSparkline data={data} dimension="dim_mood" />);
    const elem = screen.getByRole("img");
    expect(elem).toBeInTheDocument();
  });

  it("não lança erro com isAnimationActive=false", () => {
    const data: SparklinePoint[] = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      value: 3,
    }));
    expect(() => {
      render(<FatigueSparkline data={data} dimension="dim_energy" />);
    }).not.toThrow();
  });

  it("usa dimensão label correcto no aria-label", () => {
    const data: SparklinePoint[] = [{ date: "2026-05-01", value: 3 }];
    render(<FatigueSparkline data={data} dimension="dim_energy" />);
    const elem = screen.getByRole("img");
    expect(elem).toHaveAttribute("aria-label", expect.stringContaining("Energia"));
  });

  it("respeita largura e altura customizadas", () => {
    const data: SparklinePoint[] = [{ date: "2026-05-01", value: 3 }];
    const { container } = render(
      <FatigueSparkline data={data} dimension="dim_focus" width={100} height={50} />
    );
    const div = container.querySelector("[role='img']");
    expect(div).toHaveStyle("width: 100px");
    expect(div).toHaveStyle("height: 50px");
  });
});
