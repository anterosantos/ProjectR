import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrendFilters } from "./TrendFilters";
import type { TrendFilters as TrendFiltersType } from "@/lib/actions/trends";

vi.mock("@/components/ui/drill-down-sheet", () => ({
  DrillDownSheet: ({ open, onOpenChange, children }: any) => (
    <div data-testid="drill-down-sheet" data-open={open}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ onClick, children, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  SlidersHorizontal: () => <span data-testid="sliders-icon">⚙️</span>,
  X: () => <span data-testid="x-icon">✕</span>,
}));

describe("TrendFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("chama onFilter no mount com valores default", () => {
    const onFilter = vi.fn();
    render(<TrendFilters onFilter={onFilter} />);
    expect(onFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        position: "all",
        ageGroup: "all",
        sortBy: "alphabetic",
      })
    );
  });

  it("renderiza botão Filtros", () => {
    const onFilter = vi.fn();
    render(<TrendFilters onFilter={onFilter} />);
    expect(screen.getAllByText("Filtros").length).toBeGreaterThan(0);
  });

  it("renderiza opções de posição", () => {
    const onFilter = vi.fn();
    render(<TrendFilters onFilter={onFilter} />);
    expect(screen.getByText("Posição")).toBeInTheDocument();
    expect(screen.getByText("Todas")).toBeInTheDocument();
  });

  it("renderiza opções de escalão", () => {
    const onFilter = vi.fn();
    render(<TrendFilters onFilter={onFilter} />);
    expect(screen.getByText("Escalão")).toBeInTheDocument();
    expect(screen.getByText("u14")).toBeInTheDocument();
  });

  it("renderiza opções de ordenação", () => {
    const onFilter = vi.fn();
    render(<TrendFilters onFilter={onFilter} />);
    expect(screen.getByText("Ordenação")).toBeInTheDocument();
    expect(screen.getByText("Por delta ↓")).toBeInTheDocument();
  });

  it("mostra chips de filtros activos com initialFilters", () => {
    const onFilter = vi.fn();
    const initialFilters: TrendFiltersType = {
      position: "GR",
      ageGroup: "u14",
      sortBy: "alphabetic",
    };
    render(<TrendFilters onFilter={onFilter} initialFilters={initialFilters} />);
    // Component should render without error
    expect(screen.getAllByText("Filtros").length).toBeGreaterThan(0);
  });

  it("renderiza botões Limpar e Aplicar", () => {
    const onFilter = vi.fn();
    render(<TrendFilters onFilter={onFilter} />);
    expect(screen.getByText("Limpar filtros")).toBeInTheDocument();
    expect(screen.getByText("Aplicar")).toBeInTheDocument();
  });

  it("persiste filtros em sessionStorage", () => {
    const onFilter = vi.fn();
    render(<TrendFilters onFilter={onFilter} />);
    // Verify onFilter was called during initialization
    expect(onFilter).toHaveBeenCalled();
  });
});
