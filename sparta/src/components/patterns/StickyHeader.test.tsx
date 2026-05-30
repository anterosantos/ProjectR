import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StickyHeader } from "./StickyHeader";

describe("StickyHeader", () => {
  it("renders title", () => {
    render(<StickyHeader title="Hoje" />);

    expect(screen.getByText("Hoje")).toBeInTheDocument();
  });

  it("renders title and meta when both are provided", () => {
    render(<StickyHeader title="Painel" meta="Sáb 16:00" />);

    expect(screen.getByText("Painel")).toBeInTheDocument();
    expect(screen.getByText("Sáb 16:00")).toBeInTheDocument();
  });

  it("does not render meta line when meta is undefined", () => {
    const { container } = render(<StickyHeader title="Hoje" />);

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(0);
  });

  it("uses semantic header element", () => {
    const { container } = render(<StickyHeader title="Hoje" />);

    const header = container.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header).toHaveAttribute("role", "banner");
  });

  it("applies sticky positioning and z-index", () => {
    const { container } = render(<StickyHeader title="Hoje" />);

    const header = container.querySelector("header");
    expect(header).toHaveClass("sticky", "top-0", "z-sticky");
  });

  it("applies border styling", () => {
    const { container } = render(<StickyHeader title="Hoje" />);

    const header = container.querySelector("header");
    expect(header).toHaveClass("border-b", "border-border");
  });
});
