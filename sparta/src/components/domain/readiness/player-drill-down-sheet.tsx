"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { TrendingDown } from "lucide-react";
import { DrillDownSheet } from "@/components/ui/drill-down-sheet";
import { SemaforoBadge } from "@/components/ui/semaforo-badge";
import { TooltipExplain } from "@/components/ui/tooltip-explain";
import { EmptyState } from "@/components/ui/empty-state";
import { DataDrivenDecisionInput } from "@/components/domain/DataDrivenDecisionInput";
import { getPlayerDrillDownData } from "@/lib/actions/readiness";
import { logger } from "@/lib/logger";
import type { PlayerReadinessData } from "@/types/supabase";
import type { DrillDownData } from "@/lib/actions/readiness";

const DIMENSIONS = [
  { key: "dim_energy",   label: "Energia",          color: "#3B82F6" },
  { key: "dim_focus",    label: "Concentração",      color: "#A855F7" },
  { key: "dim_sleep",    label: "Sono",              color: "#22C55E" },
  { key: "dim_soreness", label: "Dores",             color: "#EF4444" },
  { key: "dim_mood",     label: "Estado emocional",  color: "#EAB308" },
] as const;

const AGE_GROUP_LABEL: Record<string, string> = {
  u14: "Sub-14",
  u15: "Sub-15",
  u17: "Sub-17",
  u19: "Sub-19",
  senior: "Sénior",
};

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "d/MM", { locale: pt });
  } catch (error) {
    logger.warn('readiness.drilldown.date_parse_failed', {
      submitted_at: iso,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return "—";
  }
}

function formatAcwr(value: number): string {
  return value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

export interface PlayerDrillDownSheetProps {
  snapshot: PlayerReadinessData | null;
  open: boolean;
  onClose: () => void;
}

export function PlayerDrillDownSheet({
  snapshot,
  open,
  onClose,
}: PlayerDrillDownSheetProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [data, setData] = useState<DrillDownData | null>(null);
  const [offline, setOffline] = useState(false);

  // Validate prop contract: if open, snapshot must be non-null
  if (open && !snapshot) {
    logger.error('readiness.drilldown.invalid_state', {
      open,
      snapshot_null: snapshot === null,
    });
  }

  // Fetch drill-down data when sheet opens
  useEffect(() => {
    if (!open || !snapshot) return;

    const controller = new AbortController();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: triggers skeleton immediately before async fetch resolves
    setStatus("loading");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears stale offline flag before each new fetch attempt
    setOffline(false);

    getPlayerDrillDownData(snapshot.player_id)
      .then((result) => {
        // Check if component is still mounted and snapshot hasn't changed
        if (controller.signal.aborted) return;
        if (result.ok) {
          setData(result.data);
          setOffline(false);
          setStatus("loaded");
        } else {
          setOffline(true);
          setStatus("error");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        logger.error('readiness.drilldown.fetch_failed', {
          player_id: snapshot.player_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        setOffline(true);
        setStatus("error");
      });

    return () => controller.abort();
  }, [open, snapshot?.player_id]);

  // Reset when sheet closes
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears stale fetch state on sheet close so next open starts clean
      setStatus("idle");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears stale data on close
      setData(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: clears offline flag on close
      setOffline(false);
    }
  }, [open]);

  const playerName = snapshot?.playerName ?? "";
  const escalaoLabel =
    snapshot?.derived_age_group != null
      ? (AGE_GROUP_LABEL[snapshot.derived_age_group] ?? snapshot.derived_age_group)
      : "—";

  const acwrDisplay =
    snapshot?.data_sufficient &&
    snapshot?.acwr != null &&
    snapshot?.acwr_band_lo != null &&
    snapshot?.acwr_band_hi != null
      ? `${formatAcwr(snapshot.acwr)} · banda ${formatAcwr(snapshot.acwr_band_lo)}–${formatAcwr(snapshot.acwr_band_hi)}`
      : null;

  // Build chart data points from fatigue responses (oldest → newest)
  const chartData =
    data?.fatigueResponses
      .slice()
      .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
      .map((r) => ({
        date: formatDate(r.submitted_at),
        dim_energy: r.dim_energy,
        dim_focus: r.dim_focus,
        dim_sleep: r.dim_sleep,
        dim_soreness: r.dim_soreness,
        dim_mood: r.dim_mood,
        srpe_value: r.srpe_value,
      })) ?? [];

  const hasSrpe = chartData.some((d) => d.srpe_value !== null);

  return (
    <DrillDownSheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      {snapshot && (
        <div className="space-y-6">
          {/* Header: close label + player info */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">{playerName}</h2>
              <p className="text-sm text-muted-foreground">
                {escalaoLabel}
                {snapshot.primaryPosition ? ` · ${snapshot.primaryPosition}` : ""}
              </p>

              {/* ACWR + banda ou tooltip sem dados */}
              {acwrDisplay != null ? (
                <p
                  className="text-sm font-medium text-foreground"
                  aria-label={`ACWR ${acwrDisplay}`}
                >
                  {acwrDisplay}
                </p>
              ) : (
                <div className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground inline-block">
                  <TooltipExplain
                    term="ACWR"
                    definition="Sem dados suficientes nos últimos 28 dias"
                  />
                </div>
              )}
            </div>

            <SemaforoBadge
              state={snapshot.state}
              size="lg"
            />
          </div>

          {/* Fatigue time series */}
          <section aria-label={`Série temporal de fadiga de ${playerName}, últimos 28 dias`}>
            <h3 className="mb-2 text-sm font-medium text-foreground">Fadiga — últimos 28 dias</h3>

            {status === "loading" && (
              <div
                className="animate-pulse rounded-lg bg-muted"
                style={{ height: 200 }}
                aria-busy="true"
                aria-label="A carregar série de fadiga..."
                role="img"
              />
            )}

            {status === "loaded" && chartData.length === 0 && (
              <EmptyState
                icon={<TrendingDown className="h-8 w-8 text-muted-foreground" />}
                title="Sem dados de fadiga"
                description="Sem dados de fadiga nos últimos 28 dias"
              />
            )}

            {status === "loaded" && chartData.length > 0 && (
              <div className="space-y-5">
                {/* sRPE — primeiro */}
                {hasSrpe && (
                  <div role="img" aria-label="sRPE pós-sessão">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-500 flex-shrink-0" aria-hidden="true" />
                      <span className="text-xs font-medium text-foreground">sRPE pós-sessão</span>
                    </div>
                    <ResponsiveContainer width="100%" height={110}>
                      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} />
                        <YAxis domain={[0, 11]} ticks={[1, 5, 10]} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} width={18} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="srpe_value" name="sRPE" stroke="#6B7280" strokeWidth={2} dot={{ r: 2, fill: "#6B7280" }} connectNulls={true} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Um gráfico por dimensão */}
                {DIMENSIONS.map((dim) => (
                  <div key={dim.key} role="img" aria-label={dim.label}>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: dim.color }} aria-hidden="true" />
                      <span className="text-xs font-medium text-foreground">{dim.label}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={110}>
                      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} />
                        <YAxis domain={[0.5, 5.5]} ticks={[1, 3, 5]} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} width={18} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey={dim.key} name={dim.label} stroke={dim.color} strokeWidth={2} dot={{ r: 2, fill: dim.color }} connectNulls={true} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}

                {/* Barras acumuladas */}
                <div role="img" aria-label="Acumulado por sessão">
                  <div className="mb-1">
                    <span className="text-xs font-medium text-foreground">Acumulado por sessão</span>
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} width={18} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} iconType="square" />
                      {DIMENSIONS.map((dim) => (
                        <Bar key={dim.key} dataKey={dim.key} name={dim.label} stackId="a" fill={dim.color} isAnimationActive={false} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {status === "error" && offline && (
              <p className="text-xs text-muted-foreground">
                Série temporal indisponível offline
              </p>
            )}

            {status === "error" && !offline && (
              <p className="text-xs text-destructive">
                Erro ao carregar série de fadiga
              </p>
            )}
          </section>

          {/* Fatigue survey responses */}
          {status === "loaded" && data != null && (
            <section>
              <h3 className="mb-1 text-sm font-medium text-foreground">Respostas de Fadiga</h3>
              {data.attendanceDenominator === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sem sessões agendadas neste período
                </p>
              ) : (
                <p
                  className="text-sm text-muted-foreground"
                  aria-label={`${data.attendanceNumerator} de ${data.attendanceDenominator} sessões nos últimos 28 dias`}
                >
                  {data.attendanceNumerator}/{data.attendanceDenominator} sessões
                </p>
              )}
            </section>
          )}

          {/* Decisão data-driven — Story 5.10 */}
          {snapshot.player_id && (
            <section aria-label="Decisão data-driven">
              <h3 className="mb-2 text-sm font-medium text-foreground">Decisão Data-Driven</h3>
              <DataDrivenDecisionInput
                playerId={snapshot.player_id}
                sessionId={snapshot.session_id}
              />
            </section>
          )}
        </div>
      )}
    </DrillDownSheet>
  );
}
