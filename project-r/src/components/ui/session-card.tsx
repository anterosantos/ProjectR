"use client";

import Link from "next/link";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Dumbbell, Trophy, Handshake } from "lucide-react";
import type { Session, SessionType } from "@/lib/schemas/sessions";

const TYPE_CONFIG: Record<
  SessionType,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  training: { label: "Treino", Icon: Dumbbell },
  match: { label: "Jogo", Icon: Trophy },
  friendly: { label: "Jogo amigável", Icon: Handshake },
};

interface SessionCardProps {
  session: Session;
}

export function SessionCard({ session }: SessionCardProps) {
  const config = TYPE_CONFIG[session.type] ?? TYPE_CONFIG.training;
  const Icon = config.Icon;
  const isCancelled = session.status === "cancelled";

  const scheduledDate = new Date(session.scheduled_at);
  const formattedDate = format(scheduledDate, "dd/MM 'às' HH:mm", {
    locale: pt,
  });

  return (
    <Link
      href={`/sessoes/${session.id}`}
      className="flex min-h-[44px] items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:bg-muted active:bg-muted"
      aria-label={`${config.label} - ${formattedDate}${isCancelled ? " (cancelada)" : ""}`}
    >
      <Icon
        className={`h-5 w-5 shrink-0 ${isCancelled ? "text-muted-foreground" : "text-foreground"}`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`text-sm font-medium ${isCancelled ? "line-through text-muted-foreground" : "text-foreground"}`}
        >
          {formattedDate} — {config.label}
        </span>
        {session.location && (
          <span className="truncate text-xs text-muted-foreground">
            {session.location}
          </span>
        )}
      </div>
      {isCancelled && (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Cancelada
        </span>
      )}
    </Link>
  );
}
