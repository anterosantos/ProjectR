/**
 * prontidao.test.tsx — Testes de integração para /prontidao (Story 5.4)
 *
 * Cobre AC #1-#5, #7, #8, #10:
 * - EmptyState quando sem sessão
 * - Agregados (ready/caution/alert counts, neutros excluídos)
 * - Agrupamento por posição (GR/DEF/MED/AVA)
 * - Ordenação dentro de grupo (alert→caution→ready→neutral, ACWR DESC)
 * - TooltipExplain para jogadores neutral
 * - Acessibilidade (axe-core)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";

// ── UUIDs ────────────────────────────────────────────────────────────────────
const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";
const CLUB_UUID = "650e8400-e29b-41d4-a716-446655440002";

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/actions/readiness", () => ({
  getUpcomingSession: vi.fn(),
  getReadinessPanelData: vi.fn(),
  getClubReadinessSnapshots: vi.fn(),
  getPlayerReadinessSnapshot: vi.fn(),
  getPlayerAcwrTrend: vi.fn(),
  refreshUpcomingReadiness: vi.fn(),
  getPlayerDrillDownData: vi.fn(),
  getFormationData: vi.fn(),
}));

import { getUpcomingSession, getReadinessPanelData } from "@/lib/actions/readiness";
import ProntidaoPage from "@/app/(staff)/prontidao/page";
import type { PlayerReadinessData } from "@/types/supabase";

// ── Fixtures ─────────────────────────────────────────────────────────────────
const FUTURE_AT = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

function makeSnapshot(
  overrides: Partial<PlayerReadinessData> & {
    player_id: string;
    state: PlayerReadinessData["state"];
  }
): PlayerReadinessData {
  return {
    session_id: SESSION_UUID,
    club_id: CLUB_UUID,
    acwr: null,
    acwr_band_lo: null,
    acwr_band_hi: null,
    recent_fatigue_avg: null,
    attendance_rate: null,
    data_sufficient: true,
    derived_age_group: "senior",
    computed_at: new Date().toISOString(),
    playerName: "Jogador",
    jerseyNum: 1,
    primaryPosition: "MED",
    ...overrides,
  };
}

/** 40-player fixture with mix of states and positions */
function makeFixturePlayers(): PlayerReadinessData[] {
  return [
    // GR
    makeSnapshot({ player_id: "p-gr-1", state: "alert", acwr: 1.9, jerseyNum: 1, playerName: "João GR", primaryPosition: "GR" }),
    makeSnapshot({ player_id: "p-gr-2", state: "ready", acwr: 1.0, jerseyNum: 13, playerName: "Carlos GR", primaryPosition: "GR" }),
    // DEF
    makeSnapshot({ player_id: "p-def-1", state: "alert", acwr: 1.8, jerseyNum: 4, playerName: "Pedro DEF", primaryPosition: "DEF" }),
    makeSnapshot({ player_id: "p-def-2", state: "caution", acwr: 1.4, jerseyNum: 5, playerName: "Rui DEF", primaryPosition: "DEF" }),
    makeSnapshot({ player_id: "p-def-3", state: "ready", acwr: 0.9, jerseyNum: 6, playerName: "Maria DEF", primaryPosition: "DEF" }),
    // MED
    makeSnapshot({ player_id: "p-med-1", state: "caution", acwr: 1.5, jerseyNum: 8, playerName: "Tiago MED", primaryPosition: "MED" }),
    makeSnapshot({ player_id: "p-med-2", state: "ready", acwr: 1.1, jerseyNum: 10, playerName: "Bruno MED", primaryPosition: "MED" }),
    makeSnapshot({ player_id: "p-med-3", state: "neutral", acwr: null, jerseyNum: 14, playerName: "Tomás MED", primaryPosition: "MED", data_sufficient: false }),
    // AVA
    makeSnapshot({ player_id: "p-ava-1", state: "ready", acwr: 1.0, jerseyNum: 9, playerName: "Ana AVA", primaryPosition: "AVA" }),
    makeSnapshot({ player_id: "p-ava-2", state: "alert", acwr: 1.7, jerseyNum: 11, playerName: "Luis AVA", primaryPosition: "AVA" }),
  ];
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("ProntidaoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── AC #1: EmptyState quando sem sessão ────────────────────────────────────
  describe("EmptyState — sem sessão nas próximas 7 dias", () => {
    it("renderiza EmptyState quando getUpcomingSession retorna null", async () => {
      vi.mocked(getUpcomingSession).mockResolvedValue({ ok: true, data: null });

      const jsx = await ProntidaoPage();
      render(jsx);

      expect(
        screen.getByText(/sem sessão agendada nas próximas 7 dias/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/cria uma para ver o painel/i)).toBeInTheDocument();
    });

    it("renderiza EmptyState quando getUpcomingSession falha", async () => {
      vi.mocked(getUpcomingSession).mockResolvedValue({
        ok: false,
        error: { code: "unauthorized", message: "Não autorizado" },
      });

      const jsx = await ProntidaoPage();
      render(jsx);

      expect(
        screen.getByText(/sem sessão agendada nas próximas 7 dias/i)
      ).toBeInTheDocument();
    });

    it("lança erro quando getReadinessPanelData falha (P-21: error.tsx trata)", async () => {
      vi.mocked(getUpcomingSession).mockResolvedValue({
        ok: true,
        data: { sessionId: SESSION_UUID, scheduledAt: FUTURE_AT },
      });
      vi.mocked(getReadinessPanelData).mockResolvedValue({
        ok: false,
        error: { code: "db_error", message: "Erro" },
      });

      // P-21: page agora lança Error para que error.tsx o trate, em vez de renderizar EmptyState
      await expect(ProntidaoPage()).rejects.toThrow("Erro");
    });
  });

  // ── AC #2: Agregados no header ─────────────────────────────────────────────
  describe("Agregados — 3 números (ready/caution/alert)", () => {
    it("exibe contagens correctas — neutros excluídos", async () => {
      vi.mocked(getUpcomingSession).mockResolvedValue({
        ok: true,
        data: { sessionId: SESSION_UUID, scheduledAt: FUTURE_AT },
      });
      vi.mocked(getReadinessPanelData).mockResolvedValue({
        ok: true,
        data: { players: makeFixturePlayers(), history: {} },
      });

      const jsx = await ProntidaoPage();
      render(jsx);

      // 3 alert: p-gr-1, p-def-1, p-ava-2
      expect(screen.getByText("3 Alerta")).toBeInTheDocument();
      // 2 caution: p-def-2, p-med-1
      expect(screen.getByText("2 Atenção")).toBeInTheDocument();
      // 4 ready: p-gr-2, p-def-3, p-med-2, p-ava-1
      expect(screen.getByText("4 Verdes")).toBeInTheDocument();
    });

    it("exibe labels PT-PT: Verdes, Atenção, Alerta", async () => {
      vi.mocked(getUpcomingSession).mockResolvedValue({
        ok: true,
        data: { sessionId: SESSION_UUID, scheduledAt: FUTURE_AT },
      });
      vi.mocked(getReadinessPanelData).mockResolvedValue({
        ok: true,
        data: { players: makeFixturePlayers(), history: {} },
      });

      const jsx = await ProntidaoPage();
      render(jsx);

      expect(screen.getByText(/Verdes/)).toBeInTheDocument();
      expect(screen.getByText(/Atenção/)).toBeInTheDocument();
      expect(screen.getByText(/Alerta/)).toBeInTheDocument();
    });
  });

  // ── AC #3: Agrupamento por posição ─────────────────────────────────────────
  describe("Agrupamento por posição", () => {
    beforeEach(async () => {
      vi.mocked(getUpcomingSession).mockResolvedValue({
        ok: true,
        data: { sessionId: SESSION_UUID, scheduledAt: FUTURE_AT },
      });
      vi.mocked(getReadinessPanelData).mockResolvedValue({
        ok: true,
        data: { players: makeFixturePlayers(), history: {} },
      });
    });

    it("renderiza 4 grupos de posição (GR, Defesa, Médio, Avançado)", async () => {
      const jsx = await ProntidaoPage();
      render(jsx);

      expect(screen.getByText("Guarda-Redes")).toBeInTheDocument();
      expect(screen.getByText("Defesa")).toBeInTheDocument();
      expect(screen.getByText("Médio")).toBeInTheDocument();
      expect(screen.getByText("Avançado")).toBeInTheDocument();
    });

    it("coloca jogadores no grupo correcto de posição", async () => {
      const jsx = await ProntidaoPage();
      render(jsx);

      // GR players visible
      expect(screen.getByText("João GR")).toBeInTheDocument();
      expect(screen.getByText("Carlos GR")).toBeInTheDocument();

      // DEF players
      expect(screen.getByText("Pedro DEF")).toBeInTheDocument();
      expect(screen.getByText("Rui DEF")).toBeInTheDocument();
      expect(screen.getByText("Maria DEF")).toBeInTheDocument();

      // MED
      expect(screen.getByText("Tiago MED")).toBeInTheDocument();

      // AVA
      expect(screen.getByText("Ana AVA")).toBeInTheDocument();
    });
  });

  // ── AC #5: Ordenação dentro de grupo ──────────────────────────────────────
  describe("Ordenação dentro de grupo — alert→caution→ready→neutral", () => {
    it("ordena DEF: alert(ACWR 1.8) antes de caution(1.4) antes de ready(0.9)", async () => {
      vi.mocked(getUpcomingSession).mockResolvedValue({
        ok: true,
        data: { sessionId: SESSION_UUID, scheduledAt: FUTURE_AT },
      });
      vi.mocked(getReadinessPanelData).mockResolvedValue({
        ok: true,
        data: { players: makeFixturePlayers(), history: {} },
      });

      const jsx = await ProntidaoPage();
      render(jsx);

      const allButtons = screen.getAllByRole("button");
      const playerButtons = allButtons.filter((btn) =>
        btn.getAttribute("aria-label")?.includes("Posição Defesa")
      );

      expect(playerButtons.length).toBe(3);
      // First: Pedro DEF (alert)
      expect(playerButtons[0]?.getAttribute("aria-label")).toMatch(/Pedro DEF/);
      // Second: Rui DEF (caution)
      expect(playerButtons[1]?.getAttribute("aria-label")).toMatch(/Rui DEF/);
      // Third: Maria DEF (ready)
      expect(playerButtons[2]?.getAttribute("aria-label")).toMatch(/Maria DEF/);
    });
  });

  // ── AC #7: TooltipExplain para neutros ────────────────────────────────────
  describe("AC #7 — TooltipExplain para data_sufficient=false", () => {
    it("renderiza indicador 'Em construção' para jogador neutral", async () => {
      vi.mocked(getUpcomingSession).mockResolvedValue({
        ok: true,
        data: { sessionId: SESSION_UUID, scheduledAt: FUTURE_AT },
      });
      vi.mocked(getReadinessPanelData).mockResolvedValue({
        ok: true,
        data: {
          players: [
            makeSnapshot({
              player_id: "p-neutral",
              state: "neutral",
              data_sufficient: false,
              playerName: "Sem dados",
              primaryPosition: "MED",
            }),
          ],
          history: {},
        },
      });

      const jsx = await ProntidaoPage();
      render(jsx);

      // Card renders with accessible aria-label including "Estado Sem dados"
      expect(
        screen.getByRole("button", { name: /estado sem dados/i })
      ).toBeInTheDocument();
    });
  });

  // ── AC #8: Acessibilidade ──────────────────────────────────────────────────
  describe("Acessibilidade — axe-core zero violations", () => {
    it("não tem violações de acessibilidade com plantel completo", async () => {
      vi.mocked(getUpcomingSession).mockResolvedValue({
        ok: true,
        data: { sessionId: SESSION_UUID, scheduledAt: FUTURE_AT },
      });
      vi.mocked(getReadinessPanelData).mockResolvedValue({
        ok: true,
        data: { players: makeFixturePlayers(), history: {} },
      });

      const jsx = await ProntidaoPage();
      const { container } = render(jsx);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("não tem violações de acessibilidade no EmptyState", async () => {
      vi.mocked(getUpcomingSession).mockResolvedValue({ ok: true, data: null });

      const jsx = await ProntidaoPage();
      const { container } = render(jsx);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});

// ── AC #4 (Story 5.5): Click num PlayerRow abre DrillDownSheet ────────────────
import { getPlayerDrillDownData } from "@/lib/actions/readiness";

describe("AC #4 (Story 5.5) — Click PlayerRow abre PlayerDrillDownSheet", () => {
  it("ao clicar num player row, getPlayerDrillDownData é chamado com o player_id correcto", async () => {
    vi.mocked(getPlayerDrillDownData).mockResolvedValue({
      ok: true,
      data: {
        fatigueResponses: [],
        sessions: {},
        attendanceNumerator: 0,
        attendanceDenominator: 0,
      },
    });

    vi.mocked(getUpcomingSession).mockResolvedValue({
      ok: true,
      data: { sessionId: SESSION_UUID, scheduledAt: FUTURE_AT },
    });
    vi.mocked(getReadinessPanelData).mockResolvedValue({
      ok: true,
      data: {
        players: [
          makeSnapshot({
            player_id: "p-click-test",
            state: "alert",
            acwr: 1.9,
            jerseyNum: 7,
            playerName: "Clique Teste",
            primaryPosition: "MED",
          }),
        ],
        history: {},
      },
    });

    const jsx = await ProntidaoPage();
    render(jsx);

    // Clicar no PlayerRow
    const playerBtn = screen.getByRole("button", { name: /Clique Teste/i });
    fireEvent.click(playerBtn);

    // A sheet deve tentar carregar os dados do jogador
    await waitFor(() => {
      expect(getPlayerDrillDownData).toHaveBeenCalledWith("p-click-test");
    });
  });
});

// ── Story 5.6: Toggle "Formação" ativa vista de formação ─────────────────────
import { getFormationData } from "@/lib/actions/readiness";
import { ReadinessPanel } from "@/components/domain/readiness/readiness-panel";

vi.mock("@/components/domain/readiness/readiness-panel-formation", () => ({
  ReadinessPanelFormation: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="readiness-panel-formation" data-session={sessionId} />
  ),
}));

describe("AC #1 (Story 5.6) — Toggle 'Formação' ativa ReadinessPanelFormation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("ReadinessPanel mostra ReadinessPanelList por defeito", () => {
    render(
      <ReadinessPanel
        players={[makeSnapshot({ player_id: "p-1", state: "ready", primaryPosition: "MED" })]}
        history={{}}
        sessionId={SESSION_UUID}
      />
    );
    expect(screen.queryByTestId("readiness-panel-formation")).not.toBeInTheDocument();
  });

  it("clicar em 'Formação' troca para ReadinessPanelFormation", async () => {
    render(
      <ReadinessPanel
        players={[makeSnapshot({ player_id: "p-1", state: "ready", primaryPosition: "MED" })]}
        history={{}}
        sessionId={SESSION_UUID}
      />
    );

    const formacaoBtn = screen.getByRole("button", { name: /^Formação$/i });
    expect(formacaoBtn).not.toBeDisabled();

    fireEvent.click(formacaoBtn);
    expect(screen.getByTestId("readiness-panel-formation")).toBeInTheDocument();
  });

  it("botão 'Formação' tem aria-pressed=false por defeito e =true após clique", async () => {
    render(
      <ReadinessPanel
        players={[makeSnapshot({ player_id: "p-1", state: "ready", primaryPosition: "MED" })]}
        history={{}}
        sessionId={SESSION_UUID}
      />
    );

    const formacaoBtn = screen.getByRole("button", { name: /^Formação$/i });
    expect(formacaoBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(formacaoBtn);
    expect(formacaoBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("botão 'Lista' tem aria-pressed=true por defeito e =false após clicar 'Formação'", async () => {
    render(
      <ReadinessPanel
        players={[makeSnapshot({ player_id: "p-1", state: "ready", primaryPosition: "MED" })]}
        history={{}}
        sessionId={SESSION_UUID}
      />
    );

    const listaBtn   = screen.getByRole("button", { name: /^Lista$/i });
    const formacaoBtn = screen.getByRole("button", { name: /^Formação$/i });

    expect(listaBtn).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(formacaoBtn);
    expect(listaBtn).toHaveAttribute("aria-pressed", "false");
  });
});

// ── Story 5.7: Botão Atualizar no painel (sessão fora da janela 4h) ───────────
describe("AC #3 (Story 5.7) — Botão Atualizar fora da janela 4h", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("mostra botão 'Atualizar' quando sessão está além de 4h (FUTURE_AT = 3 dias)", async () => {
    // FUTURE_AT = 3 dias no futuro → fora da janela 4h → inWindow=false → botão visível
    vi.mocked(getUpcomingSession).mockResolvedValue({
      ok: true,
      data: { sessionId: SESSION_UUID, scheduledAt: FUTURE_AT },
    });
    vi.mocked(getReadinessPanelData).mockResolvedValue({
      ok: true,
      data: { players: [], history: {} },
    });

    const jsx = await ProntidaoPage();
    render(jsx);

    expect(
      screen.getByRole("button", { name: /atualizar dados de prontidão/i })
    ).toBeInTheDocument();
  });
});

// ── Unit tests for getPositionKey ────────────────────────────────────────────
import { getPositionKey } from "@/components/domain/readiness/readiness-panel-list";

describe("getPositionKey — mapeamento de posições", () => {
  // Schema abbreviations — GR
  it("mapeia 'GR' → GR", () => expect(getPositionKey("GR")).toBe("GR"));
  it("mapeia 'gr' → GR", () => expect(getPositionKey("gr")).toBe("GR"));
  // Schema abbreviations — DEF
  it("mapeia 'DD' → DEF", () => expect(getPositionKey("DD")).toBe("DEF"));
  it("mapeia 'DC' → DEF", () => expect(getPositionKey("DC")).toBe("DEF"));
  it("mapeia 'DE' → DEF", () => expect(getPositionKey("DE")).toBe("DEF"));
  it("mapeia 'LIB' → DEF", () => expect(getPositionKey("LIB")).toBe("DEF"));
  // Schema abbreviations — MED
  it("mapeia 'MDC' → MED", () => expect(getPositionKey("MDC")).toBe("MED"));
  it("mapeia 'MC' → MED", () => expect(getPositionKey("MC")).toBe("MED"));
  it("mapeia 'MO' → MED", () => expect(getPositionKey("MO")).toBe("MED"));
  it("mapeia 'MD' → MED", () => expect(getPositionKey("MD")).toBe("MED"));
  it("mapeia 'ME' → MED", () => expect(getPositionKey("ME")).toBe("MED"));
  // Schema abbreviations — AVA
  it("mapeia 'EXD' → AVA", () => expect(getPositionKey("EXD")).toBe("AVA"));
  it("mapeia 'EXE' → AVA", () => expect(getPositionKey("EXE")).toBe("AVA"));
  it("mapeia 'SC' → AVA", () => expect(getPositionKey("SC")).toBe("AVA"));
  it("mapeia 'PL' → AVA", () => expect(getPositionKey("PL")).toBe("AVA"));
  // Text-based names
  it("mapeia 'Guarda-Redes' → GR", () => expect(getPositionKey("Guarda-Redes")).toBe("GR"));
  it("mapeia 'DEF' → DEF", () => expect(getPositionKey("DEF")).toBe("DEF"));
  it("mapeia 'Defesa Central' → DEF", () => expect(getPositionKey("Defesa Central")).toBe("DEF"));
  it("mapeia 'Lateral Direito' → DEF", () => expect(getPositionKey("Lateral Direito")).toBe("DEF"));
  it("mapeia 'MED' → MED", () => expect(getPositionKey("MED")).toBe("MED"));
  it("mapeia 'Médio Defensivo' → MED", () => expect(getPositionKey("Médio Defensivo")).toBe("MED"));
  it("mapeia 'AVA' → AVA", () => expect(getPositionKey("AVA")).toBe("AVA"));
  it("mapeia 'Avançado' → AVA", () => expect(getPositionKey("Avançado")).toBe("AVA"));
  it("mapeia 'Ponta de Lança' → AVA", () => expect(getPositionKey("Ponta de Lança")).toBe("AVA"));
  // P-24: "centrocampista central" → MED, não DEF
  it("mapeia 'Centrocampista Central' → MED (P-24)", () => expect(getPositionKey("Centrocampista Central")).toBe("MED"));
  // Fallbacks
  it("mapeia null → MED (fallback)", () => expect(getPositionKey(null)).toBe("MED"));
  it("mapeia string desconhecida → MED (fallback)", () => expect(getPositionKey("Desconhecida")).toBe("MED"));
});
