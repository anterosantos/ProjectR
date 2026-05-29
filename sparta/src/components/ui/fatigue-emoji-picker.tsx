"use client";

import { cn } from "@/lib/utils";

export interface FatigueEmojiPickerProps {
  id: string;
  /** Chave da dimensão — usado para data-testid */
  dimKey: string;
  label: string;
  /** 5 emojis para os valores 1–5 */
  emojis: readonly [string, string, string, string, string];
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function FatigueEmojiPicker({
  id,
  dimKey,
  label,
  emojis,
  value,
  onChange,
  disabled = false,
}: FatigueEmojiPickerProps) {
  return (
    <div id={id} className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>

      <div
        role="radiogroup"
        aria-label={label}
        className="flex justify-between gap-1"
      >
        {emojis.map((emoji, i) => {
          const val = i + 1; // 1–5
          const selected = value === val;

          return (
            <button
              key={val}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label}: ${val} de 5`}
              data-testid={`emoji-${dimKey}-${val}`}
              disabled={disabled}
              onClick={() => onChange(val)}
              className={cn(
                "flex-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl text-2xl transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                selected
                  ? "bg-primary/15 ring-2 ring-primary scale-105"
                  : "opacity-50 hover:opacity-80 hover:bg-muted active:scale-95"
              )}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}
