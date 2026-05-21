"use client"

import { useState, useRef } from "react"
import type { Session } from "@/lib/schemas/sessions"
import { MonthGrid } from "@/components/ui/month-grid"
import { NextSevenDaysList } from "@/components/ui/next-seven-days-list"
import { isSameDay } from "date-fns"

interface CalendarMonthViewProps {
  monthSessions: Session[]
  next7Sessions: Session[]
  month: string // ISO string
}

export function CalendarMonthView({ monthSessions, next7Sessions, month }: CalendarMonthViewProps) {
  const monthDate = new Date(month)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const agendaRef = useRef<HTMLDivElement>(null)

  const handleSelectDay = (date: Date) => {
    setSelectedDay(date)
    setTimeout(() => {
      agendaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  const agendaSessions =
    selectedDay != null
      ? monthSessions.filter((s) => isSameDay(new Date(s.scheduled_at), selectedDay))
      : next7Sessions

  return (
    <div className="space-y-6">
      <MonthGrid
        sessions={monthSessions}
        month={monthDate}
        onSelectDay={handleSelectDay}
      />

      <div ref={agendaRef}>
        <NextSevenDaysList sessions={agendaSessions} />
      </div>
    </div>
  )
}
