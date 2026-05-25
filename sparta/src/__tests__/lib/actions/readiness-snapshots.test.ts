import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshUpcomingReadiness, getClubReadinessSnapshots, getUpcomingSession, getReadinessPanelData } from '@/lib/actions/readiness';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/supabase/service-role', () => ({
  getServiceRoleClient: vi.fn(),
}));

vi.mock('@/lib/readiness/snapshot', () => ({
  refreshSnapshotForSession: vi.fn(),
}));

vi.mock('@/lib/data/audited', () => ({
  auditedRead: vi.fn((opts, fn) => fn()),
}));

// Import after mocking
import { createServerClient } from '@/lib/supabase/server';
import { getServiceRoleClient } from '@/lib/supabase/service-role';
import { refreshSnapshotForSession } from '@/lib/readiness/snapshot';
import { auditedRead } from '@/lib/data/audited';

describe('refreshUpcomingReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthorized error for unauthenticated users', async () => {
    const mockCreateServerClient = vi.mocked(createServerClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);

    const result = await refreshUpcomingReadiness();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized');
      expect(result.error.message).toBe('Não autorizado');
    }
  });

  it('returns unauthorized error for players (non-staff)', async () => {
    const mockCreateServerClient = vi.mocked(createServerClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'player', club_id: 'club-123' },
            }),
          }),
        }),
      }),
    } as any);

    const result = await refreshUpcomingReadiness();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized');
    }
  });

  it('refreshes specific session when sessionId provided', async () => {
    const mockCreateServerClient = vi.mocked(createServerClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'coach', club_id: 'club-123' },
            }),
          }),
        }),
      }),
    } as any);

    // Patch 11: Mock serviceRole.from() for session authorization check
    const mockServiceRole = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { club_id: 'club-123' },
              error: null,
            }),
          }),
        }),
      }),
    } as any;

    const mockGetServiceRole = vi.mocked(getServiceRoleClient);
    mockGetServiceRole.mockReturnValue(mockServiceRole);

    const mockRefresh = vi.mocked(refreshSnapshotForSession);
    mockRefresh.mockResolvedValue(undefined);

    const result = await refreshUpcomingReadiness('session-123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.refreshed).toBe(1);
      expect(mockRefresh).toHaveBeenCalledWith(mockServiceRole, 'session-123');
    }
  });

  it('refreshes all scheduled sessions for next 7 days when no sessionId', async () => {
    const mockCreateServerClient = vi.mocked(createServerClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'analyst', club_id: 'club-123' },
            }),
          }),
        }),
      }),
    } as any);

    const mockServiceRole = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn()
            .mockReturnValueOnce({
              eq: vi.fn().mockReturnValueOnce({
                gte: vi.fn().mockReturnValue({
                  lte: vi.fn().mockResolvedValue({
                    data: [
                      { id: 'session-1' },
                      { id: 'session-2' },
                      { id: 'session-3' },
                    ],
                  }),
                }),
              }),
            }),
        }),
      }),
    };

    const mockGetServiceRole = vi.mocked(getServiceRoleClient);
    mockGetServiceRole.mockReturnValue(mockServiceRole as any);

    const mockRefresh = vi.mocked(refreshSnapshotForSession);
    mockRefresh.mockResolvedValue(undefined);

    const result = await refreshUpcomingReadiness();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.refreshed).toBe(3);
      expect(mockRefresh).toHaveBeenCalledTimes(3);
    }
  });
});

describe('getClubReadinessSnapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthorized error for unauthenticated users', async () => {
    const mockCreateServerClient = vi.mocked(createServerClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);

    const result = await getClubReadinessSnapshots('session-123');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized');
    }
  });

  it('returns unauthorized error for players', async () => {
    const mockCreateServerClient = vi.mocked(createServerClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'player', club_id: 'club-123' },
            }),
          }),
        }),
      }),
    } as any);

    const result = await getClubReadinessSnapshots('session-123');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unauthorized');
    }
  });

  it('returns snapshots sorted by state priority', async () => {
    const mockCreateServerClient = vi.mocked(createServerClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'coach', club_id: 'club-123' },
            }),
          }),
        }),
      }),
    } as any);

    const mockAuditedRead = vi.mocked(auditedRead);
    mockAuditedRead.mockImplementation(async (opts, fn) => {
      const mockSnapshots = [
        { state: 'ready', acwr: 1.2, player_id: 'p1' },
        { state: 'alert', acwr: 1.8, player_id: 'p2' },
        { state: 'caution', acwr: 1.5, player_id: 'p3' },
        { state: 'neutral', acwr: null, player_id: 'p4' },
        { state: 'ready', acwr: 0.9, player_id: 'p5' },
      ];
      return { data: mockSnapshots };
    });

    const result = await getClubReadinessSnapshots('session-123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      const snapshots = result.data.snapshots;
      expect(snapshots.length).toBe(5);
      // Verify order: alert (1), caution (2), ready (3), neutral (4)
      expect(snapshots[0]?.state).toBe('alert');
      expect(snapshots[1]?.state).toBe('caution');
      expect(snapshots[2]?.state).toBe('ready');
      expect(snapshots[3]?.state).toBe('ready');
      expect(snapshots[4]?.state).toBe('neutral');
      // Verify ACWR DESC within same state
      expect(snapshots[2]?.acwr).toBeGreaterThan(snapshots[3]?.acwr ?? 0);
    }
  });

  it('handles empty snapshots list', async () => {
    const mockCreateServerClient = vi.mocked(createServerClient);
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'coach', club_id: 'club-123' },
            }),
          }),
        }),
      }),
    } as any);

    const mockAuditedRead = vi.mocked(auditedRead);
    mockAuditedRead.mockResolvedValue({ data: [] });

    const result = await getClubReadinessSnapshots('session-123');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.snapshots).toEqual([]);
    }
  });
});

