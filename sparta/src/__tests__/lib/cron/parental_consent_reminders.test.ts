import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  classifyConsentAge,
  buildReminderSubject,
  buildReminderCopy,
  buildStaffAlertBody,
  getStaffEmailsForClub,
  hasReminderBeenSentToday,
  getPendingConsentsByAge,
  getOverdueConsentClubs,
} from "@/lib/cron/parental-consent-reminders";

// ─── Testes de lógica pura (sem mocks) ──────────────────────────────────────

describe("classifyConsentAge", () => {
  const now = new Date("2026-05-20T10:00:00Z");

  it("retorna 'day_7' para consentimento criado exactamente há 7 dias", () => {
    const createdAt = new Date("2026-05-13T10:00:00Z");
    expect(classifyConsentAge(createdAt, now)).toBe("day_7");
  });

  it("retorna 'day_14' para consentimento criado exactamente há 14 dias", () => {
    const createdAt = new Date("2026-05-06T10:00:00Z");
    expect(classifyConsentAge(createdAt, now)).toBe("day_14");
  });

  it("retorna 'staff_alert' para consentimento criado há mais de 14 dias", () => {
    const createdAt = new Date("2026-04-30T10:00:00Z"); // 20 dias atrás
    expect(classifyConsentAge(createdAt, now)).toBe("staff_alert");
  });

  it("retorna null para consentimento criado há menos de 7 dias", () => {
    const createdAt = new Date("2026-05-18T10:00:00Z"); // 2 dias atrás
    expect(classifyConsentAge(createdAt, now)).toBeNull();
  });

  it("retorna null para consentimento criado hoje", () => {
    expect(classifyConsentAge(now, now)).toBeNull();
  });
});

describe("buildReminderSubject", () => {
  it("retorna subject correcto para day_7", () => {
    expect(buildReminderSubject("day_7")).toBe(
      "[Lembrete] Consentimento parental — SPARTA"
    );
  });

  it("retorna subject correcto para day_14", () => {
    expect(buildReminderSubject("day_14")).toBe(
      "2º Lembrete: Consentimento parental — SPARTA"
    );
  });
});

describe("buildReminderCopy", () => {
  it("copy day_7 menciona 'pode ignorar'", () => {
    expect(buildReminderCopy("day_7")).toContain("pode ignorar");
  });

  it("copy day_14 menciona 'última tentativa'", () => {
    expect(buildReminderCopy("day_14")).toContain("última tentativa");
  });
});

describe("buildStaffAlertBody", () => {
  it("inclui contagem correcta e nomes dos jogadores", () => {
    const players = [
      { name: "João Silva" },
      { name: "Pedro Santos" },
    ];
    const body = buildStaffAlertBody(players);
    expect(body).toContain("2 jogadores têm");
    expect(body).toContain("João Silva");
    expect(body).toContain("Pedro Santos");
  });

  it("trunca lista após 5 jogadores com '... e mais X'", () => {
    const players = Array.from({ length: 8 }, (_, i) => ({
      name: `Jogador ${i + 1}`,
    }));
    const body = buildStaffAlertBody(players);
    expect(body).toContain("... e mais 3");
    expect(body).not.toContain("Jogador 6");
  });

  it("singular para 1 jogador", () => {
    const body = buildStaffAlertBody([{ name: "Tiago" }]);
    expect(body).toContain("1 jogador tem");
  });
});

// ─── Testes de helpers de DB (com mocks) ─────────────────────────────────────

function makeQueryChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "in", "gte", "lt", "maybeSingle", "single"];
  methods.forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue(result);
  return chain;
}

describe("getStaffEmailsForClub", () => {
  it("retorna lista de emails de coaches e analistas do clube", async () => {
    const mockChain = makeQueryChain(null);
    (mockChain.in as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ email: "coach@clube.pt" }, { email: "analyst@clube.pt" }],
    });

    const serviceRole = {
      from: vi.fn().mockReturnValue(mockChain),
    } as unknown as Parameters<typeof getStaffEmailsForClub>[0];

    const result = await getStaffEmailsForClub(serviceRole, "club-uuid");
    expect(result).toEqual(["coach@clube.pt", "analyst@clube.pt"]);
    expect(serviceRole.from).toHaveBeenCalledWith("profiles");
  });

  it("retorna lista vazia se não houver staff", async () => {
    const mockChain = makeQueryChain(null);
    (mockChain.in as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

    const serviceRole = {
      from: vi.fn().mockReturnValue(mockChain),
    } as unknown as Parameters<typeof getStaffEmailsForClub>[0];

    const result = await getStaffEmailsForClub(serviceRole, "club-uuid");
    expect(result).toEqual([]);
  });
});

