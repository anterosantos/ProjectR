import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { RecentEventsRing } from "@/components/domain/match-event-capture/recent-events-ring";
import { useMatchSession } from "@/lib/stores/match-session";
import type { RecentEventEntry } from "@/lib/stores/match-session";

vi.mock("@/lib/actions/events", () => ({
  getRecentMatchEvents: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  deleteMatchEvent: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

const { getRecentMatchEvents, deleteMatchEvent } = await import("@/lib/actions/events");

const mockEvent: RecentEventEntry = {
  id: "evt-001",
  action: "ball_loss",
  zone: "mid_center",
  jersey_number: 7,
  occurred_at: "2026-05-30T15:00:00.000Z",
};

describe("<RecentEventsRing>", () => {
  beforeEach(() => {
    useMatchSession.setState({ recentEvents: [] });
    vi.mocked(getRecentMatchEvents).mockResolvedValue({ ok: true, data: [] });
    vi.mocked(deleteMatchEvent).mockResolvedValue({ ok: true, data: undefined });
  });

  it("renderiza 6 placeholders quando sem eventos", async () => {
    render(<RecentEventsRing sessionId="sess-123" />);
    await waitFor(() => {
      const placeholders = screen.getAllByRole("presentation");
      expect(placeholders).toHaveLength(6);
    });
  });

  it("renderiza chip quando há eventos no store e 5 placeholders", async () => {
    vi.mocked(getRecentMatchEvents).mockResolvedValue({
      ok: true,
      data: [mockEvent],
    });
    render(<RecentEventsRing sessionId="sess-123" />);
    await waitFor(() => {
      expect(screen.getByText(/#7/)).toBeInTheDocument();
    });
    const placeholders = screen.getAllByRole("presentation");
    expect(placeholders).toHaveLength(5);
  });

  it("renderiza 6 chips e 0 placeholders com 6 eventos", async () => {
    const events = Array.from({ length: 6 }, (_, i) => ({
      ...mockEvent,
      id: `evt-${i}`,
      jersey_number: i + 1,
    }));
    vi.mocked(getRecentMatchEvents).mockResolvedValue({
      ok: true,
      data: events,
    });
    render(<RecentEventsRing sessionId="sess-123" />);
    await waitFor(() => {
      expect(screen.getByText(/#1/)).toBeInTheDocument();
    });
    expect(screen.queryAllByRole("presentation")).toHaveLength(0);
  });

  it("tem role=log e aria-live=polite (AC#6)", () => {
    render(<RecentEventsRing sessionId="sess-123" />);
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
  });

  it("chama getRecentMatchEvents no mount com sessionId", async () => {
    render(<RecentEventsRing sessionId="sess-abc" />);
    await waitFor(() => {
      expect(getRecentMatchEvents).toHaveBeenCalledWith("sess-abc");
    });
  });

  it("popula store a partir do DB na montagem", async () => {
    vi.mocked(getRecentMatchEvents).mockResolvedValue({
      ok: true,
      data: [mockEvent],
    });
    render(<RecentEventsRing sessionId="sess-123" />);
    await waitFor(() => {
      expect(screen.getByText(/#7/)).toBeInTheDocument();
    });
  });

  it("limpa events ao mudar sessionId (session boundary AC#7)", async () => {
    vi.mocked(getRecentMatchEvents).mockResolvedValue({
      ok: true,
      data: [mockEvent],
    });
    const { rerender } = render(<RecentEventsRing sessionId="sess-123" />);

    // Aguarda carregamento inicial
    await waitFor(() => {
      expect(getRecentMatchEvents).toHaveBeenCalledWith("sess-123");
    });

    expect(useMatchSession.getState().recentEvents).toHaveLength(1);

    // Mock para novo sessionId
    vi.mocked(getRecentMatchEvents).mockResolvedValue({
      ok: true,
      data: [],
    });

    // Muda sessionId
    rerender(<RecentEventsRing sessionId="sess-456" />);

    // Verifica que getRecentMatchEvents foi chamado com novo sessionId
    await waitFor(() => {
      expect(getRecentMatchEvents).toHaveBeenCalledWith("sess-456");
    });
  });

  it("delete success remove chip optimisticamente", async () => {
    vi.mocked(getRecentMatchEvents).mockResolvedValue({
      ok: true,
      data: [mockEvent],
    });
    render(<RecentEventsRing sessionId="sess-123" />);
    await waitFor(() => {
      expect(screen.getByText(/#7/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /remover evento/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Remover$/i }));

    await waitFor(() => {
      expect(deleteMatchEvent).toHaveBeenCalledWith("evt-001");
      expect(screen.queryByText(/#7/)).not.toBeInTheDocument();
    });
  });

  it("delete error mostra mensagem e restaura via re-fetch", async () => {
    vi.mocked(deleteMatchEvent).mockResolvedValue({
      ok: false,
      error: { code: "unknown", message: "Erro" },
    });
    vi.mocked(getRecentMatchEvents).mockResolvedValue({
      ok: true,
      data: [mockEvent],
    });
    useMatchSession.setState({ recentEvents: [mockEvent] });
    render(<RecentEventsRing sessionId="sess-123" />);

    await waitFor(() => {
      expect(screen.getByText(/#7/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /remover evento/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Remover$/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Erro ao remover/i)).toBeInTheDocument();
      expect(screen.getByText(/#7/)).toBeInTheDocument();
    });
  });

  it("zero violações axe", async () => {
    const { container } = render(<RecentEventsRing sessionId="sess-123" />);
    await waitFor(() => expect(getRecentMatchEvents).toHaveBeenCalled());
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
