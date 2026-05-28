"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { FatigueDimension, SparklinePoint } from "@/lib/actions/trends";

export const DIMENSION_COLORS: Record<FatigueDimension, string> = {
  dim_energy: "#3B82F6", // blue
  dim_focus: "#A855F7", // purple
  dim_sleep: "#22C55E", // green
  dim_soreness: "#EF4444", // red
  dim_mood: "#EAB308", // yellow
};

export const DIMENSION_LABELS: Record<FatigueDimension, string> = {
  dim_energy: "Energia",
  dim_focus: "Concentração",
  dim_sleep: "Sono",
  dim_soreness: "Dores Musculares",
  dim_mood: "Humor",
};

interface FatigueSparklineProps {
  data: SparklinePoint[];
  dimension: FatigueDimension;
  width?: number;
  height?: number;
}

export function FatigueSparkline({
  data,
  dimension,
  width = 80,
  height = 32,
}: FatigueSparklineProps) {
  const label = DIMENSION_LABELS[dimension];

  if (data.length === 0) {
    return (
      <div
        role="img"
        aria-label={`Tendência ${label}: sem dados`}
        style={{ width, height }}
        className="flex items-center justify-center"
      >
        <span aria-hidden="true" className="text-muted-foreground text-xs">—</span>
      </div>
    );
  }

  // Calcular trend para aria-label
  const first = data[0]?.value ?? null;
  const last = data[data.length - 1]?.value ?? null;
  const trend =
    first === null || last === null
      ? "estável"
      : last - first > 0.2
        ? "crescente"
        : last - first < -0.2
          ? "decrescente"
          : "estável";

  return (
    <div
      role="img"
      aria-label={`Tendência ${label}: ${trend}`}
      style={{ width, height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={DIMENSION_COLORS[dimension]}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
