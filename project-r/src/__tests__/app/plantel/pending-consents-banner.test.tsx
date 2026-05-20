import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/consent", () => ({
  getPendingConsentsOver14Days: vi.fn(),
  resendConsentEmail: vi.fn(),
}));

import { getPendingConsentsOver14Days, resendConsentEmail } from "@/lib/actions/consent";
import { PendingConsentsBanner } from "@/app/(staff)/plantel/pending-consents-banner";
import { ResendConsentButton } from "@/app/(staff)/plantel/resend-consent-button";

const mockGetPending = getPendingConsentsOver14Days as ReturnType<typeof vi.fn>;
const mockResendConsentEmail = resendConsentEmail as ReturnType<typeof vi.fn>;

const PLAYER_UUID_1 = "aa000000-0000-7000-8000-000000000011";
const PLAYER_UUID_2 = "aa000000-0000-7000-8000-000000000022";

// ─── PendingConsentsBanner (Server Component assíncrono) ─────────────────────

describe("PendingConsentsBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza nada se não houver consentimentos pendentes", async () => {
    mockGetPending.mockResolvedValue([]);

    const Component = await PendingConsentsBanner();
    expect(Component).toBeNull();
  });

  it("renderiza banner com 2 jogadores pendentes", async () => {
    mockGetPending.mockResolvedValue([
      { playerId: PLAYER_UUID_1, playerName: "João Silva" },
      { playerId: PLAYER_UUID_2, playerName: "Pedro Santos" },
    ]);

    const element = await PendingConsentsBanner();
    if (!element) throw new Error("Banner deve renderizar");

    render(element);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/2 jogadores com consentimento parental/)).toBeTruthy();
    expect(screen.getByText("João Silva")).toBeTruthy();
    expect(screen.getByText("Pedro Santos")).toBeTruthy();
    expect(screen.getAllByText("Reenviar manualmente")).toHaveLength(2);
  });

  it("renderiza singular para 1 jogador", async () => {
    mockGetPending.mockResolvedValue([
      { playerId: PLAYER_UUID_1, playerName: "Tiago Ferreira" },
    ]);

    const element = await PendingConsentsBanner();
    if (!element) throw new Error("Banner deve renderizar");

    render(element);
    expect(screen.getByText(/1 jogador com consentimento parental/)).toBeTruthy();
  });
});

// ─── ResendConsentButton (Client Component) ───────────────────────────────────

describe("ResendConsentButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza botão 'Reenviar manualmente'", () => {
    render(<ResendConsentButton playerId={PLAYER_UUID_1} />);
    expect(screen.getByRole("button", { name: "Reenviar manualmente" })).toBeTruthy();
  });

  it("mostra feedback 'Email reenviado' após sucesso", async () => {
    mockResendConsentEmail.mockResolvedValue({
      ok: true,
      data: { message: "Email de consentimento reenviado." },
    });

    render(<ResendConsentButton playerId={PLAYER_UUID_1} />);
    fireEvent.click(screen.getByRole("button", { name: "Reenviar manualmente" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeTruthy();
      expect(screen.getByText("Email reenviado")).toBeTruthy();
    });
  });

  it("mostra toast de erro se reenvio falhar", async () => {
    mockResendConsentEmail.mockResolvedValue({
      ok: false,
      error: { code: "internal", message: "Falha ao enviar" },
    });

    render(<ResendConsentButton playerId={PLAYER_UUID_1} />);
    fireEvent.click(screen.getByRole("button", { name: "Reenviar manualmente" }));

    await waitFor(() => {
      expect(screen.getByText("Falha ao reenviar — tenta novamente")).toBeTruthy();
    });
  });

  it("mostra mensagem de rate-limit se reenvio bloqueado", async () => {
    mockResendConsentEmail.mockResolvedValue({
      ok: false,
      error: { code: "rate_limited", message: "Pode reenviar novamente em 3 minutos" },
    });

    render(<ResendConsentButton playerId={PLAYER_UUID_1} />);
    fireEvent.click(screen.getByRole("button", { name: "Reenviar manualmente" }));

    await waitFor(() => {
      expect(screen.getByText("Pode reenviar novamente em 3 minutos")).toBeTruthy();
    });
  });

  it("desactiva botão enquanto está a enviar", async () => {
    let resolve: (v: unknown) => void = () => {};
    mockResendConsentEmail.mockReturnValue(
      new Promise((r) => { resolve = r; })
    );

    render(<ResendConsentButton playerId={PLAYER_UUID_1} />);
    fireEvent.click(screen.getByRole("button", { name: "Reenviar manualmente" }));

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });

    resolve({ ok: true, data: { message: "ok" } });
  });
});
