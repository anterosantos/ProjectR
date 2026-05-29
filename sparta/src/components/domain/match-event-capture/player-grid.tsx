"use client";

import { useEffect, useState } from "react";
import { PlayerButton } from "./player-button";
import { useMatchSession } from "@/lib/stores/match-session";
import { getLineupForSession } from "@/lib/actions/lineups";
import type { MatchLineupRow } from "@/lib/stores/match-session";
import type { MatchLineupWithPlayerData } from "@/lib/actions/lineups";

interface PlayerGridProps {
  sessionId: string;
}

export function PlayerGrid({ sessionId }: PlayerGridProps) {
  const [players, setPlayers] = useState<MatchLineupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setSelectedPlayer = useMatchSession((s) => s.setSelectedPlayer);

  useEffect(() => {
    async function loadPlayers() {
      try {
        setLoading(true);
        const result = await getLineupForSession(sessionId);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        // Transform the data to match MatchLineupRow type
        const transformedPlayers: MatchLineupRow[] = result.data.map((lineup) => ({
          id: lineup.id,
          session_id: lineup.session_id,
          player_id: lineup.player_id,
          name: lineup.name,
          jersey_number: lineup.jersey_number,
          position: lineup.position,
          age_group: lineup.age_group,
          processing_restricted: lineup.processing_restricted,
          role: lineup.role,
        }));
        setPlayers(transformedPlayers);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load players");
      } finally {
        setLoading(false);
      }
    }

    loadPlayers();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-slate-500">Carregando jogadores...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-red-600 dark:text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Selecione um jogador</h2>
      <div className="grid grid-cols-4 gap-4">
        {players.map((player) => (
          <PlayerButton
            key={player.id}
            player={player}
            onClick={() => setSelectedPlayer(player)}
            disabled={player.processing_restricted}
          />
        ))}
      </div>
      {players.length < 11 && (
        <div className="text-sm text-slate-500">
          {players.length} de 11 jogadores carregados
        </div>
      )}
    </div>
  );
}
