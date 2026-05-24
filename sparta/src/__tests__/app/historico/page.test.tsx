/**
 * historico/page.test.tsx — Testes do componente /historico
 *
 * Valida AC #3 (Story 4.6):
 * - Página mostra apenas campos raw de fatigue_responses
 * - Copy mediado "As tuas respostas. O treinador é quem interpreta como conjunto." está presente
 * - Sem métricas derivadas visíveis (ACWR, readiness, recovery, etc.)
 * - Acessibilidade: tabela com role="table", headers scope="col"
 * - Empty state para players sem respostas
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

const { mockRedirect, mockCreateServerClient } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockCreateServerClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mockCreateServerClient,
}));

import HistoricoPage from "@/app/(player)/historico/page";

// ─── Constantes ───────────────────────────────────────────────────────────────

const USER_UUID   = "550e8400-e29b-41d4-a716-446655440001";
const PLAYER_UUID = "650e8400-e29b-41d4-a716-446655440002";

const SAMPLE_RESPONSES = [
  {
    id: "resp-1",
    phase: "pre",
    dim_energy: 4,
    dim_focus: 3,
    dim_sleep: 5,
    dim_soreness: 2,
    dim_mood: 4,
    srpe_value: null,
    submitted_at: "2026-05-24T10:00:00Z",
  },
  {
    id: "resp-2",
    phase: "post",
    dim_energy: 3,
    dim_focus: 4,
    dim_sleep: 4,
    dim_soreness: 3,
    dim_mood: 3,
    srpe_value: 7,
    submitted_at: "2026-05-24T20:00:00Z",
  },
];

// ─── Mock builder ─────────────────────────────────────────────────────────────

function buildSupabaseMock(opts: {
  user?: { id: string } | null;
  profileRole?: string;
  playerData?: { id: string; age_group: string } | null;
  responses?: typeof SAMPLE_RESPONSES;
}) {
  // Use !== undefined to correctly handle null (unauthenticated) vs default (USER_UUID)
  const user = opts.user !== undefined ? opts.user : { id: USER_UUID };
  const profileRole = opts.profileRole ?? "player";
  // Default playerData includes `id` so the player_id defence-in-depth filter fires (P2).
  const playerData = opts.playerData !== undefined ? opts.playerData : { id: PLAYER_UUID, age_group: "senior" };
  const responses = opts.responses ?? SAMPLE_RESPONSES;

  // Each `from` call returns a chain; we track which table is being queried by call order
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { role: profileRole }, error: null }),
  };

  const playerChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: playerData, error: null }),
  };

  const responsesChain = {
    select: vi.fn().mockReturnThis(),
    // `.eq("player_id", player.id)` is called before `.order()` after P2 defence-in-depth patch
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: responses, error: null }),
  };

  const fromMock = vi.fn((table: string) => {
    // Route by table name for robustness (order-independent, avoids call-count fragility)
    if (table === "profiles") return profileChain;
    if (table === "players") return playerChain;
    // fatigue_responses and any unknown table
    return responsesChain;
  });

  mockCreateServerClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: fromMock,
  });
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("/historico page — Dados Mediados: raw answers only (AC #3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Autenticação ───────────────────────────────────────────────────────────

  it("redirects to /login if user is not authenticated", async () => {
    buildSupabaseMock({ user: null });

    // In real Next.js, redirect() throws a NEXT_REDIRECT special error.
    // In tests, it's mocked as vi.fn() which doesn't throw, so code may continue
    // and crash on user.id access. Wrap in try/catch to handle both behaviours.
    try {
      await HistoricoPage();
    } catch {
      // Expected if mock redirect throws — acceptable
    }

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects staff (coach) away from player page", async () => {
    buildSupabaseMock({ profileRole: "coach" });

    // Redirect is mocked — execution may continue (safe with valid user mock)
    try {
      await HistoricoPage();
    } catch {
      // Acceptable if redirect implementation throws
    }

    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  // ─── Copy mediado ───────────────────────────────────────────────────────────

  it("displays mediated data copy (UX-DR38, AC #3)", async () => {
    buildSupabaseMock({});

    const jsx = await HistoricoPage();
    render(jsx);

    expect(
      screen.getByTestId("mediated-copy").textContent
    ).toContain("As tuas respostas. O treinador é quem interpreta como conjunto.");
  });

  // ─── Empty state ─────────────────────────────────────────────────────────────

  it("shows empty state when player has no responses", async () => {
    buildSupabaseMock({ responses: [] });

    const jsx = await HistoricoPage();
    render(jsx);

    expect(screen.getByText("Sem respostas ainda")).toBeDefined();
    expect(
      screen.getByText(/As tuas respostas aos questionários de fadiga/i)
    ).toBeDefined();
  });

  it("still shows mediated copy even when there are no responses", async () => {
    buildSupabaseMock({ responses: [] });

    const jsx = await HistoricoPage();
    render(jsx);

    expect(
      screen.getByTestId("mediated-copy").textContent
    ).toContain("O treinador é quem interpreta");
  });

  // ─── Dados raw (sem métricas derivadas) ─────────────────────────────────────

  it("renders raw dimension values 1-5 in table cells", async () => {
    buildSupabaseMock({});

    const jsx = await HistoricoPage();
    render(jsx);

    // Raw values from SAMPLE_RESPONSES[0]: 4, 3, 5, 2, 4
    // (Appears as individual table cells — search for '4' may match multiple)
    const cells = screen.getAllByRole("cell");
    const cellTexts = cells.map((c) => c.textContent?.trim());

    expect(cellTexts).toContain("4"); // dim_energy
    expect(cellTexts).toContain("3"); // dim_focus
    expect(cellTexts).toContain("5"); // dim_sleep
    expect(cellTexts).toContain("2"); // dim_soreness
  });

  it("renders sRPE value for post-session responses", async () => {
    buildSupabaseMock({});

    const jsx = await HistoricoPage();
    render(jsx);

    // SAMPLE_RESPONSES[1] has srpe_value: 7, phase: "post"
    const cells = screen.getAllByRole("cell");
    const cellTexts = cells.map((c) => c.textContent?.trim());
    expect(cellTexts).toContain("7");
  });

  it("renders '—' for sRPE on pre-session (no sRPE for pre)", async () => {
    buildSupabaseMock({});

    const jsx = await HistoricoPage();
    render(jsx);

    const cells = screen.getAllByRole("cell");
    const cellTexts = cells.map((c) => c.textContent?.trim());
    expect(cellTexts).toContain("—");
  });

  it("does NOT render any derived metrics (no ACWR, readiness, recovery)", async () => {
    buildSupabaseMock({});

    const jsx = await HistoricoPage();
    render(jsx);

    const pageText = document.body.textContent ?? "";

    expect(pageText).not.toMatch(/acwr/i);
    expect(pageText).not.toMatch(/readiness/i);
    expect(pageText).not.toMatch(/recovery/i);
    expect(pageText).not.toMatch(/prontidão/i);
    expect(pageText).not.toMatch(/tendência/i);
    expect(pageText).not.toMatch(/carga crónica/i);
    expect(pageText).not.toMatch(/carga aguda/i);
  });

  // ─── Acessibilidade ─────────────────────────────────────────────────────────

  it("table has role='table' for accessibility", async () => {
    buildSupabaseMock({});

    const jsx = await HistoricoPage();
    render(jsx);

    const table = screen.getByRole("table");
    expect(table).toBeDefined();
  });

  it("column headers have scope='col'", async () => {
    buildSupabaseMock({});

    const jsx = await HistoricoPage();
    render(jsx);

    const colHeaders = screen.getAllByRole("columnheader");
    expect(colHeaders.length).toBeGreaterThan(0);
    colHeaders.forEach((header) => {
      expect(header.getAttribute("scope")).toBe("col");
    });
  });

  it("displays phase labels in PT-PT (Pré-sessão / Pós-sessão)", async () => {
    buildSupabaseMock({});

    const jsx = await HistoricoPage();
    render(jsx);

    expect(screen.getByText("Pré-sessão")).toBeDefined();
    expect(screen.getByText("Pós-sessão")).toBeDefined();
  });

  it("passes axe-core accessibility scan (zero violations)", async () => {
    buildSupabaseMock({});

    const jsx = await HistoricoPage();
    const { container } = render(jsx);

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("passes axe-core scan for empty state", async () => {
    buildSupabaseMock({ responses: [] });

    const jsx = await HistoricoPage();
    const { container } = render(jsx);

    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
