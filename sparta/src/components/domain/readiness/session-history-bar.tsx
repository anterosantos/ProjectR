import { cn } from "@/lib/utils";
import type { SessionHistoryEntry } from "@/types/supabase";

const SESSION_HISTORY_COUNT = 8;

/** Classify srpe_value (1–10) into a load category for bar color */
function srpeColor(srpeValue: number): string {
  if (srpeValue <= 4) return "bg-signal-ready";    // low load — recovery/light
  if (srpeValue <= 7) return "bg-signal-caution";  // moderate load
  return "bg-signal-alert";                         // high load — intense
}

export interface SessionHistoryBarProps {
  history: SessionHistoryEntry[];
  className?: string;
}

export function SessionHistoryBar({ history, className }: SessionHistoryBarProps) {
  const slots = Array.from({ length: SESSION_HISTORY_COUNT }, (_, i) => history[i] ?? null);

  return (
    <div
      className={cn("flex items-end gap-0.5 h-6", className)}
      aria-hidden="true"
    >
      {slots.map((entry, i) => (
        entry ? (
          <div
            key={i}
            className={cn("flex-1 rounded-sm transition-all", srpeColor(entry.srpeValue))}
            style={{ height: `${Math.max(20, (entry.srpeValue / 10) * 100)}%` }}
          />
        ) : (
          <div
            key={i}
            className="flex-1 rounded-sm bg-muted"
            style={{ height: "20%" }}
          />
        )
      ))}
    </div>
  );
}
