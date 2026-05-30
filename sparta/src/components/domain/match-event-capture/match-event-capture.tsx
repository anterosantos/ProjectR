"use client";

import { RefreshCw } from "lucide-react";
import {
  useMatchSession,
  useSelectedPlayer,
  useLastActionPolarity,
} from "@/lib/stores/match-session";
import { PlayerGrid } from "./player-grid";
import { ActionList } from "./action-list";
import { ZoneSelectorSheet } from "./zone-selector-sheet";
import { RecentEventsRing } from "./recent-events-ring";
import { PendingBadge } from "@/components/domain/pending-badge";
import { useOutboxDrain } from "@/hooks/useOutboxDrain";
import { cn } from "@/lib/utils";

interface MatchEventCaptureProps {
  sessionId: string;
}

export function MatchEventCapture({ sessionId }: MatchEventCaptureProps) {
  const selectedPlayer = useSelectedPlayer();
  const lastPolarity = useLastActionPolarity();
  const { clearSelection } = useMatchSession();
  const { pendingCount, isDraining, drain } = useOutboxDrain();

  const headerBg =
    selectedPlayer && lastPolarity === "negative"
      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      : selectedPlayer
        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800";

  return (
    <div className="flex flex-col w-full h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sticky Header */}
      <div
        className={cn(
          "sticky top-0 z-20 border-b px-4 py-3 flex items-center justify-between gap-3 min-h-[60px]",
          headerBg
        )}
      >
        {selectedPlayer ? (
          <>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {selectedPlayer.name} • nº {selectedPlayer.jersey_number}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                {selectedPlayer.position}
              </div>
            </div>
            <button
              onClick={() => clearSelection()}
              aria-label="Trocar jogador"
              className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex-shrink-0"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </>
        ) : (
          <div className="text-sm text-slate-500 flex-1">
            Selecione um jogador
          </div>
        )}
        <PendingBadge
          count={pendingCount}
          isDraining={isDraining}
          onSyncClick={drain}
        />
      </div>

      {/* Body — full-bleed, no extra padding */}
      <div className="flex-1 overflow-auto p-4">
        {!selectedPlayer ? (
          <PlayerGrid sessionId={sessionId} />
        ) : (
          <ActionList />
        )}
      </div>

      {/* Recent Events Footer */}
      <RecentEventsRing sessionId={sessionId} />

      {/* Zone Selector Modal */}
      <ZoneSelectorSheet sessionId={sessionId} />
    </div>
  );
}
