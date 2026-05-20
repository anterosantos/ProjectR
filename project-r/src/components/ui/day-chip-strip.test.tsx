import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { DayChipStrip } from "./day-chip-strip"
import { addDays } from "date-fns"

const TODAY = new Date("2026-06-01T00:00:00.000Z")

vi.setSystemTime(TODAY)

function makeWeekDays() {
  return Array.from({ length: 7 }, (_, i) => ({
    date: addDays(TODAY, i),
    sessions: [],
  }))
}

describe("DayChipStrip", () => {
  it("renderiza sempre 7 chips", () => {
    const weekDays = makeWeekDays()
    render(
      <DayChipStrip
        weekDays={weekDays}
        selectedDate={TODAY}
        onSelectDay={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(7)
  })

  it("chip do dia actual tem aria-current='true'", () => {
    const weekDays = makeWeekDays()
    const selectedDate = weekDays[0]!.date
    render(
      <DayChipStrip
        weekDays={weekDays}
        selectedDate={selectedDate}
        onSelectDay={vi.fn()}
      />
    )
    const selected = screen.getAllByRole("button").find(
      (btn) => btn.getAttribute("aria-current") === "true"
    )
    expect(selected).toBeDefined()
  })

  it("chip não seleccionado não tem aria-current", () => {
    const weekDays = makeWeekDays()
    const selected = weekDays[0]!.date
    render(
      <DayChipStrip
        weekDays={weekDays}
        selectedDate={selected}
        onSelectDay={vi.fn()}
      />
    )
    const buttons = screen.getAllByRole("button")
    const nonSelected = buttons.slice(1)
    nonSelected.forEach((btn) => {
      expect(btn.getAttribute("aria-current")).toBeNull()
    })
  })
})
