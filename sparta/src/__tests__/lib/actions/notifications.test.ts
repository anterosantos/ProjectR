import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotificationSettingsSchema } from '@/lib/actions/notifications'

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))

import { createServerClient } from '@/lib/supabase/server'
import {
  getNotificationSettings,
  updateNotificationSettings,
} from '@/lib/actions/notifications'

// ─── Constants ─────────────────────────────────────────────────────────────

const CLUB_UUID = '550e8400-e29b-41d4-a716-446655440001'
const USER_UUID = '650e8400-e29b-41d4-a716-446655440002'
const PROFILE_ID = '750e8400-e29b-41d4-a716-446655440003'

const VALID_SETTINGS = {
  id: 'settings-uuid',
  club_id: CLUB_UUID,
  pre_minutes: 30,
  post_minutes: 30,
  is_enabled: true,
  updated_at: '2026-05-24T10:00:00Z',
}

// ─── Mock Helpers ──────────────────────────────────────────────────────────

function buildMockServerClient(opts?: {
  noUser?: boolean
  profileData?: object | null
  settingsData?: object | null
  profileError?: object | null
  settingsError?: object | null
  upsertError?: object | null
}) {
  const profileRow = opts?.profileData ?? {
    id: PROFILE_ID,
    club_id: CLUB_UUID,
    role: 'coach',
  }

  const settingsRow = opts?.settingsData ?? VALID_SETTINGS

  // Profile query chain: select().eq().single()
  const mockProfileSelectChain = {
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: opts?.profileData === null ? null : profileRow,
        error: opts?.profileError ?? null,
      }),
    }),
  }

  const mockProfileQuery = {
    select: vi.fn().mockReturnValue(mockProfileSelectChain),
  }

  // Settings query chain: select().eq().maybeSingle()
  const mockSettingsSelectChain = {
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: opts?.settingsData === null ? null : settingsRow,
        error: opts?.settingsError ?? null,
      }),
    }),
  }

  const mockSettingsQuery = {
    select: vi.fn().mockReturnValue(mockSettingsSelectChain),
  }

  // Upsert chain: upsert().select().single()
  const mockUpsertSelectChain = {
    single: vi.fn().mockResolvedValue({
      data: opts?.upsertError ? null : settingsRow,
      error: opts?.upsertError ?? null,
    }),
  }

  const mockUpsertChain = {
    select: vi.fn().mockReturnValue(mockUpsertSelectChain),
  }

  const mockSettingsQueryWithUpsert = {
    select: vi.fn().mockReturnValue(mockSettingsSelectChain),
    upsert: vi.fn().mockReturnValue(mockUpsertChain),
  }

  const mockFromFn = vi.fn((table: string) => {
    if (table === 'profiles') return mockProfileQuery
    if (table === 'notification_settings') {
      return mockSettingsQueryWithUpsert
    }
    return mockSettingsQuery
  })

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts?.noUser ? null : { id: USER_UUID } },
      }),
    },
    from: mockFromFn,
  }
}

// ─── Zod Schema Tests ──────────────────────────────────────────────────────

