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
      channels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          last_message_at: string
          user_high: string
          user_low: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          user_high: string
          user_low: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          user_high?: string
          user_low?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      live_acs_messages: {
        Row: {
          acs_id: string
          author_id: string | null
          body: string
          created_at: string
          file_path: string | null
          id: string
          kind: string
        }
        Insert: {
          acs_id: string
          author_id?: string | null
          body?: string
          created_at?: string
          file_path?: string | null
          id?: string
          kind: string
        }
        Update: {
          acs_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
          file_path?: string | null
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_acs_messages_acs_id_fkey"
            columns: ["acs_id"]
            isOneToOne: false
            referencedRelation: "live_active_call_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      live_active_call_spaces: {
        Row: {
          channel_id: string
          closed_at: string | null
          created_at: string
          id: string
          membrane_id: string | null
          previewer_id: string
          request_id: string
          scratchpad: string
          viewer_id: string
        }
        Insert: {
          channel_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          membrane_id?: string | null
          previewer_id: string
          request_id: string
          scratchpad?: string
          viewer_id: string
        }
        Update: {
          channel_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          membrane_id?: string | null
          previewer_id?: string
          request_id?: string
          scratchpad?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_active_call_spaces_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "live_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_active_call_spaces_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "live_call_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      live_call_requests: {
        Row: {
          channel_id: string
          created_at: string
          decided_at: string | null
          id: string
          previewer_id: string
          status: string
          story_plot: string
          suggested_role: string
          viewer_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          decided_at?: string | null
          id?: string
          previewer_id: string
          status?: string
          story_plot: string
          suggested_role: string
          viewer_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          previewer_id?: string
          status?: string
          story_plot?: string
          suggested_role?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_call_requests_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "live_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      live_channels: {
        Row: {
          active_boxes: string[]
          box_payload: Json
          created_at: string
          description: string | null
          id: string
          is_open: boolean
          min_tokens: number
          multi_window: boolean
          name: string
          per_minute_rate: number
          previewer_id: string
          slug: string
        }
        Insert: {
          active_boxes?: string[]
          box_payload?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_open?: boolean
          min_tokens?: number
          multi_window?: boolean
          name: string
          per_minute_rate?: number
          previewer_id: string
          slug: string
        }
        Update: {
          active_boxes?: string[]
          box_payload?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_open?: boolean
          min_tokens?: number
          multi_window?: boolean
          name?: string
          per_minute_rate?: number
          previewer_id?: string
          slug?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
          words: number
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
          words: number
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
          words?: number
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      previewer_brain_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      previewer_brand_payloads: {
        Row: {
          api_link: string | null
          api_seed: number | null
          brand_appeal: string | null
          brand_name: string | null
          brand_self: string | null
          created_at: string
          id: string
          payload: Json | null
          user_id: string
        }
        Insert: {
          api_link?: string | null
          api_seed?: number | null
          brand_appeal?: string | null
          brand_name?: string | null
          brand_self?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          user_id: string
        }
        Update: {
          api_link?: string | null
          api_seed?: number | null
          brand_appeal?: string | null
          brand_name?: string | null
          brand_self?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      previewer_lyrics: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          name: string
          title: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          title?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      previewer_recommendations: {
        Row: {
          created_at: string
          id: string
          label: string
          meta: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          meta?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          meta?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      previewer_recordings: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          mime_type: string | null
          name: string
          storage_path: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          mime_type?: string | null
          name: string
          storage_path: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          storage_path?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          phone: string | null
          token_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          token_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          token_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      token_spend_logs: {
        Row: {
          created_at: string
          currency_issues: string | null
          hold_place: string | null
          id: string
          log_hold: string | null
          original_text: string | null
          reason: string
          string_appeal: string | null
          token_units: number
          transaction_id: string | null
          user_currency: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          currency_issues?: string | null
          hold_place?: string | null
          id?: string
          log_hold?: string | null
          original_text?: string | null
          reason: string
          string_appeal?: string | null
          token_units: number
          transaction_id?: string | null
          user_currency?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          currency_issues?: string | null
          hold_place?: string | null
          id?: string
          log_hold?: string | null
          original_text?: string | null
          reason?: string
          string_appeal?: string | null
          token_units?: number
          transaction_id?: string | null
          user_currency?: string | null
          user_id?: string
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          amount_cents: number
          amount_paid_inr: number
          created_at: string
          currency: string
          environment: string
          id: string
          price_id: string
          status: string
          stripe_session_id: string | null
          tokens_credited: number
          user_id: string
        }
        Insert: {
          amount_cents: number
          amount_paid_inr?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          price_id: string
          status?: string
          stripe_session_id?: string | null
          tokens_credited: number
          user_id: string
        }
        Update: {
          amount_cents?: number
          amount_paid_inr?: number
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          price_id?: string
          status?: string
          stripe_session_id?: string | null
          tokens_credited?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      accept_call_request: { Args: { p_request_id: string }; Returns: Json }
      admin_credit_tokens: {
        Args: {
          p_amount_inr: number
          p_razorpay_payment_id: string
          p_tier: string
          p_tokens: number
          p_user_email: string
        }
        Returns: Json
      }
      conversation_peer_email: { Args: { p_conv_id: string }; Returns: string }
      credit_tokens: {
        Args: { p_tokens: number; p_user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      previewer_collect_minute: { Args: { p_acs_id: string }; Returns: Json }
      reject_call_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      send_message: {
        Args: {
          p_body: string
          p_channel_slug: string
          p_recipient_email: string
        }
        Returns: Json
      }
      spend_tokens:
        | { Args: { p_reason: string; p_tokens: number }; Returns: Json }
        | {
            Args: {
              p_currency_issues?: string
              p_hold_place?: string
              p_log_hold?: string
              p_original_text?: string
              p_reason: string
              p_string_appeal?: string
              p_tokens: number
              p_user_currency?: string
            }
            Returns: Json
          }
      wipe_viewer_traces: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user" | "previewer"
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
      app_role: ["admin", "user", "previewer"],
    },
  },
} as const
