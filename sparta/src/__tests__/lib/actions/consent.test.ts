import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => Promise<void>) => { void fn(); }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/uuid", () => ({
  newId: vi.fn().mockReturnValue("token-uuid-12345"),
}));

const { mockBrevoFetch } = vi.hoisted(() => ({
  mockBrevoFetch: vi.fn(),
}));

// Mock global fetch for Brevo API
global.fetch = vi.fn((url: string, options?: RequestInit) => {
  if (url.includes("api.brevo.com")) {
    return mockBrevoFetch(url, options);
  }
  return Promise.reject(new Error("Unexpected fetch call"));
});

import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerClient } from "@/lib/supabase/server";
import { initiateParentalConsent, resendConsentEmail } from "@/lib/actions/consent";

const mockGetServiceRoleClient = getServiceRoleClient as ReturnType<typeof vi.fn>;
const mockCreateServerClient = createServerClient as ReturnType<typeof vi.fn>;

const PLAYER_UUID = "aa000000-0000-7000-8000-000000000001";
const CLUB_UUID   = "bb000000-0000-7000-8000-000000000002";
const PROFILE_UUID = "cc000000-0000-7000-8000-000000000003";
const POLICY_UUID  = "dd000000-0000-7000-8000-000000000004";
const CONSENT_UUID = "ee000000-0000-7000-8000-000000000005";

function makeQueryChain(resolvedData: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "in", "update", "insert", "single", "maybeSingle"];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(resolvedData);
  (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(resolvedData);
  return chain;
}

function buildServiceRole(overrides: {
  player?: unknown;
  existing?: unknown;
  policy?: unknown;
  consentInsert?: unknown;
  profileUpdate?: unknown;
  auditInsert?: unknown;
} = {}) {
  const playerChain = makeQueryChain(overrides.player ?? { data: { id: PLAYER_UUID, profile_id: PROFILE_UUID, age_group: "u14", club_id: CLUB_UUID } });
  const existingChain = makeQueryChain(overrides.existing ?? { data: null });
  const policyChain = makeQueryChain(overrides.policy ?? { data: { id: POLICY_UUID } });
  const consentChain = makeQueryChain(overrides.consentInsert ?? { data: { id: CONSENT_UUID }, error: null });
  const profileChain = makeQueryChain(overrides.profileUpdate ?? { error: null });
  const auditChain = makeQueryChain(overrides.auditInsert ?? { error: null });

  let profileCallCount = 0;
  let consentCallCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === "players") return playerChain;
      if (table === "privacy_policies") return policyChain;
      if (table === "parental_consents") {
        consentCallCount++;
        return consentCallCount === 1 ? existingChain : consentChain;
      }
      if (table === "profiles") {
        profileCallCount++;
        return profileCallCount === 1 ? profileChain : auditChain;
      }
      if (table === "audit_logs") return auditChain;
      return makeQueryChain({ data: null });
    }),
  };
}

// ─── initiateParentalConsent ─────────────────────────────────────────────────

