/**
 * srpe.ts — Funções puras de cálculo sRPE (Session Rating of Perceived Exertion)
 *
 * FR33: "Sistema calcula sRPE (Session-RPE × duração) por sessão"
 * NFR54: Cobertura ≥80% nas funções críticas (ACWR, sRPE, ...)
 *
 * Estas funções são:
 * - Puras (sem efeitos secundários, sem dependências externas)
 * - Testáveis isoladamente
 * - Usadas pelo Server Action (fatigue.ts) — não duplicar cálculo inline
 * - Disponíveis para uso client-side futuro (Story 5.x)
 */

/** Escala de sRPE válida (Foster scale): 1–10 */
export const SRPE_VALUE_MIN = 1;
export const SRPE_VALUE_MAX = 10;

/** Duração de sessão válida em minutos: 15–240 */
export const DURATION_MIN_MIN = 15;
export const DURATION_MIN_MAX = 240;

/**
 * Calcula a carga sRPE: srpeValue × durationMin.
 *
 * Esta função é pura e assume inputs válidos.
 * Usar em conjunto com `isSrpeInputValid()` para validação prévia.
 *
 * @param srpeValue  Percepção de esforço da sessão (1–10)
 * @param durationMin Duração da sessão em minutos (15–240)
 * @returns Carga sRPE (ex: srpe=7, dur=90 → 630)
 *
 * @example
 * calculateSrpeLoad(1, 15)   // → 15   (boundary mínimo)
 * calculateSrpeLoad(10, 240) // → 2400 (boundary máximo)
 * calculateSrpeLoad(7, 90)   // → 630  (caso típico)
 */
export function calculateSrpeLoad(
  srpeValue: number,
  durationMin: number
): number {
  return srpeValue * durationMin;
}

/**
 * Valida se os inputs de sRPE estão dentro dos ranges aceites.
 *
 * Usado antes de chamar `calculateSrpeLoad()` e antes do upsert em `session_metrics`.
 *
 * @param srpeValue   Qualquer valor (validado como número inteiro 1–10)
 * @param durationMin Qualquer valor (validado como número inteiro 15–240)
 * @returns true se ambos os inputs são válidos; false caso contrário
 *
 * @example
 * isSrpeInputValid(7, 90)   // → true
 * isSrpeInputValid(0, 90)   // → false  (srpe < 1)
 * isSrpeInputValid(11, 90)  // → false  (srpe > 10)
 * isSrpeInputValid(7, 14)   // → false  (dur < 15)
 * isSrpeInputValid(7, 241)  // → false  (dur > 240)
 * isSrpeInputValid("7", 90) // → false  (não é número)
 * isSrpeInputValid(null, 90)// → false  (null)
 */
export function isSrpeInputValid(
  srpeValue: unknown,
  durationMin: unknown
): boolean {
  if (typeof srpeValue !== "number" || typeof durationMin !== "number") {
    return false;
  }
  if (!Number.isInteger(srpeValue) || !Number.isInteger(durationMin)) {
    return false;
  }
  if (srpeValue < SRPE_VALUE_MIN || srpeValue > SRPE_VALUE_MAX) {
    return false;
  }
  if (durationMin < DURATION_MIN_MIN || durationMin > DURATION_MIN_MAX) {
    return false;
  }
  return true;
}
