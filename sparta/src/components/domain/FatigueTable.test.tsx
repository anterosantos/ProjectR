import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { FatigueResponse, SessionInfo } from "@/lib/actions/fatigue-staff";
import { FatigueTable, calculateDelta } from "@/components/domain/FatigueTable";

const PLAYER_ID = "650e8400-e29b-41d4-a716-446655440001";
const SESSION_ID_A = "750e8400-e29b-41d4-a716-446655440002";
const SESSION_ID_B = "750e8400-e29b-41d4-a716-446655440003";

function makeResponse(overrides: Partial<FatigueResponse> = {}): FatigueResponse {
  return {
    id: "850e8400-e29b-41d4-a716-446655440004",
    player_id: PLAYER_ID,
    session_id: SESSION_ID_A,
    phase: "pre",
    dim_energy: 3,
    dim_focus: 4,
    dim_sleep: 2,
    dim_soreness: 3,
    dim_mood: 4,
    srpe_value: null,
    submitted_at: "2026-05-20T10:00:00Z",
    submitted_via: "app",
    ...overrides,
  };
}

const SESSION_MAP: Record<string, SessionInfo> = {
  [SESSION_ID_A]: {
    id: SESSION_ID_A,
    type: "training",
    scheduled_at: "2026-05-20T09:00:00Z",
  },
  [SESSION_ID_B]: {
    id: SESSION_ID_B,
    type: "match",
    scheduled_at: "2026-05-18T15:00:00Z",
  },
};

describe("calculateDelta", () => {
  it("returns null when pre is null", () => {
    expect(calculateDelta(null, 4)).toBeNull();
  });

  it("returns null when post is null", () => {
    expect(calculateDelta(3, null)).toBeNull();
  });

  it("returns null when both are null", () => {
    expect(calculateDelta(null, null)).toBeNull();
  });

  it("returns positive delta (improvement)", () => {
    expect(calculateDelta(2, 4)).toBe(2);
  });

  it("returns negative delta (deterioration)", () => {
    expect(calculateDelta(4, 2)).toBe(-2);
  });

  it("returns zero delta (no change)", () => {
    expect(calculateDelta(3, 3)).toBe(0);
  });
});

describe("FatigueTable", () => {
  it("renders empty state when no responses", () => {
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás Silva"
        responses={[]}
        sessions={{}}
      />
    );
    expect(screen.getByText("Sem respostas ainda")).toBeInTheDocument();
    expect(screen.getByText(/Tomás Silva/)).toBeInTheDocument();
  });

  it("renders session rows when responses exist", () => {
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás Silva"
        responses={[makeResponse()]}
        sessions={SESSION_MAP}
      />
    );
    // Should have a collapsible row with "Treino"
    expect(screen.getByText("Treino")).toBeInTheDocument();
  });

  it("has role=img with aria-label (AC #8)", () => {
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás Silva"
        responses={[makeResponse()]}
        sessions={SESSION_MAP}
      />
    );
    const table = screen.getByRole("img");
    expect(table).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Tabela de respostas")
    );
    expect(table).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Tomás Silva")
    );
  });

  it("expands a session row when clicked", () => {
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás Silva"
        responses={[makeResponse()]}
        sessions={SESSION_MAP}
      />
    );
    const button = screen.getByRole("button", { expanded: false });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Energia")).toBeInTheDocument();
  });

  it("shows dimension values when expanded (AC #4)", () => {
    const pre = makeResponse({ phase: "pre", dim_energy: 3, dim_focus: 4 });
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás"
        responses={[pre]}
        sessions={SESSION_MAP}
      />
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("Energia")).toBeInTheDocument();
    expect(screen.getByText("Concentração")).toBeInTheDocument();
  });

  it("shows delta arrows when pre and post exist (AC #4)", () => {
    const pre = makeResponse({ id: "pre-1", phase: "pre",  dim_energy: 2 });
    const post = makeResponse({ id: "post-1", phase: "post", dim_energy: 4, submitted_at: "2026-05-20T12:00:00Z" });
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás"
        responses={[pre, post]}
        sessions={SESSION_MAP}
      />
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    // positive delta for energy: +2 with ↑
    expect(screen.getByLabelText("Melhoria de 2")).toBeInTheDocument();
  });

  it("shows negative delta with aria-label (AC #4)", () => {
    const pre = makeResponse({ id: "pre-2", phase: "pre",  dim_energy: 4 });
    const post = makeResponse({ id: "post-2", phase: "post", dim_energy: 2, submitted_at: "2026-05-20T12:00:00Z" });
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás"
        responses={[pre, post]}
        sessions={SESSION_MAP}
      />
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByLabelText("Deterioração de 2")).toBeInTheDocument();
  });

  it("shows zero delta (AC #4)", () => {
    const pre = makeResponse({ id: "pre-3", phase: "pre",  dim_energy: 3 });
    const post = makeResponse({ id: "post-3", phase: "post", dim_energy: 3, submitted_at: "2026-05-20T12:00:00Z" });
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás"
        responses={[pre, post]}
        sessions={SESSION_MAP}
      />
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    // Multiple dimensions with zero delta — use getAllByLabelText
    const zeroDeltas = screen.getAllByLabelText("Sem alteração");
    expect(zeroDeltas.length).toBeGreaterThan(0);
  });

  it("renders sRPE value when present (AC #4)", () => {
    const post = makeResponse({ id: "post-srpe", phase: "post", srpe_value: 7, submitted_at: "2026-05-20T12:00:00Z" });
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás"
        responses={[post]}
        sessions={SESSION_MAP}
      />
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/sRPE pós-sessão:/)).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("filters by phase (AC #6 integration)", () => {
    const pre = makeResponse({ id: "pre-f", phase: "pre" });
    const post = makeResponse({ id: "post-f", phase: "post", session_id: SESSION_ID_B, submitted_at: "2026-05-18T16:00:00Z" });
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás"
        responses={[pre, post]}
        sessions={SESSION_MAP}
        activePhase="post"
      />
    );
    // Only session B (post) should appear; session A (pre) filtered out
    expect(screen.getByText("Jogo")).toBeInTheDocument();
    expect(screen.queryByText("Treino")).not.toBeInTheDocument();
  });

  it("groups pre and post for same session under one row", () => {
    const pre = makeResponse({ id: "pre-g", phase: "pre" });
    const post = makeResponse({ id: "post-g", phase: "post", submitted_at: "2026-05-20T12:00:00Z" });
    render(
      <FatigueTable
        playerId={PLAYER_ID}
        playerName="Tomás"
        responses={[pre, post]}
        sessions={SESSION_MAP}
      />
    );
    // Only 1 session row (one collapsed button)
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
  });
});
