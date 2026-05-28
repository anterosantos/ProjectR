"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { FatigueSparkline } from "./FatigueSparkline";
import type { PlayerTrendData } from "@/lib/actions/trends";

function DeltaIndicator({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (delta > 0.1) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-green-600">
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
        +{delta.toFixed(1)}
      </span>
    );
  }
  if (delta < -0.1) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-red-600">
        <TrendingDown className="h-3 w-3" aria-hidden="true" />
        {delta.toFixed(1)}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" aria-hidden="true" />
      ~0
    </span>
  );
}

interface FatigueTrendRowProps {
  player: PlayerTrendData;
}

export function FatigueTrendRow({ player }: FatigueTrendRowProps) {
  return (
    <tr className="border-b border-border text-sm">
      {/* Jogador */}
      <td className="py-3 px-4 sm:px-6">
        <div className="font-medium text-foreground">{player.playerName}</div>
      </td>

      {/* Posição */}
      <td className="py-3 px-4 sm:px-6 text-muted-foreground">
        <div className="text-xs sm:text-sm">{player.position}</div>
      </td>

      {/* Escalão (oculto em mobile) */}
      <td className="hidden sm:table-cell py-3 px-4 sm:px-6 text-muted-foreground">
        <div className="text-xs">{player.ageGroup}</div>
      </td>

      {/* Sparklines */}
      <td className="py-3 px-4 sm:px-6">
        {player.hasFatigueData ? (
          <div className="flex items-center gap-3">
            <div className="h-8 w-20">
              <FatigueSparkline data={player.sparklines.dim_energy} dimension="dim_energy" width={80} height={32} />
            </div>
            <div className="h-8 w-20">
              <FatigueSparkline data={player.sparklines.dim_focus} dimension="dim_focus" width={80} height={32} />
            </div>
            <div className="h-8 w-20">
              <FatigueSparkline data={player.sparklines.dim_sleep} dimension="dim_sleep" width={80} height={32} />
            </div>
            <div className="h-8 w-20">
              <FatigueSparkline
                data={player.sparklines.dim_soreness}
                dimension="dim_soreness"
                width={80}
                height={32}
              />
            </div>
            <div className="h-8 w-20">
              <FatigueSparkline data={player.sparklines.dim_mood} dimension="dim_mood" width={80} height={32} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs">—</span>
            <span className="text-muted-foreground text-xs">—</span>
            <span className="text-muted-foreground text-xs">—</span>
            <span className="text-muted-foreground text-xs">—</span>
            <span className="text-muted-foreground text-xs">—</span>
          </div>
        )}
      </td>

      {/* Delta Indicator */}
      <td className="py-3 px-4 sm:px-6">
        <DeltaIndicator delta={player.delta} />
      </td>
    </tr>
  );
}
