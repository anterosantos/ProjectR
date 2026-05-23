import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SessionCard } from "@/components/ui/session-card";
import type { Session } from "@/lib/schemas/sessions";

const BASE_SESSION: Session = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  club_id: "650e8400-e29b-41d4-a716-446655440001",
  season_id: "750e8400-e29b-41d4-a716-446655440002",
  type: "training",
  scheduled_at: "2026-05-07T16:00:00.000Z",
  duration_min: 90,
  location: "Campo Municipal",
  status: "scheduled",
  notes: null,
  created_by: "850e8400-e29b-41d4-a716-446655440003",
  created_at: "2026-05-01T00:00:00Z",
};

describe("SessionCard", () => {
  it("renderiza sessão de treino com link para gestão quando role é staff", () => {
    render(<SessionCard session={BASE_SESSION} userRole="staff" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      `/sessoes/${BASE_SESSION.id}`
    );
  });

  it("renderiza sessão com link para questionário quando role é player", () => {
    render(<SessionCard session={BASE_SESSION} userRole="player" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      `/questionario/${BASE_SESSION.id}/pre`
    );
  });

  it("renderiza com link para gestão quando role não é especificado (default staff behavior)", () => {
    render(<SessionCard session={BASE_SESSION} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      `/sessoes/${BASE_SESSION.id}`
    );
  });

  it("mostra data formatada em PT-PT", () => {
    render(<SessionCard session={BASE_SESSION} />);
    // Deve mostrar formato dd/MM às HH:mm
    expect(screen.getByRole("link")).toHaveTextContent(/às/i);
  });

  it("mostra localização quando preenchida", () => {
    render(<SessionCard session={BASE_SESSION} />);
    expect(screen.getByText("Campo Municipal")).toBeInTheDocument();
  });

  it("não mostra localização quando nula", () => {
    const noLocation: Session = { ...BASE_SESSION, location: null };
    render(<SessionCard session={noLocation} />);
    expect(screen.queryByText("Campo Municipal")).not.toBeInTheDocument();
  });

  it("sessão cancelada mostra badge 'Cancelada' e texto riscado", () => {
    const cancelled: Session = { ...BASE_SESSION, status: "cancelled" };
    render(<SessionCard session={cancelled} />);
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    const textEl = screen.getByRole("link").querySelector(".line-through");
    expect(textEl).toBeInTheDocument();
  });

  it("sessão normal não mostra badge de cancelada", () => {
    render(<SessionCard session={BASE_SESSION} />);
    expect(screen.queryByText("Cancelada")).not.toBeInTheDocument();
  });

  it("renderiza ícone de jogo para tipo 'match'", () => {
    const match: Session = { ...BASE_SESSION, type: "match" };
    render(<SessionCard session={match} />);
    // Verifica que o aria-label inclui "Jogo"
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("aria-label", expect.stringContaining("Jogo"));
  });

  it("renderiza ícone de jogo amigável para tipo 'friendly'", () => {
    const friendly: Session = { ...BASE_SESSION, type: "friendly" };
    render(<SessionCard session={friendly} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Jogo amigável")
    );
  });

  it("link tem min-h ≥44px (NFR40) via classe CSS", () => {
    render(<SessionCard session={BASE_SESSION} />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("min-h-[44px]");
  });
});
