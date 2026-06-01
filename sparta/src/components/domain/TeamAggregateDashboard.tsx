"use client";

import { useState, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { FileText, TrendingUp } from "lucide-react";
import Link from "next/link";
import { CalmConfirmation } from "@/components/ui/calm-confirmation";
import { TooltipExplain } from "@/components/ui/tooltip-explain";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamAggregateFiltersSheet, DEFAULT_FILTERS } from "@/components/domain/TeamAggregateFiltersSheet";
import type { TeamAggregateFilters } from "@/components/domain/TeamAggregateFiltersSheet";
import type {
  TeamAggregateData,
  TopPlayerItem,
  MatchEventsPoint,
} from "@/lib/actions/team-aggregate";

interface TeamAggregateDashboardProps {
  data: TeamAggregateData;
}

function TopPlayerCard({
  player,
  valueLabel,
}: {
  player: TopPlayerItem;
  valueLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1">
      <p className="text-sm font-semibold text-foreground truncate">
        {player.playerName}
      </p>
      <p className="text-xs text-muted-foreground">
        {player.position} · {player.ageGroup}
      </p>
      <p className="text-lg font-bold text-primary">
        {player.value.toLocaleString("pt-PT")}
      </p>
      <p className="text-xs text-muted-foreground">{valueLabel}</p>
    </div>
  );
}

