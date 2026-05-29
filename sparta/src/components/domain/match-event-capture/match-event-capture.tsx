"use client";

import { RefreshCw } from "lucide-react";
import {
  useMatchSession,
  useSelectedPlayer,
  useSelectedAction,
} from "@/lib/stores/match-session";
import { PlayerGrid } from "./player-grid";
import { ActionList } from "./action-list";
import { ZoneSelectorSheet } from "./zone-selector-sheet";
import { PendingBadge } from "@/components/ui/pending-badge";
import { cn } from "@/lib/utils";

interface MatchEventCaptureProps {
  sessionId: string;
}

export function MatchEventCapture({ sessionId }: MatchEventCaptureProps) {
  const selectedPlayer = useSelectedPlayer();
  const selectedAction = useSelectedAction();
  const { clearSelection } = useMatchSession();

  return (
    <div className="flex flex-col w-full h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sticky Header */}
      <div
        className={cn(
          "sticky top-0 z-20 border-b px-4 py-3 flex items-center justify-between gap-3 min-h-[60px]",
          selectedPlayer
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        )}
      >
        {selectedPlayer ? (
          <>
            <div className="flex-1">
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
        <PendingBadge />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {!selectedPlayer ? (
            <PlayerGrid sessionId={sessionId} />
          ) : (
            <ActionList />
          )}
        </div>
      </div>

      {/* Zone Selector Modal */}
      <ZoneSelectorSheet sessionId={sessionId} />
    </div>
  );
}
