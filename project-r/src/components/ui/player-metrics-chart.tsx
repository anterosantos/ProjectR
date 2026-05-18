"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { BarChart2 } from "lucide-react";
import type { PlayerMetric } from "@/lib/actions/metrics";
import { EmptyState } from "@/components/ui/empty-state";

interface PlayerMetricsChartProps {
  metrics: PlayerMetric[];
  onAddReading?: () => void;
}

export function PlayerMetricsChart({
  metrics,
  onAddReading,
}: PlayerMetricsChartProps) {
  if (metrics.length === 0) {
    return (
      <EmptyState
        icon={<BarChart2 className="h-8 w-8 text-muted-foreground" />}
        title="Sem leituras ainda"
        description="Adiciona a primeira leitura de peso ou altura"
        cta={
          onAddReading
            ? { label: "Adicionar leitura", onClick: onAddReading }
            : undefined
        }
      />
    );
  }

  const chartData = metrics.map((m) => ({
    date: format(new Date(m.recorded_at), "d MMM yyyy", { locale: pt }),
    peso: m.weight_kg ?? null,
    altura: m.height_cm ?? null,
  }));

  const latestWeight = [...metrics]
    .reverse()
    .find((m) => m.weight_kg !== null)?.weight_kg;
  const latestHeight = [...metrics]
    .reverse()
    .find((m) => m.height_cm !== null)?.height_cm;

  return (
    <div className="space-y-3">
      <div className="flex gap-6 text-sm">
        {latestWeight !== undefined && (
          <div>
            <span className="text-muted-foreground">Peso actual: </span>
            <span className="font-semibold text-blue-600">
              {latestWeight} kg
            </span>
          </div>
        )}
        {latestHeight !== undefined && (
          <div>
            <span className="text-muted-foreground">Altura actual: </span>
            <span className="font-semibold text-green-600">
              {latestHeight} cm
            </span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart
          data={chartData}
          margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis
            yAxisId="peso"
            orientation="left"
            domain={["auto", "auto"]}
            tick={{ fontSize: 11 }}
            unit=" kg"
          />
          <YAxis
            yAxisId="altura"
            orientation="right"
            domain={["auto", "auto"]}
            tick={{ fontSize: 11 }}
            unit=" cm"
          />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="peso"
            type="monotone"
            dataKey="peso"
            name="Peso (kg)"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls={false}
          />
          <Line
            yAxisId="altura"
            type="monotone"
            dataKey="altura"
            name="Altura (cm)"
            stroke="#16a34a"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
