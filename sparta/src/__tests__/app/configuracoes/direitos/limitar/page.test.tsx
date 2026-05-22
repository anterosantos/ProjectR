import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getRestrictionStatus } from '@/lib/actions/data-rights'
import LimitarPage from '@/app/configuracoes/(subject-rights)/direitos/limitar/page'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/actions/data-rights', () => ({
  getRestrictionStatus: vi.fn(),
  restrictProcessing: vi.fn(),
  unrestrictProcessing: vi.fn(),
}))

const mockCreateServerClient = vi.mocked(createServerClient)
const mockRedirect = vi.mocked(redirect)
const mockGetRestrictionStatus = vi.mocked(getRestrictionStatus)

describe('Limitar Page (Auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza botão "Limitar o meu tratamento" quando restricted=false', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }) },
    } as any)
    mockGetRestrictionStatus.mockResolvedValue({
      ok: true,
      data: { restricted: false, restrictedAt: null },
    } as any)

    const component = await LimitarPage()
    render(component)

    expect(screen.getByRole('button', { name: /Limitar o meu tratamento/i })).toBeDefined()
  })

  it('renderiza estado activo quando restricted=true', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }) },
    } as any)
    mockGetRestrictionStatus.mockResolvedValue({
      ok: true,
      data: { restricted: true, restrictedAt: '2026-05-22T10:00:00Z' },
    } as any)

    const component = await LimitarPage()
    render(component)

    expect(screen.getByRole('button', { name: /Remover limitação/i })).toBeDefined()
    expect(screen.getByText(/Tratamento limitado/i)).toBeDefined()
  })

  it('redireciona para /login quando não autenticado', async () => {
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any)

    await LimitarPage()

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
