/**
 * DataDrivenDecisionInput.test.tsx — Testes para DataDrivenDecisionInput (Story 5.10)
 *
 * Cobre AC #3, #4, #7:
 * - Botão ghost colapsado por defeito
 * - Expande ao clicar
 * - Textarea + RadioGroup + Checkbox quando expandido
 * - Submissão chama saveDataDrivenDecision
 * - Sucesso mostra "Decisão registada ✓" e colapsa
 * - Histórico de decisões acima do formulário
 * - Botão Editar visível apenas para actor correcto dentro de 24h
 * - Acessibilidade axe-core
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { axe } from "vitest-axe";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/actions/decisions", () => ({
  getDataDrivenDecisions: vi.fn(),
  saveDataDrivenDecision: vi.fn(),
  updateDataDrivenDecision: vi.fn(),
  DECISION_KIND_LABELS: {
    roster: "Convocatória",
    management: "Gestão do jogador",
    load_adjustment: "Ajuste de carga",
    rest: "Descanso",
    other: "Outra",
  },
  DECISION_KINDS: ["roster", "management", "load_adjustment", "rest", "other"],
}));

import { DataDrivenDecisionInput } from "@/components/domain/DataDrivenDecisionInput";
import {
  getDataDrivenDecisions,
  saveDataDrivenDecision,
} from "@/lib/actions/decisions";
import type { DataDecision } from "@/lib/actions/decisions";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CURRENT_USER_ID = "user-uuid-coach";
const PLAYER_ID = "player-uuid-1";

function makeDecision(overrides: Partial<DataDecision> = {}): DataDecision {
  return {
    id: "decision-uuid-1",
    decisionKind: "roster",
    note: "Deixei o João fora por ACWR elevado.",
    wasDataDriven: true,
    createdAt: new Date(Date.now() - 1000).toISOString(),
    actorId: CURRENT_USER_ID,
    ...overrides,
  };
}

const expiredDecision = makeDecision({
  createdAt: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
});

const otherActorDecision = makeDecision({
  actorId: "other-user-uuid",
});

function mockEmpty() {
  vi.mocked(getDataDrivenDecisions).mockResolvedValue({
    ok: true,
    data: { decisions: [], currentUserId: CURRENT_USER_ID },
  });
}

function mockWithDecisions(decisions: DataDecision[]) {
  vi.mocked(getDataDrivenDecisions).mockResolvedValue({
    ok: true,
    data: { decisions, currentUserId: CURRENT_USER_ID },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DataDrivenDecisionInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmpty();
  });

  it("renderiza botão ghost colapsado por defeito", async () => {
    render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    // Button renders immediately (status=idle, expanded=false)
    expect(
      screen.getByRole("button", { name: /Marcar decisão data-driven/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("group", { name: /Formulário de decisão/i })
    ).not.toBeInTheDocument();
  });

  it("expande ao clicar botão", async () => {
    render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar decisão data-driven/i })
    );

    expect(
      screen.getByRole("group", { name: /Formulário de decisão data-driven/i })
    ).toBeInTheDocument();
  });

  it("mostra Textarea + RadioGroup + Checkbox quando expandido", async () => {
    render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar decisão data-driven/i })
    );

    expect(screen.getByRole("textbox", { name: /Nota da decisão/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Convocatória")).toBeInTheDocument();
    expect(screen.getByLabelText("Gestão do jogador")).toBeInTheDocument();
    expect(screen.getByLabelText(/Foi mesmo data-driven\?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("chama saveDataDrivenDecision ao submeter formulário", async () => {
    vi.mocked(saveDataDrivenDecision).mockResolvedValue({
      ok: true,
      data: { id: "new-decision-uuid" },
    });

    render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar decisão data-driven/i })
    );
    fireEvent.click(screen.getByLabelText("Convocatória"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    });

    expect(saveDataDrivenDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: PLAYER_ID,
        decisionKind: "roster",
      })
    );
  });

  it("mostra 'Decisão registada ✓' após save bem-sucedido", async () => {
    vi.mocked(saveDataDrivenDecision).mockResolvedValue({
      ok: true,
      data: { id: "new-decision-uuid" },
    });

    render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar decisão data-driven/i })
    );
    fireEvent.click(screen.getByLabelText("Convocatória"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    });

    await waitFor(() =>
      expect(screen.getByText(/Decisão registada ✓/i)).toBeInTheDocument()
    );
  });

  it("colapsa após 2s do sucesso", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    vi.mocked(saveDataDrivenDecision).mockResolvedValue({
      ok: true,
      data: { id: "new-decision-uuid" },
    });

    render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar decisão data-driven/i })
    );
    fireEvent.click(screen.getByLabelText("Convocatória"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    });

    await waitFor(() =>
      expect(screen.getByText(/Decisão registada ✓/i)).toBeInTheDocument()
    );

    act(() => {
      vi.advanceTimersByTime(2001);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Marcar decisão data-driven/i })
      ).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it("mostra últimas 3 decisões acima do formulário", async () => {
    const decisions = [
      makeDecision({ id: "d1", note: "Nota da primeira decisão", decisionKind: "roster" }),
      makeDecision({ id: "d2", note: "Nota da segunda decisão", decisionKind: "rest" }),
      makeDecision({ id: "d3", note: "Nota da terceira decisão", decisionKind: "other" }),
    ];
    mockWithDecisions(decisions);

    render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Convocatória")).toBeInTheDocument();
    });
    expect(screen.getByText("Descanso")).toBeInTheDocument();
    expect(screen.getByText("Outra")).toBeInTheDocument();
  });

  it("botão 'Editar' visível para decisão dentro de 24h do actor correcto", async () => {
    const recentDecision = makeDecision({ actorId: CURRENT_USER_ID });
    mockWithDecisions([recentDecision]);

    render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    });
  });

  it("sem botão 'Editar' para decisão de outro actor", async () => {
    mockWithDecisions([otherActorDecision]);

    render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    // Wait for decisions to load
    await waitFor(() => {
      expect(screen.getByText("Convocatória")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("sem botão 'Editar' após 24h expirar", async () => {
    mockWithDecisions([expiredDecision]);

    render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    // Wait for decisions to load
    await waitFor(() => {
      expect(screen.getByText("Convocatória")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("zero violações axe", async () => {
    const { container } = render(<DataDrivenDecisionInput playerId={PLAYER_ID} />);

    // Ensure render is stable
    await act(async () => {});

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
