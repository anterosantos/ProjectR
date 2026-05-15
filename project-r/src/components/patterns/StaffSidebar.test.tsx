import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaffSidebar } from "./StaffSidebar";

describe("StaffSidebar", () => {
  it("renders aside element with navigation role", () => {
    const { container } = render(<StaffSidebar role="coach" />);

    const aside = container.querySelector("aside");
    expect(aside).toBeInTheDocument();
    expect(aside).toHaveAttribute("role", "navigation");
  });

  it("applies hidden class on mobile (lg:block means hidden on smaller screens)", () => {
    const { container } = render(<StaffSidebar role="coach" />);

    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("hidden", "lg:block");
  });

  it("applies correct width styling", () => {
    const { container } = render(<StaffSidebar role="coach" />);

    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("w-64");
  });

  it("applies correct background styling", () => {
    const { container } = render(<StaffSidebar role="coach" />);

    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("bg-gray-50");
  });

  it("renders nav element with aria-label", () => {
    render(<StaffSidebar role="analyst" />);

    const nav = screen.getByRole("navigation", { name: /Navegação principal/i });
    expect(nav).toBeInTheDocument();
  });

  it("accepts coach role", () => {
    render(<StaffSidebar role="coach" />);
    expect(screen.getByRole("navigation", { name: /Navegação principal/i })).toBeInTheDocument();
  });

  it("accepts analyst role", () => {
    render(<StaffSidebar role="analyst" />);
    expect(screen.getByRole("navigation", { name: /Navegação principal/i })).toBeInTheDocument();
  });

  it("renders placeholder text", () => {
    render(<StaffSidebar role="coach" />);

    expect(screen.getByText(/Navegação será adicionada em histórias futuras/i)).toBeInTheDocument();
  });
});
