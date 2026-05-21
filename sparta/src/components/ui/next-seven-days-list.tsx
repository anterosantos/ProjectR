import Link from "next/link"
import { format, isToday } from "date-fns"
import { pt } from "date-fns/locale"
import type { Session } from "@/lib/schemas/sessions"
import { SESSION_TYPE_COLORS } from "@/lib/constants/session-colors"
import { Eyebrow } from "@/components/ui/eyebrow"

interface NextSevenDaysListProps {
  sessions: Session[]
}

export function NextSevenDaysList({ sessions }: NextSevenDaysListProps) {
  if (sessions.length === 0) return null

  return (
    <section aria-label="Próximos 7 dias">
      <div className="mb-3">
        <Eyebrow>Próximos 7 Dias</Eyebrow>
      </div>
      <ul className="space-y-2">
        {sessions.map((session) => {
          const config = SESSION_TYPE_COLORS[session.type]
          const date = new Date(session.scheduled_at)
          const time = format(date, "HH:mm", { locale: pt })
          const dateLabel = isToday(date)
            ? "Hoje"
            : format(date, "EEE, d MMM", { locale: pt })

          return (
            <li key={session.id}>
              <Link
                href={`/sessoes/${session.id}`}
                className="flex items-start gap-3 rounded-lg bg-surface p-3 border-l-4 hover:opacity-80 transition-opacity"
                style={{ borderLeftColor: config.bg }}
              >
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-semibold text-ink-1 capitalize">{config.label}</p>
                  <p className="text-xs text-ink-2">
                    {dateLabel} · {time}
                    {session.location ? ` · ${session.location}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
