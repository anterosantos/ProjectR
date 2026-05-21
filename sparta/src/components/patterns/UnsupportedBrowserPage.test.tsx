import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { UnsupportedBrowserPage } from "./UnsupportedBrowserPage";

describe("UnsupportedBrowserPage", () => {
  it("renders heading with correct text", () => {
    render(<UnsupportedBrowserPage />);
    expect(
      screen.getByRole("heading", { name: /Este site precisa de um browser moderno/i })
    ).toBeInTheDocument();
  });

  it("renders a list of supported browsers", () => {
    render(<UnsupportedBrowserPage />);
    const list = screen.getByRole("list", { name: /Browsers suportados/i });
    expect(list).toBeInTheDocument();
  });

  it("lists Chrome as a supported browser", () => {
    render(<UnsupportedBrowserPage />);
    expect(screen.getByText("Chrome")).toBeInTheDocument();
  });

  it("lists Safari as a supported browser", () => {
    render(<UnsupportedBrowserPage />);
    expect(screen.getByText("Safari")).toBeInTheDocument();
  });

  it("lists Firefox as a supported browser", () => {
    render(<UnsupportedBrowserPage />);
    expect(screen.getByText("Firefox")).toBeInTheDocument();
  });

  it("lists Microsoft Edge as a supported browser", () => {
    render(<UnsupportedBrowserPage />);
    expect(screen.getByText("Microsoft Edge")).toBeInTheDocument();
  });

  it("lists Samsung Internet as a supported browser", () => {
    render(<UnsupportedBrowserPage />);
    expect(screen.getByText("Samsung Internet")).toBeInTheDocument();
  });

  it("has a main landmark", () => {
    render(<UnsupportedBrowserPage />);
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("has zero axe accessibility violations", async () => {
    const { container } = render(<UnsupportedBrowserPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
