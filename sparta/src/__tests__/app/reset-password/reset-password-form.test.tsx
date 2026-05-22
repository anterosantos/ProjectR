import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { Suspense } from 'react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  updatePassword: vi.fn(),
  getSupabaseClient: vi.fn(),
  createClient: vi.fn(),
}))

import { useRouter, useSearchParams } from 'next/navigation'
import { updatePassword, getSupabaseClient, createClient } from '@/lib/supabase/client'
import ResetPasswordForm from '@/app/reset-password/reset-password-form'

const mockUseRouter = vi.mocked(useRouter)
const mockUseSearchParams = vi.mocked(useSearchParams)
const mockUpdatePassword = vi.mocked(updatePassword)
const mockGetSupabaseClient = vi.mocked(getSupabaseClient)
const mockCreateClient = vi.mocked(createClient)

function renderForm() {
  return render(
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function makeAuthClient(sessionValue: object | null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: sessionValue } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
  }
}

describe('ResetPasswordForm — invite flow (from=invite)', () => {
  let mockLocationReplace: ReturnType<typeof vi.fn>
  let mockRouterPush: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRouterPush = vi.fn()
    mockUseRouter.mockReturnValue({ push: mockRouterPush, replace: vi.fn() } as any)
    mockUseSearchParams.mockReturnValue({ get: (k: string) => (k === 'from' ? 'invite' : null) } as any)
    mockLocationReplace = vi.fn()
    vi.stubGlobal('location', { replace: mockLocationReplace })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra formulário "Activar conta" quando sessão existe', async () => {
    const client = makeAuthClient({ user: { id: 'user-1' } })
    mockGetSupabaseClient.mockReturnValue(client as any)

    renderForm()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Activar conta' })).toBeDefined()
      expect(screen.getByText('Define uma password para aceder à tua conta')).toBeDefined()
      expect(screen.getByRole('button', { name: 'Activar conta' })).toBeDefined()
    })
  })

  it('mostra "Link inválido" quando não há sessão', async () => {
    const client = makeAuthClient(null)
    mockGetSupabaseClient.mockReturnValue(client as any)

    renderForm()

    await waitFor(() => {
      expect(screen.getByText(/Link de recuperação inválido ou expirado/i)).toBeDefined()
    })
  })

  it('submissão chama updateUser (não updatePassword) e redireciona para /login', async () => {
    const client = makeAuthClient({ user: { id: 'user-1' } })
    mockGetSupabaseClient.mockReturnValue(client as any)
    mockCreateClient.mockReturnValue(client as any)

    renderForm()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activar conta' })).toBeDefined()
    )

    fireEvent.change(screen.getByLabelText('Nova Password'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar Password'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Activar conta' }))

    await waitFor(() => {
      expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'password123' })
      expect(mockUpdatePassword).not.toHaveBeenCalled()
      expect(mockLocationReplace).toHaveBeenCalledWith('/login')
    })
  })

  it('mostra erro quando updateUser falha', async () => {
    const client = makeAuthClient({ user: { id: 'user-1' } })
    client.auth.updateUser = vi.fn().mockResolvedValue({ error: { message: 'Weak password' } })
    mockGetSupabaseClient.mockReturnValue(client as any)
    mockCreateClient.mockReturnValue(client as any)

    renderForm()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activar conta' })).toBeDefined()
    )

    fireEvent.change(screen.getByLabelText('Nova Password'), {
      target: { value: 'abc123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar Password'), {
      target: { value: 'abc123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Activar conta' }))

    await waitFor(() => {
      expect(screen.getByText('Erro ao atualizar password')).toBeDefined()
      expect(mockLocationReplace).not.toHaveBeenCalled()
    })
  })

  it('mostra erro quando passwords não correspondem', async () => {
    const client = makeAuthClient({ user: { id: 'user-1' } })
    mockGetSupabaseClient.mockReturnValue(client as any)

    renderForm()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Activar conta' })).toBeDefined()
    )

    fireEvent.change(screen.getByLabelText('Nova Password'), {
      target: { value: 'password123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar Password'), {
      target: { value: 'different456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Activar conta' }))

    await waitFor(() => {
      expect(screen.getByText('As passwords não correspondem')).toBeDefined()
      expect(client.auth.updateUser).not.toHaveBeenCalled()
    })
  })
})

describe('ResetPasswordForm — recovery flow (sem from=invite)', () => {
  let mockRouterPush: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRouterPush = vi.fn()
    mockUseRouter.mockReturnValue({ push: mockRouterPush, replace: vi.fn() } as any)
    mockUseSearchParams.mockReturnValue({ get: () => null } as any)
  })

  it('mostra "Definir nova password" e aguarda evento PASSWORD_RECOVERY', async () => {
    let capturedCallback: ((event: string) => void) | null = null
    const mockUnsubscribe = vi.fn()
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockImplementation((cb) => {
          capturedCallback = cb
          return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
        }),
      },
    }
    mockGetSupabaseClient.mockReturnValue(client as any)

    renderForm()

    // Initially showing "A validar link..."
    expect(screen.getByText('A validar link...')).toBeDefined()

    // Simulate PASSWORD_RECOVERY event
    capturedCallback!('PASSWORD_RECOVERY')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Definir nova password' })).toBeDefined()
      expect(screen.getByText('Introduza a sua nova password abaixo')).toBeDefined()
    })
  })

  it('mostra "Link inválido" se PASSWORD_RECOVERY não disparar em 3s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    }
    mockGetSupabaseClient.mockReturnValue(client as any)

    renderForm()

    await act(async () => {
      vi.advanceTimersByTime(3100)
    })

    await waitFor(() => {
      expect(screen.getByText(/Link de recuperação inválido ou expirado/i)).toBeDefined()
    })

    vi.useRealTimers()
  }, 10000)

  it('submissão no fluxo recovery chama updatePassword (com signOut)', async () => {
    let capturedCallback: ((event: string) => void) | null = null
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockImplementation((cb) => {
          capturedCallback = cb
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
      },
    }
    mockGetSupabaseClient.mockReturnValue(client as any)
    mockUpdatePassword.mockResolvedValue({ success: true, error: null })

    renderForm()

    // Wait for useEffect to register the callback before invoking it
    await waitFor(() => expect(capturedCallback).not.toBeNull())

    act(() => { capturedCallback!('PASSWORD_RECOVERY') })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Atualizar password' })).toBeDefined()
    )

    fireEvent.change(screen.getByLabelText('Nova Password'), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmar Password'), {
      target: { value: 'newpass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar password' }))

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('newpass123')
    })
    // router.push is called inside setTimeout(2000) — wait beyond that
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/login')
    }, { timeout: 3000 })
  })
})
