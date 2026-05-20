import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/service-role", () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/uuid", () => ({
  newId: vi.fn().mockReturnValue("token-uuid-12345"),
}));

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

  it("happy path: dispara fetch fire-and-forget para send-parental-consent", async () => {
    const serviceRole = buildServiceRole();
    mockGetServiceRoleClient.mockReturnValue(serviceRole);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await initiateParentalConsent({
      playerId: PLAYER_UUID,
      parentEmail: "mae@mail.com",
    });

    // fire-and-forget: flushes microtask queue
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/send-parental-consent"),
      expect.objectContaining({ method: "POST" })
    );
    vi.unstubAllGlobals();
  });
});

// ─── resendConsentEmail ──────────────────────────────────────────────────────

function buildResendServiceRole(consentData: unknown) {
  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  const insertChain = {
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  const consentChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(consentData),
    update: vi.fn().mockReturnValue(updateChain),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "parental_consents") return consentChain;
      if (table === "parental_consent_reminders_log") return insertChain;
      return consentChain;
    }),
    _consentChain: consentChain,
  };
}

describe("resendConsentEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("chama Edge Function e retorna ok quando registo pending existe", async () => {
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

    const serviceRole = buildResendServiceRole({
      data: { id: CONSENT_UUID, last_manual_resend_at: null },
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const result = await resendConsentEmail(PLAYER_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.message).toBe("Email de consentimento reenviado.");
    }
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/send-parental-consent"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("retorna err({ code: 'internal' }) se Edge Function falha", async () => {
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

    const serviceRole = buildResendServiceRole({
      data: { id: CONSENT_UUID, last_manual_resend_at: null },
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "Email send failed" }), { status: 502 })
    );

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
        single: vi.fn().mockResolvedValue({ data: { role: "coach" } }),
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
        single: vi.fn().mockResolvedValue({ data: { role: "coach" } }),
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
    // fetch NÃO deve ter sido chamado
    expect(fetch).not.toHaveBeenCalled();
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

    // Simular último envio há 6 minutos (fora da janela)
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const serviceRole = buildResendServiceRole({
      data: { id: CONSENT_UUID, last_manual_resend_at: sixMinutesAgo },
    });
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const result = await resendConsentEmail(PLAYER_UUID);

    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/send-parental-consent"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
