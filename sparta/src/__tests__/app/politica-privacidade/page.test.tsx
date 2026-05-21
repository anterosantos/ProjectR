import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

vi.mock("@/lib/supabase/server");
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

import { createServerClient } from "@/lib/supabase/server";
import PoliticaPrivacidadePage from "@/app/politica-privacidade/page";

const mockCreateServerClient = vi.mocked(createServerClient);

const FULL_MD = "## Full Privacy Policy\n\nFull content here.";
const U14_MD = "## Simplified Policy\n\nSimplified content for minors.";

describe("PoliticaPrivacidadePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildClient(
    policy: { body_full_md: string; body_u14_md: string } | null,
    user: { id: string } | null,
    player: { age_group: string } | null,
    playerError: { message: string } | null = null
  ) {
    const privacyEq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: policy }),
    });
    const playersEq = vi.fn().mockReturnValue({
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: player, error: playerError }),
    });
    return {
      _privacyEq: privacyEq,
      _playersEq: playersEq,
      from: vi.fn((table: string) => {
        if (table === "privacy_policies") {
          return { select: vi.fn(() => ({ eq: privacyEq })) };
        }
        if (table === "players") {
          return { select: vi.fn(() => ({ eq: playersEq })) };
        }
        return {};
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user } }),
      },
    };
  }

  function getPolicyContentProps(element: ReactElement) {
    const children = element.props.children as ReactElement[];
    const policyContent = children[1];
    return policyContent?.props as { content: string; isU14: boolean };
  }

  it("unauthenticated user receives body_full_md", async () => {
    const policy = { body_full_md: FULL_MD, body_u14_md: U14_MD };
    const client = buildClient(policy, null, null);
    mockCreateServerClient.mockResolvedValue(client as never);

    const element = await PoliticaPrivacidadePage();
    const props = getPolicyContentProps(element as ReactElement);

    expect(props.content).toBe(FULL_MD);
    expect(props.isU14).toBe(false);
    expect(client._privacyEq).toHaveBeenCalledWith("is_current", true);
  });

  it("authenticated user without player record receives body_full_md", async () => {
    const policy = { body_full_md: FULL_MD, body_u14_md: U14_MD };
    const client = buildClient(policy, { id: "user-1" }, null);
    mockCreateServerClient.mockResolvedValue(client as never);

    const element = await PoliticaPrivacidadePage();
    const props = getPolicyContentProps(element as ReactElement);

    expect(props.content).toBe(FULL_MD);
    expect(props.isU14).toBe(false);
    expect(client._playersEq).toHaveBeenCalledWith("profile_id", "user-1");
  });

  it("u14 player receives body_u14_md with isU14=true", async () => {
    const policy = { body_full_md: FULL_MD, body_u14_md: U14_MD };
    const client = buildClient(policy, { id: "user-2" }, { age_group: "u14" });
    mockCreateServerClient.mockResolvedValue(client as never);

    const element = await PoliticaPrivacidadePage();
    const props = getPolicyContentProps(element as ReactElement);

    expect(props.content).toBe(U14_MD);
    expect(props.isU14).toBe(true);
  });

  it("u15 player receives body_u14_md with isU14=true", async () => {
    const policy = { body_full_md: FULL_MD, body_u14_md: U14_MD };
    const client = buildClient(policy, { id: "user-3" }, { age_group: "u15" });
    mockCreateServerClient.mockResolvedValue(client as never);

    const element = await PoliticaPrivacidadePage();
    const props = getPolicyContentProps(element as ReactElement);

    expect(props.content).toBe(U14_MD);
    expect(props.isU14).toBe(true);
  });

  it("u18 player receives body_full_md with isU14=false", async () => {
    const policy = { body_full_md: FULL_MD, body_u14_md: U14_MD };
    const client = buildClient(policy, { id: "user-4" }, { age_group: "u18" });
    mockCreateServerClient.mockResolvedValue(client as never);

    const element = await PoliticaPrivacidadePage();
    const props = getPolicyContentProps(element as ReactElement);

    expect(props.content).toBe(FULL_MD);
    expect(props.isU14).toBe(false);
  });

  it("null policy renders fallback message", async () => {
    const client = buildClient(null, null, null);
    mockCreateServerClient.mockResolvedValue(client as never);

    const element = await PoliticaPrivacidadePage();
    const rendered = element as ReactElement;
    const fallbackText = rendered.props.children?.props?.children as string;

    expect(fallbackText).toContain("não disponível");
  });

  it("player query error falls back to body_full_md without crashing", async () => {
    const policy = { body_full_md: FULL_MD, body_u14_md: U14_MD };
    const client = buildClient(
      policy,
      { id: "user-5" },
      null,
      { message: "RLS denied" }
    );
    mockCreateServerClient.mockResolvedValue(client as never);

    const element = await PoliticaPrivacidadePage();
    const props = getPolicyContentProps(element as ReactElement);

    expect(props.content).toBe(FULL_MD);
    expect(props.isU14).toBe(false);
  });
});
