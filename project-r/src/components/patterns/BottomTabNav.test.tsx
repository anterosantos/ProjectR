import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomTabNav } from "./BottomTabNav";

// Mock next/navigation with configurable pathname
let mockPathname = "/hoje";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
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

  it("marks correct tab as active for each player route", () => {
    const routes = ["/hoje", "/historico", "/configuracoes"];
    const tabLabels = ["Hoje", "Histórico", "Eu"];

    routes.forEach((route, index) => {
      mockPathname = route;
      const { unmount } = render(<BottomTabNav role="player" />);

      const activeLink = screen.getByRole("link", { name: new RegExp(tabLabels[index], "i") });
      expect(activeLink).toHaveAttribute("aria-current", "page");

      unmount();
    });
  });

  it("marks correct tab as active for each coach route", () => {
    const routes = ["/prontidao", "/calendario", "/plantel", "/configuracoes"];
    const tabLabels = ["Prontidão", "Calendário", "Plantel", "Eu"];

    routes.forEach((route, index) => {
      mockPathname = route;
      const { unmount } = render(<BottomTabNav role="coach" />);

      const activeLink = screen.getByRole("link", { name: new RegExp(tabLabels[index], "i") });
      expect(activeLink).toHaveAttribute("aria-current", "page");

      unmount();
    });
  });

  it("throws error on invalid role", () => {
    expect(() => {
      render(<BottomTabNav role={"admin" as any} />);
    }).toThrow("Invalid role prop");
  });
});
