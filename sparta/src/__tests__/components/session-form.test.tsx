import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/sessions", () => ({
  createSession: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock("@/components/ui/drill-down-sheet", () => ({
  DrillDownSheet: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="drill-down-sheet">{children}</div> : null),
}));

vi.mock("@/components/ui/calm-confirmation", () => ({
  CalmConfirmation: ({ message }: { message: string }) => (
    <div data-testid="calm-confirmation">{message}</div>
  ),
}));

import { SessionForm } from "@/app/(staff)/calendario/session-form";
import { createSession, updateSession } from "@/lib/actions/sessions";
import type { Session } from "@/lib/schemas/sessions";

const FUTURE_AT = new Date(Date.now() + 60 * 60 * 1000).toISOString();

const mockSession: Session = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  club_id: "650e8400-e29b-41d4-a716-446655440001",
  season_id: "750e8400-e29b-41d4-a716-446655440002",
  type: "training",
  scheduled_at: FUTURE_AT,
  duration_min: 90,
  location: "Campo Municipal",
  status: "scheduled",
  notes: "Treino normal",
  created_by: "850e8400-e29b-41d4-a716-446655440003",
  created_at: "2026-05-19T00:00:00Z",
};

describe("SessionForm — modo create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza campos do formulário quando hasSeason=true", () => {
    render(<SessionForm mode="create" hasSeason={true} />);
    expect(screen.getByTestId("drill-down-sheet")).toBeInTheDocument();
    expect(screen.getByText("Nova sessão")).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo de sessão/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/data e hora/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/duração/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/local/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notas/i)).toBeInTheDocument();
  });

  it("mostra alerta quando hasSeason=false e desabilita botão", () => {
    render(<SessionForm mode="create" hasSeason={false} />);
    expect(screen.getByText(/sem época actual/i)).toBeInTheDocument();
    const submitBtn = screen.getByRole("button", { name: /criar sessão/i });
    expect(submitBtn).toBeDisabled();
  });

  it("o dropdown de tipo contém as 3 opções", () => {
    render(<SessionForm mode="create" hasSeason={true} />);
    expect(screen.getByRole("option", { name: "Treino" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Jogo" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Jogo amigável" })
    ).toBeInTheDocument();
  });

  it("chama createSession ao submeter e mostra confirmação", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: true,
      data: mockSession,
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    const select = screen.getByLabelText(/tipo de sessão/i);
    fireEvent.change(select, { target: { value: "match" } });

    const datetimeInput = screen.getByLabelText(/data e hora/i);
    const localDt = new Date(FUTURE_AT);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dtLocal = `${localDt.getFullYear()}-${pad(localDt.getMonth() + 1)}-${pad(localDt.getDate())}T${pad(localDt.getHours())}:${pad(localDt.getMinutes())}`;
    fireEvent.change(datetimeInput, { target: { value: dtLocal } });

    const durationInput = screen.getByLabelText(/duração/i);
    fireEvent.change(durationInput, { target: { value: "60" } });

    const submitBtn = screen.getByRole("button", { name: /criar sessão/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSession).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId("calm-confirmation")).toHaveTextContent(
        "Sessão criada"
      );
    });
  });

  it("mostra erro quando createSession falha", async () => {
    vi.mocked(createSession).mockResolvedValue({
      ok: false,
      error: { code: "no_season", message: "Sem época actual definida." },
    });

    render(<SessionForm mode="create" hasSeason={true} />);

    const datetimeInput = screen.getByLabelText(/data e hora/i);
    const localDt = new Date(FUTURE_AT);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dtLocal = `${localDt.getFullYear()}-${pad(localDt.getMonth() + 1)}-${pad(localDt.getDate())}T${pad(localDt.getHours())}:${pad(localDt.getMinutes())}`;
    fireEvent.change(datetimeInput, { target: { value: dtLocal } });

    fireEvent.click(screen.getByRole("button", { name: /criar sessão/i }));

    await waitFor(() => {
      expect(screen.getByText(/sem época actual/i)).toBeInTheDocument();
    });
  });
});

describe("SessionForm — modo edit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza pré-preenchido com dados da sessão", () => {
    render(<SessionForm mode="edit" session={mockSession} />);
    expect(screen.getByText("Editar sessão")).toBeInTheDocument();
    const select = screen.getByLabelText(/tipo de sessão/i) as HTMLSelectElement;
    expect(select.value).toBe("training");
  });

  it("desabilita formulário quando sessão está cancelada", () => {
    const cancelled: Session = { ...mockSession, status: "cancelled" };
    render(<SessionForm mode="edit" session={cancelled} />);
    expect(screen.getByText(/não pode ser editada/i)).toBeInTheDocument();
    const select = screen.getByLabelText(/tipo de sessão/i) as HTMLSelectElement;
    expect(select).toBeDisabled();
  });

  it("desabilita formulário quando sessão está concluída", () => {
    const completed: Session = { ...mockSession, status: "completed" };
    render(<SessionForm mode="edit" session={completed} />);
    expect(screen.getByText(/não pode ser editada/i)).toBeInTheDocument();
  });

  it("chama updateSession ao submeter", async () => {
    vi.mocked(updateSession).mockResolvedValue({ ok: true, data: mockSession });

    render(<SessionForm mode="edit" session={mockSession} />);

    const submitBtn = screen.getByRole("button", {
      name: /actualizar sessão/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateSession).toHaveBeenCalled();
    });
  });
});
