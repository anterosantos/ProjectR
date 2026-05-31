"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { ZoneCell } from "./zone-cell";
import { MATCH_ZONES } from "@/lib/schemas/match-events";
import {
  useMatchSession,
  useSelectedPlayer,
  useSelectedAction,
  type RecentEventEntry,
} from "@/lib/stores/match-session";
import { submitMatchEvent } from "@/lib/actions/events";
import { newId } from "@/lib/uuid";
import { enqueueMutation } from "@/lib/outbox/enqueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const POSITIVE_ACTIONS = new Set([
  "ball_recovery",
  "shot_total",
  "shot_on_target",
  "pass_completed",
  "def_action_success",
  "off_action_success",
]);

interface ZoneSelectorSheetProps {
  sessionId: string;
}

// TODO Story 6.6+: extract helper to DRY the RecentEventEntry construction (called 3x)
function createRecentEventEntry(
  payload: ReturnType<typeof newId> extends never
    ? never
    : {
        id: string;
        action: string;
        zone: (typeof MATCH_ZONES)[number];
        player_id: string;
        session_id: string;
        occurred_at: string;
        captured_via: "online" | "offline-drain";
      },
  selectedAction: string,
  zone: (typeof MATCH_ZONES)[number],
  selectedPlayer: {
    jersey_number: number;
  }
): RecentEventEntry {
  return {
    id: payload.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: selectedAction as any,
    zone,
    jersey_number: selectedPlayer.jersey_number,
    occurred_at: payload.occurred_at,
  };
}

export function ZoneSelectorSheet({ sessionId }: ZoneSelectorSheetProps) {
  const selectedPlayer = useSelectedPlayer();
  const selectedAction = useSelectedAction();
  const { clearAction, clearSelection } = useMatchSession();
  const addRecentEvent = useMatchSession((s) => s.addRecentEvent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { isOnline } = useOnlineStatus();
  const firstCellRef = useRef<HTMLButtonElement>(null);

  const isOpen = selectedAction !== null && selectedPlayer !== null;

  // Focus first zone cell when sheet opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstCellRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const handleZoneSelect = async (zone: (typeof MATCH_ZONES)[number]) => {
    if (!selectedPlayer || !selectedAction) return;
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    const payload = {
      id: newId(),
      action: selectedAction,
      zone,
      player_id: selectedPlayer.player_id,
      session_id: sessionId,
      occurred_at: new Date().toISOString(),
      captured_via: isOnline ? ("online" as const) : ("offline-drain" as const),
    };

    try {
      if (!isOnline) {
        await enqueueMutation("match-event.submit", payload);
        if (!selectedPlayer || !selectedAction) {
          console.error("Cannot add recent event: missing player or action");
          return;
        }
        const recentEntry = createRecentEventEntry(
          payload,
          selectedAction,
          zone,
          selectedPlayer
        );
        addRecentEvent(recentEntry);
        const polarity = POSITIVE_ACTIONS.has(selectedAction)
          ? "positive"
          : "negative";
        startTransition(() => clearAction(polarity));
        return;
      }

      const result = await submitMatchEvent(payload);

      if (!result.ok) {
        await enqueueMutation("match-event.submit", {
          ...payload,
          captured_via: "offline-drain",
        });
        if (!selectedPlayer || !selectedAction) {
          console.error("Cannot add recent event: missing player or action");
          return;
        }
        const recentEntry = createRecentEventEntry(
          payload,
          selectedAction,
          zone,
          selectedPlayer
        );
        addRecentEvent(recentEntry);
        setError(
          "Erro ao registar — evento guardado para sincronização posterior."
        );
        return;
      }

      if (!selectedPlayer || !selectedAction) {
        console.error("Cannot add recent event: missing player or action");
        return;
      }
      const recentEntry = createRecentEventEntry(
        payload,
        selectedAction,
        zone,
        selectedPlayer
      );
      addRecentEvent(recentEntry);
      const polarity = POSITIVE_ACTIONS.has(selectedAction)
        ? "positive"
        : "negative";
      startTransition(() => clearAction(polarity));
    } catch (err) {
      try {
        await enqueueMutation("match-event.submit", {
          ...payload,
          captured_via: "offline-drain",
        });
        setError("Erro de rede — evento guardado para sincronização.");
      } catch {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zone-sheet-title"
    >
      {/* Overlay — blocked during submission */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isSubmitting && clearSelection()}
      />

      {/* Modal Content */}
      <div className="relative w-full bg-white dark:bg-slate-900 rounded-t-xl shadow-2xl p-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="zone-sheet-title" className="text-lg font-semibold">
            Selecione a zona
          </h2>
          <button
            onClick={() => !isSubmitting && clearSelection()}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            aria-label="Fechar seletor de zona"
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        {/* Pitch SVG */}
        <div className="mb-4 rounded-lg overflow-hidden" aria-hidden="true">
          <svg
            viewBox="0 0 300 120"
            className="w-full h-20 bg-emerald-600"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Pitch outline */}
            <rect
              x="2"
              y="2"
              width="296"
              height="116"
              fill="none"
              stroke="white"
              strokeWidth="2"
            />
            {/* Vertical dividers (left/center/right) */}
            <line
              x1="100"
              y1="2"
              x2="100"
              y2="118"
              stroke="white"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <line
              x1="200"
              y1="2"
              x2="200"
              y2="118"
              stroke="white"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            {/* Horizontal dividers (def/mid/att) */}
            <line
              x1="2"
              y1="40"
              x2="298"
              y2="40"
              stroke="white"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <line
              x1="2"
              y1="80"
              x2="298"
              y2="80"
              stroke="white"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            {/* Zone labels */}
            <text x="50" y="24" fill="white" fontSize="8" textAnchor="middle">
              Def
            </text>
            <text x="150" y="24" fill="white" fontSize="8" textAnchor="middle">
              Def
            </text>
            <text x="250" y="24" fill="white" fontSize="8" textAnchor="middle">
              Def
            </text>
            <text x="50" y="64" fill="white" fontSize="8" textAnchor="middle">
              Meio
            </text>
            <text x="150" y="64" fill="white" fontSize="8" textAnchor="middle">
              Meio
            </text>
            <text x="250" y="64" fill="white" fontSize="8" textAnchor="middle">
              Meio
            </text>
            <text x="50" y="104" fill="white" fontSize="8" textAnchor="middle">
              Atq
            </text>
            <text x="150" y="104" fill="white" fontSize="8" textAnchor="middle">
              Atq
            </text>
            <text x="250" y="104" fill="white" fontSize="8" textAnchor="middle">
              Atq
            </text>
          </svg>
        </div>

        {/* Zone Grid */}
        <div
          className="grid grid-cols-3 gap-3 mb-4"
          role="grid"
          aria-label="Selector de zonas do campo"
        >
          {MATCH_ZONES.map((zone, i) => (
            <ZoneCell
              key={zone}
              zone={zone}
              onClick={handleZoneSelect}
              disabled={isSubmitting}
              ref={i === 0 ? firstCellRef : undefined}
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
              aria-label="Fechar mensagem de erro"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Loading State */}
        {isSubmitting && (
          <div
            className="text-center text-sm text-slate-500"
            aria-live="polite"
          >
            Registando evento...
          </div>
        )}
      </div>
    </div>
  );
}
