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
        }
        Insert: {
          club_id: string
          consent_status?: string
          created_at?: string
          full_name?: string | null
          id: string
          role: string
        }
        Update: {
          club_id?: string
          consent_status?: string
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
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
