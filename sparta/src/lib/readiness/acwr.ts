/**
 * acwr.ts — Motor de cálculo ACWR (Acute:Chronic Workload Ratio)
 *
 * FR32: "ACWR (rácio carga aguda 7d / crónica 28d) por jogador com limiares por escalão"
 * NFR5: "Recálculo ACWR para 18 convocados em ≤3s"
 * NFR54: "Cobertura ≥80% nas funções críticas (ACWR, sRPE, ...)"
 *
 * Arquitectura:
 * - `computeAcwrFromRawData()`: função pura, sem DB, testável isoladamente
 * - `computeAcwr()`: orquestra fetch do DB + delega para função pura
 * - `classifyAcwrState()`: função pura de classificação de estado
 *
 * A separação garante:
 * 1. Testabilidade sem mocks de DB para a lógica de negócio
 * 2. Reutilização em contextos client-side (Story 5.x)
 * 3. Equivalência verificável com a função SQL `compute_acwr`
 */

import { getISOWeek, getISOWeekYear } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getThreshold,
  type AgeGroup,
  type AcwrState,
} from "@/lib/readiness/thresholds";

// ─── Tipos públicos ────────────────────────────────────────────────────────────

/** Input para `computeAcwr` (com DB) */
export interface AcwrInput {
  playerId: string;
  asOf: Date;
}

/** Input para `computeAcwrFromRawData` (pura, sem DB) */
export interface AcwrRawInput {
  /** Registos de `session_metrics` com `srpe_load` e `computed_at` (ISO string) */
  loads: { srpe_load: number; computed_at: string }[];
  /** Escalão etário do jogador */
  ageGroup: AgeGroup;
  /** Data de referência para cálculo das janelas temporais */
  asOf: Date;
}

/** Resultado completo do cálculo ACWR */
export interface AcwrResult {
  /** Carga aguda: soma de srpe_load nos últimos 7 dias */
  acute: number;
  /** Carga crónica: soma de srpe_load nos últimos 28 dias / 4 */
  chronic: number;
  /** Rácio ACWR (acute / chronic); null se chronic = 0 */
  ratio: number | null;
  /** Escalão etário do jogador */
  ageGroup: AgeGroup;
  /** Limiares de segurança para o escalão */
  threshold: { lo: number; hi: number };
  /** Estado de prontidão classificado */
  state: AcwrState;
  /**
   * Verdadeiro se há entradas em `session_metrics` cobrindo ≥ 4 semanas ISO distintas
   * na janela de 28 dias. Falso implica dados insuficientes → state = 'neutral'.
   */
  dataSufficient: boolean;
}

// ─── Funções puras ─────────────────────────────────────────────────────────────

/**
 * Classifica o estado ACWR com base no rácio, limiares e suficiência de dados.
 *
 * @param ratio           ACWR ratio (null se chronic = 0)
 * @param threshold       Limiares { lo, hi } para o escalão
 * @param dataSufficient  true se dados cobrem ≥ 4 semanas ISO
 * @returns Estado de prontidão
 *
 * Regras (por ordem de prioridade):
 * 1. Se !dataSufficient → 'neutral'
 * 2. Se ratio === null (chronic=0 mas dados suficientes) → 'alert' (alto risco)
 * 3. Se ratio dentro [lo, hi] → 'ready'
 * 4. Se fora por ≤ 0.2 → 'caution'
 * 5. Se fora por > 0.2 → 'alert'
 */
export function classifyAcwrState(
  ratio: number | null,
  threshold: { lo: number; hi: number },
  dataSufficient: boolean
): AcwrState {
  if (!dataSufficient) return "neutral";

  // chronic=0 com dados suficientes: sRPE=0 é impossível (escala 1–10),
  // logo indica ausência de dados de carga → risco máximo
  if (ratio === null) return "alert";

  if (ratio >= threshold.lo && ratio <= threshold.hi) return "ready";

  // Margem de caution: ≤ 0.2 fora da banda.
  // Tolerância 1e-9 para casos exactos de vírgula flutuante (ex: 0.8 - 0.6 = 0.20000000000000007).
  // A precisão de ACWR em medicina desportiva é 2-3 casas decimais; 1e-9 é irrelevante
  // clinicamente mas necessário para boundaries exactos como 0.6 e 1.7 (lo-0.2, hi+0.2).
  const CAUTION_LIMIT = 0.2 + 1e-9;
  const distance =
    ratio > threshold.hi ? ratio - threshold.hi : threshold.lo - ratio;

  if (distance <= CAUTION_LIMIT) return "caution";
  return "alert";
}

