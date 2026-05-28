/**
 * configuracoes-kpis.test.tsx — Testes para /configuracoes/kpis-validacao (Story 5.10)
 *
 * Cobre AC #5, #7:
 * - Tabela com meses e contagens
 * - Badge verde "Meta atingida" quando total >= 1
 * - Badge âmbar "Meta não atingida" quando total === 0
 * - EmptyState quando sem dados
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { MonthlyKpiRow } from "@/lib/types/decisions";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/actions/decisions", () => ({
  getDecisionKpiData: vi.fn(),
}));

vi.mock("@/lib/types/decisions", () => ({
  DECISION_KIND_LABELS: {
    roster: "Convocatória",
    management: "Gestão do jogador",
    load_adjustment: "Ajuste de carga",
    rest: "Descanso",
    other: "Outra",
  },
  DECISION_KINDS: ["roster", "management", "load_adjustment", "rest", "other"],
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
}));

import { getDecisionKpiData } from "@/lib/actions/decisions";
import KpisValidacaoPage from "@/app/(staff)/configuracoes/kpis-validacao/page";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<MonthlyKpiRow> = {}): MonthlyKpiRow {
  return {
    month: "2026-05",
    total: 3,
    byKind: { roster: 2, rest: 1 },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("KPIs de Validação (/configuracoes/kpis-validacao)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza tabela com meses e contagens", async () => {
    vi.mocked(getDecisionKpiData).mockResolvedValue({
      ok: true,
      data: [
        makeRow({ month: "2026-05", total: 3, byKind: { roster: 2, rest: 1 } }),
        makeRow({ month: "2026-04", total: 0, byKind: {} }),
      ],
    });

    render(await KpisValidacaoPage());

    expect(screen.getByRole("table")).toBeInTheDocument();
    // Meses visíveis
    expect(screen.getByText(/maio/i)).toBeInTheDocument();
    expect(screen.getByText(/abril/i)).toBeInTheDocument();
  });

  it("badge verde 'Meta atingida' quando total >= 1", async () => {
    vi.mocked(getDecisionKpiData).mockResolvedValue({
      ok: true,
      data: [makeRow({ month: "2026-05", total: 2 })],
    });

    render(await KpisValidacaoPage());

    expect(screen.getByText(/Meta atingida/i)).toBeInTheDocument();
  });

  it("badge âmbar 'Meta não atingida' quando total === 0", async () => {
    vi.mocked(getDecisionKpiData).mockResolvedValue({
      ok: true,
      data: [makeRow({ month: "2026-04", total: 0, byKind: {} })],
    });

    render(await KpisValidacaoPage());

    expect(screen.getByText(/Meta não atingida/i)).toBeInTheDocument();
  });

  it("EmptyState quando sem dados", async () => {
    vi.mocked(getDecisionKpiData).mockResolvedValue({
      ok: true,
      data: [],
    });

    render(await KpisValidacaoPage());

    expect(
      screen.getByText(/Nenhuma decisão registada ainda/i)
    ).toBeInTheDocument();
  });
});