describe("hasReminderBeenSentToday", () => {
  it("retorna true se existir registo de hoje", async () => {
    const mockChain = makeQueryChain({ data: { id: "log-id" } });

    const serviceRole = {
      from: vi.fn().mockReturnValue(mockChain),
    } as unknown as Parameters<typeof hasReminderBeenSentToday>[0];

    const result = await hasReminderBeenSentToday(
      serviceRole,
      "consent-uuid",
      "day_7"
    );
    expect(result).toBe(true);
  });

  it("retorna false se não existir registo de hoje", async () => {
    const mockChain = makeQueryChain({ data: null });

    const serviceRole = {
      from: vi.fn().mockReturnValue(mockChain),
    } as unknown as Parameters<typeof hasReminderBeenSentToday>[0];

    const result = await hasReminderBeenSentToday(
      serviceRole,
      "consent-uuid",
      "day_14"
    );
    expect(result).toBe(false);
  });
});

describe("getPendingConsentsByAge (integração mock)", () => {
  const now = new Date("2026-05-20T10:00:00Z");

  it("retorna consentimentos correctos para dia 7", async () => {
    const mockData = [
      { id: "c1", club_id: "club-1" },
      { id: "c2", club_id: "club-1" },
    ];
    const mockChain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: mockData }),
    };
    Object.keys(mockChain).forEach((k) => {
      if (k !== "lt") {
        (mockChain[k] as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
      }
    });
    (mockChain.lt as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockData,
    });

    const serviceRole = {
      from: vi.fn().mockReturnValue(mockChain),
    } as unknown as Parameters<typeof getPendingConsentsByAge>[0];

    const result = await getPendingConsentsByAge(serviceRole, 7, now);
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("c1");
    // Verifica que a query usa a data correcta: 2026-05-13
    const gteCall = (mockChain.gte as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(gteCall?.[1]).toContain("2026-05-13");
  });

  it("retorna consentimentos correctos para dia 14", async () => {
    const mockChain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [{ id: "c3", club_id: "club-2" }] }),
    };
    Object.keys(mockChain).forEach((k) => {
      if (k !== "lt") {
        (mockChain[k] as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
      }
    });
    (mockChain.lt as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: "c3", club_id: "club-2" }],
    });

    const serviceRole = {
      from: vi.fn().mockReturnValue(mockChain),
    } as unknown as Parameters<typeof getPendingConsentsByAge>[0];

    const result = await getPendingConsentsByAge(serviceRole, 14, now);
    expect(result).toHaveLength(1);
    // Data para dia 14: 2026-05-06
    const gteCall = (mockChain.gte as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(gteCall?.[1]).toContain("2026-05-06");
  });
});

describe("getOverdueConsentClubs (integração mock — idempotência)", () => {
  const now = new Date("2026-05-20T10:00:00Z");

  it("identifica clubes com consentimentos em atraso", async () => {
    const mockChain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({
        data: [
          { club_id: "club-A" },
          { club_id: "club-A" }, // duplicado — deve ser deduplicado
          { club_id: "club-B" },
        ],
      }),
    };
    Object.keys(mockChain).forEach((k) => {
      if (k !== "lt") {
        (mockChain[k] as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
      }
    });

    const serviceRole = {
      from: vi.fn().mockReturnValue(mockChain),
    } as unknown as Parameters<typeof getOverdueConsentClubs>[0];

    const clubs = await getOverdueConsentClubs(serviceRole, now);
    expect(clubs).toHaveLength(2);
    expect(clubs).toContain("club-A");
    expect(clubs).toContain("club-B");
  });

  it("retorna lista vazia se não houver atrasos", async () => {
    const mockChain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ data: [] }),
    };
    Object.keys(mockChain).forEach((k) => {
      if (k !== "lt") {
        (mockChain[k] as ReturnType<typeof vi.fn>).mockReturnValue(mockChain);
      }
    });

    const serviceRole = {
      from: vi.fn().mockReturnValue(mockChain),
    } as unknown as Parameters<typeof getOverdueConsentClubs>[0];

    const clubs = await getOverdueConsentClubs(serviceRole, now);
    expect(clubs).toHaveLength(0);
  });
});
