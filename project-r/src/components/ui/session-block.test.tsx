import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { SessionBlock } from "./session-block"
import type { Session } from "@/lib/schemas/sessions"

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string; [key: string]: unknown }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@/hooks/useDarkMode", () => ({ useDarkMode: () => false }))

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    club_id: "club-1",
    season_id: "season-1",
    type: "training",
    scheduled_at: "2026-06-01T10:00:00.000Z",
    duration_min: 90,
    location: "Campo A",
    status: "scheduled",
    notes: null,
    created_by: "user-1",
    created_at: "2026-06-01T09:00:00.000Z",
    ...overrides,
  }
}

describe("SessionBlock", () => {
  it("aplica cor de fundo #2563EB para training", () => {
    const { container } = render(<SessionBlock session={makeSession({ type: "training" })} />)
    const link = container.querySelector("a")
    expect(link).not.toBeNull()
    expect(link).toHaveStyle({ backgroundColor: "#2563EB" })
  })

  it("aplica cor de fundo #DC2626 para match", () => {
    const { container } = render(<SessionBlock session={makeSession({ type: "match" })} />)
    const link = container.querySelector("a")
    expect(link).toHaveStyle({ backgroundColor: "#DC2626" })
  })

  it("aplica cor de fundo #CA8A04 para friendly", () => {
    const { container } = render(<SessionBlock session={makeSession({ type: "friendly" })} />)
    const link = container.querySelector("a")
    expect(link).toHaveStyle({ backgroundColor: "#CA8A04" })
  })

  it("sessão cancelada tem opacidade reduzida e label 'Cancelada'", () => {
    const { container } = render(
      <SessionBlock session={makeSession({ status: "cancelled" })} />
    )
    const link = container.querySelector("a")
    expect(link).toHaveStyle({ opacity: "0.5" })
    expect(screen.getByText("Cancelada")).toBeInTheDocument()
  })

  it("navega para /sessoes/[id]", () => {
    const { container } = render(<SessionBlock session={makeSession({ id: "sess-abc" })} />)
    const link = container.querySelector("a")
    expect(link).toHaveAttribute("href", "/sessoes/sess-abc")
  })
})
