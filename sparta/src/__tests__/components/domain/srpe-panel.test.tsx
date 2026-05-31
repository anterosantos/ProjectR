import 'fake-indexeddb/auto'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SrpePanel } from '@/app/(staff)/sessoes/[id]/srpe/srpe-panel'
import type { PlayerSrpeEntry } from '@/lib/schemas/session-srpe'

vi.mock('@/lib/actions/session-srpe', () => ({
  upsertSessionSrpe: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
}))

vi.mock('@/lib/outbox/enqueue', () => ({
  enqueueMutation: vi.fn().mockResolvedValue('mock-id'),
}))

vi.mock('@/lib/uuid', () => ({
  newId: vi.fn().mockReturnValue('01920a4b-c8d3-7000-9c4e-000000000099'),
}))

let mockIsOnline = true
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({ isOnline: mockIsOnline }),
}))

let mockPendingCount = 0
vi.mock('@/lib/outbox/status', () => ({
  useOutboxStatus: () => ({ pendingCount: mockPendingCount }),
}))

const { upsertSessionSrpe } = await import('@/lib/actions/session-srpe')
const { enqueueMutation } = await import('@/lib/outbox/enqueue')

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_ID = 'session-uuid-001'
const DURATION_MIN = 90

const activePlayers: PlayerSrpeEntry[] = [
  {
    player_id: 'player-1',
    full_name: 'João Silva',
    jersey_num: 10,
    primary_position: 'MID',
    is_active: true,
    attendance_status: 'present',
    existing_analyst_srpe: null,
    player_submitted_srpe: null,
  },
  {
    player_id: 'player-2',
    full_name: 'Carlos Matos',
    jersey_num: 7,
    primary_position: 'FWD',
    is_active: true,
    attendance_status: 'present',
    existing_analyst_srpe: null,
    player_submitted_srpe: null,
  },
]

const playersWithExistingValues: PlayerSrpeEntry[] = [
  {
    player_id: 'player-1',
    full_name: 'João Silva',
    jersey_num: 10,
    primary_position: 'MID',
    is_active: true,
    attendance_status: 'present',
    existing_analyst_srpe: 7,
    player_submitted_srpe: 5,
  },
  {
    player_id: 'player-2',
    full_name: 'Carlos Matos',
    jersey_num: 7,
    primary_position: 'FWD',
    is_active: true,
    attendance_status: 'present',
    existing_analyst_srpe: null,
    player_submitted_srpe: 6,
  },
]

const playersWithAbsent: PlayerSrpeEntry[] = [
  {
    player_id: 'player-1',
    full_name: 'João Silva',
    jersey_num: 10,
    primary_position: 'MID',
    is_active: true,
    attendance_status: 'present',
    existing_analyst_srpe: null,
    player_submitted_srpe: null,
  },
  {
    player_id: 'player-3',
    full_name: 'Rui Costa',
    jersey_num: 4,
    primary_position: 'DEF',
    is_active: true,
    attendance_status: 'absent',
    existing_analyst_srpe: null,
    player_submitted_srpe: null,
  },
]

