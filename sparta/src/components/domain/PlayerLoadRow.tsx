"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
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
  const hasData = load > 0 && sessions > 0 && seasonAvg > 0;
  const showLowBadge  = hasData && load < seasonAvg * 0.5;
  const showHighBadge = hasData && load > seasonAvg * 1.5;
  const showNormalBadge = hasData && !showLowBadge && !showHighBadge;

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
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <TrendingDown className="h-3 w-3" aria-hidden="true" />
            Carga baixa
          </span>
        )}
        {showNormalBadge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <Minus className="h-3 w-3" aria-hidden="true" />
            Carga normal
          </span>
        )}
        {showHighBadge && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
            Carga alta
          </span>
        )}
      </td>
    </tr>
  );
}
