import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventChip } from "@/components/domain/match-event-capture/event-chip";
import type { RecentEventEntry } from "@/lib/stores/match-session";

const mockEntry: RecentEventEntry = {
  id: "01920a4b-c8d3-7000-9c4e-000000000001",
  action: "ball_loss",
  zone: "mid_center",
  jersey_number: 10,
  occurred_at: "2026-05-30T15:00:00.000Z",
};

describe("<EventChip>", () => {
  it("renderiza jersey e abreviatura de zona no estado normal", () => {
    render(<EventChip entry={mockEntry} onDelete={vi.fn()} isDeleting={false} />);
    expect(screen.getByText(/#10/)).toBeInTheDocument();
    expect(screen.getByText(/MC/)).toBeInTheDocument();
  });

  it("tem aria-label descritiva no estado normal", () => {
    render(<EventChip entry={mockEntry} onDelete={vi.fn()} isDeleting={false} />);
    const btn = screen.getByRole("button", { name: /Remover evento: Perda de bola #10 Meio centro/i });
    expect(btn).toBeInTheDocument();
  });

  it("tap abre confirmação inline", () => {
    render(<EventChip entry={mockEntry} onDelete={vi.fn()} isDeleting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /remover evento/i }));
    expect(screen.getByText("Remover evento?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Remover$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cancelar$/i })).toBeInTheDocument();
  });

  it("cancelar volta ao estado normal", () => {
    render(<EventChip entry={mockEntry} onDelete={vi.fn()} isDeleting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /remover evento/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancelar$/i }));
    expect(screen.queryByText("Remover evento?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remover evento/i })).toBeInTheDocument();
  });

  it("confirmar chama onDelete com id correcto", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<EventChip entry={mockEntry} onDelete={onDelete} isDeleting={false} />);
    fireEvent.click(screen.getByRole("button", { name: /remover evento/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Remover$/i }));
    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(mockEntry.id);
    });
  });

  it("renderiza ícone lucide (aria-hidden)", () => {
    const { container } = render(
      <EventChip entry={mockEntry} onDelete={vi.fn()} isDeleting={false} />
    );
    const svgIcon = container.querySelector("svg[aria-hidden='true']");
    expect(svgIcon).toBeInTheDocument();
  });

  it("ball_recovery usa abreviatura de zona correcta (att_left → AE)", () => {
    const entry: RecentEventEntry = { ...mockEntry, action: "ball_recovery", zone: "att_left" };
    render(<EventChip entry={entry} onDelete={vi.fn()} isDeleting={false} />);
    expect(screen.getByText(/AE/)).toBeInTheDocument();
  });

  it("desabilitado quando isDeleting=true", () => {
    render(<EventChip entry={mockEntry} onDelete={vi.fn()} isDeleting={true} />);
    expect(screen.getByRole("button", { name: /remover evento/i })).toBeDisabled();
  });

  it("isWithinEditWindow=false — botão disabled e TooltipExplain renderizado", () => {
    render(
      <EventChip
        entry={mockEntry}
        onDelete={vi.fn()}
        isDeleting={false}
        isWithinEditWindow={false}
      />
    );
    const btn = screen.getByRole("button", { name: /remover evento/i });
    expect(btn).toBeDisabled();
    // TooltipExplain renders the term text
    expect(screen.getByText(/Edição encerrada/i)).toBeInTheDocument();
  });

  it("isWithinEditWindow=false — click não abre confirmação", () => {
    render(
      <EventChip
        entry={mockEntry}
        onDelete={vi.fn()}
        isDeleting={false}
        isWithinEditWindow={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /remover evento/i }));
    expect(screen.queryByText("Remover evento?")).not.toBeInTheDocument();
  });

  it("isWithinEditWindow=true (default) — comportamento existente preservado", () => {
    render(<EventChip entry={mockEntry} onDelete={vi.fn()} isDeleting={false} />);
    const btn = screen.getByRole("button", { name: /remover evento/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(screen.getByText("Remover evento?")).toBeInTheDocument();
  });
});
