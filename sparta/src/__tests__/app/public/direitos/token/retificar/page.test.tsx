import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RetificarTokenPage from '@/app/(public)/direitos/[token]/retificar/page'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

vi.mock('@/lib/actions/data-rights', () => ({
  submitRectificationRequestByToken: vi.fn().mockResolvedValue({ ok: true, data: { submitted: true, requestId: 'req-1' } }),
}))

function mockTokenFetch(response: object, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(response), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ))
}

describe('Retificar Page (Token)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('token válido: mostra formulário com nome do menor', async () => {
    mockTokenFetch({ valid: true, playerId: '550e8400-e29b-41d4-a716-446655440000', playerName: 'João Silva' })

    const component = await RetificarTokenPage({ params: Promise.resolve({ token: 'test-token-123' }) })
    render(component)

    expect(screen.getByText(/Retificar dados de João Silva/i)).toBeDefined()
    expect(screen.getByLabelText(/Campo a corrigir/i)).toBeDefined()
  })

  it('token inválido/expirado: mostra EmptyState', async () => {
    mockTokenFetch({ valid: false, reason: 'expired' })

    const component = await RetificarTokenPage({ params: Promise.resolve({ token: 'expired-token' }) })
    render(component)

    expect(screen.getByText(/Link expirado/i)).toBeDefined()
  })
})
