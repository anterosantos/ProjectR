import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApagarPage from '@/app/(public)/direitos/[token]/apagar/page'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

function mockTokenFetch(response: object, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(response), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ))
}

describe('Apagar Page (Token)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('renderiza confirmação com nome do menor quando token válido', async () => {
    mockTokenFetch({ valid: true, playerId: '550e8400-e29b-41d4-a716-446655440000', playerName: 'João Silva' })

    const component = await ApagarPage({ params: Promise.resolve({ token: 'test-token-123' }) })
    render(component)

    expect(screen.getByText(/Apagar dados de João Silva/i)).toBeDefined()
  })

  it('renderiza EmptyState quando token expirado', async () => {
    mockTokenFetch({ valid: false, reason: 'expired' })

    const component = await ApagarPage({ params: Promise.resolve({ token: 'expired-token' }) })
    render(component)

    expect(screen.getByText(/Link expirado/i)).toBeDefined()
  })

  it('renderiza EmptyState quando token inválido', async () => {
    mockTokenFetch({ valid: false, reason: 'invalid' })

    const component = await ApagarPage({ params: Promise.resolve({ token: 'invalid-token' }) })
    render(component)

    expect(screen.getByText(/Link inválido/i)).toBeDefined()
  })
})
