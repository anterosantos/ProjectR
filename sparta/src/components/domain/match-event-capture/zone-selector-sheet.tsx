"use client";

import { useState, useTransition } from "react";
import { ZoneCell } from "./zone-cell";
import { MATCH_ZONES } from "@/lib/schemas/match-events";
import {
  useMatchSession,
  useSelectedPlayer,
  useSelectedAction,
} from "@/lib/stores/match-session";
import { submitMatchEvent } from "@/lib/actions/events";
import { newId } from "@/lib/uuid";
import type { MATCH_ZONES as ZonesType } from "@/lib/schemas/match-events";

interface ZoneSelectorSheetProps {
  sessionId: string;
}

export function ZoneSelectorSheet({ sessionId }: ZoneSelectorSheetProps) {
  const selectedPlayer = useSelectedPlayer();
  const selectedAction = useSelectedAction();
  const { clearSelection } = useMatchSession();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOpen = selectedAction !== null && selectedPlayer !== null;

  const handleZoneSelect = async (zone: (typeof MATCH_ZONES)[number]) => {
    if (!selectedPlayer || !selectedAction) return;

    setError(null);
    startTransition(async () => {
      try {
        const result = await submitMatchEvent({
          id: newId(),
          action: selectedAction,
          zone: zone,
          player_id: selectedPlayer.player_id,
          session_id: sessionId,
          occurred_at: new Date().toISOString(),
          captured_via: "online",
        });

        if (!result.ok) {
          setError(result.error.message);
          return;
        }

        clearSelection();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        setError(message);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => clearSelection()}
      />

      {/* Modal Content */}
      <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-xl shadow-2xl p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Selecione a zona</h2>
          <button
            onClick={() => clearSelection()}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Pitch SVG Background Info */}
        <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Meio-campo dividido em 9 zonas
        </div>

        {/* Zone Grid */}
        <div
          className="grid grid-cols-3 gap-3 mb-4"
          role="grid"
          aria-label="Selector de zonas"
        >
          {MATCH_ZONES.map((zone) => (
            <ZoneCell
              key={zone}
              zone={zone}
              onClick={handleZoneSelect}
            />
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Loading State */}
        {isPending && (
          <div className="text-center text-sm text-slate-500">
            Registando evento...
          </div>
        )}
      </div>
    </div>
  );
}
