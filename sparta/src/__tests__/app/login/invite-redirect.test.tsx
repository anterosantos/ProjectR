import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
  signInWithPassword: vi.fn(),
  getRoleHomePath: vi.fn(),
}))

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LoginPage from '@/app/login/page'

const mockUseRouter = vi.mocked(useRouter)
const mockCreateClient = vi.mocked(createClient)

const INVITE_HASH =
  '#access_token=test-access-token&refresh_token=test-refresh-token&type=invite'

function makeMockSupabase(setSessionResult = { data: { session: {} }, error: null }) {
  return {
    auth: {
      setSession: vi.fn().mockResolvedValue(setSessionResult),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(),
        listFactors: vi.fn(),
        challengeAndVerify: vi.fn(),
      },
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  }
}

describe('LoginPage — invite redirect', () => {
  let mockReplace: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockReplace = vi.fn()
    mockUseRouter.mockReturnValue({ replace: mockReplace, push: vi.fn() } as any)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders login form when hash has no invite token', () => {
    vi.stubGlobal('location', { hash: '' })
    render(<LoginPage />)
    expect(screen.getByText('Entrar em S.P.A.R.T.A.')).toBeDefined()
    expect(screen.getByLabelText('Email')).toBeDefined()
  })

  it('calls setSession with parsed tokens and redirects on invite hash', async () => {
    vi.stubGlobal('location', { hash: INVITE_HASH })
    const mockSupabase = makeMockSupabase()
    mockCreateClient.mockReturnValue(mockSupabase as any)

    render(<LoginPage />)

    await waitFor(() => {
      expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      })
      expect(mockReplace).toHaveBeenCalledWith('/reset-password?from=invite')
    })
  })

  it('still redirects when setSession fails (expired token)', async () => {
    vi.stubGlobal('location', { hash: INVITE_HASH })
    const mockSupabase = makeMockSupabase({
      data: { session: null },
      error: { message: 'Token expired' },
    } as any)
    mockCreateClient.mockReturnValue(mockSupabase as any)

    render(<LoginPage />)

    await waitFor(() => {
      expect(mockSupabase.auth.setSession).toHaveBeenCalled()
      expect(mockReplace).toHaveBeenCalledWith('/reset-password?from=invite')
    })
  })

  it('does NOT call setSession when hash has no type=invite', async () => {
    vi.stubGlobal('location', { hash: '#access_token=some-token&type=recovery' })
    const mockSupabase = makeMockSupabase()
    mockCreateClient.mockReturnValue(mockSupabase as any)

    render(<LoginPage />)

    await new Promise((r) => setTimeout(r, 50))

    expect(mockSupabase.auth.setSession).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalledWith('/reset-password?from=invite')
  })

  it('does NOT call setSession when hash is empty', async () => {
    vi.stubGlobal('location', { hash: '' })
    const mockSupabase = makeMockSupabase()
    mockCreateClient.mockReturnValue(mockSupabase as any)

    render(<LoginPage />)

    await new Promise((r) => setTimeout(r, 50))

    expect(mockSupabase.auth.setSession).not.toHaveBeenCalled()
  })
})
