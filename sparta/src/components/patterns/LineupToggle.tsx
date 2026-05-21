"use client";

import { Star, Users, Circle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LineupToggleProps {
  player: {
    id: string;
    full_name: string;
    jersey_num: number;
    positions?: Array<{ position: string; is_primary: boolean }>;
  };
  selected: "starter" | "bench" | null;
  onChange: (role: "starter" | "bench" | null, shirtNum?: number | null) => void;
  parentalConsentConfirmed?: boolean;
  disabled?: boolean;
  shirtNum?: number | null;
}

export function LineupToggle({
  player,
  selected,
  onChange,
  parentalConsentConfirmed = true,
  disabled = false,
  shirtNum = null,
}: LineupToggleProps) {
  const primaryPosition =
    player.positions?.find((p) => p.is_primary)?.position || "—";

  return (
    <div className="border-b border-gray-200 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {player.jersey_num}
            </span>
            <span className="text-sm font-medium text-gray-900 truncate">
              {player.full_name}
            </span>
            {!parentalConsentConfirmed && (
              <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                <AlertCircle className="h-3 w-3" />
                Aguarda
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{primaryPosition}</p>
        </div>
      </div>

      <div
        role="group"
        aria-label={`Seleção para ${player.full_name}`}
        className="flex gap-2 flex-wrap items-end"
      >
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-pressed={selected === null}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-lg border font-medium text-sm transition-colors",
            selected === null
              ? "border-gray-300 bg-gray-100 text-gray-900"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Circle className="h-4 w-4" />
          <span className="hidden sm:inline">Não</span>
        </button>

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => onChange("starter")}
            disabled={disabled}
            aria-pressed={selected === "starter"}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-lg border font-medium text-sm transition-colors",
              selected === "starter"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Titular</span>
          </button>
          {selected === "starter" && (
            <input
              type="number"
              min="1"
              max="99"
              placeholder="Nº"
              value={shirtNum ?? ""}
              onChange={(e) => onChange("starter", e.target.value ? parseInt(e.target.value, 10) : null)}
              disabled={disabled}
              className="min-h-[44px] min-w-[60px] px-2 rounded-lg border border-gray-200 text-sm font-medium text-center"
              aria-label={`Número de camisola para ${player.full_name}`}
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => onChange("bench")}
          disabled={disabled}
          aria-pressed={selected === "bench"}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-lg border font-medium text-sm transition-colors",
            selected === "bench"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Banco</span>
        </button>
      </div>
    </div>
  );
}
