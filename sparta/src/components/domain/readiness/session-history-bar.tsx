import { cn } from "@/lib/utils";
import type { SessionHistoryEntry } from "@/types/supabase";

const SESSION_HISTORY_COUNT = 8;

const SLOT_COLOR: Record<SessionHistoryEntry['state'], string> = {
  ready:   "bg-signal-ready",
  caution: "bg-signal-caution",
  alert:   "bg-signal-alert",
  neutral: "bg-signal-neutral/60",
};

export interface SessionHistoryBarProps {
  history: SessionHistoryEntry[];
  className?: string;
}

export function SessionHistoryBar({ history, className }: SessionHistoryBarProps) {
  const slots = Array.from({ length: SESSION_HISTORY_COUNT }, (_, i) => history[i] ?? null);

  return (
    <div className={cn("flex gap-1", className)} aria-hidden="true">
      {slots.map((entry, i) => (
        <div
          key={i}
          className={cn(
            "h-2.5 flex-1 rounded-sm",
            entry ? SLOT_COLOR[entry.state] : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}
