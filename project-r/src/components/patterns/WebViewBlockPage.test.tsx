import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { WebViewBlockPage } from "./WebViewBlockPage";

describe("WebViewBlockPage", () => {
  it("renders heading with correct text", () => {
    render(<WebViewBlockPage />);
    expect(
      screen.getByRole("heading", { name: /Abre o Project R no teu browser principal/i })
    ).toBeInTheDocument();
  });

  it("renders the copy link button", () => {
    render(<WebViewBlockPage />);
    expect(screen.getByRole("button", { name: /Copiar link/i })).toBeInTheDocument();
  });

  it("copy link button has aria-label", () => {
    render(<WebViewBlockPage />);
    const btn = screen.getByRole("button", { name: /Copiar link/i });
    expect(btn).toHaveAttribute("aria-label");
  });

  it("renders iOS instructions", () => {
    render(<WebViewBlockPage />);
    expect(screen.getByText(/Abrir no Safari/i)).toBeInTheDocument();
  });

  it("renders Android instructions", () => {
    render(<WebViewBlockPage />);
    expect(screen.getByText(/Abrir no Chrome/i)).toBeInTheDocument();
  });

  it("has a main landmark", () => {
    render(<WebViewBlockPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("has zero axe accessibility violations", async () => {
    const { container } = render(<WebViewBlockPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
