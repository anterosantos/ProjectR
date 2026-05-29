"use client";

import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import type { MatchLineupRow } from "@/lib/stores/match-session";
import { cn } from "@/lib/utils";

interface PlayerButtonProps {
  player: MatchLineupRow;
  onClick?: (player: MatchLineupRow) => void;
  disabled?: boolean;
}

export const PlayerButton = forwardRef<
  HTMLButtonElement,
  PlayerButtonProps
>(({ player, onClick, disabled }, ref) => {
  const isDisabled = disabled ?? player.processing_restricted;
  const ageGroupColor = {
    "U-14": "border-blue-500",
    "U-17": "border-purple-500",
    "U-20": "border-green-500",
    Senior: "border-slate-700 dark:border-slate-300",
  }[player.age_group] ?? "border-slate-400";

  return (
    <button
      ref={ref}
      onClick={() => !isDisabled && onClick?.(player)}
      disabled={isDisabled}
      aria-label={`${player.name}, nº ${player.jersey_number}, ${player.position}, ${player.age_group}`}
      aria-describedby={
        player.processing_restricted
          ? "restricted-tooltip-match-capture"
          : undefined
      }
      className={cn(
        "w-16 h-16 min-w-16 min-h-16 rounded-lg border-2 flex flex-col items-center justify-center gap-1 bg-slate-100 dark:bg-slate-900",
        ageGroupColor,
        isDisabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800"
      )}
    >
      <span className="text-sm font-semibold text-center truncate px-1">
        {player.jersey_number}
      </span>
      <span className="text-xs text-slate-600 dark:text-slate-400 text-center truncate px-1">
        {player.position.split(" ")?.[0] ?? "—"}
      </span>
    </button>
  );
});

PlayerButton.displayName = "PlayerButton";
