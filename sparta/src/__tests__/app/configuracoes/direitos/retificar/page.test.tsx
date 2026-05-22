import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import RetificarPage from '@/app/configuracoes/(subject-rights)/direitos/retificar/page'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/actions/data-rights', () => ({
  submitRectificationRequest: vi.fn().mockResolvedValue({ ok: true, data: { submitted: true, requestId: 'req-1' } }),
}))

const mockCreateServerClient = vi.mocked(createServerClient)
const mockRedirect = vi.mocked(redirect)

describe('Retificar Page (Auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza formulário com select de campo quando autenticado', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as any)

    const component = await RetificarPage()
    render(component)

    expect(screen.getByLabelText(/Campo a corrigir/i)).toBeDefined()
    expect(screen.getByText(/Nome completo/i)).toBeDefined()
    expect(screen.getByText(/Data de nascimento/i)).toBeDefined()
    expect(screen.getByText(/Número de camisola/i)).toBeDefined()
  })

  it('redireciona para /login quando não autenticado', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any)

    await RetificarPage()

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('mostra botão Enviar pedido quando autenticado', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      },
    } as any)

    const component = await RetificarPage()
    render(component)

    expect(screen.getByRole('button', { name: /Enviar pedido/i })).toBeDefined()
  })
})
