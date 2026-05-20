"use client"

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  startOfDay,
  format,
} from "date-fns"
import { pt } from "date-fns/locale"
import type { Session } from "@/lib/schemas/sessions"
import { SESSION_TYPE_COLORS } from "@/lib/constants/session-colors"

const DAY_HEADERS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]

interface MonthGridProps {
  sessions: Session[]
  month: Date
  onSelectDay: (date: Date) => void
}

function buildCalendarDays(month: Date): Date[] {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days: Date[] = []
  let current = calStart
  while (current <= calEnd) {
    days.push(current)
    current = addDays(current, 1)
  }
  return days
}

export function MonthGrid({ sessions, month, onSelectDay }: MonthGridProps) {
  const days = buildCalendarDays(month)

  const sessionsByDay = new Map<string, Session[]>()
  for (const session of sessions) {
    const key = startOfDay(new Date(session.scheduled_at)).toISOString()
    const existing = sessionsByDay.get(key) ?? []
    existing.push(session)
    sessionsByDay.set(key, existing)
  }

  return (
    <div role="grid" aria-label={format(month, "MMMM yyyy", { locale: pt })}>
      {/* Header */}
      <div role="row" className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="text-center font-mono text-[9px] uppercase text-ink-3 py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = startOfDay(day).toISOString()
          const daySessions = sessionsByDay.get(key) ?? []
          const isCurrentMonth = isSameMonth(day, month)
          const today = isToday(day)
          const dayNum = format(day, "d")
          const visibleSessions = daySessions.slice(0, 3)
          const extraCount = daySessions.length - 3

          return (
            <button
              key={key}
              role="gridcell"
              onClick={() => onSelectDay(day)}
              aria-label={`${format(day, "d 'de' MMMM", { locale: pt })}, ${daySessions.length} ${daySessions.length === 1 ? "sessão" : "sessões"}`}
              className={[
                "flex flex-col items-center py-1.5 px-0.5 min-h-[52px] rounded transition-colors hover:bg-surface",
                !isCurrentMonth && "opacity-30",
                today && "ring-1 ring-foreground ring-inset",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="text-xs font-medium leading-none mb-1">{dayNum}</span>
              <div className="flex flex-wrap gap-0.5 justify-center">
                {visibleSessions.map((s) => {
                  const color = SESSION_TYPE_COLORS[s.type]?.bg
                  return (
                    <span
                      key={s.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                  )
                })}
                {extraCount > 0 && (
                  <span className="text-[9px] text-ink-3 leading-none">+{extraCount}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
