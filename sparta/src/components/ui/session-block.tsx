"use client"

import Link from "next/link"
import { format } from "date-fns"
import { pt } from "date-fns/locale"
import type { Session } from "@/lib/schemas/sessions"
import { SESSION_TYPE_COLORS } from "@/lib/constants/session-colors"
import { useDarkMode } from "@/hooks/useDarkMode"

interface SessionBlockProps {
  session: Session
}

export function SessionBlock({ session }: SessionBlockProps) {
  const isDark = useDarkMode()
  const config = SESSION_TYPE_COLORS[session.type]
  const bgColor = isDark ? config.bgDark : config.bg
  const isCancelled = session.status === "cancelled"
  const time = format(new Date(session.scheduled_at), "HH:mm", { locale: pt })

  return (
    <Link
      href={`/sessoes/${session.id}`}
      aria-label={`${config.label}, ${time}${session.location ? `, ${session.location}` : ", sem local"}`}
      className="block w-full rounded-lg p-4 text-white transition-opacity hover:opacity-90"
      style={{ backgroundColor: bgColor, opacity: isCancelled ? 0.5 : 1 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold leading-tight">
            {config.label}
            {isCancelled && (
              <span className="ml-2 text-xs font-normal opacity-90">Cancelada</span>
            )}
          </p>
          <p className="text-xs opacity-90">
            {time} · {session.duration_min} min
          </p>
          {session.location && (
            <p className="text-xs opacity-80">{session.location}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
