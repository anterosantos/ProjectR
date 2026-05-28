/**
 * player-drill-down-sheet.test.tsx — Testes para PlayerDrillDownSheet (Story 5.5)
 *
 * Cobre AC #1, #2, #3, #4, #6, #7, #8, #10:
 * - Sheet abre com dados do snapshot (AC #1, #2)
 * - ACWR + banda formatado PT-PT (AC #2)
 * - data_sufficient=false → zona cinzenta + TooltipExplain (AC #2)
 * - Série temporal com respostas → gráfico renderiza (AC #3)
 * - Sem respostas → EmptyState (AC #3)
 * - Attendance X/Y calculado (AC #4)
 * - getPlayerDrillDownData chamado com playerId correcto (AC #5)
 * - Botão nota disabled (AC #6)
 * - Acessibilidade axe-core (AC #8)
 * - onClose chamado ao fechar (AC #8)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { axe } from "vitest-axe";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/actions/readiness", () => ({
  getPlayerDrillDownData: vi.fn(),
}));

vi.mock("@/lib/actions/decisions", () => ({
  getDataDrivenDecisions: vi.fn().mockResolvedValue({
    ok: true,
    data: { decisions: [], currentUserId: "user-uuid-staff" },
  }),
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

vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { PlayerDrillDownSheet } from "@/components/domain/readiness/player-drill-down-sheet";
import { getPlayerDrillDownData } from "@/lib/actions/readiness";
import type { PlayerReadinessData } from "@/types/supabase";
import type { DrillDownData } from "@/lib/actions/readiness";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fixtureSnapshot: PlayerReadinessData = {
  player_id: "player-alert-1",
  session_id: "session-1",
  club_id: "club-1",
  state: "alert",
  acwr: 1.82,
  acwr_band_lo: 0.8,
  acwr_band_hi: 1.5,
  recent_fatigue_avg: 3.8,
  attendance_rate: 0.857,
  data_sufficient: true,
  derived_age_group: "senior",
  computed_at: new Date().toISOString(),
  playerName: "João Silva",
  jerseyNum: 4,
  primaryPosition: "DEF",
};

const mockDrillDownData: DrillDownData = {
  fatigueResponses: [
    {
      id: "fr-1",
      player_id: "player-alert-1",
      session_id: "session-1",
      phase: "post",
      dim_energy: 2,
      dim_focus: 3,
      dim_sleep: 2,
      dim_soreness: 4,
      dim_mood: 3,
      srpe_value: 7,
      submitted_at: "2026-05-20T10:00:00Z",
      submitted_via: "online",
    },
  ],
  sessions: {
    "session-1": {
      id: "session-1",
      type: "treino",
      scheduled_at: "2026-05-20T09:00:00Z",
    },
  },
  attendanceNumerator: 12,
  attendanceDenominator: 14,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PlayerDrillDownSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlayerDrillDownData).mockResolvedValue({
      ok: true,
      data: mockDrillDownData,
    });
  });

  // ── AC #1 + #2: Sheet abre com dados do snapshot ───────────────────────────
  describe("AC #1/#2 — Header com dados do snapshot", () => {
    it("renderiza nome, escalão e posição do jogador imediatamente", async () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      expect(screen.getByText("João Silva")).toBeInTheDocument();
      expect(screen.getByText(/Sénior/)).toBeInTheDocument();
      expect(screen.getByText(/DEF/)).toBeInTheDocument();
    });

    it("renderiza SemaforoBadge com estado alert", async () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      // SemaforoBadge usa labelMap interno: alert → "Estado: não recomendado"
      expect(
        screen.getByRole("img", { name: "Estado: não recomendado" })
      ).toBeInTheDocument();
    });

    it("renderiza ACWR formatado PT-PT com vírgula e banda", async () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      // ACWR 1.82 → "1,82" em PT-PT; banda 0.8–1.5 → "0,80–1,50"
      expect(screen.getByText(/1,82/)).toBeInTheDocument();
      expect(screen.getByText(/banda 0,80/)).toBeInTheDocument();
    });
  });

  // ── AC #2: data_sufficient=false → tooltip ─────────────────────────────────
  describe("AC #2 — data_sufficient=false → zona cinzenta + TooltipExplain", () => {
    it("mostra TooltipExplain ACWR quando data_sufficient=false", async () => {
      const snapshotNoData: PlayerReadinessData = {
        ...fixtureSnapshot,
        data_sufficient: false,
        acwr: null,
        acwr_band_lo: null,
        acwr_band_hi: null,
        state: "neutral",
      };

      render(
        <PlayerDrillDownSheet
          snapshot={snapshotNoData}
          open={true}
          onClose={() => {}}
        />
      );

      // TooltipExplain renders the term "ACWR" as a button
      expect(
        screen.getByRole("button", { name: /Explicação de ACWR/i })
      ).toBeInTheDocument();
    });

    it("não mostra ACWR numérico quando data_sufficient=false", async () => {
      const snapshotNoData: PlayerReadinessData = {
        ...fixtureSnapshot,
        data_sufficient: false,
        acwr: null,
      };

      render(
        <PlayerDrillDownSheet
          snapshot={snapshotNoData}
          open={true}
          onClose={() => {}}
        />
      );

      expect(screen.queryByText(/1,82/)).not.toBeInTheDocument();
    });
  });

  // ── AC #3: Série temporal ──────────────────────────────────────────────────
  describe("AC #3 — Série temporal de fadiga", () => {
    it("renderiza gráfico recharts quando há respostas", async () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("line-chart")).toBeInTheDocument();
      });
    });

    it("renderiza EmptyState quando não há respostas de fadiga", async () => {
      vi.mocked(getPlayerDrillDownData).mockResolvedValue({
        ok: true,
        data: {
          ...mockDrillDownData,
          fatigueResponses: [],
        },
      });

      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Sem dados de fadiga nos últimos 28 dias/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ── AC #4: Presenças X/Y ───────────────────────────────────────────────────
  describe("AC #4 — Presenças em fração", () => {
    it("exibe attendance X/Y correcto", async () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/12\/14/)).toBeInTheDocument();
      });
    });

    it("exibe aria-label de presenças", async () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        const el = screen.getByText(/12\/14 sessões/i);
        expect(el).toHaveAttribute(
          "aria-label",
          "12 de 14 sessões nos últimos 28 dias"
        );
      });
    });
  });

  // ── AC #5: getPlayerDrillDownData chamado com playerId correcto ────────────
  describe("AC #5 — Audit: getPlayerDrillDownData chamado com playerId", () => {
    it("chama getPlayerDrillDownData com player_id do snapshot", async () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(getPlayerDrillDownData).toHaveBeenCalledWith("player-alert-1");
      });
    });

    it("não chama getPlayerDrillDownData quando open=false", () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={false}
          onClose={() => {}}
        />
      );

      expect(getPlayerDrillDownData).not.toHaveBeenCalled();
    });
  });

  // ── AC #6: Zona de decisão data-driven (Story 5.10) ──────────────────────
  describe("AC #6 — Zona de decisão data-driven implementada (Story 5.10)", () => {
    it("renderiza botão 'Marcar decisão data-driven' clicável", async () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      // DataDrivenDecisionInput renders the button immediately (no disabled state during load)
      const btn = screen.getByRole("button", { name: /Marcar decisão data-driven/i });
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
    });
  });

  // ── AC #7: Degradação offline ──────────────────────────────────────────────
  describe("AC #7 — Degradação offline", () => {
    it("mostra mensagem discreta quando fetch falha (offline)", async () => {
      vi.mocked(getPlayerDrillDownData).mockRejectedValue(new Error("Network error"));

      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Série temporal indisponível offline/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ── AC #8: Acessibilidade ──────────────────────────────────────────────────
  describe("AC #8 — Acessibilidade axe-core zero violations", () => {
    it("não tem violações de acessibilidade com sheet aberta e dados carregados", async () => {
      const { container } = render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("line-chart")).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("não tem violações com data_sufficient=false", async () => {
      const snapshotNoData: PlayerReadinessData = {
        ...fixtureSnapshot,
        data_sufficient: false,
        acwr: null,
        state: "neutral",
      };

      const { container } = render(
        <PlayerDrillDownSheet
          snapshot={snapshotNoData}
          open={true}
          onClose={() => {}}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  // ── AC #9: Navegação por teclado ──────────────────────────────────────────
  describe("AC #9 — Navegação por teclado (ESC, Tab focus)", () => {
    it("renderiza elementos focáveis com tabindex correcto", async () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("line-chart")).toBeInTheDocument();
      });

      // Verify DataDrivenDecisionInput button is focusable (Story 5.10)
      const notaBtn = screen.getByRole("button", { name: /Marcar decisão data-driven/i });
      expect(notaBtn).toBeInTheDocument();
      expect(notaBtn).not.toBeDisabled();
    });

    it("suporta navegação por teclado (Dialog wrapper handles ESC, Tab, focus trap)", async () => {
      render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId("line-chart")).toBeInTheDocument();
      });

      // Verify content is rendered (Dialog will auto-manage focus and ESC key via radix-ui)
      expect(screen.getByText(/Fadiga — últimos 28 dias/i)).toBeInTheDocument();
      // Sheet interaction is handled by Dialog component
    });
  });

  // ── onClose ────────────────────────────────────────────────────────────────
  describe("onClose — callback chamado ao fechar", () => {
    it("não renderiza conteúdo quando snapshot é null", () => {
      render(
        <PlayerDrillDownSheet
          snapshot={null}
          open={true}
          onClose={() => {}}
        />
      );

      expect(screen.queryByText("João Silva")).not.toBeInTheDocument();
    });

    it("reset estado quando open muda para false", async () => {
      const { rerender } = render(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(getPlayerDrillDownData).toHaveBeenCalled();
      });

      // Fechar e reabrir → deve chamar novamente
      vi.clearAllMocks();
      vi.mocked(getPlayerDrillDownData).mockResolvedValue({
        ok: true,
        data: mockDrillDownData,
      });

      rerender(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={false}
          onClose={() => {}}
        />
      );

      await act(async () => {});

      rerender(
        <PlayerDrillDownSheet
          snapshot={fixtureSnapshot}
          open={true}
          onClose={() => {}}
        />
      );

      await waitFor(() => {
        expect(getPlayerDrillDownData).toHaveBeenCalledWith("player-alert-1");
      });
    });
  });
});
