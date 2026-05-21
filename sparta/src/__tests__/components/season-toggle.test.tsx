import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import { SeasonToggle } from "@/components/patterns/SeasonToggle";

describe("SeasonToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("cumulativo");
    mockSearchParams.delete("tipo");
  });

  it("renderiza dois chips: Época actual e Cumulativo", () => {
    render(<SeasonToggle isCumulative={false} />);
    expect(screen.getByText("Época actual")).toBeInTheDocument();
    expect(screen.getByText("Cumulativo")).toBeInTheDocument();
  });

  it("chip Época actual tem aria-pressed=true quando isCumulative=false", () => {
    render(<SeasonToggle isCumulative={false} />);
    const epocaBtn = screen.getByText("Época actual");
    expect(epocaBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("chip Cumulativo tem aria-pressed=true quando isCumulative=true", () => {
    render(<SeasonToggle isCumulative={true} />);
    const cumulativoBtn = screen.getByText("Cumulativo");
    expect(cumulativoBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("ao clicar Cumulativo adiciona ?cumulativo=true à URL", () => {
    render(<SeasonToggle isCumulative={false} />);
    fireEvent.click(screen.getByText("Cumulativo"));
    expect(mockPush).toHaveBeenCalledWith("?cumulativo=true");
  });

  it("ao clicar Época actual remove param cumulativo da URL", () => {
    mockSearchParams.set("cumulativo", "true");
    render(<SeasonToggle isCumulative={true} />);
    fireEvent.click(screen.getByText("Época actual"));
    expect(mockPush).toHaveBeenCalledWith("?");
  });

  it("preserva outros params ao toggle", () => {
    mockSearchParams.set("tipo", "training");
    render(<SeasonToggle isCumulative={false} />);
    fireEvent.click(screen.getByText("Cumulativo"));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("tipo=training")
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("cumulativo=true")
    );
  });
});
