/**
 * field-formation.test.tsx — Testes para FieldFormation (Story 5.6)
 *
 * Cobre:
 * - 11 chips de titular renderizados com aria-label correcto
 * - Clique num chip chama onSelectPlayer
 * - SVG campo tem role="img" e aria-label correcto
 * - Selector de formação: 4-3-3 activo, outros disabled
 * - Acessibilidade axe-core
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { FieldFormation } from "@/components/domain/readiness/field-formation";
import type { PlayerReadinessData } from "@/types/supabase";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const CLUB_UUID    = "650e8400-e29b-41d4-a716-446655440002";

function makePlayer(
  overrides: Partial<PlayerReadinessData> & { player_id: string; primaryPosition: string }
): PlayerReadinessData {
  return {
    session_id: SESSION_UUID,
    club_id: CLUB_UUID,
    state: "ready",
    acwr: 1.1,
    acwr_band_lo: 0.8,
    acwr_band_hi: 1.5,
    recent_fatigue_avg: 2.5,
    attendance_rate: 0.9,
    data_sufficient: true,
    derived_age_group: "senior",
    computed_at: "2026-05-27T00:00:00Z",
    playerName: "Jogador Teste",
    jerseyNum: 10,
    ...overrides,
  };
}

const fixtureStarters: PlayerReadinessData[] = [
  makePlayer({ player_id: "p-gr-1",  jerseyNum: 1,  playerName: "Rui Patrício",  primaryPosition: "GR" }),
  makePlayer({ player_id: "p-def-1", jerseyNum: 4,  playerName: "Pepe Silva",     primaryPosition: "DEF" }),
  makePlayer({ player_id: "p-def-2", jerseyNum: 5,  playerName: "Ruben Dias",     primaryPosition: "DEF" }),
  makePlayer({ player_id: "p-def-3", jerseyNum: 6,  playerName: "José Fonte",     primaryPosition: "DEF" }),
  makePlayer({ player_id: "p-def-4", jerseyNum: 2,  playerName: "Nélson Semedo",  primaryPosition: "DEF" }),
  makePlayer({ player_id: "p-med-1", jerseyNum: 8,  playerName: "Moutinho João",  primaryPosition: "MED" }),
  makePlayer({ player_id: "p-med-2", jerseyNum: 6,  playerName: "William Costa",  primaryPosition: "MED" }),
  makePlayer({ player_id: "p-med-3", jerseyNum: 14, playerName: "Renato Sanches", primaryPosition: "MED" }),
  makePlayer({ player_id: "p-ava-1", jerseyNum: 7,  playerName: "Ronaldo CR7",    primaryPosition: "AVA" }),
  makePlayer({ player_id: "p-ava-2", jerseyNum: 17, playerName: "Rafa Silva",     primaryPosition: "AVA" }),
  makePlayer({ player_id: "p-ava-3", jerseyNum: 11, playerName: "André Silva",    primaryPosition: "AVA" }),
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FieldFormation", () => {
  it("renders 11 player chips with correct aria-label pattern", () => {
    render(<FieldFormation starters={fixtureStarters} onSelectPlayer={vi.fn()} />);

    const chips = screen.getAllByRole("button", { name: /Estado:/ });
    expect(chips.length).toBe(11);
  });

  it("each chip aria-label includes state, name, position, and ACWR", () => {
    render(<FieldFormation starters={fixtureStarters} onSelectPlayer={vi.fn()} />);

    const grChip = screen.getByRole("button", { name: /Rui Patrício/ });
    expect(grChip).toHaveAttribute("aria-label", expect.stringContaining("Estado: Pronto"));
    expect(grChip).toHaveAttribute("aria-label", expect.stringContaining("Rui Patrício"));
    expect(grChip).toHaveAttribute("aria-label", expect.stringContaining("GR"));
    expect(grChip).toHaveAttribute("aria-label", expect.stringContaining("ACWR"));
  });

  it("calls onSelectPlayer when a chip is clicked", () => {
    const onSelectPlayer = vi.fn();
    render(<FieldFormation starters={fixtureStarters} onSelectPlayer={onSelectPlayer} />);

    const chip = screen.getByRole("button", { name: /Rui Patrício/ });
    fireEvent.click(chip);

    expect(onSelectPlayer).toHaveBeenCalledTimes(1);
    expect(onSelectPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ player_id: "p-gr-1" })
    );
  });

  it("SVG field has correct aria-label accessible to screen readers", () => {
    const { container } = render(<FieldFormation starters={fixtureStarters} onSelectPlayer={vi.fn()} />);

    const svg = container.querySelector('svg[aria-label="Campo de futebol — formação 4-3-3"]');
    expect(svg).toBeInTheDocument();
  });

  it("4-3-3 formation selector is present and active", () => {
    render(<FieldFormation starters={fixtureStarters} onSelectPlayer={vi.fn()} />);

    const selectorBtn = screen.getByRole("button", { name: /Formação 4-3-3/ });
    expect(selectorBtn).not.toBeDisabled();
  });

  it("alternative formations (4-4-2, 3-5-2) are disabled with Em breve title", () => {
    render(<FieldFormation starters={fixtureStarters} onSelectPlayer={vi.fn()} />);

    const alt442 = screen.getByRole("button", { name: /Formação 4-4-2 — em breve/ });
    const alt352 = screen.getByRole("button", { name: /Formação 3-5-2 — em breve/ });

    expect(alt442).toBeDisabled();
    expect(alt352).toBeDisabled();
  });

  it("renders empty when no starters provided", () => {
    render(<FieldFormation starters={[]} onSelectPlayer={vi.fn()} />);
    const chips = screen.queryAllByRole("button", { name: /Estado:/ });
    expect(chips.length).toBe(0);
  });

  it("shows jersey number inside chip, or ? when null", () => {
    const noJersey = makePlayer({ player_id: "p-no-jersey", jerseyNum: null as unknown as number, primaryPosition: "GR" });
    render(<FieldFormation starters={[noJersey]} onSelectPlayer={vi.fn()} />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("has zero axe violations with 11 starters", async () => {
    const { container } = render(
      <FieldFormation starters={fixtureStarters} onSelectPlayer={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
