"use client";

/**
 * ReadinessPanelList — Lista de jogadores agrupados por posição.
 *
 * AC #3: 4 grupos (GR, DEF, MED, AVA) com icons
 * AC #4: PlayerRow clickable → abre DrillDownSheet (Story 5.5 placeholder)
 * AC #5: Ordenação por estado (alert→caution→ready→neutral) + ACWR DESC dentro de grupo
 */

import { useState } from "react";
import { PlayerDrillDownSheet } from "@/components/domain/readiness/player-drill-down-sheet";
import {
  PositionGroup,
  type PositionKey,
} from "@/components/domain/readiness/position-group";
import type { PlayerReadinessData, PlayerSessionHistory } from "@/types/supabase";
// P-22: usar constante partilhada (DRY — evita divergência com Server Actions)
import { READINESS_STATE_PRIORITY } from "@/lib/readiness/thresholds";

const POSITIONS: PositionKey[] = ["GR", "DEF", "MED", "AVA"];

/**
 * Maps raw position string from DB → canonical PositionKey.
 *
 * Handles both schema abbreviations (GR, DD, DC, DE, LIB, MDC, MC, MO, MD, ME, EXD, EXE, SC, PL)
 * and Portuguese text names (e.g. "guarda-redes", "defesa central").
 *
 * Abbreviations are checked first via exact match (no ordering sensitivity).
 * Text names are checked after, with P-24 preserved: "centrocampista" before "central"
 * so "centrocampista central" maps to MED, not DEF.
 */
export function getPositionKey(position: string | null): PositionKey {
  if (!position) return "MED";
  const p = position.toLowerCase().trim();

  // Schema abbreviations — exact match, order-insensitive
  if (p === "gr") return "GR";
  if (p === "dd" || p === "dc" || p === "de" || p === "lib") return "DEF";
  if (p === "mdc" || p === "mc" || p === "mo" || p === "md" || p === "me") return "MED";
  if (p === "exd" || p === "exe" || p === "sc" || p === "pl") return "AVA";

  // Text-based names and legacy compat values — P-24: MED before DEF ("centrocampista central" → MED)
  if (p.includes("guarda")) return "GR";
  if (p.includes("meio") || p === "med" || p.includes("centrocampista")) return "MED";
  if (p.includes("defesa") || p === "def" || p.includes("lateral") || p.includes("central")) return "DEF";
  if (p.includes("avançado") || p === "ava" || p.includes("ponta") || p.includes("extremo") || p.includes("ala")) return "AVA";

  return "MED"; // fallback
}

/** Sort within a position group: alert → caution → ready → neutral, then ACWR DESC (NULLs last) */

function sortGroup(players: PlayerReadinessData[]): PlayerReadinessData[] {
  return [...players].sort((a, b) => {
    // P-22: usar READINESS_STATE_PRIORITY partilhado
    const pa = READINESS_STATE_PRIORITY[a.state] ?? 5;
    const pb = READINESS_STATE_PRIORITY[b.state] ?? 5;
    if (pa !== pb) return pa - pb;
    const acwrA = a.acwr ?? -Infinity;
    const acwrB = b.acwr ?? -Infinity;
    return acwrB - acwrA;
  });
}

export interface ReadinessPanelListProps {
  players: PlayerReadinessData[];
  history: PlayerSessionHistory;
  sessionId: string;
  flashedIds?: Set<string>;
}

export function ReadinessPanelList({
  players,
  history,
  sessionId: _,
  flashedIds,
}: ReadinessPanelListProps) {
  void _;
  const [selectedPlayer, setSelectedPlayer] =
    useState<PlayerReadinessData | null>(null);

  // Group by position
  const grouped = new Map<PositionKey, PlayerReadinessData[]>(
    POSITIONS.map((pos) => [pos, []])
  );

  for (const player of players) {
    const key = getPositionKey(player.primaryPosition);
    const group = grouped.get(key);
    if (group) group.push(player);
  }

  // Sort within each group
  const sortedGroups = new Map<PositionKey, PlayerReadinessData[]>(
    POSITIONS.map((pos) => [pos, sortGroup(grouped.get(pos) ?? [])])
  );

  return (
    <>
      <div className="pb-4">
        {POSITIONS.map((pos) => {
          const group = sortedGroups.get(pos) ?? [];
          return (
            <PositionGroup
              key={pos}
              position={pos}
              players={group}
              history={history}
              onSelectPlayer={setSelectedPlayer}
              flashedIds={flashedIds}
            />
          );
        })}
      </div>

      <PlayerDrillDownSheet
        snapshot={selectedPlayer}
        open={selectedPlayer !== null}
        onClose={() => setSelectedPlayer(null)}
      />
    </>
  );
}
