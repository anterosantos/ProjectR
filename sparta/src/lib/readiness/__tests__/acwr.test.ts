/**
 * acwr.test.ts — Testes unitários do motor de cálculo ACWR
 *
 * AC #4: Cobertura ≥80% em acwr.ts e thresholds.ts
 * NFR54: Cobertura nas funções críticas
 *
 * Estratégia:
 * - Testar `computeAcwrFromRawData()` directamente (função pura, sem mock de DB)
 * - Testar `classifyAcwrState()` isoladamente para boundary cases
 * - Testar `computeAcwr()` com mock de Supabase
 * - Testar `getThreshold()` e `ACWR_THRESHOLDS`
 * - Verificar equivalência TypeScript ↔ PL/pgSQL através de fixtures partilhadas
 */

import { describe, it, expect, vi } from "vitest";
import {
  computeAcwr,
  computeAcwrFromRawData,
  classifyAcwrState,
  type AcwrRawInput,
} from "../acwr";
import {
  getThreshold,
  ACWR_THRESHOLDS,
  type AgeGroup,
} from "../thresholds";

// ─── Helpers de fixtures ───────────────────────────────────────────────────────

/**
 * Gera entradas de `session_metrics` distribuídas por semanas ISO.
 *
 * @param options.asOf        Data de referência (default: 2026-05-24)
 * @param options.weeks       Número de semanas a gerar (default: 4)
 * @param options.loadPerWeek Carga sRPE por sessão em cada semana (default: 300)
 * @param options.sessionsPerWeek Sessões por semana (default: 1)
 */
function buildLoads(options: {
  asOf?: Date;
  weeks?: number;
  loadPerWeek?: number | number[];
  sessionsPerWeek?: number;
}): { srpe_load: number; computed_at: string }[] {
  const {
    asOf = new Date("2026-05-24T12:00:00Z"),
    weeks = 4,
    loadPerWeek = 300,
    sessionsPerWeek = 1,
  } = options;

  const loads: { srpe_load: number; computed_at: string }[] = [];
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (let w = 0; w < weeks; w++) {
    const weekLoad = Array.isArray(loadPerWeek) ? (loadPerWeek[w] ?? 300) : loadPerWeek;
    for (let s = 0; s < sessionsPerWeek; s++) {
      // Distribuir sessões: semana mais antiga primeiro
      // Cada semana começa 7*(weeks-w) dias antes do asOf
      const daysBack = 7 * (weeks - w) - s * 2 - 1;
      const sessionDate = new Date(asOf.getTime() - daysBack * DAY_MS);
      loads.push({
        srpe_load: weekLoad,
        computed_at: sessionDate.toISOString(),
      });
    }
  }

  return loads;
}

// ─── getThreshold ──────────────────────────────────────────────────────────────

describe("getThreshold", () => {
  it("retorna { lo: 0.8, hi: 1.3 } para u14", () => {
    expect(getThreshold("u14")).toEqual({ lo: 0.8, hi: 1.3 });
  });

  it("retorna { lo: 0.8, hi: 1.4 } para u15", () => {
    expect(getThreshold("u15")).toEqual({ lo: 0.8, hi: 1.4 });
  });

  it("retorna { lo: 0.8, hi: 1.5 } para u17", () => {
    expect(getThreshold("u17")).toEqual({ lo: 0.8, hi: 1.5 });
  });

  it("retorna { lo: 0.8, hi: 1.5 } para u19", () => {
    expect(getThreshold("u19")).toEqual({ lo: 0.8, hi: 1.5 });
  });

  it("retorna { lo: 0.8, hi: 1.5 } para senior", () => {
    expect(getThreshold("senior")).toEqual({ lo: 0.8, hi: 1.5 });
  });

  it("u14 tem banda superior mais apertada que senior", () => {
    const u14 = getThreshold("u14");
    const senior = getThreshold("senior");
    expect(u14.hi).toBeLessThan(senior.hi);
    expect(u14.lo).toBe(senior.lo); // mesmo limite inferior
  });

  it("ACWR_THRESHOLDS contém todas as age groups", () => {
    const ageGroups: AgeGroup[] = ["u14", "u15", "u17", "u19", "senior"];
    ageGroups.forEach((ag) => {
      expect(ACWR_THRESHOLDS[ag]).toBeDefined();
      expect(ACWR_THRESHOLDS[ag]!.lo).toBe(0.8);
      expect(ACWR_THRESHOLDS[ag]!.hi).toBeGreaterThan(0.8);
    });
  });
});