// ── getUpcomingSession (Story 5.4) ───────────────────────────────────────────

function makeStaffClient(opts: {
  role?: string;
  clubId?: string;
  sessionData?: { id: string; scheduled_at: string } | null;
  sessionError?: boolean;
}) {
  const role    = opts.role    ?? 'coach';
  const clubId  = opts.clubId  ?? 'club-123';

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role, club_id: clubId }, error: null }),
        };
      }
      if (table === 'sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue(
            opts.sessionError
              ? { data: null, error: { message: 'DB error' } }
              : { data: opts.sessionData !== undefined ? opts.sessionData : { id: 'session-123', scheduled_at: new Date(Date.now() + 86400000).toISOString() }, error: null }
          ),
        };
      }
      // Default: readiness_snapshots, players, positions
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
      };
    }),
  } as any;
}

describe('getUpcomingSession (Story 5.4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna unauthorized para player', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeStaffClient({ role: 'player' }));
    const result = await getUpcomingSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unauthorized');
  });

  it('retorna null quando não há sessão nas próximas 7 dias', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeStaffClient({ sessionData: null }));
    const result = await getUpcomingSession();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeNull();
  });

  it('retorna sessionId quando há sessão agendada', async () => {
    const futureAt = new Date(Date.now() + 86400000).toISOString();
    vi.mocked(createServerClient).mockResolvedValue(
      makeStaffClient({ sessionData: { id: 'session-abc', scheduled_at: futureAt } })
    );
    const result = await getUpcomingSession();
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.sessionId).toBe('session-abc');
      expect(result.data.scheduledAt).toBe(futureAt);
    }
  });

  it('retorna db_error quando query falha', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeStaffClient({ sessionError: true }));
    const result = await getUpcomingSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('db_error');
  });
});

describe('getReadinessPanelData (Story 5.4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna unauthorized para player', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeStaffClient({ role: 'player' }));
    const result = await getReadinessPanelData('session-123');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unauthorized');
  });

  it('retorna not_found para sessionId vazio', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeStaffClient({}));
    const result = await getReadinessPanelData('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('not_found');
  });

  it('retorna lista vazia quando não há snapshots', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeStaffClient({}));
    // auditedRead returns no snapshots
    vi.mocked(auditedRead).mockImplementation(async (_opts, _fn) => ({ data: [], error: null }));
    const result = await getReadinessPanelData('session-123');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.players).toHaveLength(0);
  });

  it('ordena jogadores: alert → caution → ready → neutral', async () => {
    vi.mocked(createServerClient).mockResolvedValue(makeStaffClient({}));
    vi.mocked(auditedRead).mockImplementation(async (_opts, _fn) => ({
      data: [
        { player_id: 'p-ready',   state: 'ready',   acwr: 1.0 },
        { player_id: 'p-neutral', state: 'neutral', acwr: null },
        { player_id: 'p-alert',   state: 'alert',   acwr: 1.8 },
        { player_id: 'p-caution', state: 'caution', acwr: 1.4 },
      ],
      error: null,
    }));

    // players + positions return empty (fallback names used)
    const client = makeStaffClient({});
    // Override to return empty arrays for players/positions
    vi.mocked(createServerClient).mockResolvedValue({
      ...client,
      from: vi.fn((table: string) => {
        if (table === 'profiles') return client.from('profiles');
        if (table === 'readiness_snapshots') return client.from('readiness_snapshots');
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
        };
      }),
    } as any);

    const result = await getReadinessPanelData('session-123');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const states = result.data.players.map(p => p.state);
      expect(states).toEqual(['alert', 'caution', 'ready', 'neutral']);
    }
  });
});
