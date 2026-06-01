"use client";

import { useState, useEffect, useRef } from "react";
import { BarChart2 } from "lucide-react";
import { PlayerMetricsChart } from "@/components/ui/player-metrics-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { SeasonToggle } from "@/components/patterns/SeasonToggle";
import { getPlayerPhysicalMetricsTabData } from "@/lib/actions/player-profile";
import { getCurrentSeason } from "@/lib/actions/seasons";
import type { PlayerMetric } from "@/lib/actions/metrics";

interface MetricasFisicasTabProps {
  playerId: string;
  isCumulative: boolean;
}

export function MetricasFisicasTab({ playerId, isCumulative }: MetricasFisicasTabProps) {
  const [data, setData] = useState<PlayerMetric[] | null>(null);
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
      const result = await getPlayerPhysicalMetricsTabData(playerId, seasonId);
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
        aria-label="A carregar métricas físicas..."
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

      {!data || data.length === 0 ? (
        <EmptyState
          icon={<BarChart2 className="h-8 w-8 text-muted-foreground" />}
          title="Sem registos de métricas"
          description="Sem registos de peso ou altura ainda. Analista pode adicionar em Plantel."
        />
      ) : (
        <div role="img" aria-label="Gráfico de métricas físicas — peso e altura">
          <PlayerMetricsChart metrics={data} />
        </div>
      )}
    </div>
  );
}
