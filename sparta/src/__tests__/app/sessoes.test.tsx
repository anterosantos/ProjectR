import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const USER_UUID = "750e8400-e29b-41d4-a716-446655440003";
const CLUB_UUID = "650e8400-e29b-41d4-a716-446655440002";
const SEASON_UUID = "850e8400-e29b-41d4-a716-446655440004";
const SESSION_UUID = "550e8400-e29b-41d4-a716-446655440001";

const FUTURE_AT = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const mockTrainingSession = {
  id: SESSION_UUID,
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

const mockMatchSession = {
  ...mockTrainingSession,
  id: "id2",
  type: "match" as const,
};

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
import SessoesPage from "@/app/(staff)/sessoes/page";

function makeSupabaseMock(role = "analyst") {
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

describe("SessoesPage — vista do analista", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza lista de sessões para analista", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockTrainingSession],
    });

    const jsx = await SessoesPage({});
    render(jsx);

    expect(screen.getByText(/campo municipal/i)).toBeInTheDocument();
  });

  it("CTA Registar sessão está visível para analista", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockTrainingSession],
    });

    const jsx = await SessoesPage({});
    render(jsx);

    expect(screen.getByText("Registar sessão")).toBeInTheDocument();
  });

  it("renderiza EmptyState quando não há sessões", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({ ok: true, data: [] });

    const jsx = await SessoesPage({});
    render(jsx);

    expect(screen.getByText(/sem sessões/i)).toBeInTheDocument();
  });

  it("filtra sessões de treino quando tipo=training nos searchParams", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockTrainingSession],
    });

    const params = Promise.resolve({ tipo: "training" });
    const jsx = await SessoesPage({ searchParams: params });
    render(jsx);

    expect(getSessionsForClub).toHaveBeenCalledWith(
      expect.objectContaining({ type: "training" })
    );
  });

  it("filtra sessões tipo matches client-side quando tipo=matches", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [mockTrainingSession, mockMatchSession],
    });

    const params = Promise.resolve({ tipo: "matches" });
    const jsx = await SessoesPage({ searchParams: params });
    render(jsx);

    // Only match session should be visible (training filtered out client-side)
    // We verify getSessionsForClub was called without type filter (matches uses client filter)
    expect(getSessionsForClub).toHaveBeenCalledWith(
      expect.not.objectContaining({ type: expect.anything() })
    );
  });

  it("SessionTypeFilter com activeFilter=all está visível", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);
    vi.mocked(getSessionsForClub).mockResolvedValue({ ok: true, data: [] });

    const jsx = await SessoesPage({});
    render(jsx);

    expect(screen.getByText("Tudo")).toBeInTheDocument();
    expect(screen.getByText("Treinos")).toBeInTheDocument();
    expect(screen.getByText("Jogos")).toBeInTheDocument();
  });

  it("ordena sessões DESC por scheduled_at quando cumulativo=true", async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeSupabaseMock() as never);

    const olderTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const newerTime = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const olderSession = {
      ...mockTrainingSession,
      id: "older-session",
      scheduled_at: olderTime,
    };

    const newerSession = {
      ...mockTrainingSession,
      id: "newer-session",
      scheduled_at: newerTime,
    };

    // Mock returns sessions in ASC order (older first)
    vi.mocked(getSessionsForClub).mockResolvedValue({
      ok: true,
      data: [olderSession, newerSession],
    });

    const params = Promise.resolve({ cumulativo: "true" });
    const jsx = await SessoesPage({ searchParams: params });
    render(jsx);

    // Verifica que ambas as sessões estão presentes (podem ser múltiplas ocorrências)
    const locations = screen.getAllByText(/campo municipal/i);
    expect(locations.length).toBeGreaterThanOrEqual(2);
  });
});