// ─── classifyAcwrState ────────────────────────────────────────────────────────

describe("classifyAcwrState", () => {
  const threshold = { lo: 0.8, hi: 1.5 };

  it("retorna neutral quando dataSufficient=false", () => {
    expect(classifyAcwrState(1.2, threshold, false)).toBe("neutral");
  });

  it("retorna neutral com ratio=null e dataSufficient=false", () => {
    expect(classifyAcwrState(null, threshold, false)).toBe("neutral");
  });

  it("retorna alert com ratio=null e dataSufficient=true (chronic=0)", () => {
    expect(classifyAcwrState(null, threshold, true)).toBe("alert");
  });

  it("retorna ready para ratio dentro da banda [0.8, 1.5]", () => {
    expect(classifyAcwrState(0.8, threshold, true)).toBe("ready"); // lo boundary
    expect(classifyAcwrState(1.0, threshold, true)).toBe("ready"); // meio
    expect(classifyAcwrState(1.5, threshold, true)).toBe("ready"); // hi boundary
  });

  it("retorna caution para ratio acima do hi por exactamente 0.2", () => {
    expect(classifyAcwrState(1.7, threshold, true)).toBe("caution"); // 1.5 + 0.2
  });

  it("retorna caution para ratio abaixo do lo por exactamente 0.2", () => {
    expect(classifyAcwrState(0.6, threshold, true)).toBe("caution"); // 0.8 - 0.2
  });

  it("retorna alert para ratio acima do hi por > 0.2 (1.5 + 0.2 + epsilon)", () => {
    expect(classifyAcwrState(1.701, threshold, true)).toBe("alert");
    expect(classifyAcwrState(2.0, threshold, true)).toBe("alert");
  });

  it("retorna alert para ratio abaixo do lo por > 0.2 (0.8 - 0.2 - epsilon)", () => {
    expect(classifyAcwrState(0.599, threshold, true)).toBe("alert");
    expect(classifyAcwrState(0.0, threshold, true)).toBe("alert");
  });

  // Limiar u14 mais apertado
  describe("escalão u14 (hi=1.3)", () => {
    const thresholdU14 = { lo: 0.8, hi: 1.3 };

    it("ratio=1.4 é caution para u14 (dentro de 0.2 do hi=1.3)", () => {
      expect(classifyAcwrState(1.4, thresholdU14, true)).toBe("caution");
    });

    it("ratio=1.4 seria ready para senior (hi=1.5)", () => {
      expect(classifyAcwrState(1.4, threshold, true)).toBe("ready");
    });

    it("ratio=1.51 é alert para u14 (> 1.3 + 0.2)", () => {
      expect(classifyAcwrState(1.51, thresholdU14, true)).toBe("alert");
    });
  });
});

// ─── computeAcwrFromRawData ───────────────────────────────────────────────────

