import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { NextSevenDaysList } from "./next-seven-days-list"
import type { Session } from "@/lib/schemas/sessions"

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string; [key: string]: unknown }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const TODAY = new Date("2026-06-01T00:00:00.000Z")
vi.setSystemTime(TODAY)

function makeSession(scheduledAt: string, id = "sess-1"): Session {
  return {
    id,
    club_id: "club-1",
    season_id: "season-1",
    type: "training",
    scheduled_at: scheduledAt,
    duration_min: 90,
    location: null,
    status: "scheduled",
    notes: null,
    created_by: "user-1",
    created_at: "2026-06-01T08:00:00.000Z",
  }
}

describe("NextSevenDaysList", () => {
  it("mostra sessão de hoje com o label 'Hoje'", () => {
    const sessions = [makeSession("2026-06-01T10:00:00.000Z")]
    render(<NextSevenDaysList sessions={sessions} />)
    expect(screen.getByText(/Hoje/)).toBeInTheDocument()
  })

  it("não mostra label 'Hoje' para sessões de outro dia", () => {
    const sessions = [makeSession("2026-06-03T10:00:00.000Z")]
    render(<NextSevenDaysList sessions={sessions} />)
    expect(screen.queryByText(/Hoje/)).toBeNull()
  })

  it("renderiza lista vazia sem erros", () => {
    const { container } = render(<NextSevenDaysList sessions={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it("renderiza header 'Próximos 7 Dias'", () => {
    const sessions = [makeSession("2026-06-01T10:00:00.000Z")]
    render(<NextSevenDaysList sessions={sessions} />)
    expect(screen.getByText(/Próximos 7 Dias/i)).toBeInTheDocument()
  })

  it("cada sessão tem link para /sessoes/[id]", () => {
    const sessions = [makeSession("2026-06-01T10:00:00.000Z", "abc-123")]
    render(<NextSevenDaysList sessions={sessions} />)
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", "/sessoes/abc-123")
  })
})
