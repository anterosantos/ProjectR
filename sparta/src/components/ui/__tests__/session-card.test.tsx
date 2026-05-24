/**
 * session-card.test.tsx — Testes para SessionCard phase prop
 * AC #4 — Story 4.9
 *
 * Cobre:
 * - Links to /pre by default for player role
 * - Links to /post when phase='post' for player role
 * - Always links to /sessoes for staff regardless of phase
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionCard } from "@/components/ui/session-card";
import type { Session } from "@/lib/schemas/sessions";

const mockSession: Session = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  club_id: "650e8400-e29b-41d4-a716-446655440002",
  season_id: "750e8400-e29b-41d4-a716-446655440003",
  type: "training",
  status: "scheduled",
  scheduled_at: "2026-05-25T10:00:00Z",
  location: "Campo Principal",
  duration_min: 90,
  notes: null,
  created_by: "950e8400-e29b-41d4-a716-446655440005",
  created_at: "2026-05-24T00:00:00Z",
};

describe("SessionCard phase prop", () => {
  it("links to /pre by default for player role", () => {
    render(<SessionCard session={mockSession} userRole="player" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/questionario/${mockSession.id}/pre`);
  });

  it("links to /post when phase='post' for player role", () => {
    render(
      <SessionCard session={mockSession} userRole="player" phase="post" />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/questionario/${mockSession.id}/post`);
  });

  it("links to /sessoes for staff regardless of phase", () => {
    render(
      <SessionCard session={mockSession} userRole="staff" phase="post" />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/sessoes/${mockSession.id}`);
  });

  it("links to /sessoes for analyst regardless of phase", () => {
    render(
      <SessionCard session={mockSession} userRole="analyst" phase="post" />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/sessoes/${mockSession.id}`);
  });

  it("links to /pre for player when phase is undefined", () => {
    render(<SessionCard session={mockSession} userRole="player" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/questionario/${mockSession.id}/pre`);
  });
});

describe("SessionCard answered prop (Story 4.10)", () => {
  it("shows answered indicator when answered=true for player role", () => {
    render(
      <SessionCard session={mockSession} userRole="player" answered={true} />
    );

    expect(screen.getByText("Respondido")).toBeInTheDocument();
  });

  it("links to /hoje when answered=true for player role", () => {
    render(
      <SessionCard session={mockSession} userRole="player" answered={true} />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/hoje");
  });

  it("hides answered indicator when answered=false", () => {
    render(
      <SessionCard session={mockSession} userRole="player" answered={false} />
    );

    expect(screen.queryByText("Respondido")).not.toBeInTheDocument();
  });

  it("ignores answered prop for staff role", () => {
    render(
      <SessionCard session={mockSession} userRole="staff" answered={true} />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", `/sessoes/${mockSession.id}`);
    expect(screen.queryByText("Respondido")).not.toBeInTheDocument();
  });

  it("has updated aria-label when answered=true", () => {
    render(
      <SessionCard session={mockSession} userRole="player" answered={true} />
    );

    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).toContain("(respondido)");
  });

  it("applies opacity-75 styling when answered=true", () => {
    render(
      <SessionCard session={mockSession} userRole="player" answered={true} />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveClass("opacity-75");
  });
});
