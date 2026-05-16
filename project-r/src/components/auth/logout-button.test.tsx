import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LogoutButton } from "./logout-button";

vi.mock("@/lib/supabase/client", () => ({
  logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/outbox/status", () => ({
  useOutboxStatus: vi.fn(),
}));

import { useOutboxStatus } from "@/lib/outbox/status";

const mockUseOutboxStatus = vi.mocked(useOutboxStatus);

describe("LogoutButton", () => {
  beforeEach(() => {
    mockUseOutboxStatus.mockReturnValue({ pendingCount: 0 });
  });

  it("renders the Sair button", () => {
    render(<LogoutButton />);
    expect(screen.getByRole("button", { name: /sair/i })).toBeInTheDocument();
  });

  it("logs out directly when there are no pending mutations", async () => {
    mockUseOutboxStatus.mockReturnValue({ pendingCount: 0 });
    const { logout } = await import("@/lib/supabase/client");

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /sair/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
  });

  it("shows dialog when there are pending mutations", async () => {
    mockUseOutboxStatus.mockReturnValue({ pendingCount: 3 });

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /sair/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/3 submissões por enviar/i)
      ).toBeInTheDocument();
    });
  });

  it("dialog shows Cancelar and Sair mesmo assim buttons", async () => {
    mockUseOutboxStatus.mockReturnValue({ pendingCount: 2 });

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /sair/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sair mesmo assim/i })).toBeInTheDocument();
    });
  });

  it("Cancelar closes the dialog without logout", async () => {
    mockUseOutboxStatus.mockReturnValue({ pendingCount: 1 });
    const { logout } = await import("@/lib/supabase/client");
    vi.mocked(logout).mockClear();

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /sair/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    await waitFor(() => {
      expect(logout).not.toHaveBeenCalled();
    });
  });

  it("Sair mesmo assim triggers logout", async () => {
    mockUseOutboxStatus.mockReturnValue({ pendingCount: 1 });
    const { logout } = await import("@/lib/supabase/client");
    vi.mocked(logout).mockClear();

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /sair/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sair mesmo assim/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /sair mesmo assim/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
  });
});
