import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import ApagarPage from '@/app/configuracoes/(subject-rights)/direitos/apagar/page'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

const mockCreateServerClient = vi.mocked(
  require('@/lib/supabase/server').createServerClient
)
const mockRedirect = vi.mocked(redirect)

describe('Apagar Page (Auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders ecrã com botão "Apagar os meus dados"', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'player-123',
                    birthdate: new Date(2006, 1, 1).toISOString(), // 18 years old
                  },
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }

    mockCreateServerClient.mockResolvedValue(mockSupabase as any)
    const component = await ApagarPage()
    render(component)

    expect(screen.getByRole('button', { name: /apagar os meus dados/i })).toBeDefined()
    expect(screen.getByText(/Apagar os meus dados — Ação irreversível/i)).toBeDefined()
  })

  it('redirects para /login quando não autenticado', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    }

    mockCreateServerClient.mockResolvedValue(mockSupabase as any)
    await ApagarPage()

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('mostra EmptyState quando utilizador é <16 e sem consentimento confirmado', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'player-123',
                    birthdate: new Date(2010, 1, 1).toISOString(), // 14 years old
                  },
                }),
              }),
            }),
          }
        }
        if (table === 'parental_consents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                  }),
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }

    mockCreateServerClient.mockResolvedValue(mockSupabase as any)
    const component = await ApagarPage()
    render(component)

    expect(screen.getByText(/Ação não disponível/i)).toBeDefined()
    expect(screen.getByText(/Menor não pode apagar dados/i)).toBeDefined()
  })
})
