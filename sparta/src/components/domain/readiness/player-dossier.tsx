"use client";

import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import type { PlayerDossierData } from "@/lib/actions/readiness";

// ─── ACWR ─────────────────────────────────────────────────────────────────────

const SCALE_MIN = 0.4;
const SCALE_MAX = 2.0;

const ACWR_ZONE_LABELS: Record<string, string> = {
  neutral:  "Dados insuficientes",
  ready:    "Zona óptima",
  caution:  "Zona de atenção",
  alert:    "Zona de risco",
};

const ACWR_STATE_COLOR: Record<string, string> = {
  ready:   "text-signal-ready",
  caution: "text-signal-caution",
  alert:   "text-signal-alert",
  neutral: "text-muted-foreground",
};

function AcwrBar({ lo, hi, ratio }: { lo: number; hi: number; ratio: number | null }) {
  const toPercent = (v: number) =>
    Math.min(100, Math.max(0, ((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));

  const loP  = toPercent(lo);
  const hiP  = toPercent(hi);
  const midP = toPercent((lo + hi) / 2);
  const markerP = ratio != null ? toPercent(ratio) : null;

  return (
    <div className="relative mt-2">
      {/* Gradient track */}
      <div
        className="h-2 w-full rounded-full overflow-hidden"
        style={{
          background: `linear-gradient(to right,
            var(--signal-alert) 0%,
            var(--signal-alert) ${loP}%,
            var(--signal-ready) ${loP}%,
            var(--signal-ready) ${midP}%,
            var(--signal-caution) ${midP}%,
            var(--signal-caution) ${hiP}%,
            var(--signal-alert) ${hiP}%,
            var(--signal-alert) 100%
          )`,
          opacity: 0.7,
        }}
        aria-hidden="true"
      />

      {/* Marker */}
      {markerP != null && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground border-2 border-background shadow-sm"
          style={{ left: `calc(${markerP}% - 6px)` }}
          aria-hidden="true"
        />
      )}

      {/* Scale labels */}
      <div className="flex justify-between mt-1 text-[9px] text-muted-foreground font-mono">
        <span>{SCALE_MIN}</span>
        <span>{lo}</span>
        <span>{hi}</span>
        <span>{SCALE_MAX}</span>
      </div>
    </div>
  );
}

// ─── Fatigue sparkline ────────────────────────────────────────────────────────

function FatigueSparkline({ trend }: { trend: PlayerDossierData["fatigueTrend"] }) {
  if (trend.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Sem respostas nos últimos 28 dias.</p>
    );
  }

  const W = 300;
  const H = 60;
  const PAD = 6;
  const xStep = trend.length > 1 ? (W - PAD * 2) / (trend.length - 1) : 0;

  const points = trend.map((p, i) => {
    const x = PAD + i * xStep;
    // avg is 1–5; invert so 5 (good) is at top
    const y = PAD + ((5 - p.avg) / 4) * (H - PAD * 2);
    return `${x},${y}`;
  });

  const dotColor = (avg: number) => {
    if (avg <= 2) return "var(--signal-alert)";
    if (avg <= 3) return "var(--signal-caution)";
    return "var(--signal-ready)";
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-hidden="true"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-muted-foreground/60"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {trend.map((p, i) => {
        const x = PAD + i * xStep;
        const y = PAD + ((5 - p.avg) / 4) * (H - PAD * 2);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="3"
            fill={dotColor(p.avg)}
          />
        );
      })}
    </svg>
  );
}

// ─── Questionnaire snapshot ───────────────────────────────────────────────────

const DIM_LABELS: Record<string, string> = {
  dim_energy:   "Energ.",
  dim_focus:    "Foco",
  dim_sleep:    "Sono",
  dim_soreness: "Dor",
  dim_mood:     "Ânimo",
};

function dimColor(value: number): string {
  if (value <= 2) return "bg-signal-alert/20 text-signal-alert";
  if (value === 3) return "bg-signal-caution/20 text-signal-caution";
  return "bg-signal-ready/20 text-signal-ready";
}

function QuestionnaireSnapshot({ q }: { q: NonNullable<PlayerDossierData["latestQuestionnaire"]> }) {
  const dims = [
    { key: "dim_energy",   value: q.dim_energy },
    { key: "dim_focus",    value: q.dim_focus },
    { key: "dim_sleep",    value: q.dim_sleep },
    { key: "dim_soreness", value: q.dim_soreness },
    { key: "dim_mood",     value: q.dim_mood },
  ] as const;

  const formattedDate = (() => {
    try {
      return format(parseISO(q.submittedAt), "d MMM HH:mm", { locale: pt });
    } catch {
      return q.submittedAt;
    }
  })();

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground uppercase font-mono tracking-wide">
        {formattedDate}
      </p>
      <div className="flex gap-2">
        {dims.map(({ key, value }) => (
          <div key={key} className="flex-1 flex flex-col items-center gap-1">
            <span
              className={`w-full rounded-lg py-2 text-center text-base font-bold ${dimColor(value)}`}
            >
              {value}
            </span>
            <span className="text-[9px] text-muted-foreground font-mono uppercase">
              {DIM_LABELS[key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PlayerDossierProps {
  data: PlayerDossierData;
}

export function PlayerDossier({ data }: PlayerDossierProps) {
  const {
    acwrRatio,
    acwrState,
    acwrBandLo,
    acwrBandHi,
    acuteLoad,
    chronicLoad,
    dataSufficient,
    fatigueTrend,
    latestQuestionnaire,
  } = data;

  return (
    <div className="space-y-4">
      {/* ── CARGA · ACWR ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-wide">
          Carga · ACWR
        </p>

        <div className="flex items-end gap-3">
          <span className={`text-5xl font-bold tabular-nums leading-none ${ACWR_STATE_COLOR[acwrState]}`}>
            {dataSufficient && acwrRatio != null ? acwrRatio.toFixed(2) : "—"}
          </span>
          <span className="text-sm text-muted-foreground mb-1">
            {ACWR_ZONE_LABELS[acwrState]}
          </span>
        </div>

        <AcwrBar lo={acwrBandLo} hi={acwrBandHi} ratio={dataSufficient ? acwrRatio : null} />

        {/* Acute / Chronic stats */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {Math.round(acuteLoad)}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase font-mono">
              UA Aguda · 7D
            </p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-foreground">
              {Math.round(chronicLoad)}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase font-mono">
              UA Crónica · 28D
            </p>
          </div>
        </div>
      </section>

      {/* ── FADIGA · TENDÊNCIA ───────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-wide">
          Fadiga · Últimas {fatigueTrend.length} sessões
        </p>
        <FatigueSparkline trend={fatigueTrend} />
      </section>

      {/* ── ÚLTIMO QUESTIONÁRIO ──────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-wide">
          Último questionário
        </p>
        {latestQuestionnaire ? (
          <QuestionnaireSnapshot q={latestQuestionnaire} />
        ) : (
          <p className="text-sm text-muted-foreground">Sem questionários registados.</p>
        )}
      </section>
    </div>
  );
}
