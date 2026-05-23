"use client";

/**
 * FatigueSlider — Slider nativo para recolha de fadiga (Story 4.2)
 *
 * Usa <input type="range" step={1}> nativo para:
 *   - Snap automático em posições inteiras (AC #2)
 *   - ARIA role="slider" embutido (AC #6)
 *   - Navegação por teclado (Left/Right) sem código adicional (AC #6)
 *
 * Story 4.3 adicionará variante sub-14 via prop ageGroup.
 */

export interface FatigueSliderProps {
  /** HTML id para associação de label */
  id: string;
  /** Título da dimensão, e.g. "Energia muscular" */
  label: string;
  /** Label do extremo mínimo, e.g. "Esgotado" */
  minLabel: string;
  /** Label do extremo máximo, e.g. "Pleno" */
  maxLabel: string;
  /** Valor mínimo da escala (defeito: 1) */
  min?: number;
  /** Valor máximo da escala (defeito: 5) */
  max?: number;
  /** Valor actual (null = não definido) */
  value: number | null;
  /** Callback chamado com o integer seleccionado */
  onChange: (value: number) => void;
  /** Se true, o slider está desactivado */
  disabled?: boolean;
  /**
   * Grupo etário do jogador — passado pelo FatigueQuestionnaire para
   * consistência. Os labels já chegam adaptados via i18n; esta prop é
   * informacional e pode ser usada por testes standalone ou futuros
   * consumidores do componente.
   * Story 4.3 — variante sub-14.
   */
  ageGroup?: "senior" | "u14";
}

/**
 * Devolve a descrição textual do valor para aria-valuetext.
 * Escala 1–5: mínimo / baixo / médio / alto / máximo
 * Escala 1–10: muito fácil / fácil / moderado / difícil / máximo
 */
export function getValueLabel(value: number, max: number): string {
  if (max === 5) {
    const labels: Record<number, string> = {
      1: "mínimo",
      2: "baixo",
      3: "médio",
      4: "alto",
      5: "máximo",
    };
    return labels[value] ?? String(value);
  }
  // Escala 1–10 (sRPE)
  if (value <= 2) return "muito fácil";
  if (value <= 4) return "fácil";
  if (value <= 6) return "moderado";
  if (value <= 8) return "difícil";
  return "máximo";
}

export function FatigueSlider({
  id,
  label,
  minLabel,
  maxLabel,
  min = 1,
  max = 5,
  value,
  onChange,
  disabled = false,
}: FatigueSliderProps) {
  const ariaValueText =
    value !== null
      ? `${value} de ${max} — ${getValueLabel(value, max)}`
      : "Não definido";

  return (
    <div className="min-h-[44px] flex flex-col gap-1 w-full">
      {/* Linha do título */}
      <span
        id={`${id}-label`}
        className="text-sm font-medium text-[var(--color-ink-2,theme(colors.gray.700))]"
      >
        {label}
      </span>

      {/* Track + extremos */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
          {minLabel}
        </span>

        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={1}
          value={value ?? ""}
          disabled={disabled}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          {...(value !== null && { "aria-valuenow": value })}
          aria-valuetext={ariaValueText}
          className="flex-1 h-2 accent-primary cursor-pointer motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            if (!isNaN(parsed) && parsed >= min && parsed <= max) {
              onChange(parsed);
            }
          }}
        />

        <span className="text-xs text-muted-foreground w-16 text-left shrink-0">
          {maxLabel}
        </span>
      </div>
    </div>
  );
}
