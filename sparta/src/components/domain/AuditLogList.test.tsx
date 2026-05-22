import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuditLogList } from './AuditLogList'
import type { AuditVisibilityResult } from '@/lib/actions/audit-visibility'

const mockEntries = [
  {
    id: 'entry-1',
    actor_id: 'actor-1',
    action: 'viewed_fatigue_response',
    target_kind: 'fatigue_response',
    target_id: 'player-1',
    occurred_at: '2026-05-22T10:30:00.000Z',
    payload: null,
  },
  {
    id: 'entry-2',
    actor_id: 'actor-2',
    action: 'read_match_events',
    target_kind: 'match_event',
    target_id: 'player-1',
    occurred_at: '2026-05-21T09:00:00.000Z',
    payload: null,
  },
]

const mockActorMap = {
  'actor-1': { full_name: 'João Silva', role: 'coach' },
  'actor-2': { full_name: 'Ana Costa', role: 'analyst' },
}

function makeInitialData(overrides?: Partial<AuditVisibilityResult>): AuditVisibilityResult {
  return {
    entries: mockEntries,
    actorMap: mockActorMap,
    totalCount: 2,
    hasMore: false,
    ...overrides,
  }
}

describe('AuditLogList', () => {
  it('renders list of audit entries', () => {
    render(
      <AuditLogList
        initialData={makeInitialData()}
        pageSize={50}
        onLoadPage={vi.fn()}
      />
    )
    expect(screen.getByText('Consultou questionário de fadiga')).toBeInTheDocument()
    expect(screen.getByText('Consultou eventos de jogo')).toBeInTheDocument()
  })

  it('renders actor name and role for each entry', () => {
    render(
      <AuditLogList
        initialData={makeInitialData()}
        pageSize={50}
        onLoadPage={vi.fn()}
      />
    )
    expect(screen.getByText(/João Silva \(Treinador\)/)).toBeInTheDocument()
    expect(screen.getByText(/Ana Costa \(Analista\)/)).toBeInTheDocument()
  })

  it('renders target_kind translation', () => {
    render(
      <AuditLogList
        initialData={makeInitialData()}
        pageSize={50}
        onLoadPage={vi.fn()}
      />
    )
    expect(screen.getByText('Questionário de fadiga')).toBeInTheDocument()
    expect(screen.getByText('Evento de jogo')).toBeInTheDocument()
  })

  it('shows empty state when no entries', () => {
    render(
      <AuditLogList
        initialData={{ entries: [], actorMap: {}, totalCount: 0, hasMore: false }}
        pageSize={50}
        onLoadPage={vi.fn()}
      />
    )
    expect(screen.getByText('Sem acessos registados')).toBeInTheDocument()
    expect(screen.getByText(/ainda não foram consultados/)).toBeInTheDocument()
  })

  it('does not show pagination when total ≤ pageSize', () => {
    render(
      <AuditLogList
        initialData={makeInitialData({ totalCount: 2 })}
        pageSize={50}
        onLoadPage={vi.fn()}
      />
    )
    expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument()
  })

  it('shows pagination when total > pageSize', () => {
    render(
      <AuditLogList
        initialData={makeInitialData({ totalCount: 120 })}
        pageSize={50}
        onLoadPage={vi.fn()}
      />
    )
    expect(screen.getByRole('navigation', { name: 'Paginação' })).toBeInTheDocument()
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument()
  })

  it('calls onLoadPage when pagination button clicked', async () => {
    const onLoadPage = vi.fn().mockResolvedValue(makeInitialData())
    render(
      <AuditLogList
        initialData={makeInitialData({ totalCount: 120 })}
        pageSize={50}
        onLoadPage={onLoadPage}
      />
    )
    const nextBtn = screen.getByRole('button', { name: /próxima/i })
    fireEvent.click(nextBtn)
    await waitFor(() => {
      expect(onLoadPage).toHaveBeenCalledWith(2)
    })
  })

  it('disables Anterior button on first page', () => {
    render(
      <AuditLogList
        initialData={makeInitialData({ totalCount: 120 })}
        pageSize={50}
        onLoadPage={vi.fn()}
      />
    )
    const prevBtn = screen.getByRole('button', { name: /anterior/i })
    expect(prevBtn).toBeDisabled()
  })

  it('shows export button when onExport is provided', () => {
    render(
      <AuditLogList
        initialData={makeInitialData()}
        pageSize={50}
        onLoadPage={vi.fn()}
        onExport={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /exportar este histórico/i })).toBeInTheDocument()
  })

  it('does not show export button when onExport is undefined', () => {
    render(
      <AuditLogList
        initialData={makeInitialData()}
        pageSize={50}
        onLoadPage={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /exportar este histórico/i })).not.toBeInTheDocument()
  })

  it('calls onExport and shows confirmation when export button clicked', async () => {
    const onExport = vi.fn().mockResolvedValue(undefined)
    render(
      <AuditLogList
        initialData={makeInitialData()}
        pageSize={50}
        onLoadPage={vi.fn()}
        onExport={onExport}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /exportar este histórico/i }))
    await waitFor(() => {
      expect(onExport).toHaveBeenCalled()
    })
    expect(screen.getByText('Pedido de exportação submetido.')).toBeInTheDocument()
  })

  it('renders "Staff desconhecido" when actor_id is null', () => {
    const data = makeInitialData({
      entries: [{
        id: 'entry-3',
        actor_id: null,
        action: 'subject.withdrew',
        target_kind: 'player',
        target_id: 'player-1',
        occurred_at: '2026-05-20T08:00:00.000Z',
        payload: null,
      }],
    })
    render(
      <AuditLogList
        initialData={data}
        pageSize={50}
        onLoadPage={vi.fn()}
      />
    )
    expect(screen.getByText('Staff desconhecido')).toBeInTheDocument()
  })
})
