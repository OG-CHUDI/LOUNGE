/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT
// Run migrations to regenerate.

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
      ama_questions: {
        Row: {
          ama_id: string
          answer: string | null
          asker_id: string
          created_at: string | null
          id: string
          question: string
        }
        Insert: {
          ama_id: string
          answer?: string | null
          asker_id: string
          created_at?: string | null
          id?: string
          question: string
        }
        Update: {
          ama_id?: string
          answer?: string | null
          asker_id?: string
          created_at?: string | null
          id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "ama_questions_ama_id_fkey"
            columns: ["ama_id"]
            isOneToOne: false
            referencedRelation: "amas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ama_questions_asker_id_fkey"
            columns: ["asker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      amas: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          spotlight_user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          spotlight_user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          spotlight_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "amas_spotlight_user_id_fkey"
            columns: ["spotlight_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_teasers: {
        Row: {
          answer: string
          created_at: string | null
          date: string
          id: string
          prompt: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          date: string
          id?: string
          prompt: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          date?: string
          id?: string
          prompt?: string
        }
        Relationships: []
      }
      canvas_boards: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          snapshot: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          snapshot?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          snapshot?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      canvas_members: {
        Row: {
          board_id: string
          created_at: string | null
          invited_by: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string | null
          invited_by?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string | null
          invited_by?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      game_scores: {
        Row: {
          created_at: string | null
          detail: Json | null
          game_key: string
          id: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          detail?: Json | null
          game_key: string
          id?: string
          score: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          detail?: Json | null
          game_key?: string
          id?: string
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      meme_comments: {
        Row: {
          body: string
          created_at: string | null
          id: string
          meme_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          meme_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          meme_id?: string
          user_id?: string
        }
        Relationships: []
      }
      meme_wall_members: {
        Row: {
          created_at: string | null
          invited_by: string | null
          status: string | null
          user_id: string
          wall_id: string
        }
        Insert: {
          created_at?: string | null
          invited_by?: string | null
          status?: string | null
          user_id: string
          wall_id: string
        }
        Update: {
          created_at?: string | null
          invited_by?: string | null
          status?: string | null
          user_id?: string
          wall_id?: string
        }
        Relationships: []
      }
      meme_walls: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      course_progress: {
        Row: {
          course_id: string
          percent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          percent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          percent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string | null
          cover_url: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          title: string
        }
        Insert: {
          category?: string | null
          cover_url?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          title: string
        }
        Update: {
          category?: string | null
          cover_url?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      desk_pets: {
        Row: {
          accessories: Json | null
          adopted_on: string | null
          created_at: string | null
          fed_on: string | null
          happiness: number | null
          last_active_on: string | null
          pet_name: string | null
          species: string | null
          stage: string | null
          streak: number | null
          updated_at: string | null
          user_id: string
          xp: number | null
        }
        Insert: {
          accessories?: Json | null
          adopted_on?: string | null
          created_at?: string | null
          fed_on?: string | null
          happiness?: number | null
          last_active_on?: string | null
          pet_name?: string | null
          species?: string | null
          stage?: string | null
          streak?: number | null
          updated_at?: string | null
          user_id: string
          xp?: number | null
        }
        Update: {
          accessories?: Json | null
          adopted_on?: string | null
          created_at?: string | null
          fed_on?: string | null
          happiness?: number | null
          last_active_on?: string | null
          pet_name?: string | null
          species?: string | null
          stage?: string | null
          streak?: number | null
          updated_at?: string | null
          user_id?: string
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "desk_pets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      focus_status: {
        Row: {
          is_focusing: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          is_focusing?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          is_focusing?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_matches: {
        Row: {
          created_at: string | null
          game_id: string
          host_id: string
          id: string
          opponent_id: string | null
          score: Json | null
          state: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          game_id: string
          host_id: string
          id?: string
          opponent_id?: string | null
          score?: Json | null
          state?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          game_id?: string
          host_id?: string
          id?: string
          opponent_id?: string | null
          score?: Json | null
          state?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_matches_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_matches_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_matches_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          avg_minutes: number | null
          cover_url: string | null
          created_at: string | null
          id: string
          mode: string
          title: string
        }
        Insert: {
          avg_minutes?: number | null
          cover_url?: string | null
          created_at?: string | null
          id?: string
          mode: string
          title: string
        }
        Update: {
          avg_minutes?: number | null
          cover_url?: string | null
          created_at?: string | null
          id?: string
          mode?: string
          title?: string
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          id: string
          solve_seconds: number
          solved_at: string | null
          teaser_id: string
          user_id: string
        }
        Insert: {
          id?: string
          solve_seconds: number
          solved_at?: string | null
          teaser_id: string
          user_id: string
        }
        Update: {
          id?: string
          solve_seconds?: number
          solved_at?: string | null
          teaser_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_teaser_id_fkey"
            columns: ["teaser_id"]
            isOneToOne: false
            referencedRelation: "brain_teasers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_now: {
        Row: {
          track_title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          track_title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          track_title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_now_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meme_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          meme_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          meme_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          meme_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meme_reactions_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memes: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          image_url: string
          poster_id: string
          wall_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          poster_id: string
          wall_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          poster_id?: string
          wall_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memes_poster_id_fkey"
            columns: ["poster_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string | null
          curator_id: string
          id: string
          spotify_url: string
          title: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string | null
          curator_id: string
          id?: string
          spotify_url: string
          title: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string | null
          curator_id?: string
          id?: string
          spotify_url?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlists_curator_id_fkey"
            columns: ["curator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pomodoro_participants: {
        Row: {
          session_id: string
          user_id: string
        }
        Insert: {
          session_id: string
          user_id: string
        }
        Update: {
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pomodoro_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "pomodoro_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pomodoro_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pomodoro_sessions: {
        Row: {
          ends_at: string | null
          host_id: string
          id: string
          phase: string
          started_at: string
          status: string | null
        }
        Insert: {
          ends_at?: string | null
          host_id: string
          id?: string
          phase: string
          started_at?: string
          status?: string | null
        }
        Update: {
          ends_at?: string | null
          host_id?: string
          id?: string
          phase?: string
          started_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pomodoro_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          name: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id: string
          name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      skill_swaps: {
        Row: {
          author_id: string
          blurb: string | null
          created_at: string | null
          id: string
          skill: string
          tags: string[] | null
          type: string
        }
        Insert: {
          author_id: string
          blurb?: string | null
          created_at?: string | null
          id?: string
          skill: string
          tags?: string[] | null
          type: string
        }
        Update: {
          author_id?: string
          blurb?: string | null
          created_at?: string | null
          id?: string
          skill?: string
          tags?: string[] | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_swaps_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
