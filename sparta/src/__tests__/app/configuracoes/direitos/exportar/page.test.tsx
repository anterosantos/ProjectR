import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockRedirect, mockGetUser, mockCreateServerClient } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGetUser: vi.fn(),
  mockCreateServerClient: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: mockCreateServerClient }))
vi.mock('@/lib/supabase/service-role', () => ({ getServiceRoleClient: vi.fn() }))
vi.mock('@/lib/actions/data-rights', () => ({
  requestDataExportForSelf: vi.fn(),
}))

import ExportarPage from '@/app/configuracoes/(subject-rights)/direitos/exportar/page'

function setupAuth(user: unknown) {
  mockCreateServerClient.mockResolvedValue({
    auth: { getUser: mockGetUser.mockResolvedValue({ data: { user } }) },
  })
}

describe('ExportarPage (/configuracoes/direitos/exportar)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('titular autenticado: renderiza botão "Exportar os meus dados"', async () => {
    setupAuth({ id: 'user-123' })

    const jsx = await ExportarPage()
    render(jsx)

    expect(screen.getByRole('button', { name: /exportar os meus dados/i })).toBeDefined()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Exportar os meus dados')
  })

  it('utilizador não autenticado: chama redirect para /login', async () => {
    setupAuth(null)

    await ExportarPage()

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