export function TeamAggregateDashboard({ data }: TeamAggregateDashboardProps) {
  const [filters, setFilters] = useState<TeamAggregateFilters>(DEFAULT_FILTERS);
  const [showPdfComingSoon, setShowPdfComingSoon] = useState(false);

  const handleFilter = useCallback((newFilters: TeamAggregateFilters) => {
    setFilters(newFilters);
  }, []);

  // Filtrar top-3 por ageGroup (client-side)
  const filteredTopLoaded: TopPlayerItem[] =
    filters.ageGroup === "all"
      ? data.topLoaded
      : data.topLoaded.filter((p) => p.ageGroup === filters.ageGroup);

  const filteredTopFatigued: TopPlayerItem[] =
    filters.ageGroup === "all"
      ? data.topFatigued
      : data.topFatigued.filter((p) => p.ageGroup === filters.ageGroup);

  // Filtrar eventos por competição
  const filteredEvents: MatchEventsPoint[] =
    filters.competition === "all"
      ? data.eventsPerMatch
      : data.eventsPerMatch.filter((e) => e.sessionType === filters.competition);

  const hasAgeGroupFilter = filters.ageGroup !== "all";

  return (
    <div className="space-y-6">
      {/* Barra de controles */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {data.currentSeason && (
            <span className="text-sm text-muted-foreground border border-border rounded-full px-3 py-1">
              {data.currentSeason.name}
            </span>
          )}
          <TeamAggregateFiltersSheet
            onFilter={handleFilter}
            initialFilters={DEFAULT_FILTERS}
          />
        </div>

        {data.userRole === "coach" && (
          <div>
            <button
              type="button"
              onClick={() => setShowPdfComingSoon(true)}
              aria-label="Exportar PDF (disponível em breve)"
              aria-disabled="true"
              disabled
              className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-muted-foreground opacity-60 cursor-not-allowed"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Exportar PDF
            </button>
            {showPdfComingSoon && (
              <CalmConfirmation
                message="Exportação PDF disponível em breve (Story 7.6)."
                onDismiss={() => setShowPdfComingSoon(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Aviso filtro por grupo etário (MVP) */}
      {hasAgeGroupFilter && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Filtro por grupo etário aplicado — gráficos de fadiga e presenças mostram dados
          pré-calculados para todo o plantel. Para análise por grupo, ver{" "}
          <Link href="/tendencias/fadiga" className="underline underline-offset-2">
            Tendências
          </Link>
          .
        </div>
      )}

      {/* Gráficos de linha — fadiga e presença */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Fadiga média semanal */}
        <section aria-labelledby="chart-fatigue-heading">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2
              id="chart-fatigue-heading"
              className="text-sm font-semibold text-foreground flex items-center gap-1"
            >
              <TooltipExplain
                term="Fadiga média"
                definition="Média das 5 dimensões de fadiga (energia, foco, sono, dores, humor) de todos os jogadores nas últimas 4 semanas."
                formula="avg(dim_energy + dim_focus + dim_sleep + dim_soreness + dim_mood) / 5"
              />
            </h2>
            {data.weeklyFatigue.every((pt) => pt.avgFatigue === 0) ? (
              <EmptyState
                icon={<TrendingUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
                title="Sem dados de fadiga"
                description="Nenhuma resposta de fadiga nas últimas 4 semanas."
              />
            ) : (
              <div
                aria-label="Gráfico de fadiga média semanal"
                className="h-56"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weeklyFatigue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value) =>
                        typeof value === "number"
                          ? value.toLocaleString("pt-PT")
                          : String(value)
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avgFatigue"
                      name="Fadiga média"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {/* Taxa de presença semanal */}
        <section aria-labelledby="chart-attendance-heading">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2
              id="chart-attendance-heading"
              className="text-sm font-semibold text-foreground flex items-center gap-1"
            >
              <TooltipExplain
                term="Taxa de presença"
                definition="Percentagem de jogadores presentes ou com atraso por semana (present + late) relativamente ao total de registos."
                formula="(present + late) / total × 100"
              />
            </h2>
            {data.weeklyAttendance.every((pt) => pt.total === 0) ? (
              <EmptyState
                icon={<TrendingUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
                title="Sem dados de presença"
                description="Nenhuma presença registada nas últimas 4 semanas."
              />
            ) : (
              <div
                aria-label="Gráfico de taxa de presença semanal"
                className="h-56"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.weeklyAttendance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                    <Tooltip
                      formatter={(value) =>
                        typeof value === "number"
                          ? `${value.toLocaleString("pt-PT")}%`
                          : String(value)
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="attendanceRate"
                      name="Taxa de presença"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top 3 mais carregados */}
        <section aria-labelledby="top-loaded-heading">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2
                id="top-loaded-heading"
                className="text-sm font-semibold text-foreground"
              >
                Top 3 Mais Carregados
              </h2>
              <Link
                href="/tendencias/carga"
                className="text-xs text-primary underline underline-offset-2"
                aria-label="Ver carga acumulada de todos os jogadores em Tendências"
              >
                Ver carga acumulada
              </Link>
            </div>
            {filteredTopLoaded.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sem dados de carga{hasAgeGroupFilter ? " para este grupo etário" : ""}.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {filteredTopLoaded.map((player) => (
                  <TopPlayerCard
                    key={player.playerId}
                    player={player}
                    valueLabel="sRPE acumulado"
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Top 3 mais fatigados */}
        <section aria-labelledby="top-fatigued-heading">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2
              id="top-fatigued-heading"
              className="text-sm font-semibold text-foreground"
            >
              Top 3 Mais Fatigados
            </h2>
            {filteredTopFatigued.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sem dados de fadiga{hasAgeGroupFilter ? " para este grupo etário" : ""}.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {filteredTopFatigued.map((player) => (
                  <TopPlayerCard
                    key={player.playerId}
                    player={player}
                    valueLabel="fadiga média (1–10)"
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Eventos por jogo */}
      <section aria-labelledby="chart-events-heading">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2
            id="chart-events-heading"
            className="text-sm font-semibold text-foreground"
          >
            Eventos por Jogo / Amigável
          </h2>
          {filteredEvents.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
              title="Sem dados de eventos"
              description="Nenhum evento de jogo ou amigável registado."
            />
          ) : (
            <div
              aria-label="Gráfico de eventos por jogo"
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredEvents}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="sessionDate"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)} // MM-DD
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number"
                        ? value.toLocaleString("pt-PT")
                        : String(value)
                    }
                    labelFormatter={(label) => `Data: ${String(label)}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="eventCount"
                    name="Eventos"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
