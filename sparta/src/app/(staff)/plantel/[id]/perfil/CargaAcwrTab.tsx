"use client";

import { useState, useEffect, useRef } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { TooltipExplain } from "@/components/ui/tooltip-explain";
import { SeasonToggle } from "@/components/patterns/SeasonToggle";
import { getPlayerLoadAcwrTabData } from "@/lib/actions/player-profile";
import { getCurrentSeason } from "@/lib/actions/seasons";
import type { LoadAcwrTabData } from "@/lib/actions/player-profile";

interface CargaAcwrTabProps {
  playerId: string;
  isCumulative: boolean;
}

export function CargaAcwrTab({ playerId, isCumulative }: CargaAcwrTabProps) {
  const [data, setData] = useState<LoadAcwrTabData | null>(null);
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
      const result = await getPlayerLoadAcwrTabData(playerId, seasonId);
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
        aria-label="A carregar dados de carga e ACWR..."
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

  if (!data || data.dataPoints.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-8 w-8 text-muted-foreground" />}
        title="Sem dados de carga"
        description="Ainda não há sessões com sRPE registado para este jogador."
      />
    );
  }

  const chartData = data.dataPoints.map((d) => ({
    date: d.date,
    acwr: d.acwr,
    srpe: d.srpe_load,
  }));

  return (
    <div className="space-y-4">
      <SeasonToggle isCumulative={isCumulative} />

      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Banda segura ACWR: {data.acwrBandLo}–{data.acwrBandHi}
        </p>
        <TooltipExplain
          term="ACWR"
          definition="O ACWR compara a carga aguda (últimos 7 dias) vs. a crónica (últimos 28 dias). Valores acima de 1.5 indicam sobrecarga com risco de lesão."
          formula="ACWR = carga 7d / (carga 28d / 4)"
        />
      </div>

      <div
        role="img"
        aria-label="Gráfico de Carga e ACWR — histórico por sessão"
      >
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} />
            <YAxis
              yAxisId="acwr"
              orientation="left"
              domain={[0, 3]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              label={{ value: "ACWR", position: "insideLeft", angle: -90, dy: 20, fontSize: 10 }}
            />
            <YAxis
              yAxisId="srpe"
              orientation="right"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              label={{ value: "sRPE", position: "insideRight", angle: 90, dy: -20, fontSize: 10 }}
            />

            {/* Safe zone band — grey semi-transparent per spec */}
            <ReferenceArea
              yAxisId="acwr"
              y1={data.acwrBandLo}
              y2={data.acwrBandHi}
              fill="#94a3b8"
              fillOpacity={0.15}
            />
            <ReferenceLine yAxisId="acwr" y={data.acwrBandLo} stroke="#22c55e" strokeDasharray="4 2" strokeOpacity={0.5} />
            <ReferenceLine yAxisId="acwr" y={data.acwrBandHi} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5} />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const acwrVal = payload.find((p) => p.dataKey === "acwr")?.value;
                const srpeVal = payload.find((p) => p.dataKey === "srpe")?.value;
                const acwrStr = acwrVal != null ? `ACWR ${Number(acwrVal).toFixed(2)}` : null;
                const srpeStr = srpeVal != null ? `Carga ${srpeVal}` : null;
                const combined = [acwrStr, srpeStr].filter(Boolean).join(" | ");
                return (
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-lg" role="tooltip">
                    <p className="mb-1 font-medium">{label}</p>
                    {combined && <p>{combined}</p>}
                  </div>
                );
              }}
            />
            <Legend />

            <Bar
              yAxisId="srpe"
              dataKey="srpe"
              name="Carga sRPE"
              fill="#94a3b8"
              opacity={0.7}
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="acwr"
              type="monotone"
              dataKey="acwr"
              name="ACWR"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 3, fill: "#3b82f6" }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
