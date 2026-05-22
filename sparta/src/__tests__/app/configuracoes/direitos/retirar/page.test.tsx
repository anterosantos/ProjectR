import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import RetirarPage from '@/app/configuracoes/(subject-rights)/direitos/retirar/page'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/actions/data-rights', () => ({
  withdrawConsent: vi.fn(),
}))

vi.mock('@/lib/outbox/db', () => ({
  db: {
    outbox: {
      where: vi.fn(() => ({ equals: vi.fn(() => ({ delete: vi.fn() })) })),
    },
  },
}))

const mockCreateServerClient = vi.mocked(createServerClient)
const mockRedirect = vi.mocked(redirect)

describe('Retirar Page (Auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza botão "Retirar consentimento" quando autenticado', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }) },
    } as any)

    const component = await RetirarPage()
    render(component)

    expect(screen.getByRole('button', { name: /Retirar consentimento/i })).toBeDefined()
  })

  it('redireciona para /login quando não autenticado', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any)

    await RetirarPage()

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('mostra aviso de irreversibilidade no layout inicial', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }) },
    } as any)

    const component = await RetirarPage()
    render(component)

    expect(screen.getByText(/irreversível/i)).toBeDefined()
    expect(screen.getByText(/apagados permanentemente/i)).toBeDefined()
  })
})
