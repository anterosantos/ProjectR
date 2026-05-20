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

import { submitConsentDecision } from "@/app/consentimento/[token]/actions";

describe("submitConsentDecision", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("confirm: faz POST para Edge Function e redireciona para a página do token", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, action: "confirmed" }), { status: 200 })
    );

    const formData = new FormData();
    formData.set("token", "test-token-abc");
    formData.set("action", "confirm");

    await expect(submitConsentDecision(formData)).rejects.toThrow(
      "REDIRECT:/consentimento/test-token-abc"
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/consent-validate"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"action":"confirm"'),
      })
    );
  });

  it("withdraw: faz POST para Edge Function e redireciona para a página do token", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, action: "withdrawn" }), { status: 200 })
    );

    const formData = new FormData();
    formData.set("token", "test-token-abc");
    formData.set("action", "withdraw");

    await expect(submitConsentDecision(formData)).rejects.toThrow(
      "REDIRECT:/consentimento/test-token-abc"
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/consent-validate"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"action":"withdraw"'),
      })
    );
  });

  it("Edge Function error: redireciona na mesma (gracioso — não propaga erro)", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const formData = new FormData();
    formData.set("token", "test-token-abc");
    formData.set("action", "confirm");

    // Mesmo com falha de rede, deve redirecionar (não propagar o erro de rede)
    await expect(submitConsentDecision(formData)).rejects.toThrow(
      "REDIRECT:/consentimento/test-token-abc"
    );
  });

  it("token em falta: redireciona para path vazio", async () => {
    const formData = new FormData();
    formData.set("action", "confirm");
    // sem token

    await expect(submitConsentDecision(formData)).rejects.toThrow("REDIRECT:");
  });
});
