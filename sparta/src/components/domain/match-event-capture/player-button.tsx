"use client";

import { forwardRef } from "react";
import type { MatchLineupRow } from "@/lib/stores/match-session";
import { cn } from "@/lib/utils";

interface PlayerButtonProps {
  player: MatchLineupRow;
  onClick?: (player: MatchLineupRow) => void;
  disabled?: boolean;
}

export const PlayerButton = forwardRef<HTMLButtonElement, PlayerButtonProps>(
  ({ player, onClick, disabled }, ref) => {
    const isDisabled = disabled ?? player.processing_restricted;
    const ageGroupColor =
      ({
        "U-14": "border-blue-500",
        "U-17": "border-purple-500",
        "U-20": "border-green-500",
        Senior: "border-slate-700 dark:border-slate-300",
      } as Record<string, string>)[player.age_group] ?? "border-slate-400";

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
          "w-full min-h-[60px] rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 px-1 py-2 bg-slate-100 dark:bg-slate-900",
          ageGroupColor,
          isDisabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800"
        )}
      >
        <span className="text-xs font-bold text-center leading-none">
          {player.jersey_number}
        </span>
        <span className="text-xs font-semibold text-center leading-tight truncate w-full px-0.5">
          {player.name.split(" ")[0] ?? player.name}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 text-center leading-none truncate w-full px-0.5">
          {player.position}
        </span>
        <span className="text-[9px] text-slate-400 dark:text-slate-500 text-center leading-none">
          {player.age_group}
        </span>
      </button>
    );
  }
);

PlayerButton.displayName = "PlayerButton";