/**
 * Calcula o ACWR a partir de dados brutos (sem acesso ao DB).
 *
 * Usado para:
 * - Testes unitários sem mocks de DB
 * - Teste de equivalência com a função SQL `compute_acwr`
 * - Potencial uso client-side
 *
 * Fórmula:
 * - acute  = sum(srpe_load) WHERE computed_at IN (asOf-7d, asOf]
 * - chronic_total = sum(srpe_load) WHERE computed_at IN (asOf-28d, asOf]
 * - chronic = chronic_total / 4  (média semanal com divisor fixo)
 * - ratio   = acute / chronic    (null se chronic = 0)
 * - dataSufficient = ISO weeks distintas com ≥ 1 entrada ≥ 4
 *
 * @param input Dados brutos de session_metrics + escalão + data de referência
 * @returns Resultado ACWR completo
 */
export function computeAcwrFromRawData(input: AcwrRawInput): AcwrResult {
  const { loads, ageGroup, asOf } = input;

  const asOfMs = asOf.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const twentyEightDaysMs = 28 * 24 * 60 * 60 * 1000;

  const windowStart28 = new Date(asOfMs - twentyEightDaysMs);
  const windowStart7 = new Date(asOfMs - sevenDaysMs);

  // Filtrar cargas dentro da janela de 28 dias: (asOf-28d, asOf]
  const loads28 = loads.filter((l) => {
    const t = new Date(l.computed_at).getTime();
    return t > windowStart28.getTime() && t <= asOfMs;
  });

  // Carga aguda: soma dos últimos 7 dias: (asOf-7d, asOf]
  const acute = loads28
    .filter((l) => new Date(l.computed_at).getTime() > windowStart7.getTime())
    .reduce((sum, l) => sum + l.srpe_load, 0);

  // Carga crónica: soma dos 28 dias / 4 (divisor fixo, não semanas com dados)
  const chronicTotal = loads28.reduce((sum, l) => sum + l.srpe_load, 0);
  const chronic = chronicTotal / 4;

  // Rácio ACWR (null se chronic = 0)
  const ratio = chronic > 0 ? acute / chronic : null;

  // Suficiência de dados: semanas ISO distintas com ≥ 1 entrada
  const distinctWeeks = new Set(
    loads28.map((l) => {
      const d = new Date(l.computed_at);
      return `${getISOWeekYear(d)}-W${getISOWeek(d)}`;
    })
  );
  const dataSufficient = distinctWeeks.size >= 4;

  const threshold = getThreshold(ageGroup);
  const state = classifyAcwrState(ratio, threshold, dataSufficient);

  return {
    acute,
    chronic,
    ratio,
    ageGroup,
    threshold,
    state,
    dataSufficient,
  };
}

// ─── Função com DB ─────────────────────────────────────────────────────────────

/**
 * Calcula o ACWR para um jogador, consultando o Supabase.
 *
 * Faz duas queries:
 * 1. `players.age_group` para o playerId
 * 2. `session_metrics.srpe_load + computed_at` dos últimos 28 dias
 *
 * O índice `idx_session_metrics_player_computed` (criado em Story 5.1)
 * em `(player_id, computed_at DESC)` garante performance ≤ 3s para 18 jogadores (NFR5).
 *
 * @param supabase  Cliente Supabase (server-side)
 * @param input     `{ playerId, asOf }`
 * @returns         Resultado ACWR completo
 */
export async function computeAcwr(
  supabase: SupabaseClient,
  { playerId, asOf }: AcwrInput
): Promise<AcwrResult> {
  const asOfMs = asOf.getTime();
  const twentyEightDaysMs = 28 * 24 * 60 * 60 * 1000;
  const windowStart28 = new Date(asOfMs - twentyEightDaysMs);

  // 1. Fetch age_group do jogador (maybeSingle: padrão estabelecido em 4-8, 5-1)
  const { data: player } = await supabase
    .from("players")
    .select("age_group")
    .eq("id", playerId)
    .maybeSingle();

  // Fallback para 'senior' se jogador não encontrado (raro, mas defensivo)
  const ageGroup: AgeGroup = (player?.age_group as AgeGroup | null) ?? "senior";

  // 2. Fetch session_metrics dos últimos 28 dias: (asOf-28d, asOf]
  // Nota: computeAcwr() é uma função de cálculo chamada de Server Actions (Story 5.3+).
  // O audit logging é responsabilidade do Server Action via auditedRead(). Esta biblioteca
  // não tem acesso a actorId/clubId necessários para auditedRead().
  // eslint-disable-next-line custom/no-direct-health-data-read
  const { data: loads } = await supabase
    .from("session_metrics")
    .select("srpe_load, computed_at")
    .eq("player_id", playerId)
    .gt("computed_at", windowStart28.toISOString())
    .lte("computed_at", asOf.toISOString())
    .order("computed_at", { ascending: false });

  // 3. Delegar para função pura
  return computeAcwrFromRawData({
    loads: loads ?? [],
    ageGroup,
    asOf,
  });
}
