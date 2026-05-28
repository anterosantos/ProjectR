"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { MonthlyLoadBar } from "@/components/domain/MonthlyLoadBar";
import type { PlayerLoadData } from "@/lib/actions/load";

interface PlayerLoadRowProps {
  player: PlayerLoadData;
  seasonAvg: number;
  load: number;
  monthly: PlayerLoadData["currentSeasonMonthly"];
  sessions: number;
}

export function PlayerLoadRow({ player, seasonAvg, load, monthly, sessions }: PlayerLoadRowProps) {
  // Badges only shown if: player has data (load + sessions > 0) and is within thresholds
  const showLowBadge = load > 0 && sessions > 0 && seasonAvg > 0 && load < seasonAvg * 0.5;
  const showHighBadge = load > 0 && sessions > 0 && seasonAvg > 0 && load > seasonAvg * 1.5;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="py-3 px-4 text-sm font-medium text-foreground">
        {player.playerName}
      </td>
      <td className="hidden sm:table-cell py-3 px-4 text-sm text-muted-foreground">
        {player.position}
      </td>
      <td className="hidden sm:table-cell py-3 px-4 text-sm text-muted-foreground">
        {player.ageGroup}
      </td>
      <td className="py-3 px-4 text-sm text-foreground font-mono tabular-nums">
        {load}
      </td>
      <td className="py-3 px-4">
        <MonthlyLoadBar data={monthly} width={100} height={28} />
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground tabular-nums">
        {sessions}
      </td>
      <td className="py-3 px-4">
        {showLowBadge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            <TrendingDown className="h-3 w-3" aria-hidden="true" />
            Carga baixa
          </span>
        )}
        {showHighBadge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
            Carga alta
          </span>
        )}
      </td>
    </tr>
  );
}
