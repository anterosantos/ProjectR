"use client";

import Link from "next/link";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Dumbbell, Trophy, Handshake, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  userRole?: "player" | "staff" | "analyst" | "coach";
  phase?: "pre" | "post";
  answered?: boolean;
}

export function SessionCard({
  session,
  userRole,
  phase,
  answered,
}: SessionCardProps) {
  const config = TYPE_CONFIG[session.type] ?? TYPE_CONFIG.training;
  const Icon = config.Icon;
  const isCancelled = session.status === "cancelled";
  const isAnswered = userRole === "player" && answered === true;

  const scheduledDate = new Date(session.scheduled_at);
  const formattedDate = format(scheduledDate, "dd/MM 'às' HH:mm", {
    locale: pt,
  });

  // Jogadores vão para responder questionário; staff/analistas vão para gestão
  // Phase prop permite especificar 'post' para post-session flow (AC #4, Story 4.9)
  // Se respondido, volta a /hoje em vez de abrir o questionário novamente (AC #1, Story 4.10)
  const href =
    userRole === "player"
      ? isAnswered
        ? "/hoje"
        : `/questionario/${session.id}/${phase ?? "pre"}`
      : `/sessoes/${session.id}`;

  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[44px] items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors",
        isAnswered
          ? "opacity-75 bg-muted/50"
          : "hover:bg-muted active:bg-muted"
      )}
      aria-label={`${config.label} - ${formattedDate}${isCancelled ? " (cancelada)" : ""}${isAnswered ? " (respondido)" : ""}`}
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
      {isCancelled ? (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Cancelada
        </span>
      ) : isAnswered ? (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
          Respondido
        </span>
      ) : null}
    </Link>
  );
}
