"use client"

import { format, isToday, isSameDay, startOfDay } from "date-fns"
import { pt } from "date-fns/locale"
import type { Session } from "@/lib/schemas/sessions"
import { SESSION_TYPE_COLORS } from "@/lib/constants/session-colors"

interface WeekDay {
  date: Date
  sessions: Session[]
}

interface DayChipStripProps {
  weekDays: WeekDay[]
  selectedDate: Date
  onSelectDay: (date: Date) => void
}

export function DayChipStrip({ weekDays, selectedDate, onSelectDay }: DayChipStripProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Dias da semana">
      {weekDays.map(({ date, sessions: daySessions }) => {
        const isSelected = isSameDay(date, selectedDate)
        const today = isToday(date)
        const dayAbbr = format(date, "EEE", { locale: pt }).toUpperCase().slice(0, 3)
        const dayNum = format(date, "d")
        const fullDate = format(date, "EEEE, d 'de' MMMM", { locale: pt })
        const sessionCount = daySessions.length
        const firstSession = daySessions[0]
        const dotColor = firstSession ? SESSION_TYPE_COLORS[firstSession.type]?.bg : undefined

        return (
          <button
            key={startOfDay(date).toISOString()}
            onClick={() => onSelectDay(date)}
            aria-label={`${fullDate}, ${sessionCount} ${sessionCount === 1 ? "sessão" : "sessões"}`}
            aria-current={isSelected ? "true" : undefined}
            className="flex flex-col items-center gap-1 shrink-0 min-w-[40px]"
          >
            <div
              className={
                today
                  ? "flex flex-col items-center justify-center w-9 h-12 rounded-full bg-foreground text-background"
                  : "flex flex-col items-center justify-center w-9 h-12"
              }
            >
              <span className="text-[10px] font-mono leading-none">{dayAbbr}</span>
              <span className="text-sm font-semibold leading-none mt-0.5">{dayNum}</span>
            </div>
            <div className="h-2 flex items-center justify-center">
              {dotColor && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: dotColor }}
                  aria-hidden="true"
                />
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
