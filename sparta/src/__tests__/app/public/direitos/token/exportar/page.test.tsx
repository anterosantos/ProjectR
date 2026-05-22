import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/actions/data-rights', () => ({
  requestDataExportByToken: vi.fn(),
}))

import ExportarTokenPage from '@/app/(public)/direitos/[token]/exportar/page'

function makeFetchMock(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

describe('ExportarTokenPage (/direitos/[token]/exportar)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('token válido: renderiza botão de exportar com nome do menor', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        valid: true,
        playerId: 'player-123',
        playerName: 'Maria Costa',
      })
    )

    const jsx = await ExportarTokenPage({
      params: Promise.resolve({ token: 'valid-token-abc123' }),
    })
    render(jsx)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Exportar dados de Maria Costa')
    expect(screen.getByRole('button', { name: /exportar dados/i })).toBeDefined()
  })

  it('token expirado: mostra EmptyState com "Link expirado"', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ valid: false, reason: 'expired' })
    )

    const jsx = await ExportarTokenPage({
      params: Promise.resolve({ token: 'expired-token-abc123' }),
    })
    render(jsx)

    expect(screen.getByText('Link expirado')).toBeDefined()
    expect(screen.getByText('Este link expirou. Pede um novo ao staff de SPARTA.')).toBeDefined()
    expect(screen.queryByRole('button', { name: /exportar/i })).toBeNull()
  })

  it('token inválido: mostra EmptyState com "Link inválido"', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ valid: false, reason: 'not_found' })
    )

    const jsx = await ExportarTokenPage({
      params: Promise.resolve({ token: 'invalid-token-abc123' }),
    })
    render(jsx)

    expect(screen.getByText('Link inválido')).toBeDefined()
    expect(screen.getByText('Este link não é válido.')).toBeDefined()
    expect(screen.queryByRole('button', { name: /exportar/i })).toBeNull()
  })
})