describe('NotificationSettingsSchema — validação Zod', () => {
  it('accepts valid settings (default)', () => {
    const input = {
      pre_minutes: 30,
      post_minutes: 30,
      is_enabled: true,
    }
    const result = NotificationSettingsSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('accepts min/max boundaries', () => {
    const input = {
      pre_minutes: 5,
      post_minutes: 120,
      is_enabled: false,
    }
    const result = NotificationSettingsSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects pre_minutes < 5', () => {
    const input = {
      pre_minutes: 4,
      post_minutes: 30,
      is_enabled: true,
    }
    const result = NotificationSettingsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects pre_minutes > 120', () => {
    const input = {
      pre_minutes: 121,
      post_minutes: 30,
      is_enabled: true,
    }
    const result = NotificationSettingsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects post_minutes < 5', () => {
    const input = {
      pre_minutes: 30,
      post_minutes: 4,
      is_enabled: true,
    }
    const result = NotificationSettingsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects non-integer values', () => {
    const input = {
      pre_minutes: 30.5,
      post_minutes: 30,
      is_enabled: true,
    }
    const result = NotificationSettingsSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

// ─── getNotificationSettings Tests ────────────────────────────────────────

describe('getNotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns unauthorized when no user', async () => {
    const mockClient = buildMockServerClient({ noUser: true })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await getNotificationSettings()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
  })

  it('returns not_found when profile lookup fails', async () => {
    const mockClient = buildMockServerClient({
      profileError: { message: 'DB error' },
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await getNotificationSettings()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('not_found')
    }
  })

  it('returns existing settings from database', async () => {
    const mockClient = buildMockServerClient()
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await getNotificationSettings()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.pre_minutes).toBe(30)
      expect(result.data.post_minutes).toBe(30)
      expect(result.data.is_enabled).toBe(true)
    }
  })

  it('returns defaults when no settings exist', async () => {
    const mockClient = buildMockServerClient({
      settingsData: null,
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await getNotificationSettings()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.pre_minutes).toBe(30)
      expect(result.data.post_minutes).toBe(30)
      expect(result.data.is_enabled).toBe(true)
    }
  })

  it('returns error when settings query fails', async () => {
    const mockClient = buildMockServerClient({
      settingsError: { message: 'DB error' },
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await getNotificationSettings()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('internal')
    }
  })
})

// ─── updateNotificationSettings Tests ──────────────────────────────────────

describe('updateNotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns validation error for invalid input', async () => {
    const mockClient = buildMockServerClient()
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await updateNotificationSettings({
      pre_minutes: 4, // below min
      post_minutes: 30,
      is_enabled: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('validation')
    }
  })

  it('returns unauthorized when no user', async () => {
    const mockClient = buildMockServerClient({ noUser: true })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await updateNotificationSettings({
      pre_minutes: 30,
      post_minutes: 30,
      is_enabled: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized')
    }
  })

  it('returns forbidden for player role', async () => {
    const mockClient = buildMockServerClient({
      profileData: {
        id: PROFILE_ID,
        club_id: CLUB_UUID,
        role: 'player',
      },
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await updateNotificationSettings({
      pre_minutes: 30,
      post_minutes: 30,
      is_enabled: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('forbidden')
    }
  })

  it('returns forbidden for analyst role without staff check', async () => {
    const mockClient = buildMockServerClient({
      profileData: {
        id: PROFILE_ID,
        club_id: CLUB_UUID,
        role: 'manager', // not coach or analyst
      },
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await updateNotificationSettings({
      pre_minutes: 30,
      post_minutes: 30,
      is_enabled: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('forbidden')
    }
  })

  it('successfully updates settings for coach', async () => {
    const mockClient = buildMockServerClient({
      profileData: {
        id: PROFILE_ID,
        club_id: CLUB_UUID,
        role: 'coach',
      },
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await updateNotificationSettings({
      pre_minutes: 15,
      post_minutes: 45,
      is_enabled: false,
    })

    expect(result.ok).toBe(true)
  })

  it('successfully updates settings for analyst', async () => {
    const mockClient = buildMockServerClient({
      profileData: {
        id: PROFILE_ID,
        club_id: CLUB_UUID,
        role: 'analyst',
      },
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await updateNotificationSettings({
      pre_minutes: 20,
      post_minutes: 40,
      is_enabled: true,
    })

    expect(result.ok).toBe(true)
  })

  it('returns error when upsert fails', async () => {
    const mockClient = buildMockServerClient({
      profileData: {
        id: PROFILE_ID,
        club_id: CLUB_UUID,
        role: 'coach',
      },
      upsertError: { message: 'Constraint violation' },
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const result = await updateNotificationSettings({
      pre_minutes: 30,
      post_minutes: 30,
      is_enabled: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('internal')
    }
  })
})
