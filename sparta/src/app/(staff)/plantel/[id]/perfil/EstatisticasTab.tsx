"use client";

import { useState, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { BarChart2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SeasonToggle } from "@/components/patterns/SeasonToggle";
import { getPlayerStatisticsTabData } from "@/lib/actions/player-profile";
import { getCurrentSeason } from "@/lib/actions/seasons";
import type { StatisticsTabData } from "@/lib/actions/player-profile";

interface EstatisticasTabProps {
  playerId: string;
  isCumulative: boolean;
}

// Named zone values as stored in match_events.zone (migration 000270)
const ZONE_ORDER = [
  "def_left", "def_center", "def_right",
  "mid_left", "mid_center", "mid_right",
  "att_left", "att_center", "att_right",
] as const;

type ZoneKey = typeof ZONE_ORDER[number];

const ZONE_LABELS: Record<ZoneKey, string> = {
  def_left: "Def. E", def_center: "Def. C", def_right: "Def. D",
  mid_left: "Meio E", mid_center: "Meio C", mid_right: "Meio D",
  att_left: "Atq. E", att_center: "Atq. C", att_right: "Atq. D",
};

function zoneColor(count: number, max: number): string {
  if (max === 0) return "bg-muted";
  const ratio = count / max;
  if (ratio >= 0.75) return "bg-signal-alert text-white";
  if (ratio >= 0.4) return "bg-signal-caution";
  if (ratio > 0) return "bg-signal-ok/40";
  return "bg-muted";
}

function per90(value: number, minutes: number): string {
  if (minutes === 0) return "—";
  return (value / (minutes / 90)).toFixed(2);
}

function formatDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), "d/MM/yy", { locale: pt });
  } catch {
    return isoDate.slice(0, 10);
  }
}

export function EstatisticasTab({ playerId, isCumulative }: EstatisticasTabProps) {
  const [data, setData] = useState<StatisticsTabData | null>(null);
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
      const result = await getPlayerStatisticsTabData(playerId, seasonId);
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
        aria-label="A carregar estatísticas..."
        className="animate-pulse rounded-lg bg-muted"
        style={{ height: 200 }}
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

  if (!data || data.rows.length === 0) {
    return (
      <>
        <SeasonToggle isCumulative={isCumulative} />
        <EmptyState
          icon={<BarChart2 className="h-8 w-8 text-muted-foreground" />}
          title="Sem jogos registados"
          description="Ainda não há eventos de performance registados para este jogador."
        />
      </>
    );
  }

  const t = data.totals;
  const heatmapCounts = ZONE_ORDER.map((z) => data.zoneHeatmap[z] ?? 0);
  const maxZoneCount = Math.max(0, ...heatmapCounts);
  const hasZoneData = heatmapCounts.some((c) => c > 0);

  return (
    <div className="space-y-6">
      <SeasonToggle isCumulative={isCumulative} />

      {/* Match stats table */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Data</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Min.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Perd.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Recup.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Rem.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Rem. Enq.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Passes</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Press. Def.</th>
              <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Ac. Of.</th>
              <th className="text-right py-2 font-semibold text-muted-foreground">Ac. Def.</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.session_id} className="border-b border-border last:border-0">
                <td className="py-2 pr-3">{formatDate(r.date)}</td>
                <td className="py-2 pr-3 text-right">{r.minutes_played}</td>
                <td className="py-2 pr-3 text-right">{r.losses}</td>
                <td className="py-2 pr-3 text-right">{r.recoveries}</td>
                <td className="py-2 pr-3 text-right">{r.shots}</td>
                <td className="py-2 pr-3 text-right">{r.shots_on_target}</td>
                <td className="py-2 pr-3 text-right">{r.passes}</td>
                <td className="py-2 pr-3 text-right">{r.defensive_pressures}</td>
                <td className="py-2 pr-3 text-right">{r.offensive_actions}</td>
                <td className="py-2 text-right">{r.defensive_actions}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="py-2 pr-3 text-muted-foreground">Total</td>
              <td className="py-2 pr-3 text-right">{t.minutes}</td>
              <td className="py-2 pr-3 text-right">{t.losses}<br /><span className="font-normal text-muted-foreground">{per90(t.losses, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.recoveries}<br /><span className="font-normal text-muted-foreground">{per90(t.recoveries, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.shots}<br /><span className="font-normal text-muted-foreground">{per90(t.shots, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.shots_on_target}<br /><span className="font-normal text-muted-foreground">{per90(t.shots_on_target, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.passes}<br /><span className="font-normal text-muted-foreground">{per90(t.passes, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.defensive_pressures}<br /><span className="font-normal text-muted-foreground">{per90(t.defensive_pressures, t.minutes)} /90</span></td>
              <td className="py-2 pr-3 text-right">{t.offensive_actions}<br /><span className="font-normal text-muted-foreground">{per90(t.offensive_actions, t.minutes)} /90</span></td>
              <td className="py-2 text-right">{t.defensive_actions}<br /><span className="font-normal text-muted-foreground">{per90(t.defensive_actions, t.minutes)} /90</span></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Zone heatmap 3×3 — uses named zone keys from match_events.zone constraint */}
      {hasZoneData && (
        <section aria-label="Mapa de zonas de acção">
          <h3 className="text-sm font-semibold mb-2">Zonas de acção</h3>
          <div
            className="grid grid-cols-3 gap-1 w-48"
            role="img"
            aria-label="Grelha 3×3 de intensidade de acções por zona"
          >
            {ZONE_ORDER.map((zone) => {
              const count = data.zoneHeatmap[zone] ?? 0;
              return (
                <div
                  key={zone}
                  className={`flex flex-col items-center justify-center h-14 rounded text-xs font-medium ${zoneColor(count, maxZoneCount)}`}
                  aria-label={`Zona ${ZONE_LABELS[zone]}: ${count} acções`}
                >
                  <span className="text-[10px] text-muted-foreground">{ZONE_LABELS[zone]}</span>
                  <span>{count > 0 ? count : ""}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
