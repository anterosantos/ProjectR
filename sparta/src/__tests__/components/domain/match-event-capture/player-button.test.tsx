import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PlayerButton } from "@/components/domain/match-event-capture/player-button";
import type { MatchLineupRow } from "@/lib/stores/match-session";

const mockPlayer: MatchLineupRow = {
  id: "01920a4b-c8d3-7000-9c4e-000000000001",
  session_id: "01920a4b-c8d3-7000-9c4e-000000000002",
  player_id: "01920a4b-c8d3-7000-9c4e-000000000003",
  name: "João Silva",
  jersey_number: 7,
  position: "Ponta de Lança",
  age_group: "Senior",
  processing_restricted: false,
  role: "starter",
};

describe("<PlayerButton>", () => {
  it("renders player information", () => {
    render(<PlayerButton player={mockPlayer} />);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getByText("Ponta de Lança")).toBeInTheDocument();
    expect(screen.getByText("Senior")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<PlayerButton player={mockPlayer} onClick={onClick} />);

    const button = screen.getByRole("button");
    button.click();

    expect(onClick).toHaveBeenCalledWith(mockPlayer);
  });

  it("has correct aria-label", () => {
    render(<PlayerButton player={mockPlayer} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-label",
      "João Silva, nº 7, Ponta de Lança, Senior"
    );
  });

  it("is disabled when processing_restricted is true", () => {
    const restrictedPlayer = { ...mockPlayer, processing_restricted: true };
    render(<PlayerButton player={restrictedPlayer} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("is not disabled when processing_restricted is false", () => {
    render(<PlayerButton player={mockPlayer} />);

    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();
  });

  it("has aria-describedby when processing_restricted", () => {
    const restrictedPlayer = { ...mockPlayer, processing_restricted: true };
    render(<PlayerButton player={restrictedPlayer} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-describedby",
      "restricted-tooltip-match-capture"
    );
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    const restrictedPlayer = { ...mockPlayer, processing_restricted: true };
    render(<PlayerButton player={restrictedPlayer} onClick={onClick} />);

    const button = screen.getByRole("button");
    button.click();

    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders with age group specific border color", () => {
    const { container } = render(<PlayerButton player={mockPlayer} />);
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-slate-700");
  });

  it("renders with different age group color for U-14", () => {
    const u14Player = { ...mockPlayer, age_group: "U-14" };
    const { container } = render(<PlayerButton player={u14Player} />);
    const button = container.querySelector("button");
    expect(button?.className).toContain("border-blue-500");
  });
});
