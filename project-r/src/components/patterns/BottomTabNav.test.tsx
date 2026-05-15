import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomTabNav } from "./BottomTabNav";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/hoje",
  useRouter: () => ({}),
}));

describe("BottomTabNav", () => {
  it("renders player tabs when role is player", () => {
    render(<BottomTabNav role="player" />);

    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByText("Histórico")).toBeInTheDocument();
    expect(screen.getByText("Eu")).toBeInTheDocument();
  });

  it("renders coach tabs when role is coach", () => {
    render(<BottomTabNav role="coach" />);

    expect(screen.getByText("Prontidão")).toBeInTheDocument();
    expect(screen.getByText("Calendário")).toBeInTheDocument();
    expect(screen.getByText("Plantel")).toBeInTheDocument();
    expect(screen.getByText("Eu")).toBeInTheDocument();
  });

  it("renders analyst tabs when role is analyst", () => {
    render(<BottomTabNav role="analyst" />);

    expect(screen.getByText("Sessões")).toBeInTheDocument();
    expect(screen.getByText("Plantel")).toBeInTheDocument();
    expect(screen.getByText("Tendências")).toBeInTheDocument();
    expect(screen.getByText("Eu")).toBeInTheDocument();
  });

  it("marks current tab with aria-current='page'", () => {
    render(<BottomTabNav role="player" />);

    const hojeLink = screen.getByRole("link", { name: /Hoje/i });
    expect(hojeLink).toHaveAttribute("aria-current", "page");
  });

  it("has semantic nav element with aria-label", () => {
    render(<BottomTabNav role="player" />);

    const nav = screen.getByRole("navigation", { name: /Navegação principal/i });
    expect(nav).toBeInTheDocument();
  });

  it("has correct href attributes for player tabs", () => {
    render(<BottomTabNav role="player" />);

    expect(screen.getByRole("link", { name: /Hoje/i })).toHaveAttribute("href", "/hoje");
    expect(screen.getByRole("link", { name: /Histórico/i })).toHaveAttribute("href", "/historico");
    expect(screen.getByRole("link", { name: /Eu/i })).toHaveAttribute("href", "/configuracoes");
  });

  it("has minimum touch target size", () => {
    const { container } = render(<BottomTabNav role="player" />);
    const links = container.querySelectorAll("a");

    links.forEach((link) => {
      const styles = window.getComputedStyle(link);
      // Check that it has padding for touch targets (min 44px)
      expect(link).toHaveClass("py-3", "px-2");
    });
  });
});
