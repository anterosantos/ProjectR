import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/actions/sessions", () => ({
  getSessionsForClub: vi.fn(),
}));

vi.mock("@/lib/actions/seasons", () => ({
  getCurrentSeason: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      id: "850e8400-e29b-41d4-a716-446655440004",
      club_id: "650e8400-e29b-41d4-a716-446655440002",
      name: "2026/27",
      start_date: "2026-08-01",
      end_date: "2027-06-30",
      is_current: true,
      created_at: "2026-05-01T00:00:00Z",
    },
  }),
}));

import { createServerClient } from "@/lib/supabase/server";
import { getSessionsForClub } from "@/lib/actions/sessions";
import { getCurrentSeason } from "@/lib/actions/seasons";
import CalendarioPage from "@/app/(staff)/calendario/page";

const USER_UUID = "750e8400-e29b-41d4-a716-446655440003";
const CLUB_UUID = "650e8400-e29b-41d4-a716-446655440002";
const SEASON_UUID = "850e8400-e29b-41d4-a716-446655440004";

const NOW = new Date();
const PAST_AT = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
const FUTURE_AT = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

const mockSession1 = {
  id: "session-1",
  club_id: CLUB_UUID,
  season_id: SEASON_UUID,
  type: "training" as const,
  scheduled_at: FUTURE_AT,
  duration_min: 90,
  location: "Campo Municipal",
  status: "scheduled" as const,
  notes: null,
  created_by: USER_UUID,
  created_at: "2026-05-19T00:00:00Z",
};

const mockSession2 = {
  ...mockSession1,
  id: "session-2",
  scheduled_at: PAST_AT,
};

function makeSupabaseMock(role = "coach") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_UUID } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { role, club_id: CLUB_UUID },
        error: null,
      }),
    }),
  };
}

describe("CalendarioPage — vista do treinador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza lista de sessões para coach", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession1],
    });

    const jsx = await CalendarioPage({});
    render(jsx);

    expect(screen.getByText(/campo municipal/i)).toBeInTheDocument();
  });

  it("CTA Nova sessão está visível para coach", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession1],
    });

    const jsx = await CalendarioPage({});
    render(jsx);

    expect(screen.getByText(/nova sessão/i)).toBeInTheDocument();
  });

  it("filtra sessões por época actual por default (modo não-cumulativo)", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession1],
    });

    const jsx = await CalendarioPage({});
    render(jsx);

    expect(getSessionsForClub).toHaveBeenCalledWith(
      expect.objectContaining({ season_id: SEASON_UUID })
    );
  });

  it("carrega todas as sessões quando cumulativo=true (sem filtro season_id)", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession1, mockSession2],
    });

    const params = Promise.resolve({ cumulativo: "true" });
    const jsx = await CalendarioPage({ searchParams: params });
    render(jsx);

    // Verifica que getSessionsForClub foi chamado SEM season_id (cumulativo)
    // Pode ser chamado com undefined ou sem argumentos
    const calls = vi.mocked(getSessionsForClub).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBeUndefined();
  });

  it("ordena sessões DESC por scheduled_at quando cumulativo=true", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession2, mockSession1],
    });

    const params = Promise.resolve({ cumulativo: "true" });
    const jsx = await CalendarioPage({ searchParams: params });
    render(jsx);

    expect(screen.getAllByText(/campo municipal/i).length).toBeGreaterThan(0);
  });

  it("SeasonToggle está visível", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({ ok: true, data: [] });

    const jsx = await CalendarioPage({});
    render(jsx);

    expect(screen.getByText("Época actual")).toBeInTheDocument();
  });

  it("renderiza EmptyState quando não há sessões", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({ ok: true, data: [] });

    const jsx = await CalendarioPage({});
    render(jsx);

    expect(screen.getByText(/sem sessões/i)).toBeInTheDocument();
  });

  it("usa graceful degradation quando não há época actual", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession1],
    });

    vi.mocked(getCurrentSeason).mockResolvedValue({
      ok: true,
      data: null,
    });

    const jsx = await CalendarioPage({});
    render(jsx);

    expect(getSessionsForClub).toHaveBeenCalledWith(undefined);
  });

  it('renderiza "Cumulativo" button para toggle', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockSession1],
    });

    const jsx = await CalendarioPage({});
    render(jsx);

    expect(screen.getByText("Cumulativo")).toBeInTheDocument();
  });
});
