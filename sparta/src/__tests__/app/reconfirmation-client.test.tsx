import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: { signOut: vi.fn().mockResolvedValue({}) },
  })),
}))

vi.mock('@/lib/actions/reconfirmation', () => ({
  confirmReconfirmation: vi.fn(),
  eraseDataViaReconfirmation: vi.fn(),
}))

// Mock CalmConfirmation to immediately call onDismiss for timer-dependent tests
let mockOnDismissCapture: (() => void) | undefined
vi.mock('@/components/ui/calm-confirmation', () => ({
  CalmConfirmation: ({ message, onDismiss }: { message: string; onDismiss?: () => void }) => {
    mockOnDismissCapture = onDismiss
    return <div role="alert">{message}</div>
  },
}))

import { confirmReconfirmation, eraseDataViaReconfirmation } from '@/lib/actions/reconfirmation'
import { ReconfirmationClient } from '@/app/(player)/reconfirmacao/[token]/ReconfirmationClient'

const mockConfirm = confirmReconfirmation as ReturnType<typeof vi.fn>
const mockErase   = eraseDataViaReconfirmation as ReturnType<typeof vi.fn>

const TOKEN = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1'

describe('ReconfirmationClient', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders confirm and erase buttons initially', () => {
    render(<ReconfirmationClient token={TOKEN} />)

    expect(screen.getByRole('button', { name: /confirmo o consentimento próprio/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /apagar os meus dados/i })).toBeTruthy()
  })

  it('confirm button triggers confirmReconfirmation on click', async () => {
    mockConfirm.mockResolvedValue({ ok: true, data: undefined })

    render(<ReconfirmationClient token={TOKEN} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirmo o consentimento próprio/i }))
    })

    expect(mockConfirm).toHaveBeenCalledWith(TOKEN)
  })

  it('shows CalmConfirmation after successful confirm', async () => {
    mockConfirm.mockResolvedValue({ ok: true, data: undefined })

    render(<ReconfirmationClient token={TOKEN} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirmo o consentimento próprio/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText(/consentimento confirmado/i)).toBeTruthy()
    })
  })

  it('shows error message when confirmReconfirmation fails', async () => {
    mockConfirm.mockResolvedValue({ ok: false, error: { code: 'internal', message: 'Falha ao confirmar.' } })

    render(<ReconfirmationClient token={TOKEN} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirmo o consentimento próprio/i }))
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText('Falha ao confirmar.')).toBeTruthy()
    })
  })

  it('erase button shows CalmConfirmation warning before erasing', async () => {
    render(<ReconfirmationClient token={TOKEN} />)

    fireEvent.click(screen.getByRole('button', { name: /apagar os meus dados/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
      expect(screen.getByText(/esta ação é irreversível/i)).toBeTruthy()
    })

    // Erase should NOT have been called yet (waiting for CalmConfirmation to dismiss)
    expect(mockErase).not.toHaveBeenCalled()
  })

  it('erase action is called after CalmConfirmation onDismiss fires', async () => {
    mockErase.mockResolvedValue({ ok: true, data: undefined })
    mockOnDismissCapture = undefined

    render(<ReconfirmationClient token={TOKEN} />)

    fireEvent.click(screen.getByRole('button', { name: /apagar os meus dados/i }))

    // CalmConfirmation warning should be visible
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })

    // Manually trigger onDismiss (simulates timer expiry)
    await act(async () => {
      mockOnDismissCapture?.()
    })

    await waitFor(() => {
      expect(mockErase).toHaveBeenCalledWith(TOKEN)
    })
  })

  it('shows error when eraseDataViaReconfirmation fails', async () => {
    mockErase.mockResolvedValue({ ok: false, error: { code: 'internal', message: 'Falha no apagamento.' } })
    mockOnDismissCapture = undefined

    render(<ReconfirmationClient token={TOKEN} />)

    fireEvent.click(screen.getByRole('button', { name: /apagar os meus dados/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })

    await act(async () => {
      mockOnDismissCapture?.()
    })

    await waitFor(() => {
      expect(screen.getByText('Falha no apagamento.')).toBeTruthy()
    })
  })
})
