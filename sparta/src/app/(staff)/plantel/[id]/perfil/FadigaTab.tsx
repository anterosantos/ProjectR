"use client";

import { useState, useEffect, useRef } from "react";
import { TrendingDown } from "lucide-react";
import { FatigueChart } from "@/components/domain/FatigueChart";
import { EmptyState } from "@/components/ui/empty-state";
import { SeasonToggle } from "@/components/patterns/SeasonToggle";
import { getPlayerFatigueTabData } from "@/lib/actions/player-profile";
import { getCurrentSeason } from "@/lib/actions/seasons";
import type { FatigueTabData } from "@/lib/actions/player-profile";

interface FadigaTabProps {
  playerId: string;
  isCumulative: boolean;
}

export function FadigaTab({ playerId, isCumulative }: FadigaTabProps) {
  const [data, setData] = useState<FatigueTabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null);
  const seasonFetchedRef = useRef(false);

  useEffect(() => {
    if (seasonFetchedRef.current) return;
    seasonFetchedRef.current = true;
    getCurrentSeason()
      .then((result) => {
        if (result.ok && result.data) setCurrentSeasonId(result.data.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      const seasonId = isCumulative ? null : currentSeasonId;
      const result = await getPlayerFatigueTabData(playerId, seasonId);
      if (controller.signal.aborted) return;
      if (result.ok) {
        setData(result.data);
      } else {
        setError(result.error.message);
      }
      setLoading(false);
    }
    void load();

    return () => controller.abort();
  }, [playerId, isCumulative, currentSeasonId]);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="A carregar dados de fadiga..."
        className="animate-pulse rounded-lg bg-muted"
        style={{ height: 260 }}
      />
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SeasonToggle isCumulative={isCumulative} />

      {data && data.responses.length === 0 ? (
        <EmptyState
          icon={<TrendingDown className="h-8 w-8 text-muted-foreground" />}
          title="Sem respostas de fadiga"
          description="O jogador ainda não respondeu a nenhum questionário."
        />
      ) : (
        data && (
          <FatigueChart
            playerId={playerId}
            playerName={data.playerName}
            responses={data.responses}
            sessions={data.sessions}
          />
        )
      )}
    </div>
  );
}
