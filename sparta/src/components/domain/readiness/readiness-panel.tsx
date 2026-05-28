"use client";

/**
 * ReadinessPanel — Componente wrapper para o Painel de Prontidão.
 *
 * AC #1: Subscreve Realtime `postgres_changes` dentro da janela 4h pré-sessão
 * AC #2: Flash 200ms ease-out via motion-safe: quando evento Realtime chega
 * AC #3: Botão "Atualizar" manual fora da janela 4h
 *
 * P-12: sessionStorage lido em useEffect (após hydration) para evitar mismatch SSR↔client.
 * P-13: sessionStorage.setItem envolvido em try/catch (falha em private browsing).
 */

import { useState, useEffect, useRef, startTransition } from "react";
import { ReadinessPanelHeader } from "@/components/domain/readiness/readiness-panel-header";
import { ReadinessPanelList } from "@/components/domain/readiness/readiness-panel-list";
import { ReadinessPanelFormation } from "@/components/domain/readiness/readiness-panel-formation";
import { createClient } from "@/lib/supabase/client";
import { isInPreSessionWindow } from "@/lib/readiness/realtime-window";
import { getReadinessPanelData } from "@/lib/actions/readiness";
import type { PlayerReadinessData } from "@/types/supabase";

const SESSION_STORAGE_KEY = "readiness-panel-view";

export interface ReadinessPanelProps {
  players: PlayerReadinessData[];
  sessionId: string;
  scheduledAt?: string;
  view?: "list" | "formation";
}

export function ReadinessPanel({
  players: initialPlayers,
  sessionId,
  scheduledAt,
  view: initialView = "list",
}: ReadinessPanelProps) {
  // P-12: Inicializar com a prop (server-safe) e sincronizar de sessionStorage após hydration.
  const [view, setView] = useState<"list" | "formation">(initialView);
  const [players, setPlayers] = useState<PlayerReadinessData[]>(initialPlayers);
  const [flashedIds, setFlashedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inWindow, setInWindow] = useState(() =>
    scheduledAt ? isInPreSessionWindow(scheduledAt) : false
  );
  const flashTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const refreshInProgressRef = useRef(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored === "list" || stored === "formation") {
        startTransition(() => { setView(stored); });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        console.warn("sessionStorage quota exceeded:", error);
      } else if (error instanceof DOMException && error.name === "SecurityError") {
        console.warn("sessionStorage unavailable (private browsing):", error);
      } else {
        console.warn("Unexpected error reading sessionStorage:", error);
      }
    }
  }, []);

  // Re-verifica janela a cada 60s para transição automática
  useEffect(() => {
    if (!scheduledAt) return;
    const id = setInterval(() => {
      setInWindow(isInPreSessionWindow(scheduledAt));
    }, 60_000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  // Subscrição Realtime — apenas dentro da janela 4h pré-sessão (AC #1, NFR34)
  const inWindowRef = useRef(inWindow);
  useEffect(() => {
    inWindowRef.current = inWindow;
  }, [inWindow]);

  useEffect(() => {
    if (!inWindow) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`readiness-snapshots-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "readiness_snapshots",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          // TR-003: Guard callback with ref check to prevent stale updates after inWindow=false
          if (!inWindowRef.current) return;

          const updatedPlayerId =
            (payload.new as { player_id?: string })?.player_id ??
            (payload.old as { player_id?: string })?.player_id;

          try {
            const result = await getReadinessPanelData(sessionId);
            if (result.ok) {
              setPlayers(result.data.players);
              if (updatedPlayerId) {
                setFlashedIds((prev) => new Set(prev).add(updatedPlayerId));

                // Clear any existing timeout for this player to avoid race conditions
                const existingTimeout = flashTimeoutsRef.current.get(updatedPlayerId);
                if (existingTimeout) clearTimeout(existingTimeout);

                const timeoutId = setTimeout(() => {
                  setFlashedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(updatedPlayerId);
                    return next;
                  });
                  flashTimeoutsRef.current.delete(updatedPlayerId);
                }, 600);

                flashTimeoutsRef.current.set(updatedPlayerId, timeoutId);
              }
            }
          } catch (error) {
            console.error("Failed to update readiness panel after Realtime event:", error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch((error) => {
        console.error("Failed to remove Realtime channel:", error);
      });
      // TR-002: Clean up all pending flash timeouts on unmount
      flashTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      flashTimeoutsRef.current.clear();
    };
  }, [sessionId, inWindow]);

  const handleManualRefresh = async () => {
    // TR-001: Debounce concurrent refresh requests
    if (refreshInProgressRef.current) return;

    refreshInProgressRef.current = true;
    setIsRefreshing(true);
    try {
      const result = await getReadinessPanelData(sessionId);
      if (result.ok) {
        setPlayers(result.data.players);
      } else {
        console.error("Failed to refresh readiness panel data:", result);
      }
    } catch (error) {
      console.error("Error refreshing readiness panel:", error);
    } finally {
      refreshInProgressRef.current = false;
      setIsRefreshing(false);
    }
  };

  // P-13: try/catch para sessionStorage.setItem (falha em private browsing)
  const handleViewChange = (v: "list" | "formation") => {
    setView(v);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, v);
    } catch {
      // Silently fail — view state já actualizado em memória
    }
  };

  // Aggregate counts — neutros excluídos (FR34, UX-DR12) — usa players state
  const readyCount = players.filter((p) => p.state === "ready").length;
  const cautionCount = players.filter((p) => p.state === "caution").length;
  const alertCount = players.filter((p) => p.state === "alert").length;

  return (
    <div className="flex flex-col min-h-0">
      <ReadinessPanelHeader
        readyCount={readyCount}
        cautionCount={cautionCount}
        alertCount={alertCount}
        view={view}
        onViewChange={handleViewChange}
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        inWindow={inWindow}
      />

      {view === "list" ? (
        <ReadinessPanelList players={players} sessionId={sessionId} flashedIds={flashedIds} />
      ) : (
        <ReadinessPanelFormation players={players} sessionId={sessionId} flashedIds={flashedIds} />
      )}
    </div>
  );
}
