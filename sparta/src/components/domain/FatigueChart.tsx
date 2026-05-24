"use client";

import { useMemo, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { TrendingDown } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { FatigueResponse, SessionInfo } from "@/lib/actions/fatigue-staff";

// Dimension config: labels (PT-PT) and signal token colors (UX-DR1)
const DIMENSIONS = [
  { key: "dim_energy",   label: "Energia",          color: "#3B82F6" }, // signal/info-ink (blue)
  { key: "dim_focus",    label: "Concentração",      color: "#A855F7" }, // purple (accent-secondary)
  { key: "dim_sleep",    label: "Sono",              color: "#22C55E" }, // signal/ready-ink (green)
  { key: "dim_soreness", label: "Dores",             color: "#EF4444" }, // signal/alert-ink (red)
  { key: "dim_mood",     label: "Estado emocional",  color: "#EAB308" }, // signal/caution-ink (yellow)
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]["key"];

export interface FatigueChartProps {
  playerId: string;
  playerName: string;
  responses: FatigueResponse[];
  sessions: Record<string, SessionInfo>;
  /** Active filter: dimension keys to display */
  activeDimensions?: DimensionKey[];
  /** Active filter: "pre" | "post" | undefined (all) */
  activePhase?: "pre" | "post" | undefined;
}

interface ChartDataPoint {
  date: string;
  dateRaw: string; // ISO for tooltip
  dim_energy: number | null;
  dim_focus: number | null;
  dim_sleep: number | null;
  dim_soreness: number | null;
  dim_mood: number | null;
  srpe_value: number | null;
  phase: string;
}

function formatDate(iso: string): string {
  try {
    const parsed = parseISO(iso);
    if (isNaN(parsed.getTime())) return "Data inválida";
    return format(parsed, "d/MM", { locale: pt });
  } catch {
    return "Data inválida";
  }
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-lg"
      role="tooltip"
    >
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) =>
        p.value !== null ? (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ) : null
      )}
    </div>
  );
}

export function FatigueChartSkeleton() {
  return (
    <div
      role="img"
      className="animate-pulse rounded-lg bg-muted"
      style={{ height: 260 }}
      aria-label="A carregar gráfico de fadiga..."
      aria-busy="true"
    />
  );
}

export function FatigueChart({
  playerName,
  responses,
  activeDimensions,
  activePhase,
}: FatigueChartProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for prefers-reduced-motion (AC #3, NFR41)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Validate activeDimensions
  const validActiveDims = activeDimensions?.filter((d) => DIMENSIONS.some((dim) => dim.key === d)) ?? DIMENSIONS.map((d) => d.key);

  // Apply phase filter
  const filtered = useMemo(() => {
    if (!activePhase) return responses;
    return responses.filter((r) => r.phase === activePhase);
  }, [responses, activePhase]);

  // Build chart data (oldest → newest for time-series left-to-right)
  const chartData = useMemo<ChartDataPoint[]>(() => {
    return [...filtered]
      .sort(
        (a, b) => {
          const aTime = new Date(a.submitted_at).getTime();
          const bTime = new Date(b.submitted_at).getTime();
          // Handle NaN by treating as epoch
          const aSafe = isNaN(aTime) ? 0 : aTime;
          const bSafe = isNaN(bTime) ? 0 : bTime;
          return aSafe - bSafe;
        }
      )
      .map((r) => ({
        date: formatDate(r.submitted_at),
        dateRaw: r.submitted_at,
        dim_energy: r.dim_energy,
        dim_focus: r.dim_focus,
        dim_sleep: r.dim_sleep,
        dim_soreness: r.dim_soreness,
        dim_mood: r.dim_mood,
        srpe_value: r.srpe_value,
        phase: r.phase,
      }));
  }, [filtered]);

  // sRPE marker positions with chart data indices
  const srpePoints = useMemo(
    () => chartData
      .map((d, idx) => ({ ...d, chartIndex: idx }))
      .filter((d) => d.srpe_value !== null),
    [chartData]
  );

  const visibleDimensions = DIMENSIONS.filter(
    (d) => !validActiveDims || validActiveDims.includes(d.key)
  );

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon={<TrendingDown className="h-8 w-8 text-muted-foreground" />}
        title="Sem respostas ainda"
        description={`O ${playerName} vai começar a registar quando responder ao primeiro questionário.`}
      />
    );
  }

  return (
    <div
      role="region"
      aria-label={`Gráfico de fadiga dos últimos 28 dias com 5 dimensões — ${playerName}`}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, className: "fill-muted-foreground" }}
            tickLine={false}
          />
          <YAxis
            domain={[0.5, 5.5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 11, className: "fill-muted-foreground" }}
            tickLine={false}
            width={24}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            iconType="plainline"
          />

          {visibleDimensions.map((dim) => (
            <Line
              key={dim.key}
              type="monotone"
              dataKey={dim.key}
              name={dim.label}
              stroke={dim.color}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              // Disable animation for prefers-reduced-motion (NFR41, AC #3)
              isAnimationActive={!prefersReducedMotion}
            />
          ))}

          {/* sRPE markers as ReferenceDots at y=1 band, positioned by chart index to avoid overlaps */}
          {srpePoints.map((point) => (
            <ReferenceDot
              key={`srpe-${point.chartIndex}`}
              x={point.chartIndex}
              y={1}
              r={4}
              fill="#6B7280"
              stroke="none"
              label={undefined}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Reduced-motion: disable chart animations via CSS */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .recharts-line-curve {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {srpePoints.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground" aria-label="Legenda sRPE">
          ● Marcador sRPE pós-sessão (escala 1–10)
        </p>
      )}
    </div>
  );
}
