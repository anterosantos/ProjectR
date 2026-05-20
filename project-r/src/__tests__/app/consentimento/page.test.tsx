import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock the ConsentForm client component to avoid "use client" issues in tests
vi.mock("@/app/consentimento/[token]/consent-form", () => ({
  ConsentForm: ({ playerName, policyBody }: { playerName: string; policyBody: string }) => (
    <div data-testid="consent-form">
      <span data-testid="player-name">{playerName}</span>
      <span data-testid="policy-body">{policyBody}</span>
    </div>
  ),
}));

import ConsentimentoPage from "@/app/consentimento/[token]/page";

function makeFetchMock(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(response), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

describe("ConsentimentoPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("estado valid: renderiza ConsentForm com nome do jogador e política", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        state: "valid",
        playerName: "Tomás Silva",
        policyBody: "## Política\n\nTexto da política.",
        tokenExpiresAt: "2026-08-20T00:00:00Z",
      })
    );

    const jsx = await ConsentimentoPage({ params: Promise.resolve({ token: "valid-token" }) });
    render(jsx);

    expect(screen.getByTestId("consent-form")).toBeDefined();
    expect(screen.getByTestId("player-name").textContent).toBe("Tomás Silva");
    expect(screen.getByTestId("policy-body").textContent).toBe(
      "## Política\n\nTexto da política."
    );
  });

  it("estado expired: renderiza EmptyState com título de link expirado", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ state: "expired" }));

    const jsx = await ConsentimentoPage({ params: Promise.resolve({ token: "expired-token" }) });
    render(jsx);

    expect(screen.getByText("Link expirado")).toBeDefined();
    expect(screen.queryByTestId("consent-form")).toBeNull();
  });

  it("estado confirmed: renderiza EmptyState com título de consentimento confirmado", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ state: "confirmed" }));

    const jsx = await ConsentimentoPage({ params: Promise.resolve({ token: "confirmed-token" }) });
    render(jsx);

    expect(screen.getByText("Consentimento já confirmado")).toBeDefined();
    expect(screen.queryByTestId("consent-form")).toBeNull();
  });

  it("estado withdrawn: renderiza EmptyState com título de consentimento recusado", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ state: "withdrawn" }));

    const jsx = await ConsentimentoPage({ params: Promise.resolve({ token: "withdrawn-token" }) });
    render(jsx);

    expect(screen.getByText("Consentimento recusado")).toBeDefined();
    expect(screen.queryByTestId("consent-form")).toBeNull();
  });

  it("estado invalid: renderiza EmptyState com título de link inválido", async () => {
    vi.stubGlobal("fetch", makeFetchMock({ state: "invalid" }));

    const jsx = await ConsentimentoPage({ params: Promise.resolve({ token: "invalid-token" }) });
    render(jsx);

    expect(screen.getByText("Link inválido")).toBeDefined();
    expect(screen.queryByTestId("consent-form")).toBeNull();
  });

  it("Edge Function não disponível (fetch throw): renderiza EmptyState com link inválido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );

    const jsx = await ConsentimentoPage({ params: Promise.resolve({ token: "any-token" }) });
    render(jsx);

    expect(screen.getByText("Link inválido")).toBeDefined();
  });

  it("valid sem playerName: usa fallback 'o seu educando'", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetchMock({
        state: "valid",
        policyBody: "Política.",
      })
    );

    const jsx = await ConsentimentoPage({ params: Promise.resolve({ token: "valid-token" }) });
    render(jsx);

    expect(screen.getByTestId("player-name").textContent).toBe("o seu educando");
  });
});
