import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { validateToken } from '@/app/(public)/direitos/[token]/lib/validate-token'
import ApagarPage from '@/app/(public)/direitos/[token]/apagar/page'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/app/(public)/direitos/[token]/lib/validate-token', () => ({
  validateToken: vi.fn(),
}))

const mockValidateToken = vi.mocked(validateToken)

describe('Apagar Page (Token)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza confirmação com nome do menor quando token válido', async () => {
    mockValidateToken.mockResolvedValue({
      valid: true,
      playerId: '550e8400-e29b-41d4-a716-446655440000',
      playerName: 'João Silva',
    })

    const component = await ApagarPage({
      params: { token: 'test-token-123' },
    })
    render(component)

    expect(screen.getByText(/Apagar dados de João Silva/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /Apagar os dados de João Silva/i })).toBeDefined()
  })

  it('renderiza EmptyState quando token expirado', async () => {
    mockValidateToken.mockResolvedValue({
      valid: false,
      reason: 'expired',
    })

    const component = await ApagarPage({
      params: { token: 'expired-token' },
    })
    render(component)

    expect(screen.getByText(/Token inválido ou expirado/i)).toBeDefined()
  })

  it('renderiza EmptyState quando token inválido', async () => {
    mockValidateToken.mockResolvedValue({
      valid: false,
      reason: 'invalid',
    })

    const component = await ApagarPage({
      params: { token: 'invalid-token' },
    })
    render(component)

    expect(screen.getByText(/Token inválido ou expirado/i)).toBeDefined()
  })
})
