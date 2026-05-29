"use client";

import { forwardRef } from "react";
import type { MATCH_ZONES } from "@/lib/schemas/match-events";
import { cn } from "@/lib/utils";

type MatchZone = (typeof MATCH_ZONES)[number];

interface ZoneCellProps {
  zone: MatchZone;
  onClick?: (zone: MatchZone) => void;
}

const ZONES_MAP: Record<MatchZone, string> = {
  def_left: "Defesa esquerda",
  def_center: "Defesa centro",
  def_right: "Defesa direita",
  mid_left: "Meio esquerda",
  mid_center: "Meio centro",
  mid_right: "Meio direita",
  att_left: "Ataque esquerda",
  att_center: "Ataque centro",
  att_right: "Ataque direita",
};

export const ZoneCell = forwardRef<HTMLButtonElement, ZoneCellProps>(
  ({ zone, onClick }, ref) => {
    const label = ZONES_MAP[zone] ?? zone;

    return (
      <button
        ref={ref}
        onClick={() => onClick?.(zone)}
        role="gridcell"
        aria-label={label}
        className={cn(
          "w-full h-20 min-h-20 rounded-lg border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors duration-0"
        )}
      >
        <span className="text-sm font-medium text-center px-2">{label}</span>
      </button>
    );
  }
);

ZoneCell.displayName = "ZoneCell";