describe("initiateParentalConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: insere registo, actualiza profiles, retorna consentId", async () => {
    const serviceRole = buildServiceRole();
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await initiateParentalConsent({
      playerId: PLAYER_UUID,
      parentEmail: "mae@mail.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.consentId).toBe(CONSENT_UUID);
    }
  });

  it("conflict: retorna err({ code: 'conflict' }) se registo activo existe", async () => {
    const serviceRole = buildServiceRole({
      existing: { data: { id: "existing-id", status: "pending" } },
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await initiateParentalConsent({
      playerId: PLAYER_UUID,
      parentEmail: "mae@mail.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("conflict");
    }
  });

  it("jogador não elegível (u17): retorna err({ code: 'validation' })", async () => {
    const serviceRole = buildServiceRole({
      player: { data: { id: PLAYER_UUID, profile_id: PROFILE_UUID, age_group: "u17", club_id: CLUB_UUID } },
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await initiateParentalConsent({
      playerId: PLAYER_UUID,
      parentEmail: "mae@mail.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("jogador não encontrado: retorna err({ code: 'not_found' })", async () => {
    const serviceRole = buildServiceRole({ player: { data: null } });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await initiateParentalConsent({
      playerId: PLAYER_UUID,
      parentEmail: "mae@mail.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("validação: playerId inválido retorna err({ code: 'validation' })", async () => {
    mockGetServiceRoleClient.mockReturnValue(buildServiceRole());

    const result = await initiateParentalConsent({
      playerId: "not-a-uuid",
      parentEmail: "mae@mail.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("validação: email inválido retorna err({ code: 'validation' })", async () => {
    mockGetServiceRoleClient.mockReturnValue(buildServiceRole());

    const result = await initiateParentalConsent({
      playerId: PLAYER_UUID,
      parentEmail: "not-an-email",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("happy path: dispara Brevo email via after() callback", async () => {
    // CI doesn't have BREVO_* env vars — set them for this test
    const originalBrevoKey = process.env.BREVO_API_KEY;
    const originalBrevoSender = process.env.BREVO_SENDER_EMAIL;
    process.env.BREVO_API_KEY = "test-brevo-key";
    process.env.BREVO_SENDER_EMAIL = "sparta@test.com";

    const serviceRole = buildServiceRole();
    mockGetServiceRoleClient.mockReturnValue(serviceRole);
    mockBrevoFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await initiateParentalConsent({
      playerId: PLAYER_UUID,
      parentEmail: "mae@mail.com",
    });

    // fire-and-forget: flushes microtask queue (mocked after() runs immediately)
    await new Promise((r) => setTimeout(r, 0));

    // Restore env vars
    process.env.BREVO_API_KEY = originalBrevoKey;
    process.env.BREVO_SENDER_EMAIL = originalBrevoSender;

    // Verify Brevo was called with email to parent
    expect(mockBrevoFetch).toHaveBeenCalled();
    const [url, options] = mockBrevoFetch.mock.calls[0] ?? [];
    expect(url).toContain("api.brevo.com");
    expect((options as RequestInit)?.method).toBe("POST");
    expect((options as RequestInit)?.body).toContain("mae@mail.com");
  });
});

// ─── resendConsentEmail ──────────────────────────────────────────────────────

function buildResendServiceRole(consentData: unknown) {
  const consentRecordData = {
    data: {
      token: "tok-abc",
      token_expires_at: new Date(Date.now() + 86400000).toISOString(),
      player_id: PLAYER_UUID,
      parent_email: "mae@mail.com",
    },
    error: null,
  };
  const playerData = { data: { full_name: "João Silva" }, error: null };

  const consentListChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(consentData),
  };
  const consentSingleChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(consentRecordData),
  };
  const playerChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(playerData),
  };
  const insertChain = { insert: vi.fn().mockResolvedValue({ error: null }) };
  const playersChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { club_id: CLUB_UUID }, error: null }),
    single: vi.fn().mockResolvedValue(playerData),
  };

  let consentCallCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === "players") return playersChain;
      if (table === "parental_consent_reminders_log") return insertChain;
      if (table === "parental_consents") {
        consentCallCount++;
        return consentCallCount === 1 ? consentListChain : consentSingleChain;
      }
      return insertChain;
    }),
  };
}

describe("resendConsentEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BREVO_API_KEY = "brevo_test_key";
    process.env.BREVO_SENDER_EMAIL = "test@sparta.pt";
  });

  afterEach(() => {
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
  });

  it("envia email via Brevo e retorna ok quando registo pending existe", async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-id" } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "coach", club_id: CLUB_UUID } }),
      }),
    });

    const serviceRole = buildResendServiceRole({
      data: { id: CONSENT_UUID, last_manual_resend_at: null },
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);
    mockBrevoFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue("") });

    const result = await resendConsentEmail(PLAYER_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.message).toBe("Email de consentimento reenviado.");
    }
    expect(mockBrevoFetch).toHaveBeenCalled();
  });

  it("retorna err({ code: 'internal' }) se Brevo falha", async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-id" } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "coach", club_id: CLUB_UUID } }),
      }),
    });

    const serviceRole = buildResendServiceRole({
      data: { id: CONSENT_UUID, last_manual_resend_at: null },
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);
    mockBrevoFetch.mockResolvedValue({ ok: false, text: vi.fn().mockResolvedValue("API error") });

    const result = await resendConsentEmail(PLAYER_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("internal");
    }
  });

  it("retorna err({ code: 'not_found' }) se sem consentimento pending", async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-id" } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "coach", club_id: CLUB_UUID } }),
      }),
    });

    const serviceRole = buildResendServiceRole({ data: null });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await resendConsentEmail(PLAYER_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("retorna err({ code: 'unauthorized' }) se utilizador não autenticado", async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const result = await resendConsentEmail(PLAYER_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unauthorized");
    }
  });

  it("rate-limit: retorna err({ code: 'rate_limited' }) se reenvio dentro de 5 minutos", async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-id" } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "coach", club_id: CLUB_UUID } }),
      }),
    });

    // Simular último envio há 2 minutos
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const serviceRole = buildResendServiceRole({
      data: { id: CONSENT_UUID, last_manual_resend_at: twoMinutesAgo },
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await resendConsentEmail(PLAYER_UUID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("rate_limited");
      expect(result.error.message).toMatch(/reenviar novamente em \d+ minuto/);
    }
    // Brevo NÃO deve ter sido chamado
    expect(mockBrevoFetch).not.toHaveBeenCalled();
  });

  it("rate-limit: permite reenvio após 5 minutos terem passado", async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-id" } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "coach" } }),
      }),
    });

    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "staff-id" } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { role: "coach", club_id: CLUB_UUID } }),
      }),
    });

    // Simular último envio há 6 minutos (fora da janela)
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const serviceRole = buildResendServiceRole({
      data: { id: CONSENT_UUID, last_manual_resend_at: sixMinutesAgo },
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    mockBrevoFetch.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue("") });

    const result = await resendConsentEmail(PLAYER_UUID);

    expect(result.ok).toBe(true);
    expect(mockBrevoFetch).toHaveBeenCalled();
  });
});
