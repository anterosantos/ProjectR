"use client";

import { useEffect, useRef, useState } from "react";
import { useMatchSession, useRecentEvents } from "@/lib/stores/match-session";
import { getRecentMatchEvents, deleteMatchEvent } from "@/lib/actions/events";
import { EventChip } from "./event-chip";

interface RecentEventsRingProps {
  sessionId: string;
}

const RING_SIZE = 6;

export function RecentEventsRing({ sessionId }: RecentEventsRingProps) {
  const recentEvents = useRecentEvents();
  const { setRecentEvents, removeRecentEvent, clearRecentEvents } =
    useMatchSession();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const prevSessionId = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    // Session boundary: limpar e re-fetch quando sessionId muda (AC#7)
    if (prevSessionId.current !== null && prevSessionId.current !== sessionId) {
      clearRecentEvents();
    }
    prevSessionId.current = sessionId;

    void getRecentMatchEvents(sessionId)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.ok) {
          setRecentEvents(result.data);
        } else {
          console.error("Failed to fetch recent events:", result.error);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error("Recent events fetch error:", err);
        }
      });

    return () => {
      controller.abort();
    };
  }, [sessionId, setRecentEvents, clearRecentEvents]);

  const handleDelete = async (id: string) => {
    // Guard: prevent concurrent deletes
    if (deletingId !== null) return;

    setDeletingId(id);
    setDeleteError(null);

    // Optimistic remove
    removeRecentEvent(id);

    const result = await deleteMatchEvent(id);

    setDeletingId(null);

    if (!result.ok) {
      // Rollback: re-fetch para restaurar estado
      const fresh = await getRecentMatchEvents(sessionId);
      if (fresh.ok) {
        setRecentEvents(fresh.data);
      }
      setDeleteError("Erro ao remover evento. Tente novamente.");
      // Auto-clear error after 4 seconds
      setTimeout(() => setDeleteError(null), 4000);
    }
  };

  const placeholderCount = Math.max(0, RING_SIZE - recentEvents.length);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Eventos recentes da sessão"
      className="flex flex-row gap-2 overflow-x-auto px-0 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800"
    >
      {recentEvents.map((entry) => (
        <EventChip
          key={entry.id}
          entry={entry}
          onDelete={handleDelete}
          isDeleting={deletingId === entry.id}
        />
      ))}

      {Array.from({ length: placeholderCount }).map((_, i) => (
        <div
          key={`placeholder-${i}`}
          role="presentation"
          className="w-16 min-h-[44px] rounded border border-dashed border-slate-300 dark:border-slate-600"
        />
      ))}

      {deleteError && (
        <span
          role="alert"
          className="text-xs text-red-600 dark:text-red-400 self-center whitespace-nowrap"
        >
          {deleteError}
        </span>
      )}
    </div>
  );
}
