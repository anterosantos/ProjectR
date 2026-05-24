import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FatigueFilters } from "@/components/domain/FatigueFilters";

// Reset sessionStorage before each test
beforeEach(() => {
  sessionStorage.clear();
});

// Mock DrillDownSheet to render children inline for easier testing
vi.mock("@/components/ui/drill-down-sheet", () => ({
  DrillDownSheet: ({
    open,
    children,
  }: {
    open?: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="filter-sheet">{children}</div> : null),
}));

describe("FatigueFilters", () => {
  it("renders filter button with aria-label (AC #8)", () => {
    render(<FatigueFilters onFilter={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /Abrir filtros/i })
    ).toBeInTheDocument();
  });

  it("calls onFilter with default filters on mount (AC #6)", () => {
    const onFilter = vi.fn();
    render(<FatigueFilters onFilter={onFilter} />);
    expect(onFilter).toHaveBeenCalledOnce();
    const arg = onFilter.mock.calls[0]?.[0];
    expect(arg).toBeDefined();
    expect(arg.phase).toBeUndefined();
    expect(arg.dimensions).toHaveLength(5);
  });

  it("opens filter sheet when button clicked", () => {
    render(<FatigueFilters onFilter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    expect(screen.getByTestId("filter-sheet")).toBeInTheDocument();
  });

  it("shows all phase options in filter sheet", () => {
    render(<FatigueFilters onFilter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    expect(screen.getByLabelText("Todas")).toBeInTheDocument();
    expect(screen.getByLabelText("Pré-sessão")).toBeInTheDocument();
    expect(screen.getByLabelText("Pós-sessão")).toBeInTheDocument();
  });

  it("shows all 5 dimension checkboxes", () => {
    render(<FatigueFilters onFilter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    expect(screen.getByLabelText("Energia")).toBeInTheDocument();
    expect(screen.getByLabelText("Concentração")).toBeInTheDocument();
    expect(screen.getByLabelText("Sono")).toBeInTheDocument();
    expect(screen.getByLabelText("Dores")).toBeInTheDocument();
    expect(screen.getByLabelText("Estado emocional")).toBeInTheDocument();
  });

  it("applies phase filter and calls onFilter (AC #6)", () => {
    const onFilter = vi.fn();
    render(<FatigueFilters onFilter={onFilter} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));

    // Select "Pré-sessão"
    fireEvent.click(screen.getByLabelText("Pré-sessão"));

    // Click Aplicar
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    expect(onFilter).toHaveBeenCalledTimes(2); // once on mount, once on apply
    const lastCall = onFilter.mock.calls[onFilter.mock.calls.length - 1]?.[0];
    expect(lastCall?.phase).toBe("pre");
  });

  it("saves filter state to sessionStorage on apply (AC #6)", () => {
    render(<FatigueFilters onFilter={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    fireEvent.click(screen.getByLabelText("Pós-sessão"));
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    const stored = sessionStorage.getItem("sparta-fatigue-filters");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.phase).toBe("post");
  });

  it("shows active filter chip when phase is set (AC #6)", () => {
    const onFilter = vi.fn();
    render(<FatigueFilters onFilter={onFilter} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    fireEvent.click(screen.getByLabelText("Pré-sessão"));
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    expect(screen.getByText("Pré-sessão")).toBeInTheDocument();
  });

  it("removes filter chip when X is clicked", () => {
    const onFilter = vi.fn();
    render(<FatigueFilters onFilter={onFilter} />);
    // Open + apply pre filter
    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    fireEvent.click(screen.getByLabelText("Pré-sessão"));
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    // Chip should be visible
    const removeBtn = screen.getByRole("button", { name: /Remover filtro: Pré-sessão/i });
    fireEvent.click(removeBtn);

    // Chip removed
    expect(screen.queryByText("Pré-sessão")).not.toBeInTheDocument();
    // onFilter called again with phase=undefined
    const lastCall = onFilter.mock.calls[onFilter.mock.calls.length - 1]?.[0];
    expect(lastCall?.phase).toBeUndefined();
  });

  it("shows filter count badge when filters are active", () => {
    const onFilter = vi.fn();
    render(<FatigueFilters onFilter={onFilter} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    fireEvent.click(screen.getByLabelText("Pós-sessão"));
    fireEvent.click(screen.getByRole("button", { name: /Aplicar/i }));

    // Badge "1" should be visible
    expect(screen.getByLabelText("1 filtros activos")).toBeInTheDocument();
  });

  it("resets filters when Limpar is clicked", () => {
    const onFilter = vi.fn();
    render(<FatigueFilters onFilter={onFilter} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir filtros/i }));
    fireEvent.click(screen.getByLabelText("Pré-sessão"));

    // Check it's selected
    expect((screen.getByLabelText("Pré-sessão") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Limpar/i }));

    // Should reset to "Todas"
    expect((screen.getByLabelText("Todas") as HTMLInputElement).checked).toBe(true);
  });
});
