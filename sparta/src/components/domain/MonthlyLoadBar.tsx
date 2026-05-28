"use client";

import { BarChart, Bar, ResponsiveContainer } from "recharts";
import type { MonthlyLoad } from "@/lib/actions/load";

interface MonthlyLoadBarProps {
  data: MonthlyLoad[];
  width?: number;
  height?: number;
}

export function MonthlyLoadBar({ data, width = 100, height = 32 }: MonthlyLoadBarProps) {
  if (data.length === 0) {
    return (
      <div
        role="img"
        aria-label="Carga mensal: sem dados"
        style={{ width, height }}
        className="flex items-center justify-center"
      >
        <span aria-hidden="true" className="text-muted-foreground text-xs">—</span>
      </div>
    );
  }

  const monthsSummary = data.map((d) => `${d.month}: ${d.load}`).join(", ");

  return (
    <div
      role="img"
      aria-label={`Carga mensal: ${monthsSummary}`}
      style={{ width, height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Bar
            dataKey="load"
            fill="#3B82F6"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
