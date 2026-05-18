import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/seasons", () => ({
  createSeason: vi.fn(),
  updateSeason: vi.fn(),
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
  }) =>
    open ? <div data-testid="drill-down-sheet">{children}</div> : null,
}));

import { SeasonForm } from "@/app/configuracoes/epocas/season-form";
import { createSeason, updateSeason } from "@/lib/actions/seasons";
import type { Season } from "@/lib/schemas/seasons";

const mockSeason: Season = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  club_id: "650e8400-e29b-41d4-a716-446655440001",
  name: "2025/26",
  start_date: "2025-08-01",
  end_date: "2026-06-30",
  is_current: true,
  created_at: "2026-05-18T00:00:00Z",
};

describe("SeasonForm — modo create", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza campos do formulário", () => {
    render(
      <SeasonForm mode="create" open={true} onOpenChange={onOpenChange} />
    );
    expect(screen.getByTestId("drill-down-sheet")).toBeInTheDocument();
    expect(screen.getByText("Nova época")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ex: 2026\/27/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/data de início/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/data de fim/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/definir como época atual/i)
    ).toBeInTheDocument();
  });

  it("não renderiza quando open=false", () => {
    render(
      <SeasonForm mode="create" open={false} onOpenChange={onOpenChange} />
    );
    expect(screen.queryByTestId("drill-down-sheet")).not.toBeInTheDocument();
  });

  it("chama createSeason ao submeter com dados válidos", async () => {
    vi.mocked(createSeason).mockResolvedValue({
      ok: true,
      data: { ...mockSeason, name: "2026/27" },
    });

    render(
      <SeasonForm mode="create" open={true} onOpenChange={onOpenChange} />
    );

    fireEvent.change(screen.getByPlaceholderText(/ex: 2026\/27/i), {
      target: { value: "2026/27" },
    });
    fireEvent.change(screen.getByLabelText(/data de início/i), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(screen.getByLabelText(/data de fim/i), {
      target: { value: "2027-06-30" },
    });

    fireEvent.click(screen.getByRole("button", { name: /criar época/i }));

    await waitFor(() => {
      expect(createSeason).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "2026/27",
          startDate: "2026-08-01",
          endDate: "2027-06-30",
          setAsCurrent: false,
        })
      );
    });
  });

  it("mostra erro de validação quando endDate <= startDate", async () => {
    render(
      <SeasonForm mode="create" open={true} onOpenChange={onOpenChange} />
    );

    fireEvent.change(screen.getByPlaceholderText(/ex: 2026\/27/i), {
      target: { value: "2026/27" },
    });
    fireEvent.change(screen.getByLabelText(/data de início/i), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(screen.getByLabelText(/data de fim/i), {
      target: { value: "2026-07-01" },
    });

    fireEvent.click(screen.getByRole("button", { name: /criar época/i }));

    await waitFor(() => {
      expect(screen.getByText(/posterior à data de início/i)).toBeInTheDocument();
    });
  });

  it("mostra erro do servidor quando action falha", async () => {
    vi.mocked(createSeason).mockResolvedValue({
      ok: false,
      error: { code: "unknown", message: "Erro de base de dados" },
    });

    render(
      <SeasonForm mode="create" open={true} onOpenChange={onOpenChange} />
    );

    fireEvent.change(screen.getByPlaceholderText(/ex: 2026\/27/i), {
      target: { value: "2026/27" },
    });
    fireEvent.change(screen.getByLabelText(/data de início/i), {
      target: { value: "2026-08-01" },
    });
    fireEvent.change(screen.getByLabelText(/data de fim/i), {
      target: { value: "2027-06-30" },
    });

    fireEvent.click(screen.getByRole("button", { name: /criar época/i }));

    await waitFor(() => {
      expect(screen.getByText(/Erro de base de dados/i)).toBeInTheDocument();
    });
  });
});

describe("SeasonForm — modo edit", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pré-preenche campos com dados da época existente", () => {
    render(
      <SeasonForm
        mode="edit"
        season={mockSeason}
        open={true}
        onOpenChange={onOpenChange}
      />
    );
    expect(screen.getByText("Editar época")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2025/26")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2025-08-01")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-06-30")).toBeInTheDocument();
  });

  it("chama updateSeason ao submeter", async () => {
    vi.mocked(updateSeason).mockResolvedValue({
      ok: true,
      data: mockSeason,
    });

    render(
      <SeasonForm
        mode="edit"
        season={mockSeason}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /actualizar/i }));

    await waitFor(() => {
      expect(updateSeason).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockSeason.id,
          name: "2025/26",
        })
      );
    });
  });

  it("fecha o sheet ao clicar em Cancelar", () => {
    render(
      <SeasonForm
        mode="edit"
        season={mockSeason}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
