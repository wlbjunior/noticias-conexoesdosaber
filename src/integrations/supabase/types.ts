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
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: Database["public"]["Enums"]["message_status"]
          subject: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      discarded_news: {
        Row: {
          ai_raw_answer: string | null
          description: string | null
          discarded_at: string
          id: string
          published_at: string
          reason: string | null
          restored: boolean
          source_name: string | null
          source_url: string
          theme_id: string | null
          title: string
          topic: Database["public"]["Enums"]["news_topic"]
        }
        Insert: {
          ai_raw_answer?: string | null
          description?: string | null
          discarded_at?: string
          id?: string
          published_at: string
          reason?: string | null
          restored?: boolean
          source_name?: string | null
          source_url: string
          theme_id?: string | null
          title: string
          topic: Database["public"]["Enums"]["news_topic"]
        }
        Update: {
          ai_raw_answer?: string | null
          description?: string | null
          discarded_at?: string
          id?: string
          published_at?: string
          reason?: string | null
          restored?: boolean
          source_name?: string | null
          source_url?: string
          theme_id?: string | null
          title?: string
          topic?: Database["public"]["Enums"]["news_topic"]
        }
        Relationships: [
          {
            foreignKeyName: "discarded_news_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_image_cache: {
        Row: {
          created_at: string
          id: string
          image_url: string
          news_id: string
          prompt: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          news_id: string
          prompt?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          news_id?: string
          prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hero_image_cache_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: true
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_calls: {
        Row: {
          called_at: string
          duration_ms: number | null
          endpoint: string
          error: string | null
          http_status: number | null
          id: string
          integration: string
          items_in: number | null
          items_new: number | null
          method: string
          ok: boolean
        }
        Insert: {
          called_at?: string
          duration_ms?: number | null
          endpoint: string
          error?: string | null
          http_status?: number | null
          id?: string
          integration: string
          items_in?: number | null
          items_new?: number | null
          method?: string
          ok?: boolean
        }
        Update: {
          called_at?: string
          duration_ms?: number | null
          endpoint?: string
          error?: string | null
          http_status?: number | null
          id?: string
          integration?: string
          items_in?: number | null
          items_new?: number | null
          method?: string
          ok?: boolean
        }
        Relationships: []
      }
      internal_news: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_pinned: boolean
          published_at: string | null
          status: string
          theme_id: string | null
          title: string
          topic: Database["public"]["Enums"]["news_topic"]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          published_at?: string | null
          status: string
          theme_id?: string | null
          title: string
          topic?: Database["public"]["Enums"]["news_topic"]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          published_at?: string | null
          status?: string
          theme_id?: string | null
          title?: string
          topic?: Database["public"]["Enums"]["news_topic"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_news_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          created_at: string
          description: string | null
          fetched_at: string
          full_article_url: string | null
          id: string
          image_url: string | null
          published_at: string
          raw: Json | null
          source_name: string | null
          source_url: string
          status: string
          theme_id: string | null
          title: string
          topic: Database["public"]["Enums"]["news_topic"]
          url_hash: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fetched_at?: string
          full_article_url?: string | null
          id?: string
          image_url?: string | null
          published_at: string
          raw?: Json | null
          source_name?: string | null
          source_url: string
          status?: string
          theme_id?: string | null
          title: string
          topic: Database["public"]["Enums"]["news_topic"]
          url_hash?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fetched_at?: string
          full_article_url?: string | null
          id?: string
          image_url?: string | null
          published_at?: string
          raw?: Json | null
          source_name?: string | null
          source_url?: string
          status?: string
          theme_id?: string | null
          title?: string
          topic?: Database["public"]["Enums"]["news_topic"]
          url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      news_analysis: {
        Row: {
          analyzed_at: string
          angle: string | null
          created_at: string
          entities: string[] | null
          id: string
          is_relevant: boolean | null
          is_spam: boolean | null
          model: string | null
          news_id: string
          prompt_version: string | null
          relevance: number | null
          sentiment: string | null
          summary: string | null
        }
        Insert: {
          analyzed_at?: string
          angle?: string | null
          created_at?: string
          entities?: string[] | null
          id?: string
          is_relevant?: boolean | null
          is_spam?: boolean | null
          model?: string | null
          news_id: string
          prompt_version?: string | null
          relevance?: number | null
          sentiment?: string | null
          summary?: string | null
        }
        Update: {
          analyzed_at?: string
          angle?: string | null
          created_at?: string
          entities?: string[] | null
          id?: string
          is_relevant?: boolean | null
          is_spam?: boolean | null
          model?: string | null
          news_id?: string
          prompt_version?: string | null
          relevance?: number | null
          sentiment?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_analysis_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: true
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      news_clicks: {
        Row: {
          clicked_at: string
          id: string
          news_id: string
          theme_id: string | null
          topic: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          news_id: string
          theme_id?: string | null
          topic: string
        }
        Update: {
          clicked_at?: string
          id?: string
          news_id?: string
          theme_id?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_clicks_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_clicks_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_rate_limits: {
        Row: {
          attempts: number
          first_attempt_at: string
          id: string
          ip_hash: string
          last_attempt_at: string
        }
        Insert: {
          attempts?: number
          first_attempt_at?: string
          id?: string
          ip_hash: string
          last_attempt_at?: string
        }
        Update: {
          attempts?: number
          first_attempt_at?: string
          id?: string
          ip_hash?: string
          last_attempt_at?: string
        }
        Relationships: []
      }
      newsletter_subscriptions: {
        Row: {
          confirmed: boolean
          created_at: string
          email: string
          id: string
          last_sent_at: string | null
          topics: Database["public"]["Enums"]["news_topic"][]
          unsubscribe_token: string | null
          updated_at: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          email: string
          id?: string
          last_sent_at?: string | null
          topics?: Database["public"]["Enums"]["news_topic"][]
          unsubscribe_token?: string | null
          updated_at?: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          email?: string
          id?: string
          last_sent_at?: string | null
          topics?: Database["public"]["Enums"]["news_topic"][]
          unsubscribe_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          active: boolean
          consecutive_failures: number
          created_at: string
          id: string
          kind: string
          last_error: string | null
          last_run_at: string | null
          last_status: string
          max_items: number
          name: string
          query: string | null
          theme_id: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string
          max_items?: number
          name: string
          query?: string | null
          theme_id?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          active?: boolean
          consecutive_failures?: number
          created_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          last_run_at?: string | null
          last_status?: string
          max_items?: number
          name?: string
          query?: string | null
          theme_id?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      canonical_url: { Args: { u: string }; Returns: string }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      last_news_refresh_at: { Args: never; Returns: string }
      url_hash: { Args: { u: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      message_status: "novo" | "em_analise" | "respondido"
      news_topic:
        | "mitologia"
        | "filosofia"
        | "religiao"
        | "artes"
        | "psicologia"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      message_status: ["novo", "em_analise", "respondido"],
      news_topic: ["mitologia", "filosofia", "religiao", "artes", "psicologia"],
    },
  },
} as const
