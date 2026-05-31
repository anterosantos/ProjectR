import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { SubstitutionSheet } from "@/components/domain/match-event-capture/substitution-sheet";

vi.mock("@/lib/actions/substitutions", () => ({
  getMatchLineupForSubs: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      starters: [
        {
          lineup_id: "l1",
          player_id: "p1",
          name: "João Silva",
          jersey_number: 10,
          started_minute: 0,
          ended_minute: null,
        },
      ],
      bench: [
        {
          lineup_id: "l2",
          player_id: "p2",
          name: "Carlos Matos",
          jersey_number: 14,
          started_minute: 0,
          ended_minute: null,
        },
      ],
    },
  }),
  registerSubstitution: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

const { getMatchLineupForSubs, registerSubstitution } = await import(
  "@/lib/actions/substitutions"
);

const SCHEDULED_AT_45 = new Date(Date.now() - 45 * 60_000).toISOString();

const defaultProps = {
  sessionId: "sess-1",
  scheduledAt: SCHEDULED_AT_45,
  isOpen: true,
  onClose: vi.fn(),
};

describe("<SubstitutionSheet>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMatchLineupForSubs).mockResolvedValue({
      ok: true,
      data: {
        starters: [
          {
            lineup_id: "l1",
            player_id: "p1",
            name: "João Silva",
            jersey_number: 10,
            started_minute: 0,
            ended_minute: null,
          },
        ],
        bench: [
          {
            lineup_id: "l2",
            player_id: "p2",
            name: "Carlos Matos",
            jersey_number: 14,
            started_minute: 0,
            ended_minute: null,
          },
        ],
      },
    });
    vi.mocked(registerSubstitution).mockResolvedValue({
      ok: true,
      data: undefined,
    });
    defaultProps.onClose = vi.fn();
  });

  it("não renderiza quando isOpen=false", () => {
    render(<SubstitutionSheet {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderiza dialog com dois painéis Sai/Entra", async () => {
    render(<SubstitutionSheet {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/SAI/i)).toBeInTheDocument();
    expect(screen.getByText(/ENTRA/i)).toBeInTheDocument();
  });

  it("renderiza jogadores de cada lista", async () => {
    render(<SubstitutionSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/#10 João Silva/i)).toBeInTheDocument();
      expect(screen.getByText(/#14 Carlos Matos/i)).toBeInTheDocument();
    });
  });

  it("botão Confirmar desactivado sem seleção", async () => {
    render(<SubstitutionSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/#10 João Silva/i)).toBeInTheDocument();
    });

    const confirmBtn = screen.getByText("Confirmar Substituição");
    expect(confirmBtn).toBeDisabled();
  });

  it("seleção dupla activa botão Confirmar", async () => {
    render(<SubstitutionSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/#10 João Silva/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/#10 João Silva/i));
    fireEvent.click(screen.getByText(/#14 Carlos Matos/i));

    const confirmBtn = screen.getByText("Confirmar Substituição");
    expect(confirmBtn).not.toBeDisabled();
  });

  it("Confirmar chama registerSubstitution com args correctos", async () => {
    render(<SubstitutionSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/#10 João Silva/i)).toBeInTheDocument();
    });

    // Selecionar jogadores
    fireEvent.click(screen.getByText(/#10 João Silva/i));
    fireEvent.click(screen.getByText(/#14 Carlos Matos/i));

    // Confirmar
    fireEvent.click(screen.getByText("Confirmar Substituição"));

    await waitFor(() => {
      expect(vi.mocked(registerSubstitution)).toHaveBeenCalledWith(
        "sess-1",
        "p1",
        "p2",
        expect.any(Number)
      );
    });
  });

  it("Confirmar fecha o sheet após sucesso", async () => {
    render(<SubstitutionSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/#10 João Silva/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/#10 João Silva/i));
    fireEvent.click(screen.getByText(/#14 Carlos Matos/i));
    fireEvent.click(screen.getByText("Confirmar Substituição"));

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it("Cancelar chama onClose sem chamar registerSubstitution", async () => {
    render(<SubstitutionSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/#10 João Silva/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Cancelar"));

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(vi.mocked(registerSubstitution)).not.toHaveBeenCalled();
  });

  it("erro da action mostrado inline sem fechar o sheet", async () => {
    vi.mocked(registerSubstitution).mockResolvedValueOnce({
      ok: false,
      error: { code: "validation", message: "Jogador que sai não está em campo." },
    });

    render(<SubstitutionSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/#10 João Silva/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/#10 João Silva/i));
    fireEvent.click(screen.getByText(/#14 Carlos Matos/i));
    fireEvent.click(screen.getByText("Confirmar Substituição"));

    await waitFor(() => {
      expect(
        screen.getByText("Jogador que sai não está em campo.")
      ).toBeInTheDocument();
    });

    // Sheet continua aberta
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it("minuto auto-calculado está próximo de 45", async () => {
    render(<SubstitutionSheet {...defaultProps} />);

    const minuteInput = screen.getByLabelText("Minuto") as HTMLInputElement;
    const value = Number(minuteInput.value);

    // Tolerância de ±2 minutos para flutação de execução do teste
    expect(value).toBeGreaterThanOrEqual(43);
    expect(value).toBeLessThanOrEqual(47);
  });

  it("campo de minuto é editável", async () => {
    render(<SubstitutionSheet {...defaultProps} />);

    const minuteInput = screen.getByLabelText("Minuto") as HTMLInputElement;
    fireEvent.change(minuteInput, { target: { value: "60" } });

    expect(Number(minuteInput.value)).toBe(60);
  });

  it("campo de minuto clipa acima de 120", async () => {
    render(<SubstitutionSheet {...defaultProps} />);

    const minuteInput = screen.getByLabelText("Minuto") as HTMLInputElement;
    fireEvent.change(minuteInput, { target: { value: "150" } });

    expect(Number(minuteInput.value)).toBe(120);
  });

  it("mostra mensagem quando Sai está vazio", async () => {
    vi.mocked(getMatchLineupForSubs).mockResolvedValueOnce({
      ok: true,
      data: { starters: [], bench: [] },
    });

    render(<SubstitutionSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Sem jogadores em campo")).toBeInTheDocument();
      expect(screen.getByText("Sem jogadores no banco")).toBeInTheDocument();
    });
  });

  it("zero violações axe", async () => {
    const { container } = render(<SubstitutionSheet {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/#10 João Silva/i)).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
