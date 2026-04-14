export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          listing_id: string
          provider_id: string
          seeker_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id: string
          provider_id: string
          seeker_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string
          provider_id?: string
          seeker_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_listing_provider_fk"
            columns: ["listing_id", "provider_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "conversations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_images: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          listing_id: string
          public_url: string | null
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          listing_id: string
          public_url?: string | null
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          listing_id?: string
          public_url?: string | null
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          listing_id: string
          reason_code: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          listing_id: string
          reason_code: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          listing_id?: string
          reason_code?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address_text: string | null
          archived_at: string | null
          area_m2: number
          available_from: string | null
          balcony: boolean
          bathrooms: number | null
          bedrooms: number | null
          city: string
          created_at: string
          currency_code: string
          deposit_amount: number | null
          description: string
          elevator: boolean
          floor_number: number | null
          furnished: boolean
          heating_type: Database["public"]["Enums"]["heating_type"] | null
          id: string
          internet_included: boolean
          latitude: number | null
          listing_status: Database["public"]["Enums"]["listing_status"]
          listing_type: Database["public"]["Enums"]["listing_type"]
          longitude: number | null
          neighborhood: string | null
          owner_id: string
          parking: boolean
          pets_allowed: boolean
          price_amount: number
          property_type: Database["public"]["Enums"]["property_type"]
          public_location_mode: Database["public"]["Enums"]["public_location_mode"]
          published_at: string | null
          slug: string
          title: string
          total_floors: number | null
          updated_at: string
          utilities_included: boolean
        }
        Insert: {
          address_text?: string | null
          archived_at?: string | null
          area_m2: number
          available_from?: string | null
          balcony?: boolean
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          created_at?: string
          currency_code?: string
          deposit_amount?: number | null
          description: string
          elevator?: boolean
          floor_number?: number | null
          furnished?: boolean
          heating_type?: Database["public"]["Enums"]["heating_type"] | null
          id?: string
          internet_included?: boolean
          latitude?: number | null
          listing_status?: Database["public"]["Enums"]["listing_status"]
          listing_type: Database["public"]["Enums"]["listing_type"]
          longitude?: number | null
          neighborhood?: string | null
          owner_id: string
          parking?: boolean
          pets_allowed?: boolean
          price_amount: number
          property_type: Database["public"]["Enums"]["property_type"]
          public_location_mode?: Database["public"]["Enums"]["public_location_mode"]
          published_at?: string | null
          slug: string
          title: string
          total_floors?: number | null
          updated_at?: string
          utilities_included?: boolean
        }
        Update: {
          address_text?: string | null
          archived_at?: string | null
          area_m2?: number
          available_from?: string | null
          balcony?: boolean
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          created_at?: string
          currency_code?: string
          deposit_amount?: number | null
          description?: string
          elevator?: boolean
          floor_number?: number | null
          furnished?: boolean
          heating_type?: Database["public"]["Enums"]["heating_type"] | null
          id?: string
          internet_included?: boolean
          latitude?: number | null
          listing_status?: Database["public"]["Enums"]["listing_status"]
          listing_type?: Database["public"]["Enums"]["listing_type"]
          longitude?: number | null
          neighborhood?: string | null
          owner_id?: string
          parking?: boolean
          pets_allowed?: boolean
          price_amount?: number
          property_type?: Database["public"]["Enums"]["property_type"]
          public_location_mode?: Database["public"]["Enums"]["public_location_mode"]
          published_at?: string | null
          slug?: string
          title?: string
          total_floors?: number | null
          updated_at?: string
          utilities_included?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by_user_id: string | null
          joined_at: string
          member_status: Database["public"]["Enums"]["organization_member_status"]
          organization_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          joined_at?: string
          member_status?: Database["public"]["Enums"]["organization_member_status"]
          organization_id: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          joined_at?: string
          member_status?: Database["public"]["Enums"]["organization_member_status"]
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          coverage_area: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          logo_path: string | null
          name: string
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          coverage_area?: string | null
          created_at?: string
          created_by_user_id: string
          description?: string | null
          id?: string
          logo_path?: string | null
          name: string
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          coverage_area?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          logo_path?: string | null
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          contact_email: string | null
          contact_methods: Database["public"]["Enums"]["preferred_contact_method"][]
          created_at: string
          display_name: string
          id: string
          phone: string | null
          preferred_contact_method:
            | Database["public"]["Enums"]["preferred_contact_method"]
            | null
          provider_account_type: Database["public"]["Enums"]["provider_account_type"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          viber_phone: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          contact_email?: string | null
          contact_methods?: Database["public"]["Enums"]["preferred_contact_method"][]
          created_at?: string
          display_name: string
          id: string
          phone?: string | null
          preferred_contact_method?:
            | Database["public"]["Enums"]["preferred_contact_method"]
            | null
          provider_account_type?: Database["public"]["Enums"]["provider_account_type"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          viber_phone?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          contact_email?: string | null
          contact_methods?: Database["public"]["Enums"]["preferred_contact_method"][]
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          preferred_contact_method?:
            | Database["public"]["Enums"]["preferred_contact_method"]
            | null
          provider_account_type?: Database["public"]["Enums"]["provider_account_type"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          viber_phone?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      security_audit_events: {
        Row: {
          actor_role: Database["public"]["Enums"]["app_role"] | null
          actor_user_id: string | null
          conversation_id: string | null
          created_at: string
          event_type: string
          from_status: Database["public"]["Enums"]["listing_status"] | null
          id: string
          listing_id: string | null
          metadata: Json
          report_id: string | null
          target_id: string | null
          target_type: string | null
          to_status: Database["public"]["Enums"]["listing_status"] | null
        }
        Insert: {
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          actor_user_id?: string | null
          conversation_id?: string | null
          created_at?: string
          event_type: string
          from_status?: Database["public"]["Enums"]["listing_status"] | null
          id?: string
          listing_id?: string | null
          metadata?: Json
          report_id?: string | null
          target_id?: string | null
          target_type?: string | null
          to_status?: Database["public"]["Enums"]["listing_status"] | null
        }
        Update: {
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          actor_user_id?: string | null
          conversation_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: Database["public"]["Enums"]["listing_status"] | null
          id?: string
          listing_id?: string | null
          metadata?: Json
          report_id?: string | null
          target_id?: string | null
          target_type?: string | null
          to_status?: Database["public"]["Enums"]["listing_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_audit_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_audit_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_audit_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "listing_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          actor_key: string
          bucket: string
          hit_count: number
          updated_at: string
          window_ends_at: string
          window_started_at: string
        }
        Insert: {
          actor_key: string
          bucket: string
          hit_count?: number
          updated_at?: string
          window_ends_at: string
          window_started_at: string
        }
        Update: {
          actor_key?: string
          bucket?: string
          hit_count?: number
          updated_at?: string
          window_ends_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_rate_limit_token: {
        Args: {
          actor_key_input: string
          bucket_name: string
          max_attempts: number
          window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      create_organization_workspace: {
        Args: { p_description?: string; p_name: string }
        Returns: {
          organization_id: string
          organization_slug: string
          owner_member_id: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      log_security_audit_event: {
        Args: {
          p_actor_role?: Database["public"]["Enums"]["app_role"]
          p_actor_user_id?: string
          p_conversation_id?: string
          p_event_type: string
          p_from_status?: Database["public"]["Enums"]["listing_status"]
          p_listing_id?: string
          p_metadata?: Json
          p_report_id?: string
          p_target_id?: string
          p_target_type?: string
          p_to_status?: Database["public"]["Enums"]["listing_status"]
        }
        Returns: string
      }
      is_valid_listing_image_path: {
        Args: { object_name: string }
        Returns: boolean
      }
      listing_image_listing_id: {
        Args: { object_name: string }
        Returns: string
      }
      listing_image_owner_id: { Args: { object_name: string }; Returns: string }
    }
    Enums: {
      app_role: "seeker" | "provider" | "admin"
      heating_type: "central" | "electric" | "gas" | "district" | "other"
      listing_status:
        | "draft"
        | "published"
        | "paused"
        | "archived"
        | "sold"
        | "rented"
        | "hidden_by_admin"
      listing_type: "rent" | "sale"
      organization_member_role: "owner" | "admin" | "manager" | "agent"
      organization_member_status: "active" | "invited" | "inactive"
      organization_status: "active" | "inactive"
      preferred_contact_method: "in_app" | "phone" | "email" | "whatsapp" | "viber"
      provider_account_type: "individual" | "company"
      property_type: "apartment" | "house" | "studio" | "land" | "commercial"
      public_location_mode: "exact" | "approximate" | "hidden"
      report_reason:
        | "spam"
        | "fraud"
        | "duplicate"
        | "inappropriate"
        | "incorrect_information"
        | "other"
      report_status: "open" | "under_review" | "resolved" | "dismissed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["seeker", "provider", "admin"],
      heating_type: ["central", "electric", "gas", "district", "other"],
      listing_status: [
        "draft",
        "published",
        "paused",
        "archived",
        "sold",
        "rented",
        "hidden_by_admin",
      ],
      listing_type: ["rent", "sale"],
      organization_member_role: ["owner", "admin", "manager", "agent"],
      organization_member_status: ["active", "invited", "inactive"],
      organization_status: ["active", "inactive"],
      preferred_contact_method: ["in_app", "phone", "email", "whatsapp", "viber"],
      provider_account_type: ["individual", "company"],
      property_type: ["apartment", "house", "studio", "land", "commercial"],
      public_location_mode: ["exact", "approximate", "hidden"],
      report_reason: [
        "spam",
        "fraud",
        "duplicate",
        "inappropriate",
        "incorrect_information",
        "other",
      ],
      report_status: ["open", "under_review", "resolved", "dismissed"],
    },
  },
} as const
