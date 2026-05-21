import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

const { mockResendSend } = vi.hoisted(() => ({
  mockResendSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: mockResendSend } };
  }),
}));

import { submitConsentDecision } from "@/app/consentimento/[token]/actions";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;

const FUTURE = new Date(Date.now() + 86400000).toISOString();

function makeQueryChain(resolved: unknown) {
  const chain: Record<string, unknown> = {};
  ["select", "eq", "update", "insert", "single", "maybeSingle"].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolved);
  (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(resolved);
  return chain;
}

function buildServiceRole(overrides: { consent?: unknown; player?: unknown } = {}) {
  const consentChain = makeQueryChain(
    overrides.consent ?? {
      data: {
        id: "consent-id",
        player_id: "player-id",
        club_id: "club-id",
        parent_email: "encarregado@mail.com",
        token_expires_at: FUTURE,
      },
    }
  );
  const playerChain = makeQueryChain(
    overrides.player ?? { data: { profile_id: "profile-id", full_name: "João Silva" } }
  );
  const genericChain = makeQueryChain({ data: null });
  return {
    from: vi.fn((table: string) => {
      if (table === "parental_consents") return consentChain;
      if (table === "players") return playerChain;
      return genericChain;
    }),
  };
}

describe("submitConsentDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("confirm: actualiza registo, envia email e redireciona para a página do token", async () => {
    mockGetServiceRoleClient.mockReturnValue(buildServiceRole());
    mockResendSend.mockResolvedValue({ data: { id: "email-id" }, error: null });

    const formData = new FormData();
    formData.set("token", "test-token-abc");
    formData.set("action", "confirm");

    await expect(submitConsentDecision(formData)).rejects.toThrow(
      "REDIRECT:/consentimento/test-token-abc"
    );

    expect(mockGetServiceRoleClient).toHaveBeenCalled();
    expect(mockResendSend).toHaveBeenCalled();
  });

  it("withdraw: actualiza registo e redireciona (sem email de confirmação)", async () => {
    mockGetServiceRoleClient.mockReturnValue(buildServiceRole());

    const formData = new FormData();
    formData.set("token", "test-token-abc");
    formData.set("action", "withdraw");

    await expect(submitConsentDecision(formData)).rejects.toThrow(
      "REDIRECT:/consentimento/test-token-abc"
    );

    expect(mockGetServiceRoleClient).toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("erro de BD: redireciona na mesma (gracioso — não propaga o erro)", async () => {
    mockGetServiceRoleClient.mockImplementation(() => {
      throw new Error("DB error");
    });

    const formData = new FormData();
    formData.set("token", "test-token-abc");
    formData.set("action", "confirm");

    await expect(submitConsentDecision(formData)).rejects.toThrow(
      "REDIRECT:/consentimento/test-token-abc"
    );
  });

  it("consentimento não encontrado: redireciona na mesma sem enviar email", async () => {
    mockGetServiceRoleClient.mockReturnValue(
      buildServiceRole({ consent: { data: null } })
    );

    const formData = new FormData();
    formData.set("token", "test-token-abc");
    formData.set("action", "confirm");

    await expect(submitConsentDecision(formData)).rejects.toThrow(
      "REDIRECT:/consentimento/test-token-abc"
    );
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("token em falta: redireciona para path vazio", async () => {
    const formData = new FormData();
    formData.set("action", "confirm");
    // sem token

    await expect(submitConsentDecision(formData)).rejects.toThrow("REDIRECT:");
  });
});
