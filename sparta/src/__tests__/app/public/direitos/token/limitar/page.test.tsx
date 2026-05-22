import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import LimitarTokenPage from '@/app/(public)/direitos/[token]/limitar/page'

vi.mock('@/lib/actions/data-rights', () => ({
  getPlayerRestrictionStatus: vi.fn().mockResolvedValue({ ok: true, data: { restricted: false } }),
  restrictProcessingByToken: vi.fn(),
  unrestrictProcessingByToken: vi.fn(),
}))

function mockTokenFetch(response: object, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(response), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ))
}

describe('Limitar Page (Token)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('token válido: mostra estado de limitação com nome do menor', async () => {
    mockTokenFetch({ valid: true, playerId: '550e8400-e29b-41d4-a716-446655440000', playerName: 'Maria Joaquina' })

    const component = await LimitarTokenPage({ params: Promise.resolve({ token: 'valid-token-abc123' }) })
    render(component)

    expect(screen.getByRole('heading', { name: /Limitar tratamento de Maria Joaquina/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Limitar tratamento de Maria Joaquina/i })).toBeDefined()
  })

  it('token inválido/expirado: mostra EmptyState', async () => {
    mockTokenFetch({ valid: false, reason: 'expired' })

    const component = await LimitarTokenPage({ params: Promise.resolve({ token: 'expired-token' }) })
    render(component)

    expect(screen.getByText(/Link expirado/i)).toBeDefined()
  })
})
