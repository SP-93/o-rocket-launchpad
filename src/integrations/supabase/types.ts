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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          wallet_address: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          wallet_address: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      game_bets: {
        Row: {
          auto_cashout_at: number | null
          bet_amount: number
          cashed_out_at: number | null
          created_at: string | null
          id: string
          round_id: string | null
          status: string | null
          ticket_id: string | null
          wallet_address: string
          winnings: number | null
        }
        Insert: {
          auto_cashout_at?: number | null
          bet_amount: number
          cashed_out_at?: number | null
          created_at?: string | null
          id?: string
          round_id?: string | null
          status?: string | null
          ticket_id?: string | null
          wallet_address: string
          winnings?: number | null
        }
        Update: {
          auto_cashout_at?: number | null
          bet_amount?: number
          cashed_out_at?: number | null
          created_at?: string | null
          id?: string
          round_id?: string | null
          status?: string | null
          ticket_id?: string | null
          wallet_address?: string
          winnings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_bets_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_bets_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "game_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      game_config: {
        Row: {
          config_key: string
          config_value: Json
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      game_pool: {
        Row: {
          current_balance: number | null
          id: string
          last_payout_at: string | null
          last_refill_at: string | null
          total_deposits: number | null
          total_payouts: number | null
          updated_at: string | null
        }
        Insert: {
          current_balance?: number | null
          id?: string
          last_payout_at?: string | null
          last_refill_at?: string | null
          total_deposits?: number | null
          total_payouts?: number | null
          updated_at?: string | null
        }
        Update: {
          current_balance?: number | null
          id?: string
          last_payout_at?: string | null
          last_refill_at?: string | null
          total_deposits?: number | null
          total_payouts?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      game_revenue: {
        Row: {
          id: string
          last_distribution_at: string | null
          pending_usdt: number | null
          pending_wover: number | null
          total_usdt_collected: number | null
          total_wover_collected: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          last_distribution_at?: string | null
          pending_usdt?: number | null
          pending_wover?: number | null
          total_usdt_collected?: number | null
          total_wover_collected?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          last_distribution_at?: string | null
          pending_usdt?: number | null
          pending_wover?: number | null
          total_usdt_collected?: number | null
          total_wover_collected?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      game_rounds: {
        Row: {
          crash_point: number | null
          crashed_at: string | null
          created_at: string | null
          id: string
          round_number: number
          server_seed: string | null
          server_seed_hash: string | null
          started_at: string | null
          status: string | null
          total_bets: number | null
          total_payouts: number | null
          total_wagered: number | null
        }
        Insert: {
          crash_point?: number | null
          crashed_at?: string | null
          created_at?: string | null
          id?: string
          round_number?: number
          server_seed?: string | null
          server_seed_hash?: string | null
          started_at?: string | null
          status?: string | null
          total_bets?: number | null
          total_payouts?: number | null
          total_wagered?: number | null
        }
        Update: {
          crash_point?: number | null
          crashed_at?: string | null
          created_at?: string | null
          id?: string
          round_number?: number
          server_seed?: string | null
          server_seed_hash?: string | null
          started_at?: string | null
          status?: string | null
          total_bets?: number | null
          total_payouts?: number | null
          total_wagered?: number | null
        }
        Relationships: []
      }
      game_tickets: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_used: boolean | null
          payment_amount: number
          payment_currency: string
          ticket_value: number
          tx_hash: string | null
          used_in_round: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          is_used?: boolean | null
          payment_amount: number
          payment_currency: string
          ticket_value: number
          tx_hash?: string | null
          used_in_round?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_used?: boolean | null
          payment_amount?: number
          payment_currency?: string
          ticket_value?: number
          tx_hash?: string | null
          used_in_round?: string | null
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_used_in_round"
            columns: ["used_in_round"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      protocol_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          verified_at: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          verified_at?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          verified_at?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_wallet_admin: { Args: { _wallet_address: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    },
  },
} as const
