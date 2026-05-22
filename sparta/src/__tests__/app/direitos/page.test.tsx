import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import DireitosTokenPage from '@/app/(public)/direitos/[token]/page'

function makeFetchMock(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

describe('DireitosTokenPage (/direitos/[token])', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('valid token: renderiza 6 cards de ação com breadcrumb', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        valid: true,
        playerId: 'player-123',
        parentEmail: 'parent@example.com',
        playerName: 'João Silva',
      })
    )

    const jsx = await DireitosTokenPage({
      params: Promise.resolve({ token: 'valid-token-abc123' }),
    })
    render(jsx)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Os meus direitos RGPD'
    )
    expect(screen.getAllByText('Continuar')).toHaveLength(6)
    expect(screen.getByText('Exportar os meus dados')).toBeDefined()
    expect(screen.getByText('Apagar os meus dados')).toBeDefined()
    expect(screen.getByText('Retificar dados pessoais')).toBeDefined()
    expect(screen.getByText('Limitar tratamento')).toBeDefined()
    expect(screen.getByText('Retirar consentimento')).toBeDefined()
    expect(screen.getByText('Quem consultou os dados')).toBeDefined()
  })

  it('expired token: mostra EmptyState com mensagem de link expirado', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ valid: false, reason: 'expired' })
    )

    const jsx = await DireitosTokenPage({
      params: Promise.resolve({ token: 'expired-token-abc123' }),
    })
    render(jsx)

    expect(screen.getByText('Link expirado')).toBeDefined()
    expect(
      screen.getByText('Este link expirou. Pede um novo ao staff de SPARTA.')
    ).toBeDefined()
    expect(screen.queryAllByText('Continuar')).toHaveLength(0)
  })

  it('invalid token: mostra EmptyState sem expor info técnica', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ valid: false, reason: 'not_found' })
    )

    const jsx = await DireitosTokenPage({
      params: Promise.resolve({ token: 'invalid-token-abc123' }),
    })
    render(jsx)

    expect(screen.getByText('Link inválido')).toBeDefined()
    expect(screen.getByText('Este link não é válido.')).toBeDefined()
    expect(screen.queryAllByText('Continuar')).toHaveLength(0)
  })

  it('erro de infra (HTTP 500): mostra mensagem de erro temporário', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ valid: false, reason: 'internal_error' }, 500)
    )

    const jsx = await DireitosTokenPage({
      params: Promise.resolve({ token: 'any-token-abc123' }),
    })
    render(jsx)

    // Infra errors show a distinct message (not the same as "not_found")
    expect(screen.queryByText('Este link não é válido.')).toBeNull()
    expect(
      screen.getByText('Não foi possível verificar o link. Tenta novamente mais tarde.')
    ).toBeDefined()
  })
})
