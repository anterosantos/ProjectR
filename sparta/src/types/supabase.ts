// Re-export from canonical location so both import paths resolve correctly:
//   "@/types/supabase"         (story spec convention)
//   "@/lib/supabase/database.types" (legacy path, used by existing client code)
export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "@/lib/supabase/database.types";

// Custom types not generated from schema
export interface ReadinessSnapshot {
  player_id: string;
  session_id: string;
  club_id: string;
  state: 'ready' | 'caution' | 'alert' | 'neutral';
  acwr: number | null;
  acwr_band_lo: number | null;
  acwr_band_hi: number | null;
  recent_fatigue_avg: number | null;
  attendance_rate: number | null;
  data_sufficient: boolean;
  derived_age_group: string | null;
  computed_at: string;
  version?: number; // Optional until schema is refreshed
}

/**
 * ReadinessSnapshot enriched with player metadata for the Painel de Prontidão (Story 5.4).
 * Fetched server-side via getReadinessPanelData() and passed as props to client components.
 */
export interface PlayerReadinessData extends ReadinessSnapshot {
  playerName: string;
  jerseyNum: number;
  /** Primary position string from positions table (e.g. 'GR', 'DEF', 'MED', 'AVA') */
  primaryPosition: string | null;
}

/** One entry in the per-player session history bar (last N past sessions). */
export interface SessionHistoryEntry {
  sessionId: string;
  computedAt: string; // ISO string — used for ordering (oldest → newest)
  state: 'ready' | 'caution' | 'alert' | 'neutral';
}

/** Session history keyed by player_id — max SESSION_HISTORY_COUNT entries per player, sorted oldest→newest. */
export type PlayerSessionHistory = Record<string, SessionHistoryEntry[]>;