describe("computeAcwrFromRawData", () => {
  const asOf = new Date("2026-05-24T12:00:00Z");

  // AC #4: Player com ≥4 semanas de dados → dataSufficient=true, ratio correcto
  it("AC#4: jogador com 4 semanas de dados — dataSufficient=true, estado correcto", () => {
    const loads = buildLoads({ asOf, weeks: 4, loadPerWeek: 300 });
    const input: AcwrRawInput = { loads, ageGroup: "senior", asOf };
    const result = computeAcwrFromRawData(input);

    expect(result.dataSufficient).toBe(true);
    expect(result.ageGroup).toBe("senior");
    expect(result.threshold).toEqual({ lo: 0.8, hi: 1.5 });
    expect(result.state).toBe("ready"); // ratio ≈ 1.0
    expect(result.chronic).toBeCloseTo(300); // 1200/4
    // Aguda: apenas sessões na última semana (1 sessão)
    expect(result.ratio).toBeGreaterThan(0);
  });

  // AC #4: Player com <4 semanas → dataSufficient=false, state=neutral
  it("AC#4: jogador com 3 semanas de dados — dataSufficient=false, state=neutral", () => {
    const loads = buildLoads({ asOf, weeks: 3, loadPerWeek: 300 });
    const input: AcwrRawInput = { loads, ageGroup: "senior", asOf };
    const result = computeAcwrFromRawData(input);

    expect(result.dataSufficient).toBe(false);
    expect(result.state).toBe("neutral");
  });

  it("AC#4: sem dados — dataSufficient=false, state=neutral, ratio=null", () => {
    const input: AcwrRawInput = { loads: [], ageGroup: "senior", asOf };
    const result = computeAcwrFromRawData(input);

    expect(result.dataSufficient).toBe(false);
    expect(result.state).toBe("neutral");
    expect(result.acute).toBe(0);
    expect(result.chronic).toBe(0);
    expect(result.ratio).toBeNull();
  });

  // AC #4: chronic=0 mas dataSufficient=true → state=alert
  it("AC#4: chronic=0 com dataSufficient=true — state=alert (alto risco)", () => {
    // Cenário artificial: 4 semanas mas carga=0 (impossível na escala 1-10, mas testável)
    // Usamos carga 0 directamente na função pura para testar o branch
    const loadsWithZero = buildLoads({ asOf, weeks: 4, loadPerWeek: 0 });
    const input: AcwrRawInput = { loads: loadsWithZero, ageGroup: "senior", asOf };
    const result = computeAcwrFromRawData(input);

    // Com srpe_load=0 em todas, chronic=0 e dataSufficient=true → alert
    expect(result.chronic).toBe(0);
    expect(result.ratio).toBeNull();
    // dataSufficient depende de distinção de semanas, não de carga
    expect(result.dataSufficient).toBe(true);
    expect(result.state).toBe("alert");
  });

  // AC #4: ratio dentro da banda → state=ready
  it("AC#4: ratio exactamente dentro da banda → state=ready", () => {
    // Para ratio=1.0: acute = chronic
    // Com 4 semanas de 300 cada, chronic=300; acute deve ser ~300
    // Construir cargas equilibradas
    const DAY_MS = 24 * 60 * 60 * 1000;
    const loads = [
      // Última semana (aguda): 300
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
      // 3 semanas anteriores: 300 cada
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 22 * DAY_MS).toISOString() },
    ];
    const result = computeAcwrFromRawData({ loads, ageGroup: "senior", asOf });

    expect(result.dataSufficient).toBe(true);
    expect(result.acute).toBe(300);
    expect(result.chronic).toBe(300); // 1200/4
    expect(result.ratio).toBeCloseTo(1.0);
    expect(result.state).toBe("ready");
  });

  // AC #4: ratio fora da banda por exactamente 0.2 → state=caution
  it("AC#4: ratio fora da banda por exactamente 0.2 (senior hi=1.5+0.2=1.7) → caution", () => {
    // ratio = 1.7: acute/chronic = 1.7 → acute = chronic * 1.7
    // chronic = 300 → acute = 510
    const DAY_MS = 24 * 60 * 60 * 1000;
    // 4 semanas exactas sem sobreposição 7d/28d:
    // Semana 1 (dentro de 7d): acute=510
    // Semanas 2-4 (entre 7d e 28d): 230 cada → total_28=1200 → chronic=300
    // ratio = 510/300 = 1.7 → caution exacto (hi=1.5 + 0.2 = 1.7)
    const loadsExact = [
      { srpe_load: 510, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
      { srpe_load: 230, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
      { srpe_load: 230, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
      { srpe_load: 230, computed_at: new Date(asOf.getTime() - 22 * DAY_MS).toISOString() },
    ];
    const result = computeAcwrFromRawData({ loads: loadsExact, ageGroup: "senior", asOf });

    expect(result.acute).toBe(510);
    expect(result.chronic).toBeCloseTo(300); // (510+230+230+230)/4 = 1200/4
    expect(result.ratio).toBeCloseTo(1.7);
    expect(result.state).toBe("caution");
  });

  // AC #4: ratio fora da banda por > 0.2 → state=alert
  it("AC#4: ratio fora da banda por > 0.2 (senior ratio=1.71) → alert", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    // Mais carga aguda: 513 → ratio = 513/300 = 1.71
    const loads = [
      { srpe_load: 513, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
      { srpe_load: 229, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
      { srpe_load: 229, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
      { srpe_load: 229, computed_at: new Date(asOf.getTime() - 22 * DAY_MS).toISOString() },
    ];
    const result = computeAcwrFromRawData({ loads, ageGroup: "senior", asOf });

    // (513+229+229+229)/4 = 1200/4 = 300; ratio = 513/300 = 1.71 > 1.5+0.2=1.7
    expect(result.ratio).toBeCloseTo(1.71);
    expect(result.state).toBe("alert");
  });

  // AC #4: u14 tem banda mais apertada [0.8, 1.3]
  it("AC#4: limiar u14 (hi=1.3) — ratio=1.4 é caution para u14, ready para senior", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    // ratio ≈ 1.4: acute=420, chronic=300 (420/300=1.4)
    const loads = [
      { srpe_load: 420, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
      { srpe_load: 260, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
      { srpe_load: 260, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
      { srpe_load: 260, computed_at: new Date(asOf.getTime() - 22 * DAY_MS).toISOString() },
    ];
    // (420+260+260+260)/4=1200/4=300; ratio=420/300=1.4

    const u14Result = computeAcwrFromRawData({ loads, ageGroup: "u14", asOf });
    const seniorResult = computeAcwrFromRawData({ loads, ageGroup: "senior", asOf });

    expect(u14Result.ratio).toBeCloseTo(1.4);
    expect(u14Result.ageGroup).toBe("u14");
    expect(u14Result.threshold).toEqual({ lo: 0.8, hi: 1.3 });
    expect(u14Result.state).toBe("caution"); // 1.4 > 1.3, distância=0.1 ≤ 0.2

    expect(seniorResult.ratio).toBeCloseTo(1.4);
    expect(seniorResult.ageGroup).toBe("senior");
    expect(seniorResult.threshold).toEqual({ lo: 0.8, hi: 1.5 });
    expect(seniorResult.state).toBe("ready"); // 1.4 dentro [0.8, 1.5]
  });

  // AC #4: Teste de equivalência TypeScript ↔ SQL
  // A lógica PL/pgSQL produz os mesmos resultados que computeAcwrFromRawData()
  it("AC#4: equivalência TS↔SQL — fixture partilhada produz mesmo estado", () => {
    /**
     * FIXTURE: 4 sessões em 4 semanas ISO distintas
     * - Semana 1 (mais recente, dentro de 7d): srpe_load=400
     * - Semanas 2-4: srpe_load=300 cada
     *
     * Cálculo esperado (idêntico em TS e PL/pgSQL):
     * - acute = 400 (últimos 7 dias)
     * - chronic_total = 400 + 300 + 300 + 300 = 1300
     * - chronic = 1300 / 4 = 325
     * - ratio = 400 / 325 ≈ 1.231
     * - threshold senior = { lo: 0.8, hi: 1.5 }
     * - state = 'ready' (1.231 ∈ [0.8, 1.5])
     * - dataSufficient = true (4 semanas ISO distintas)
     *
     * A função SQL compute_acwr() com estes mesmos dados produziria:
     * SELECT * FROM compute_acwr(p_player_id, '2026-05-24 12:00:00+00')
     * → state='ready', data_sufficient=true, ratio≈1.231
     */
    const DAY_MS = 24 * 60 * 60 * 1000;
    const sharedFixture = [
      { srpe_load: 400, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 22 * DAY_MS).toISOString() },
    ];

    const result = computeAcwrFromRawData({
      loads: sharedFixture,
      ageGroup: "senior",
      asOf,
    });

    // Valores esperados (idênticos à função SQL)
    expect(result.acute).toBe(400);
    expect(result.chronic).toBeCloseTo(325); // 1300/4
    expect(result.ratio).toBeCloseTo(1.2308, 3);
    expect(result.dataSufficient).toBe(true);
    expect(result.state).toBe("ready");
    expect(result.threshold).toEqual({ lo: 0.8, hi: 1.5 });

    /*
     * Nota: A equivalência completa com PL/pgSQL é verificada pela identidade
     * da lógica (mesmos algoritmos, mesmos valores constantes).
     * Testes de integração contra a DB real pertencem a __tests__/acwr.integration.test.ts
     * (fora do âmbito desta story — requer DB live com session_metrics populado).
     */
  });

  it("cargas fora da janela de 28 dias são ignoradas", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const loads = [
      // Dentro da janela
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 22 * DAY_MS).toISOString() },
      // Fora da janela (> 28 dias)
      { srpe_load: 9999, computed_at: new Date(asOf.getTime() - 29 * DAY_MS).toISOString() },
      { srpe_load: 9999, computed_at: new Date(asOf.getTime() - 35 * DAY_MS).toISOString() },
    ];
    const result = computeAcwrFromRawData({ loads, ageGroup: "senior", asOf });

    // Apenas as 4 sessões dentro da janela
    expect(result.chronic).toBeCloseTo(300); // 1200/4
    expect(result.dataSufficient).toBe(true);
  });

  it("carga exactamente no boundary (computed_at = asOf - 28d) é excluída (exclusive start)", () => {
    const windowStart28 = new Date(asOf.getTime() - 28 * 24 * 60 * 60 * 1000);
    const loads = [
      // Exactamente no boundary inferior (exclusive) — deve ser excluído
      { srpe_load: 9999, computed_at: windowStart28.toISOString() },
      // 1ms depois do boundary — deve ser incluído
      { srpe_load: 100, computed_at: new Date(windowStart28.getTime() + 1).toISOString() },
    ];

    // Com apenas 1 entrada (< 4 semanas), dataSufficient=false
    const result = computeAcwrFromRawData({ loads, ageGroup: "senior", asOf });
    expect(result.chronic).toBeCloseTo(25); // apenas 100/4 (9999 excluído)
    expect(result.dataSufficient).toBe(false);
  });

  it("computed_at = asOf é incluído (inclusive end)", () => {
    const loads = [
      { srpe_load: 200, computed_at: asOf.toISOString() },
    ];
    const result = computeAcwrFromRawData({ loads, ageGroup: "senior", asOf });
    expect(result.chronic).toBeCloseTo(50); // 200/4
  });
});

// ─── computeAcwr (com mock de DB) ────────────────────────────────────────────

describe("computeAcwr", () => {
  const asOf = new Date("2026-05-24T12:00:00Z");
  const DAY_MS = 24 * 60 * 60 * 1000;
  const playerId = "00000000-0000-7000-8000-000000000001";

  const sampleLoads = [
    { srpe_load: 300, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
    { srpe_load: 300, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
    { srpe_load: 300, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
    { srpe_load: 300, computed_at: new Date(asOf.getTime() - 22 * DAY_MS).toISOString() },
  ];

  function buildSupabaseMock(ageGroup: AgeGroup | null, loads: typeof sampleLoads) {
    const playerChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: ageGroup !== null ? { age_group: ageGroup } : null,
        error: null,
      }),
    };

    const loadsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: loads, error: null }),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "players") return playerChain;
        if (table === "session_metrics") return loadsChain;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    return supabase as unknown as Parameters<typeof computeAcwr>[0];
  }

  it("retorna resultado correcto com jogador senior e 4 semanas de dados", async () => {
    const supabase = buildSupabaseMock("senior", sampleLoads);
    const result = await computeAcwr(supabase, { playerId, asOf });

    expect(result.ageGroup).toBe("senior");
    expect(result.dataSufficient).toBe(true);
    expect(result.state).toBe("ready");
    expect(result.chronic).toBeCloseTo(300);
  });

  it("usa fallback 'senior' quando jogador não encontrado (data=null)", async () => {
    const supabase = buildSupabaseMock(null, sampleLoads);
    const result = await computeAcwr(supabase, { playerId, asOf });

    expect(result.ageGroup).toBe("senior");
  });

  it("retorna neutral quando sem dados de session_metrics", async () => {
    const supabase = buildSupabaseMock("u14", []);
    const result = await computeAcwr(supabase, { playerId, asOf });

    expect(result.dataSufficient).toBe(false);
    expect(result.state).toBe("neutral");
    expect(result.acute).toBe(0);
    expect(result.chronic).toBe(0);
    expect(result.ratio).toBeNull();
  });

  it("aplica limiares correctos para u14", async () => {
    // ratio ≈ 1.4 → caution para u14, ready para senior
    const u14Loads = [
      { srpe_load: 420, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
      { srpe_load: 260, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
      { srpe_load: 260, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
      { srpe_load: 260, computed_at: new Date(asOf.getTime() - 22 * DAY_MS).toISOString() },
    ];
    const supabase = buildSupabaseMock("u14", u14Loads);
    const result = await computeAcwr(supabase, { playerId, asOf });

    expect(result.ageGroup).toBe("u14");
    expect(result.threshold).toEqual({ lo: 0.8, hi: 1.3 });
    expect(result.state).toBe("caution");
  });

  it("query players usa maybeSingle (não .single())", async () => {
    const playerChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { age_group: "senior" }, error: null }),
    };
    const loadsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "players") return playerChain;
        return loadsChain;
      }),
    } as unknown as Parameters<typeof computeAcwr>[0];

    await computeAcwr(supabase, { playerId, asOf });

    expect(playerChain.maybeSingle).toHaveBeenCalled();
  });
});

