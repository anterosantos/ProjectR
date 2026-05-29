"use client";

import { cn } from "@/lib/utils";
import { SessionHistoryBar } from "@/components/domain/readiness/session-history-bar";
import type { PlayerReadinessData, SessionHistoryEntry } from "@/types/supabase";

// ─── Age group display ────────────────────────────────────────────────────────

const AGE_GROUP_LABEL: Record<string, string> = {
  senior: "Sénior",
  u19: "Sub-19",
  u17: "Sub-17",
  u15: "Sub-15",
  u14: "Sub-14",
};

function ageGroupLabel(raw: string | null): string {
  if (!raw) return "";
  return AGE_GROUP_LABEL[raw.toLowerCase()] ?? raw;
}

// ─── Readiness badge ──────────────────────────────────────────────────────────

const BADGE_CONFIG = {
  ready:   { label: "OK",        ariaLabel: "OK",        className: "bg-signal-ready/10 text-signal-ready" },
  caution: { label: "ATENÇÃO",   ariaLabel: "Atenção",   className: "bg-signal-caution/10 text-signal-caution" },
  alert:   { label: "ALERTA",    ariaLabel: "Alerta",    className: "bg-signal-alert/10 text-signal-alert" },
  neutral: { label: "—",         ariaLabel: "Sem dados", className: "bg-muted text-muted-foreground" },
} as const satisfies Record<string, { label: string; ariaLabel: string; className: string }>;

function ReadinessBadge({ state }: { state: string }) {
  const config = BADGE_CONFIG[state as keyof typeof BADGE_CONFIG] ?? BADGE_CONFIG.neutral;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium shrink-0",
        config.className
      )}
      aria-hidden="true"
    >
      <span className="text-[10px]">●</span>
      {config.label}
    </span>
  );
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

export interface PlayerRowProps {
  snapshot: PlayerReadinessData;
  history: SessionHistoryEntry[];
  position: string;
  onSelect?: (snapshot: PlayerReadinessData) => void;
  flashed?: boolean;
}

export function PlayerRow({
  snapshot,
  history,
  position,
  onSelect,
  flashed = false,
}: PlayerRowProps) {
  const { playerName, jerseyNum, state, acwr, derived_age_group, player_id } = snapshot;

  const acwrLabel = acwr != null ? `ACWR ${acwr.toFixed(2)}` : null;
  const categoryLabel = ageGroupLabel(derived_age_group);
  const subtitle = [categoryLabel, acwrLabel].filter(Boolean).join(" · ");

  const ariaLabel = [
    playerName,
    jerseyNum != null ? `Número ${String(jerseyNum)}` : null,
    `Posição ${position}`,
    `Estado ${BADGE_CONFIG[state as keyof typeof BADGE_CONFIG]?.ariaLabel ?? state}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      className={cn(
        "w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl",
        flashed && "motion-safe:bg-primary/5 motion-safe:transition-all motion-safe:duration-200"
      )}
      aria-label={ariaLabel}
      data-player-id={player_id}
      data-flashed={flashed ? "true" : undefined}
      onClick={() => onSelect?.(snapshot)}
    >
      <div className="bg-card rounded-xl shadow-sm border border-border/50 p-4 hover:shadow-md transition-shadow">
        {/* Top row: jersey | name+subtitle | badge */}
        <div className="flex items-center gap-3">
          {/* Jersey badge */}
          <div
            className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <span className="text-lg font-bold text-muted-foreground">
              {jerseyNum != null ? jerseyNum : "—"}
            </span>
          </div>

          {/* Name + subtitle */}
          <div className="flex-1 min-w-0" aria-hidden="true">
            <p className="font-semibold text-foreground truncate">{playerName}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>

          {/* State badge */}
          <ReadinessBadge state={state} />
        </div>

        {/* History bar */}
        <SessionHistoryBar history={history} className="mt-3" />
      </div>
    </button>
  );
}
