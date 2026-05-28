"use client";

/**
 * ReadinessPanel — Componente wrapper para o Painel de Prontidão.
 *
 * AC #1: Client Component para gerir view state (lista/formação) em sessionStorage
 * AC #2: Calcula contagens de ready/caution/alert (neutros excluídos — UX-DR12)
 *
 * P-12: sessionStorage lido em useEffect (após hydration) para evitar mismatch SSR↔client.
 * P-13: sessionStorage.setItem envolvido em try/catch (falha em private browsing).
 */

import { useState, useEffect, startTransition } from "react";
import { ReadinessPanelHeader } from "@/components/domain/readiness/readiness-panel-header";
import { ReadinessPanelList } from "@/components/domain/readiness/readiness-panel-list";
import { ReadinessPanelFormation } from "@/components/domain/readiness/readiness-panel-formation";
import type { PlayerReadinessData } from "@/types/supabase";

const SESSION_STORAGE_KEY = "readiness-panel-view";

export interface ReadinessPanelProps {
  players: PlayerReadinessData[];
  sessionId: string;
  view?: "list" | "formation";
}

export function ReadinessPanel({
  players,
  sessionId,
  view: initialView = "list",
}: ReadinessPanelProps) {
  // P-12: Inicializar com a prop (server-safe) e sincronizar de sessionStorage após hydration.
  // Evita hydration mismatch Next.js 15 quando utilizador tem "formation" guardado.
  const [view, setView] = useState<"list" | "formation">(initialView);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored === "list" || stored === "formation") {
        // startTransition: chama setView numa callback (evita react-hooks/set-state-in-effect)
        // e marca a actualização como não-urgente (non-blocking hydration sync)
        startTransition(() => { setView(stored); });
      }
    } catch {
      // sessionStorage indisponível (private browsing, quota excedida)
    }
  }, []);

  // P-13: try/catch para sessionStorage.setItem (falha em private browsing)
  const handleViewChange = (v: "list" | "formation") => {
    setView(v);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, v);
    } catch {
      // Silently fail — view state já actualizado em memória
    }
  };

  // Aggregate counts — neutros excluídos (FR34, UX-DR12)
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
      />

      {view === "list" ? (
        <ReadinessPanelList players={players} sessionId={sessionId} />
      ) : (
        <ReadinessPanelFormation players={players} sessionId={sessionId} />
      )}
    </div>
  );
}
