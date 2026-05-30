import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaffSidebar } from "./StaffSidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/prontidao",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StaffSidebar", () => {
  it("renders aside element with aria-label", () => {
    const { container } = render(<StaffSidebar role="coach" />);
    const aside = container.querySelector("aside");
    expect(aside).toBeInTheDocument();
    expect(aside).toHaveAttribute("aria-label", "Navegação principal");
  });

  it("applies hidden class for mobile", () => {
    const { container } = render(<StaffSidebar role="coach" />);
    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("hidden");
  });

  it("applies lg:w-64 width class", () => {
    const { container } = render(<StaffSidebar role="coach" />);
    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("lg:w-64");
  });

  it("renders SPARTA brand text", () => {
    render(<StaffSidebar role="coach" />);
    expect(screen.getByText("SPARTA")).toBeInTheDocument();
  });

  it("renders coach nav items", () => {
    render(<StaffSidebar role="coach" />);
    expect(screen.getByText("Prontidão")).toBeInTheDocument();
    expect(screen.getByText("Calendário")).toBeInTheDocument();
    expect(screen.getByText("Plantel")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
  });

  it("renders analyst nav items", () => {
    render(<StaffSidebar role="analyst" />);
    expect(screen.getByText("Sessões")).toBeInTheDocument();
    expect(screen.getByText("Plantel")).toBeInTheDocument();
    expect(screen.getByText("Tendências")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
  });

  it("shows Treinador label for coach role", () => {
    render(<StaffSidebar role="coach" />);
    expect(screen.getByText("Treinador")).toBeInTheDocument();
  });

  it("shows Analista label for analyst role", () => {
    render(<StaffSidebar role="analyst" />);
    expect(screen.getByText("Analista")).toBeInTheDocument();
  });

  it("marks active link with aria-current=page", () => {
    render(<StaffSidebar role="coach" />);
    const prontidaoLink = screen.getByText("Prontidão").closest("a");
    expect(prontidaoLink).toHaveAttribute("aria-current", "page");
  });
});
