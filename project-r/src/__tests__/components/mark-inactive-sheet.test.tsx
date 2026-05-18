import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/players", () => ({
  markPlayerInactive: vi.fn(),
  reactivatePlayer: vi.fn(),
}));

vi.mock("@/components/ui/drill-down-sheet", () => ({
  DrillDownSheet: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) =>
    open ? <div data-testid="drill-down-sheet">{children}</div> : null,
}));

import { MarkInactiveSheet } from "@/components/ui/mark-inactive-sheet";
import { ReactivatePlayerDialog } from "@/app/(staff)/plantel/[id]/reactivate-player-dialog";
import { markPlayerInactive, reactivatePlayer } from "@/lib/actions/players";

const PLAYER_ID = "123e4567-e89b-12d3-a456-426614174000";
const PLAYER_NAME = "João Silva";

describe("MarkInactiveSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza botão 'Marcar inactivo'", () => {
    render(<MarkInactiveSheet playerId={PLAYER_ID} playerName={PLAYER_NAME} />);
    expect(screen.getByRole("button", { name: /Marcar inactivo/i })).toBeInTheDocument();
  });

  it("abre sheet ao clicar no botão", async () => {
    render(<MarkInactiveSheet playerId={PLAYER_ID} playerName={PLAYER_NAME} />);
    fireEvent.click(screen.getByRole("button", { name: /Marcar inactivo/i }));
    await waitFor(() => {
      expect(screen.getByTestId("drill-down-sheet")).toBeInTheDocument();
    });
  });

  it("mostra campo de motivo e botões no sheet", async () => {
    render(<MarkInactiveSheet playerId={PLAYER_ID} playerName={PLAYER_NAME} />);
    fireEvent.click(screen.getByRole("button", { name: /Marcar inactivo/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/lesão no joelho/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirmar/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
    });
  });

  it("chama markPlayerInactive ao submeter", async () => {
    vi.mocked(markPlayerInactive).mockResolvedValue({ ok: true, data: undefined });

    render(<MarkInactiveSheet playerId={PLAYER_ID} playerName={PLAYER_NAME} />);
    fireEvent.click(screen.getByRole("button", { name: /Marcar inactivo/i }));
    await waitFor(() => screen.getByRole("button", { name: /Confirmar/i }));

    fireEvent.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => {
      expect(markPlayerInactive).toHaveBeenCalledWith(
        expect.objectContaining({ playerId: PLAYER_ID })
      );
    });
  });

  it("mostra erro quando markPlayerInactive falha", async () => {
    vi.mocked(markPlayerInactive).mockResolvedValue({
      ok: false,
      error: { code: "unknown", message: "Erro ao marcar" },
    });

    render(<MarkInactiveSheet playerId={PLAYER_ID} playerName={PLAYER_NAME} />);
    fireEvent.click(screen.getByRole("button", { name: /Marcar inactivo/i }));
    await waitFor(() => screen.getByRole("button", { name: /Confirmar/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar/i }));

    await waitFor(() => {
      expect(screen.getByText("Erro ao marcar")).toBeInTheDocument();
    });
  });
});

describe("ReactivatePlayerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza botão 'Reactivar'", () => {
    render(<ReactivatePlayerDialog playerId={PLAYER_ID} playerName={PLAYER_NAME} />);
    expect(screen.getByRole("button", { name: /Reactivar/i })).toBeInTheDocument();
  });

  it("abre diálogo ao clicar no botão", async () => {
    render(<ReactivatePlayerDialog playerId={PLAYER_ID} playerName={PLAYER_NAME} />);
    fireEvent.click(screen.getByRole("button", { name: /Reactivar/i }));
    await waitFor(() => {
      expect(screen.getByText(/Reactivar jogador\?/i)).toBeInTheDocument();
      expect(screen.getByText(PLAYER_NAME)).toBeInTheDocument();
    });
  });

  it("chama reactivatePlayer ao confirmar", async () => {
    vi.mocked(reactivatePlayer).mockResolvedValue({ ok: true, data: undefined });

    render(<ReactivatePlayerDialog playerId={PLAYER_ID} playerName={PLAYER_NAME} />);
    fireEvent.click(screen.getByRole("button", { name: /Reactivar/i }));
    await waitFor(() => screen.getByText(/Reactivar jogador\?/i));

    // Click the confirm button (the one inside the dialog footer)
    const buttons = screen.getAllByRole("button");
    const confirmBtn = buttons.find((b) => b.textContent === "Reactivar");
    if (confirmBtn) fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(reactivatePlayer).toHaveBeenCalledWith({ playerId: PLAYER_ID });
    });
  });

  it("mostra erro quando reactivatePlayer falha", async () => {
    vi.mocked(reactivatePlayer).mockResolvedValue({
      ok: false,
      error: { code: "unknown", message: "Erro ao reactivar" },
    });

    render(<ReactivatePlayerDialog playerId={PLAYER_ID} playerName={PLAYER_NAME} />);
    fireEvent.click(screen.getByRole("button", { name: /Reactivar/i }));
    await waitFor(() => screen.getByText(/Reactivar jogador\?/i));

    const buttons = screen.getAllByRole("button");
    const confirmBtn = buttons.find((b) => b.textContent === "Reactivar");
    if (confirmBtn) fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText("Erro ao reactivar")).toBeInTheDocument();
    });
  });
});
