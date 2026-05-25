/**
 * thresholds.ts — Limiares ACWR por escalão etário
 *
 * FR32: "ACWR (rácio carga aguda 7d / crónica 28d) por jogador com limiares por escalão"
 * NFR54: Cobertura ≥80% nas funções críticas (ACWR, sRPE, ...)
 *
 * Esta é a única fonte de verdade (DRY) para limiares ACWR no projecto.
 * A função SQL `compute_acwr` em 000245_acwr_function.sql espelha estes valores.
 *
 * Referência científica:
 * - Gabbett (2016): zona segura ACWR 0.8–1.3 (atletas jovens, menor capacidade de absorção)
 * - Hulin et al. (2014): zona segura ACWR 0.8–1.5 (atletas seniores, maior resiliência)
 */

/**
 * Escalões etários válidos — espelha o CHECK constraint em `players.age_group`:
 * CHECK (age_group IN ('u14','u15','u17','u19','senior'))
 */
export type AgeGroup = "u14" | "u15" | "u17" | "u19" | "senior";

/**
 * Estado de prontidão derivado do ACWR.
 * - `neutral` : dados insuficientes para classificar (< 4 semanas ISO com dados)
 * - `ready`   : rácio dentro da banda segura
 * - `caution` : rácio fora da banda por ≤ 0.2 (atenção, mas não crítico)
 * - `alert`   : rácio fora da banda por > 0.2 (risco elevado de lesão / overtraining)
 */
export type AcwrState = "ready" | "caution" | "alert" | "neutral";

/**
 * Limiares ACWR por escalão etário.
 * - `lo` : limite inferior da zona segura
 * - `hi` : limite superior da zona segura
 *
 * Escalões mais jovens têm banda superior mais apertada (menor capacidade de carga).
 *
 * ATENÇÃO: Estes valores são espelhados na função SQL 000245_acwr_function.sql.
 * Qualquer alteração aqui deve ser replicada no PL/pgSQL CASE expression.
 */
export const ACWR_THRESHOLDS: Record<AgeGroup, { lo: number; hi: number }> = {
  u14: { lo: 0.8, hi: 1.3 },
  u15: { lo: 0.8, hi: 1.4 },
  u17: { lo: 0.8, hi: 1.5 },
  u19: { lo: 0.8, hi: 1.5 },
  senior: { lo: 0.8, hi: 1.5 },
} as const;

/**
 * Retorna os limiares ACWR para o escalão etário indicado.
 *
 * @param ageGroup Escalão etário do jogador
 * @returns `{ lo, hi }` com os limites inferior e superior da zona segura
 *
 * @example
 * getThreshold('u14')    // → { lo: 0.8, hi: 1.3 }
 * getThreshold('senior') // → { lo: 0.8, hi: 1.5 }
 */
export function getThreshold(ageGroup: AgeGroup): { lo: number; hi: number } {
  return ACWR_THRESHOLDS[ageGroup];
}

/**
 * Prioridade de ordenação por estado de prontidão.
 * Exportada como única fonte de verdade (DRY) — usada em Server Actions e Client Components.
 * alert → caution → ready → neutral → desconhecido (5)
 */
export const READINESS_STATE_PRIORITY: Record<string, number> = {
  alert: 1,
  caution: 2,
  ready: 3,
  neutral: 4,
} as const;