const defaultProps = {
  players: activePlayers,
  sessionId: SESSION_ID,
  durationMin: DURATION_MIN,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('<SrpePanel>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsOnline = true
    mockPendingCount = 0
  })

  it('renders all players com sliders', () => {
    render(<SrpePanel {...defaultProps} />)
    expect(screen.getByText(/João Silva/)).toBeDefined()
    expect(screen.getByText(/Carlos Matos/)).toBeDefined()
    expect(screen.getAllByRole('slider')).toHaveLength(activePlayers.length)
  })

  it('pre-fill existing_analyst_srpe', () => {
    render(<SrpePanel {...defaultProps} players={playersWithExistingValues} />)

    const sliders = screen.getAllByRole('slider')
    const joaoSlider = sliders[0]
    expect(joaoSlider).toHaveAttribute('aria-valuenow', '7')
  })

  it('pre-fill player_submitted_srpe com meta "Submetido pelo jogador"', () => {
    render(<SrpePanel {...defaultProps} players={playersWithExistingValues} />)

    // Carlos Matos tem player_submitted_srpe=6 e existing_analyst_srpe=null
    expect(screen.getByText('Submetido pelo jogador')).toBeDefined()
    const sliders = screen.getAllByRole('slider')
    const carlosSlider = sliders[1]
    expect(carlosSlider).toHaveAttribute('aria-valuenow', '6')
  })

  it('absent player: slider desactivado + "Ausente — sem sRPE"', () => {
    render(<SrpePanel {...defaultProps} players={playersWithAbsent} />)

    expect(screen.getByText('Ausente — sem sRPE')).toBeDefined()
    const sliders = screen.getAllByRole('slider')
    // DEF (order 1) rendered before MID (order 2) → Rui Costa (absent) is sliders[0]
    const ruiSlider = sliders[0]
    expect(ruiSlider).toBeDisabled()
  })

  it('save online: upsertSessionSrpe chamado apenas para jogadores com valor', async () => {
    render(<SrpePanel {...defaultProps} />)

    // Definir valores apenas para o primeiro jogador
    const sliders = screen.getAllByRole('slider')
    await act(async () => {
      fireEvent.change(sliders[0], { target: { value: '5' } })
    })

    const saveBtn = screen.getByRole('button', { name: /Guardar sRPE da sessão/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    await waitFor(() => {
      expect(vi.mocked(upsertSessionSrpe)).toHaveBeenCalledTimes(1)
      const callArgs = vi.mocked(upsertSessionSrpe).mock.calls[0]?.[0]
      expect(callArgs?.srpe_value).toBe(5)
      expect(callArgs?.player_id).toBe('player-1')
    })

    expect(screen.getByText('sRPE guardado')).toBeDefined()
  })

  it('save offline: enqueueMutation chamado para cada jogador com valor', async () => {
    mockIsOnline = false
    render(<SrpePanel {...defaultProps} />)

    // Definir valores para ambos os jogadores
    const sliders = screen.getAllByRole('slider')
    await act(async () => {
      fireEvent.change(sliders[0], { target: { value: '5' } })
      fireEvent.change(sliders[1], { target: { value: '7' } })
    })

    const saveBtn = screen.getByRole('button', { name: /Guardar sRPE da sessão/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    await waitFor(() => {
      expect(vi.mocked(enqueueMutation)).toHaveBeenCalledTimes(2)
    })

    expect(vi.mocked(enqueueMutation).mock.calls[0]?.[0]).toBe('srpe.upsert')
    expect(screen.getByText(/2 registos de sRPE em fila para sincronização/i)).toBeDefined()
  })

  it('save apenas jogadores presentes (não absent)', async () => {
    render(<SrpePanel {...defaultProps} players={playersWithAbsent} />)

    // DEF (Rui, absent) is sliders[0]; MID (João, present) is sliders[1]
    const sliders = screen.getAllByRole('slider')
    await act(async () => {
      fireEvent.change(sliders[1], { target: { value: '5' } })
    })

    const saveBtn = screen.getByRole('button', { name: /Guardar sRPE da sessão/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    await waitFor(() => {
      expect(vi.mocked(upsertSessionSrpe)).toHaveBeenCalledTimes(1)
    })
  })

  it('EmptyState quando players=[]', () => {
    render(
      <SrpePanel players={[]} sessionId={SESSION_ID} durationMin={DURATION_MIN} />
    )

    expect(screen.getByText('Sem jogadores no plantel')).toBeDefined()
  })

  it('erro quando nenhum jogador com sRPE para guardar', async () => {
    render(<SrpePanel {...defaultProps} />)

    const saveBtn = screen.getByRole('button', { name: /Guardar sRPE da sessão/i })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    await waitFor(() => {
      expect(
        screen.getByText(/Nenhum jogador com sRPE para guardar/)
      ).toBeDefined()
    })
  })

  it('slider: alterar valor funciona', async () => {
    render(<SrpePanel {...defaultProps} />)

    const slider = screen.getAllByRole('slider')[0]
    fireEvent.change(slider, { target: { value: '8' } })

    await waitFor(() => {
      expect(slider).toHaveAttribute('aria-valuenow', '8')
    })
  })

  it('não mostra analyst override label quando existing_analyst_srpe existe', () => {
    render(<SrpePanel {...defaultProps} players={playersWithExistingValues} />)

    // João tem existing_analyst_srpe=7 e player_submitted_srpe=5
    // Não deve aparecer "Submetido pelo jogador"
    const labels = screen.getAllByText('Submetido pelo jogador')
    expect(labels).toHaveLength(1) // Apenas para Carlos
  })

  it('grouping por posição: MID antes de FWD', () => {
    render(<SrpePanel {...defaultProps} />)

    const positions = screen.getAllByText(/MID|FWD/)
    expect(positions[0]?.textContent).toContain('MID')
    expect(positions[positions.length - 1]?.textContent).toContain('FWD')
  })

  it('PendingBadge visível quando pendingCount > 0', () => {
    mockPendingCount = 3
    render(<SrpePanel {...defaultProps} />)

    expect(screen.getByText(/3/)).toBeDefined()
    expect(screen.getByText(/registos de sRPE pendentes/i)).toBeDefined()
  })
})
