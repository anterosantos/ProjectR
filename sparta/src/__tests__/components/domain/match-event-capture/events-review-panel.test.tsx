import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventsReviewPanel } from '@/app/(staff)/sessoes/[id]/eventos/events-review-panel'
import type { SessionEventEntry } from '@/lib/schemas/match-events'

vi.mock('@/lib/actions/events', () => ({
  updateMatchEvent: vi.fn().mockResolvedValue({ ok: true }),
  deleteMatchEvent: vi.fn().mockResolvedValue({ ok: true }),
}))

const mockEvents: SessionEventEntry[] = [
  {
    id: 'event-1',
    action: 'ball_loss',
    zone: 'def_left',
    player_id: 'player-1',
    player_name: 'João Silva',
    jersey_number: 10,
    occurred_at: '2026-05-31T14:00:00Z',
    captured_via: 'online',
  },
  {
    id: 'event-2',
    action: 'ball_recovery',
    zone: 'mid_center',
    player_id: 'player-2',
    player_name: 'Pedro Oliveira',
    jersey_number: 5,
    occurred_at: '2026-05-31T14:05:00Z',
    captured_via: 'online',
  },
]

describe('<EventsReviewPanel>', () => {
  it('renderiza estado vazio quando events=[]', () => {
    render(
      <EventsReviewPanel
        events={[]}
        sessionId="session-1"
        isWithinEditWindow={true}
      />
    )

    expect(screen.getByText(/Sem eventos registados/i)).toBeInTheDocument()
  })

  it('botões Editar/Apagar activos quando isWithinEditWindow=true', () => {
    render(
      <EventsReviewPanel
        events={mockEvents}
        sessionId="session-1"
        isWithinEditWindow={true}
      />
    )

    const editButtons = screen.getAllByRole('button', { name: /Editar evento/i })
    const deleteButtons = screen.getAllByRole('button', { name: /Apagar evento/i })

    expect(editButtons.length).toBeGreaterThan(0)
    expect(deleteButtons.length).toBeGreaterThan(0)
    editButtons.forEach((btn) => expect(btn).not.toBeDisabled())
    deleteButtons.forEach((btn) => expect(btn).not.toBeDisabled())
  })

  it('botões Editar/Apagar desactivados quando isWithinEditWindow=false', () => {
    render(
      <EventsReviewPanel
        events={mockEvents}
        sessionId="session-1"
        isWithinEditWindow={false}
      />
    )

    const editButtons = screen.getAllByRole('button', { name: /Editar desactivado/i })
    const deleteButtons = screen.getAllByRole('button', { name: /Apagar desactivado/i })

    expect(editButtons.length).toBeGreaterThan(0)
    expect(deleteButtons.length).toBeGreaterThan(0)
    editButtons.forEach((btn) => expect(btn).toBeDisabled())
    deleteButtons.forEach((btn) => expect(btn).toBeDisabled())
  })

  it('renderiza structure correctly quando janela encerrada', () => {
    render(
      <EventsReviewPanel
        events={mockEvents}
        sessionId="session-1"
        isWithinEditWindow={false}
      />
    )

    // Verifica estrutura de tabela
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Editar desactivado/i }).length).toBeGreaterThan(0)
  })

  it('delete button triggered calls deleteMatchEvent', async () => {
    const { deleteMatchEvent } = await import('@/lib/actions/events')
    vi.mocked(deleteMatchEvent).mockResolvedValueOnce({ ok: true })

    render(
      <EventsReviewPanel
        events={mockEvents}
        sessionId="session-1"
        isWithinEditWindow={true}
      />
    )

    const deleteButtons = screen.getAllByRole('button', { name: /Apagar evento/i })
    fireEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(deleteMatchEvent).toHaveBeenCalledWith('event-1')
    })
  })

  it('exibe mensagem de erro em alert role após falha de delete', async () => {
    const { deleteMatchEvent } = await import('@/lib/actions/events')
    vi.mocked(deleteMatchEvent).mockResolvedValueOnce({
      ok: false,
      error: { code: 'forbidden', message: 'Janela encerrada.' },
    })

    render(
      <EventsReviewPanel
        events={mockEvents}
        sessionId="session-1"
        isWithinEditWindow={true}
      />
    )

    const deleteButtons = screen.getAllByRole('button', { name: /Apagar evento/i })
    fireEvent.click(deleteButtons[0])

    // Mensagem de erro exibida em alert role
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Janela encerrada')
    })
  })
})
