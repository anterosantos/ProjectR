import "fake-indexeddb/auto";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttendancePanel } from "@/app/(staff)/sessoes/[id]/presencas/attendance-panel";
import type {
  AttendanceRecord,
  PlayerForAttendance,
} from "@/lib/schemas/attendances";

vi.mock("@/lib/actions/attendance", () => ({
  upsertAttendance: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}));

vi.mock("@/lib/outbox/enqueue", () => ({
  enqueueMutation: vi.fn().mockResolvedValue("mock-id"),
}));

vi.mock("@/lib/uuid", () => ({
  newId: vi.fn().mockReturnValue("01920a4b-c8d3-7000-9c4e-000000000099"),
}));

let mockIsOnline = true;
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => ({ isOnline: mockIsOnline }),
}));

const { upsertAttendance } = await import("@/lib/actions/attendance");
const { enqueueMutation } = await import("@/lib/outbox/enqueue");

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = "session-uuid-001";

const activePlayers: PlayerForAttendance[] = [
  { id: "player-1", full_name: "João Silva", jersey_num: 10, primary_position: "MID", is_active: true },
  { id: "player-2", full_name: "Carlos Matos", jersey_num: 7, primary_position: "FWD", is_active: true },
];

const mixedPlayers: PlayerForAttendance[] = [
  ...activePlayers,
  { id: "player-3", full_name: "Rui Costa", jersey_num: 4, primary_position: "DEF", is_active: false },
];

const existingAttendances: AttendanceRecord[] = [
  {
    player_id: "player-1",
    status: "absent",
    note: null,
    recorded_at: "2026-05-31T10:00:00Z",
  },
];

const defaultProps = {
  players: activePlayers,
  existingAttendances: [],
  sessionId: SESSION_ID,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("<AttendancePanel>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline = true;
  });

  it("renders all active players", () => {
    render(<AttendancePanel {...defaultProps} />);
    expect(screen.getByText("João Silva")).toBeDefined();
    expect(screen.getByText("Carlos Matos")).toBeDefined();
  });

  it("pre-loads existing attendance status", () => {
    render(
      <AttendancePanel
        {...defaultProps}
        players={activePlayers}
        existingAttendances={existingAttendances}
      />
    );
    const btn = screen.getByRole("button", { name: /João Silva.*Ausente/i });
    expect(btn).toBeDefined();
  });

  it("defaults to 'Presente' when no existing record", () => {
    render(<AttendancePanel {...defaultProps} existingAttendances={[]} />);
    const btn = screen.getByRole("button", { name: /João Silva.*Presente/i });
    expect(btn).toBeDefined();
  });

  it("toggle cicla: present → absent → late → injured → excused → present", async () => {
    render(<AttendancePanel {...defaultProps} existingAttendances={[]} />);

    const getPlayerBtn = () =>
      screen.getByRole("button", { name: /João Silva/i });

    fireEvent.click(getPlayerBtn());
    await waitFor(() =>
      expect(getPlayerBtn().getAttribute("aria-label")).toContain("Ausente")
    );

    fireEvent.click(getPlayerBtn());
    await waitFor(() =>
      expect(getPlayerBtn().getAttribute("aria-label")).toContain("Atrasado")
    );

    fireEvent.click(getPlayerBtn());
    await waitFor(() =>
      expect(getPlayerBtn().getAttribute("aria-label")).toContain("Lesionado")
    );

    fireEvent.click(getPlayerBtn());
    await waitFor(() =>
      expect(getPlayerBtn().getAttribute("aria-label")).toContain("Justificado")
    );

    fireEvent.click(getPlayerBtn());
    await waitFor(() =>
      expect(getPlayerBtn().getAttribute("aria-label")).toContain("Presente")
    );
  });

  it("save online: upsertAttendance chamado para cada jogador", async () => {
    render(<AttendancePanel {...defaultProps} />);

    const saveBtn = screen.getByRole("button", { name: /Guardar presenças da sessão/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(vi.mocked(upsertAttendance)).toHaveBeenCalledTimes(activePlayers.length);
    });

    expect(screen.getByText("Presenças guardadas")).toBeDefined();
  });

  it("save offline: enqueueMutation chamado para cada jogador", async () => {
    mockIsOnline = false;
    render(<AttendancePanel {...defaultProps} />);

    const saveBtn = screen.getByRole("button", { name: /Guardar presenças da sessão/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(vi.mocked(enqueueMutation)).toHaveBeenCalledTimes(activePlayers.length);
    });

    expect(vi.mocked(enqueueMutation).mock.calls[0]?.[0]).toBe("attendance.upsert");
  });

  it("'Mostrar inativos' toggle: jogadores inativos aparecem/desaparecem", async () => {
    render(
      <AttendancePanel
        {...defaultProps}
        players={mixedPlayers}
        existingAttendances={[]}
      />
    );

    // Rui Costa (inactive) should not be visible initially
    expect(screen.queryByText("Rui Costa")).toBeNull();

    const toggleBtn = screen.getByRole("button", { name: /Mostrar inativos/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText("Rui Costa")).toBeDefined();
    });

    const hideBtn = screen.getByRole("button", { name: /Ocultar inativos/i });
    fireEvent.click(hideBtn);

    await waitFor(() => {
      expect(screen.queryByText("Rui Costa")).toBeNull();
    });
  });

  it("EmptyState quando players=[]", () => {
    render(
      <AttendancePanel
        players={[]}
        existingAttendances={[]}
        sessionId={SESSION_ID}
      />
    );

    expect(screen.getByText("Sem jogadores no plantel")).toBeDefined();
  });

  it("PendingBadge visível quando pendingCount > 0 (após save offline)", async () => {
    mockIsOnline = false;
    render(<AttendancePanel {...defaultProps} />);

    const saveBtn = screen.getByRole("button", { name: /Guardar presenças da sessão/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      const badge = screen.getByRole("button", { name: /\d+ presenças pendentes/i });
      expect(badge).toBeDefined();
    });
  });

  it("não mostra botão 'Mostrar inativos' quando todos são activos", () => {
    render(<AttendancePanel {...defaultProps} players={activePlayers} />);
    expect(screen.queryByRole("button", { name: /Mostrar inativos/i })).toBeNull();
  });
});
