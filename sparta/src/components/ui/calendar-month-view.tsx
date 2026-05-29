"use client"

import Link from "next/link"
import { useState, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Session } from "@/lib/schemas/sessions"
import { MonthGrid } from "@/components/ui/month-grid"
import { NextSevenDaysList } from "@/components/ui/next-seven-days-list"
import { isSameDay } from "date-fns"

interface CalendarMonthViewProps {
  monthSessions: Session[]
  next7Sessions: Session[]
  month: string // ISO string
  monthLabel: string
  prevMonthHref: string
  nextMonthHref: string
}

export function CalendarMonthView({
  monthSessions,
  next7Sessions,
  month,
  monthLabel,
  prevMonthHref,
  nextMonthHref,
}: CalendarMonthViewProps) {
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
      {/* Month header with navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={prevMonthHref}
          aria-label="Mês anterior"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>

        <p className="text-xs font-mono uppercase text-muted-foreground capitalize tracking-wide">
          {monthLabel}
        </p>

        <Link
          href={nextMonthHref}
          aria-label="Mês seguinte"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </Link>
      </div>

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
