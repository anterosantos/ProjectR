"use client"

import { useState } from "react"
import { isSameDay, startOfDay } from "date-fns"
import type { Session } from "@/lib/schemas/sessions"
import { DayChipStrip } from "@/components/ui/day-chip-strip"
import { SessionBlock } from "@/components/ui/session-block"
import { NextSevenDaysList } from "@/components/ui/next-seven-days-list"
import { EmptyState } from "@/components/ui/empty-state"
import { Calendar } from "lucide-react"

interface WeekDay {
  date: string // ISO string (serialisável do server)
  sessions: Session[]
}

interface CalendarWeekViewProps {
  weekDays: WeekDay[]
  next7Sessions: Session[]
  isCoach: boolean
}

export function CalendarWeekView({ weekDays, next7Sessions }: CalendarWeekViewProps) {
  const today = startOfDay(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(today)

  const parsedWeekDays = weekDays.map((wd) => ({
    date: new Date(wd.date),
    sessions: wd.sessions,
  }))

  const daySessions = parsedWeekDays
    .find((wd) => isSameDay(wd.date, selectedDate))
    ?.sessions ?? []

  return (
    <div className="space-y-6">
      <DayChipStrip
        weekDays={parsedWeekDays}
        selectedDate={selectedDate}
        onSelectDay={setSelectedDate}
      />

      {daySessions.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
          title="Sem sessões"
          description="Não há sessões para este dia."
        />
      ) : (
        <div className="space-y-2">
          {daySessions.map((session) => (
            <SessionBlock key={session.id} session={session} />
          ))}
        </div>
      )}

      <NextSevenDaysList sessions={next7Sessions} />
    </div>
  )
}
