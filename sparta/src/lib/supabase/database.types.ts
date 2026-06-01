export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendances: {
        Row: {
          id: string
          club_id: string
          session_id: string
          player_id: string
          status: string
          note: string | null
          recorded_by: string
          recorded_at: string
        }
        Insert: {
          id?: string
          club_id: string
          session_id: string
          player_id: string
          status: string
          note?: string | null
          recorded_by: string
          recorded_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          session_id?: string
          player_id?: string
          status?: string
          note?: string | null
          recorded_by?: string
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          country: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          club_id: string
          consent_status: string
          created_at: string
          full_name: string | null
          id: string
          role: string
          processing_restricted: boolean
          restricted_at: string | null
        }
        Insert: {
          club_id: string
          consent_status?: string
          created_at?: string
          full_name?: string | null
          id: string
          role: string
          processing_restricted?: boolean
          restricted_at?: string | null
        }
        Update: {
          club_id?: string
          consent_status?: string
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          processing_restricted?: boolean
          restricted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      parental_consent_reminders_log: {
        Row: {
          id: string
          consent_id: string
          kind: string
          sent_at: string
        }
        Insert: {
          id?: string
          consent_id: string
          kind: string
          sent_at?: string
        }
        Update: {
          id?: string
          consent_id?: string
          kind?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parental_consent_reminders_log_consent_id_fkey"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "parental_consents"
            referencedColumns: ["id"]
          },
        ]
      }
      parental_consents: {
        Row: {
          id: string
          club_id: string
          player_id: string
          parent_email: string
          token: string
          token_expires_at: string
          status: string
          confirmed_at: string | null
          confirmed_ip: string | null
          policy_version_id: string
          created_at: string
          last_manual_resend_at: string | null
        }
        Insert: {
          id?: string
          club_id: string
          player_id: string
          parent_email: string
          token: string
          token_expires_at: string
          status: string
          confirmed_at?: string | null
          confirmed_ip?: string | null
          policy_version_id: string
          created_at?: string
          last_manual_resend_at?: string | null
        }
        Update: {
          id?: string
          club_id?: string
          player_id?: string
          parent_email?: string
          token?: string
          token_expires_at?: string
          status?: string
          confirmed_at?: string | null
          confirmed_ip?: string | null
          policy_version_id?: string
          created_at?: string
          last_manual_resend_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parental_consents_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parental_consents_policy_version_id_fkey"
            columns: ["policy_version_id"]
            isOneToOne: false
            referencedRelation: "privacy_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_reconfirmations: {
        Row: {
          id: string
          club_id: string
          player_id: string
          profile_id: string
          token: string
          status: 'pending' | 'confirmed' | 'anonymized'
          created_at: string
          confirmed_at: string | null
          anonymized_at: string | null
        }
        Insert: {
          id?: string
          club_id: string
          player_id: string
          profile_id: string
          token: string
          status: 'pending' | 'confirmed' | 'anonymized'
          created_at?: string
          confirmed_at?: string | null
          anonymized_at?: string | null
        }
        Update: {
          id?: string
          club_id?: string
          player_id?: string
          profile_id?: string
          token?: string
          status?: 'pending' | 'confirmed' | 'anonymized'
          created_at?: string
          confirmed_at?: string | null
          anonymized_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_reconfirmations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_reconfirmations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_reconfirmations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          id: string
          club_id: string
          actor_id: string | null
          action: string
          target_kind: string
          target_id: string | null
          payload: Json | null
          occurred_at: string
        }
        Insert: {
          id?: string
          club_id: string
          actor_id?: string | null
          action: string
          target_kind: string
          target_id?: string | null
          payload?: Json | null
          occurred_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          actor_id?: string | null
          action?: string
          target_kind?: string
          target_id?: string | null
          payload?: Json | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_events: {
        Row: {
          id: string
          club_id: string
          kind: string
          payload_json: Json
          occurred_at: string
        }
        Insert: {
          id?: string
          club_id: string
          kind: string
          payload_json: Json
          occurred_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          kind?: string
          payload_json?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          id: string
          club_id: string
          profile_id: string | null
          jersey_num: number
          full_name: string
          birthdate: string
          age_group: string
          is_archived: boolean
          archived_at: string | null
          is_active: boolean
          inactive_reason: string | null
          photo_path: string | null
          email: string | null
          invite_sent_at: string | null
          created_at: string
          updated_at: string
          processing_restricted: boolean
          restricted_at: string | null
        }
        Insert: {
          id?: string
          club_id: string
          profile_id?: string | null
          jersey_num: number
          full_name: string
          birthdate: string
          age_group: string
          is_archived?: boolean
          archived_at?: string | null
          is_active?: boolean
          inactive_reason?: string | null
          photo_path?: string | null
          email?: string | null
          invite_sent_at?: string | null
          created_at?: string
          updated_at?: string
          processing_restricted?: boolean
          restricted_at?: string | null
        }
        Update: {
          id?: string
          club_id?: string
          profile_id?: string | null
          jersey_num?: number
          full_name?: string
          birthdate?: string
          age_group?: string
          is_archived?: boolean
          archived_at?: string | null
          is_active?: boolean
          inactive_reason?: string | null
          photo_path?: string | null
          email?: string | null
          invite_sent_at?: string | null
          created_at?: string
          updated_at?: string
          processing_restricted?: boolean
          restricted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_metrics: {
        Row: {
          id: string
          club_id: string
          player_id: string
          weight_kg: number | null
          height_cm: number | null
          recorded_at: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          player_id: string
          weight_kg?: number | null
          height_cm?: number | null
          recorded_at?: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          player_id?: string
          weight_kg?: number | null
          height_cm?: number | null
          recorded_at?: string
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_metrics_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_metrics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_metrics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          id: string
          player_id: string
          position: string
          is_primary: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          player_id: string
          position: string
          is_primary?: boolean
          sort_order?: number
        }
        Update: {
          id?: string
          player_id?: string
          position?: string
          is_primary?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "positions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_snapshots: {
        Row: {
          player_id: string
          session_id: string
          club_id: string
          state: 'ready' | 'caution' | 'alert' | 'neutral'
          acwr: number | null
          acwr_band_lo: number | null
          acwr_band_hi: number | null
          recent_fatigue_avg: number | null
          attendance_rate: number | null
          data_sufficient: boolean
          derived_age_group: string | null
          computed_at: string
        }
        Insert: {
          player_id: string
          session_id: string
          club_id: string
          state?: 'ready' | 'caution' | 'alert' | 'neutral'
          acwr?: number | null
          acwr_band_lo?: number | null
          acwr_band_hi?: number | null
          recent_fatigue_avg?: number | null
          attendance_rate?: number | null
          data_sufficient?: boolean
          derived_age_group?: string | null
          computed_at?: string
        }
        Update: {
          player_id?: string
          session_id?: string
          club_id?: string
          state?: 'ready' | 'caution' | 'alert' | 'neutral'
          acwr?: number | null
          acwr_band_lo?: number | null
          acwr_band_hi?: number | null
          recent_fatigue_avg?: number | null
          attendance_rate?: number | null
          data_sufficient?: boolean
          derived_age_group?: string | null
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "readiness_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_snapshots_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          id: string
          club_id: string
          name: string
          start_date: string
          end_date: string
          is_current: boolean
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          name: string
          start_date: string
          end_date: string
          is_current?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          name?: string
          start_date?: string
          end_date?: string
          is_current?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          id: string
          club_id: string
          season_id: string
          type: string
          scheduled_at: string
          duration_min: number
          location: string | null
          status: string
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          season_id: string
          type: string
          scheduled_at: string
          duration_min?: number
          location?: string | null
          status?: string
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          season_id?: string
          type?: string
          scheduled_at?: string
          duration_min?: number
          location?: string | null
          status?: string
          notes?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_policies: {
        Row: {
          id: string
          version: string
          effective_from: string
          body_full_md: string
          body_u14_md: string
          is_current: boolean
          created_at: string
        }
        Insert: {
          id?: string
          version: string
          effective_from?: string
          body_full_md: string
          body_u14_md: string
          is_current?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          version?: string
          effective_from?: string
          body_full_md?: string
          body_u14_md?: string
          is_current?: boolean
          created_at?: string
        }
        Relationships: []
      }
      rectification_requests: {
        Row: {
          id: string
          club_id: string
          player_id: string
          status: string
          field_name: string
          requested_value: string
          current_value: string | null
          reason: string | null
          applied_at: string | null
          applied_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          reject_reason: string | null
          notified_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          player_id: string
          status?: string
          field_name: string
          requested_value: string
          current_value?: string | null
          reason?: string | null
          applied_at?: string | null
          applied_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          reject_reason?: string | null
          notified_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          player_id?: string
          status?: string
          field_name?: string
          requested_value?: string
          current_value?: string | null
          reason?: string | null
          applied_at?: string | null
          applied_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          reject_reason?: string | null
          notified_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rectification_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rectification_requests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rectification_requests_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rectification_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fatigue_responses: {
        Row: {
          id: string
          club_id: string
          player_id: string
          session_id: string
          phase: string
          dim_energy: number
          dim_focus: number
          dim_sleep: number
          dim_soreness: number
          dim_mood: number
          srpe_value: number | null
          submitted_at: string
          submitted_via: string
        }
        Insert: {
          id?: string
          club_id: string
          player_id: string
          session_id: string
          phase: string
          dim_energy: number
          dim_focus: number
          dim_sleep: number
          dim_soreness: number
          dim_mood: number
          srpe_value?: number | null
          submitted_at?: string
          submitted_via: string
        }
        Update: {
          id?: string
          club_id?: string
          player_id?: string
          session_id?: string
          phase?: string
          dim_energy?: number
          dim_focus?: number
          dim_sleep?: number
          dim_soreness?: number
          dim_mood?: number
          srpe_value?: number | null
          submitted_at?: string
          submitted_via?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatigue_responses_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatigue_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          id: string
          club_id: string
          pre_minutes: number
          post_minutes: number
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          club_id: string
          pre_minutes?: number
          post_minutes?: number
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          pre_minutes?: number
          post_minutes?: number
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          id: string
          club_id: string
          profile_id: string
          session_id: string
          kind: string
          scheduled_for: string
          status: string
          sent_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          profile_id: string
          session_id: string
          kind: string
          scheduled_for: string
          status?: string
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          profile_id?: string
          session_id?: string
          kind?: string
          scheduled_for?: string
          status?: string
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          club_id: string
          profile_id: string
          endpoint: string
          keys_json: { p256dh: string; auth: string }
          created_at: string
          last_used_at: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          club_id: string
          profile_id: string
          endpoint: string
          keys_json: { p256dh: string; auth: string }
          created_at?: string
          last_used_at?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          club_id?: string
          profile_id?: string
          endpoint?: string
          keys_json?: { p256dh: string; auth: string }
          created_at?: string
          last_used_at?: string | null
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_metrics: {
        Row: {
          id: string
          club_id: string
          session_id: string
          player_id: string
          srpe_value: number
          duration_min: number
          srpe_load: number
          computed_at: string
        }
        Insert: {
          id?: string
          club_id: string
          session_id: string
          player_id: string
          srpe_value: number
          duration_min: number
          // srpe_load is GENERATED ALWAYS AS STORED — omit from Insert
          computed_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          session_id?: string
          player_id?: string
          srpe_value?: number
          duration_min?: number
          // srpe_load is GENERATED ALWAYS AS STORED — omit from Update
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_metrics_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_metrics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_metrics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      data_decisions: {
        Row: {
          id: string
          club_id: string
          player_id: string | null
          session_id: string | null
          actor_id: string | null
          decision_kind: string
          note: string | null
          was_data_driven: boolean
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          player_id?: string | null
          session_id?: string | null
          actor_id?: string | null
          decision_kind: string
          note?: string | null
          was_data_driven?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          player_id?: string | null
          session_id?: string | null
          actor_id?: string | null
          decision_kind?: string
          note?: string | null
          was_data_driven?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_decisions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_decisions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_decisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_decisions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          id: string
          club_id: string
          session_id: string
          player_id: string | null
          action: string
          zone: string
          occurred_at: string
          captured_at: string
          captured_by: string | null
          captured_via: string
          is_deleted: boolean
          deleted_at: string | null
          deleted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          club_id: string
          session_id: string
          player_id?: string | null
          action: string
          zone: string
          occurred_at: string
          captured_at?: string
          captured_by?: string | null
          captured_via: string
          is_deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          club_id?: string
          session_id?: string
          player_id?: string | null
          action?: string
          zone?: string
          occurred_at?: string
          captured_at?: string
          captured_by?: string | null
          captured_via?: string
          is_deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      club_id: { Args: never; Returns: string }
      is_staff_of_club: { Args: { target_club_id: string }; Returns: boolean }
      user_role: { Args: never; Returns: string }
      uuidv7: { Args: never; Returns: string }
      upsert_player_positions: {
        Args: { p_player_id: string; p_positions: Json }
        Returns: void
      }
      set_current_season: {
        Args: { p_season_id: string }
        Returns: void
      }
      anonymize_archived_player: {
        Args: { p_player_id: string }
        Returns: boolean
      }
      claim_push_notifications: {
        Args: { batch_size?: number }
        Returns: Array<Database['public']['Tables']['notification_log']['Row']>
      }
      reset_stale_processing_notifications: {
        Args: { stale_minutes?: number }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