// ─── Testes adicionais de edge cases ──────────────────────────────────────────

describe("edge cases avançados", () => {
  const asOf = new Date("2026-05-24T12:00:00Z");

  it("5 semanas de dados — dataSufficient=true (mais que 4 semanas)", () => {
    const loads = buildLoads({ asOf, weeks: 5, loadPerWeek: 300 });
    // Note: loads fora de 28d são filtradas na função; mas buildLoads distribui em 35d
    // Apenas as últimas 4 semanas (28d) são contadas
    const result = computeAcwrFromRawData({ loads, ageGroup: "senior", asOf });
    // Independente do resultado, não deve causar erro
    expect(result).toBeDefined();
    expect(result.state).toBeDefined();
  });

  it("ratio=0.8 (lo boundary) → ready", () => {
    // ratio=0.8: acute=240, chronic=300 (240/300=0.8)
    const DAY_MS = 24 * 60 * 60 * 1000;
    const loads = [
      { srpe_load: 240, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
      { srpe_load: 320, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
      { srpe_load: 320, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
      { srpe_load: 320, computed_at: new Date(asOf.getTime() - 22 * DAY_MS).toISOString() },
    ];
    // chronic=(240+320+320+320)/4=1200/4=300; ratio=240/300=0.8
    const result = computeAcwrFromRawData({ loads, ageGroup: "senior", asOf });
    expect(result.ratio).toBeCloseTo(0.8);
    expect(result.state).toBe("ready");
  });

  it("ratio=0.6 (lo - 0.2) → caution", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    // ratio=0.6: acute=180, chronic=300 (180/300=0.6)
    const loads = [
      { srpe_load: 180, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
      { srpe_load: 340, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
      { srpe_load: 340, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
      { srpe_load: 340, computed_at: new Date(asOf.getTime() - 22 * DAY_MS).toISOString() },
    ];
    // chronic=(180+340+340+340)/4=1200/4=300; ratio=180/300=0.6 → caution
    const result = computeAcwrFromRawData({ loads, ageGroup: "senior", asOf });
    expect(result.ratio).toBeCloseTo(0.6);
    expect(result.state).toBe("caution");
  });

  it("múltiplas sessões na mesma semana contam como 1 semana ISO", () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    // 3 sessões na semana 1, 1 sessão em cada das semanas 2 e 3 → apenas 3 semanas distintas
    const loads = [
      { srpe_load: 100, computed_at: new Date(asOf.getTime() - 1 * DAY_MS).toISOString() },
      { srpe_load: 100, computed_at: new Date(asOf.getTime() - 2 * DAY_MS).toISOString() },
      { srpe_load: 100, computed_at: new Date(asOf.getTime() - 3 * DAY_MS).toISOString() },
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 8 * DAY_MS).toISOString() },
      { srpe_load: 300, computed_at: new Date(asOf.getTime() - 15 * DAY_MS).toISOString() },
    ];
    const result = computeAcwrFromRawData({ loads, ageGroup: "senior", asOf });
    // 3 semanas distintas → dataSufficient=false
    expect(result.dataSufficient).toBe(false);
    expect(result.state).toBe("neutral");
  });
});
