import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import { SessionTypeFilter } from "@/components/patterns/SessionTypeFilter";

describe("SessionTypeFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("tipo");
    mockSearchParams.delete("cumulativo");
  });

  it("renderiza 3 chips: Tudo, Treinos, Jogos", () => {
    render(<SessionTypeFilter activeFilter="all" />);
    expect(screen.getByText("Tudo")).toBeInTheDocument();
    expect(screen.getByText("Treinos")).toBeInTheDocument();
    expect(screen.getByText("Jogos")).toBeInTheDocument();
  });

  it("chip Tudo tem aria-pressed=true quando activeFilter=all", () => {
    render(<SessionTypeFilter activeFilter="all" />);
    expect(screen.getByText("Tudo")).toHaveAttribute("aria-pressed", "true");
  });

  it("chip Treinos tem aria-pressed=true quando activeFilter=training", () => {
    render(<SessionTypeFilter activeFilter="training" />);
    expect(screen.getByText("Treinos")).toHaveAttribute("aria-pressed", "true");
  });

  it("chip Jogos tem aria-pressed=true quando activeFilter=matches", () => {
    render(<SessionTypeFilter activeFilter="matches" />);
    expect(screen.getByText("Jogos")).toHaveAttribute("aria-pressed", "true");
  });

  it("ao clicar Treinos define ?tipo=training na URL", () => {
    render(<SessionTypeFilter activeFilter="all" />);
    fireEvent.click(screen.getByText("Treinos"));
    expect(mockPush).toHaveBeenCalledWith("?tipo=training");
  });

  it("ao clicar Jogos define ?tipo=matches na URL", () => {
    render(<SessionTypeFilter activeFilter="all" />);
    fireEvent.click(screen.getByText("Jogos"));
    expect(mockPush).toHaveBeenCalledWith("?tipo=matches");
  });

  it("ao clicar Tudo remove param tipo da URL", () => {
    mockSearchParams.set("tipo", "training");
    render(<SessionTypeFilter activeFilter="training" />);
    fireEvent.click(screen.getByText("Tudo"));
    expect(mockPush).toHaveBeenCalledWith("?");
  });

  it("preserva param cumulativo ao mudar tipo", () => {
    mockSearchParams.set("cumulativo", "true");
    render(<SessionTypeFilter activeFilter="all" />);
    fireEvent.click(screen.getByText("Treinos"));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("cumulativo=true")
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("tipo=training")
    );
  });
});
