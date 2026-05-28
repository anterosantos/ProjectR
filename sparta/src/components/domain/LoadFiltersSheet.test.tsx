import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock DrillDownSheet so we can control open state in tests
vi.mock("@/components/ui/drill-down-sheet", () => ({
  DrillDownSheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
}));

import { LoadFiltersSheet } from "./LoadFiltersSheet";

describe("LoadFiltersSheet", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("chama onFilter no mount com valores default", () => {
    const onFilter = vi.fn();
    render(<LoadFiltersSheet onFilter={onFilter} />);
    expect(onFilter).toHaveBeenCalledWith({
      position: "all",
      sortBy: "load",
    });
  });

  it("abre sheet ao clicar botão Filtros", () => {
    const onFilter = vi.fn();
    render(<LoadFiltersSheet onFilter={onFilter} />);
    const btn = screen.getByRole("button", { name: /filtros/i });
    fireEvent.click(btn);
    expect(screen.getByTestId("sheet")).toBeInTheDocument();
  });

  it("filtra por posição GR ao seleccionar e aplicar", () => {
    const onFilter = vi.fn();
    render(<LoadFiltersSheet onFilter={onFilter} />);
    // Open sheet
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }));
    // Select GR
    const grRadio = screen.getByRole("radio", { name: "GR" });
    fireEvent.click(grRadio);
    // Apply
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    expect(onFilter).toHaveBeenLastCalledWith({
      position: "GR",
      sortBy: "load",
    });
  });

  it("ordenação por sessões chama onFilter com sortBy='sessions'", () => {
    const onFilter = vi.fn();
    render(<LoadFiltersSheet onFilter={onFilter} />);
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }));
    const sessionsRadio = screen.getByRole("radio", { name: /sessões/i });
    fireEvent.click(sessionsRadio);
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    expect(onFilter).toHaveBeenLastCalledWith({
      position: "all",
      sortBy: "sessions",
    });
  });

  it("chips removíveis aparecem para filtros activos (posição)", () => {
    const onFilter = vi.fn();
    render(<LoadFiltersSheet onFilter={onFilter} />);
    // Set position filter via sessionStorage pre-load
    sessionStorage.setItem("sparta:load:filters", JSON.stringify({ position: "DEF", sortBy: "load" }));
    // Re-render
    const { unmount } = render(<LoadFiltersSheet onFilter={onFilter} />);
    expect(screen.getByText(/Posição: DEF/)).toBeInTheDocument();
    unmount();
  });

  it("Limpar repõe valores default", () => {
    const onFilter = vi.fn();
    render(<LoadFiltersSheet onFilter={onFilter} />);
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }));
    // Select GR first
    fireEvent.click(screen.getByRole("radio", { name: "GR" }));
    // Click Limpar
    fireEvent.click(screen.getByRole("button", { name: /limpar/i }));
    // Apply to confirm reset
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    expect(onFilter).toHaveBeenLastCalledWith({
      position: "all",
      sortBy: "load",
    });
  });

  it("persiste filtros em sessionStorage com chave 'sparta:load:filters'", () => {
    const onFilter = vi.fn();
    render(<LoadFiltersSheet onFilter={onFilter} />);
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }));
    fireEvent.click(screen.getByRole("radio", { name: "GR" }));
    fireEvent.click(screen.getByRole("button", { name: /aplicar/i }));
    const stored = sessionStorage.getItem("sparta:load:filters");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.position).toBe("GR");
  });
});
