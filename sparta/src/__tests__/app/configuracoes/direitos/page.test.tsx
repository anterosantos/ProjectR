import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { mockRedirect, mockGetUser, mockCreateServerClient } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockGetUser: vi.fn(),
  mockCreateServerClient: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: mockCreateServerClient }))

import DireitosPage from '@/app/configuracoes/(subject-rights)/direitos/page'

function makeSupabaseMock(user: unknown) {
  mockCreateServerClient.mockResolvedValue({
    auth: { getUser: mockGetUser.mockResolvedValue({ data: { user } }) },
  })
}

describe('DireitosPage (/configuracoes/direitos)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('titular autenticado: renderiza h1 e 6 cards de ação', async () => {
    makeSupabaseMock({ id: 'user-adult-1' })

    const jsx = await DireitosPage()
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
    expect(screen.getByText('Quem consultou os meus dados')).toBeDefined()
  })

  it('botão de cada card diz "Continuar" sem seta', async () => {
    makeSupabaseMock({ id: 'user-adult-2' })

    const jsx = await DireitosPage()
    render(jsx)

    const buttons = screen.getAllByText('Continuar')
    expect(buttons).toHaveLength(6)
    buttons.forEach((btn) => {
      expect(btn.textContent).not.toContain('→')
    })
  })

  it('utilizador não autenticado: chama redirect para /login', async () => {
    makeSupabaseMock(null)

    await DireitosPage()
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
