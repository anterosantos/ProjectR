import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RetirarTokenPage from '@/app/(public)/direitos/[token]/retirar/page'
import * as dataRights from '@/lib/actions/data-rights'

vi.mock('@/lib/actions/data-rights', () => ({
  withdrawConsentByToken: vi.fn(),
  validateToken: vi.fn(),
}))

vi.mock('@/lib/outbox/db', () => ({
  db: {
    outbox: {
      where: vi.fn(() => ({ equals: vi.fn(() => ({ delete: vi.fn() })) })),
    },
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

function mockTokenFetch(response: object, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(response), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ))
}

describe('Retirar Page (Token)', () => {
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
    vi.mocked(dataRights.validateToken).mockResolvedValue({
      ok: true,
      data: { valid: true, playerId: '550e8400-e29b-41d4-a716-446655440000', playerName: 'Carlos Mané' },
    })

    const component = await RetirarTokenPage({ params: Promise.resolve({ token: 'valid-token-abc123' }) })
    render(component)

    expect(screen.getByRole('heading', { name: /Retirar consentimento de Carlos Mané/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Retirar consentimento/i })).toBeDefined()
  })

  it('token inválido/expirado: mostra EmptyState', async () => {
    vi.mocked(dataRights.validateToken).mockResolvedValue({
      ok: false,
      error: { code: 'unauthorized', message: 'Token inválido ou expirado' },
    })

    const component = await RetirarTokenPage({ params: Promise.resolve({ token: 'expired-token' }) })
    render(component)

    expect(screen.getByText(/Link inválido/i)).toBeDefined()
  })
})
