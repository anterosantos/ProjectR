import { describe, it, expect, vi, beforeEach } from "vitest";

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
});

// ─── resendConsentEmail ──────────────────────────────────────────────────────

describe("resendConsentEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stub retorna ok com mensagem placeholder quando registo pending existe", async () => {
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

    const serviceRole = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: CONSENT_UUID } }),
      }),
    };
    mockGetServiceRoleClient.mockReturnValue(serviceRole);

    const result = await resendConsentEmail(PLAYER_UUID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.message).toContain("Story 3.3");
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
});
