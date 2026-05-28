import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { MonthlyLoad } from "@/lib/actions/load";

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
}));

import { MonthlyLoadBar } from "./MonthlyLoadBar";

function makeData(months = 3): MonthlyLoad[] {
  return Array.from({ length: months }, (_, i) => {
    const m = i + 9;
    const monthStr = m < 10 ? `0${m}` : String(m);
    return { month: `2024-${monthStr}`, load: 500 };
  });
}

describe("MonthlyLoadBar", () => {
  it("renderiza role=img no container", () => {
    render(<MonthlyLoadBar data={makeData(3)} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("renderiza aria-label com resumo de meses", () => {
    const data = makeData(2);
    render(<MonthlyLoadBar data={data} />);
    const elem = screen.getByRole("img");
    expect(elem.getAttribute("aria-label")).toContain("2024-09");
    expect(elem.getAttribute("aria-label")).toContain("500");
  });

  it("renderiza — quando data está vazio", () => {
    render(<MonthlyLoadBar data={[]} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Carga mensal: sem dados");
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("não lança erro com isAnimationActive=false", () => {
    expect(() => {
      render(<MonthlyLoadBar data={makeData(3)} />);
    }).not.toThrow();
  });

  it("usa dimensões customizadas (width/height)", () => {
    const { container } = render(<MonthlyLoadBar data={makeData(2)} width={120} height={40} />);
    const div = container.querySelector("[role='img']");
    expect(div).toHaveStyle("width: 120px");
    expect(div).toHaveStyle("height: 40px");
  });

  it("renderiza BarChart quando tem dados", () => {
    render(<MonthlyLoadBar data={makeData(3)} />);
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });
});
