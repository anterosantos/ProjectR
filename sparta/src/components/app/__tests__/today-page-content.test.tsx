/**
 * today-page-content.test.tsx — Testes para TodayPageContent com feedback de respostas
 * AC #4, AC #5 — Story 4.10
 *
 * Cobre:
 * - nextSessionAnswered=true → card com indicador
 * - allDoneToday=true + nextSession=null → "Tudo registado" empty state
 * - Combinação: nextSession + recentSession (Story 4.9) ambos visíveis
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayPageContent } from "@/components/app/today-page-content";
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

const mockRecentSession: Session = {
  ...mockSession,
  id: "550e8400-e29b-41d4-a716-446655440099",
  scheduled_at: "2026-05-24T10:00:00Z",
  status: "completed",
};

describe("TodayPageContent with answered state (Story 4.10)", () => {
  it("shows nextSessionAnswered indicator when nextSessionAnswered=true", () => {
    render(
      <TodayPageContent
        nextSession={mockSession}
        nextSessionAnswered={true}
        userRole="player"
      />
    );

    expect(screen.getByText("Respondido")).toBeInTheDocument();
  });

  it("shows empty state 'Tudo registado' when allDoneToday=true and no nextSession", () => {
    render(
      <TodayPageContent
        nextSession={null}
        allDoneToday={true}
        userRole="player"
      />
    );

    expect(screen.getByText("Tudo registado")).toBeInTheDocument();
    expect(
      screen.getByText("Questionários desta sessão concluídos.")
    ).toBeInTheDocument();
  });

  it("shows both nextSession and recentSession when both exist", () => {
    render(
      <TodayPageContent
        nextSession={mockSession}
        recentSession={mockRecentSession}
        userRole="player"
      />
    );

    expect(screen.getByText("Próxima sessão")).toBeInTheDocument();
    expect(screen.getByText("Sessão recente")).toBeInTheDocument();
  });

  it("shows 'Sem sessões' empty state when no sessions and not allDoneToday", () => {
    render(
      <TodayPageContent
        nextSession={null}
        recentSession={null}
        allDoneToday={false}
        userRole="player"
      />
    );

    expect(
      screen.getByText("Sem sessões nos próximos 7 dias")
    ).toBeInTheDocument();
  });

  it("shows Tudo registado when allDoneToday=true and no recentSession shown (post already answered)", () => {
    // Quando allDoneToday=true, recentSession é null porque post foi respondido (lógica do /hoje)
    render(
      <TodayPageContent
        nextSession={null}
        recentSession={null}
        allDoneToday={true}
        userRole="player"
      />
    );

    expect(screen.getByText("Tudo registado")).toBeInTheDocument();
    expect(screen.queryByText("Sessão recente")).not.toBeInTheDocument();
  });

  it("passes answered prop to SessionCard for nextSession", () => {
    render(
      <TodayPageContent
        nextSession={mockSession}
        nextSessionAnswered={true}
        userRole="player"
      />
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/hoje");
  });
});
