/**
 * Cópia de fadiga em PT-PT — Story 4.3
 *
 * Materializa o requisito de arquitectura lib/i18n/pt-PT/ com variantes
 * linguísticas para jogadores senior e sub-14/u15.
 *
 * Regras:
 * - Sem barrel files — importar directamente de @/lib/i18n/pt-PT/fatigue
 * - Sem lógica dinâmica — copy estático PT-PT (não usar next-intl ou i18n runtime)
 * - `as const satisfies` preserva tipos literais e valida contra a interface
 */

export interface FatigueDimensionCopy {
  key: "dim_energy" | "dim_focus" | "dim_sleep" | "dim_soreness" | "dim_mood";
  label: string;
  minLabel: string;
  maxLabel: string;
}

export interface FatigueCopySet {
  dimensions: readonly FatigueDimensionCopy[];
  submitLabel: string;
  submittingLabel: string;
  /** Texto de ajuda — null para senior, string para sub-14 (AC #3) */
  helpText: string | null;
  confirmationMessage: string;
}

export const FATIGUE_COPY = {
  senior: {
    dimensions: [
      { key: "dim_energy", label: "Energia muscular", minLabel: "Esgotado", maxLabel: "Pleno" },
      { key: "dim_focus", label: "Concentração", minLabel: "Disperso", maxLabel: "Concentrado" },
      { key: "dim_sleep", label: "Sono", minLabel: "Mau", maxLabel: "Excelente sono" },
      { key: "dim_soreness", label: "Desconforto físico", minLabel: "Muito dor", maxLabel: "Sem dor" },
      { key: "dim_mood", label: "Estado emocional", minLabel: "Mau", maxLabel: "Bom estado" },
    ],
    submitLabel: "Submeter",
    submittingLabel: "A submeter…",
    helpText: null,
    confirmationMessage: "Registado, bom treino",
  },
  u14: {
    dimensions: [
      { key: "dim_energy", label: "Como te sentes de energia?", minLabel: "Cansado", maxLabel: "Cheio de energia" },
      { key: "dim_focus", label: "Estás atento?", minLabel: "Distraído", maxLabel: "Atento" },
      { key: "dim_sleep", label: "Como dormiste?", minLabel: "Dormi mal", maxLabel: "Dormi bem" },
      { key: "dim_soreness", label: "Tens dor em algum sítio?", minLabel: "Tenho dor", maxLabel: "Sem dor" },
      { key: "dim_mood", label: "Como estás de humor?", minLabel: "Triste/zangado", maxLabel: "Bem-disposto" },
    ],
    submitLabel: "Pronto, terminámos",
    submittingLabel: "A registar…",
    helpText: "Não há respostas certas. O que importa é como te sentes mesmo.",
    confirmationMessage: "Registado, bom treino",
  },
} as const satisfies Record<string, FatigueCopySet>;

/**
 * Devolve o conjunto de copy de fadiga para o grupo etário do jogador.
 * age_group "u14" ou "u15" → versão simplificada sub-14.
 * Qualquer outro valor (incluindo undefined) → versão senior.
 */
export function getFatigueCopy(ageGroup?: string): FatigueCopySet {
  if (ageGroup === "u14" || ageGroup === "u15") return FATIGUE_COPY.u14;
  return FATIGUE_COPY.senior;
}
