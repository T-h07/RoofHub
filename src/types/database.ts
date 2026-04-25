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
      company_internal_conversation_participants: {
        Row: {
          added_by_user_id: string | null
          conversation_id: string
          created_at: string
          id: string
          joined_at: string
          last_read_at: string | null
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          added_by_user_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          added_by_user_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_internal_conversation_participants_added_by_user_id_fkey"
            columns: ["added_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_internal_conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "company_internal_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_internal_conversation_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_internal_conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_internal_conversations: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          kind: Database["public"]["Enums"]["company_internal_conversation_kind"]
          last_message_at: string
          organization_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          kind?: Database["public"]["Enums"]["company_internal_conversation_kind"]
          last_message_at?: string
          organization_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["company_internal_conversation_kind"]
          last_message_at?: string
          organization_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_internal_conversations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_internal_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_internal_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_user_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_user_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "company_internal_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_internal_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_at: string | null
          assigned_member_user_id: string | null
          created_at: string
          id: string
          last_message_at: string
          listing_id: string
          organization_id: string | null
          owner_mode: Database["public"]["Enums"]["conversation_owner_mode"]
          provider_id: string
          routing_status: Database["public"]["Enums"]["conversation_routing_status"]
          seeker_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_member_user_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id: string
          organization_id?: string | null
          owner_mode?: Database["public"]["Enums"]["conversation_owner_mode"]
          provider_id: string
          routing_status?: Database["public"]["Enums"]["conversation_routing_status"]
          seeker_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_member_user_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string
          organization_id?: string | null
          owner_mode?: Database["public"]["Enums"]["conversation_owner_mode"]
          provider_id?: string
          routing_status?: Database["public"]["Enums"]["conversation_routing_status"]
          seeker_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_member_user_id_fkey"
            columns: ["assigned_member_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_provider_fk"
            columns: ["listing_id", "provider_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
      listing_edit_submissions: {
        Row: {
          applied_at: string | null
          created_at: string
          id: string
          listing_id: string
          organization_id: string
          proposed_patch: Json
          review_note: string | null
          reviewed_at: string | null
          reviewer_user_id: string | null
          status: Database["public"]["Enums"]["listing_edit_submission_status"]
          submitted_at: string | null
          submitted_by_user_id: string
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          id?: string
          listing_id: string
          organization_id: string
          proposed_patch?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["listing_edit_submission_status"]
          submitted_at?: string | null
          submitted_by_user_id: string
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          organization_id?: string
          proposed_patch?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_user_id?: string | null
          status?: Database["public"]["Enums"]["listing_edit_submission_status"]
          submitted_at?: string | null
          submitted_by_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_edit_submissions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_edit_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_edit_submissions_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_edit_submissions_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
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
      listing_workflow_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["listing_workflow_event_type"]
          from_status: Database["public"]["Enums"]["listing_status"] | null
          id: string
          listing_id: string
          metadata: Json
          note: string | null
          organization_id: string
          to_status: Database["public"]["Enums"]["listing_status"] | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["listing_workflow_event_type"]
          from_status?: Database["public"]["Enums"]["listing_status"] | null
          id?: string
          listing_id: string
          metadata?: Json
          note?: string | null
          organization_id: string
          to_status?: Database["public"]["Enums"]["listing_status"] | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["listing_workflow_event_type"]
          from_status?: Database["public"]["Enums"]["listing_status"] | null
          id?: string
          listing_id?: string
          metadata?: Json
          note?: string | null
          organization_id?: string
          to_status?: Database["public"]["Enums"]["listing_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_workflow_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_workflow_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_workflow_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address_text: string | null
          archived_at: string | null
          area_m2: number
          assigned_agent_user_id: string | null
          available_from: string | null
          balcony: boolean
          bathrooms: number | null
          bedrooms: number | null
          city: string
          created_at: string
          created_by_user_id: string
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
          organization_id: string | null
          owner_id: string
          parking: boolean
          pets_allowed: boolean
          price_amount: number
          property_type: Database["public"]["Enums"]["property_type"]
          public_location_mode: Database["public"]["Enums"]["public_location_mode"]
          published_at: string | null
          published_by_user_id: string | null
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
          assigned_agent_user_id?: string | null
          available_from?: string | null
          balcony?: boolean
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          created_at?: string
          created_by_user_id: string
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
          organization_id?: string | null
          owner_id: string
          parking?: boolean
          pets_allowed?: boolean
          price_amount: number
          property_type: Database["public"]["Enums"]["property_type"]
          public_location_mode?: Database["public"]["Enums"]["public_location_mode"]
          published_at?: string | null
          published_by_user_id?: string | null
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
          assigned_agent_user_id?: string | null
          available_from?: string | null
          balcony?: boolean
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          created_at?: string
          created_by_user_id?: string
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
          organization_id?: string | null
          owner_id?: string
          parking?: boolean
          pets_allowed?: boolean
          price_amount?: number
          property_type?: Database["public"]["Enums"]["property_type"]
          public_location_mode?: Database["public"]["Enums"]["public_location_mode"]
          published_at?: string | null
          published_by_user_id?: string | null
          slug?: string
          title?: string
          total_floors?: number | null
          updated_at?: string
          utilities_included?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "listings_assigned_agent_user_id_fkey"
            columns: ["assigned_agent_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_published_by_user_id_fkey"
            columns: ["published_by_user_id"]
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
      notification_preferences: {
        Row: {
          account_mode: string
          company_mode: string
          created_at: string
          listings_mode: string
          messages_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_mode?: string
          company_mode?: string
          created_at?: string
          listings_mode?: string
          messages_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_mode?: string
          company_mode?: string
          created_at?: string
          listings_mode?: string
          messages_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          actor_user_id: string | null
          archived_at: string | null
          body: string
          created_at: string
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          metadata: Json
          organization_id: string | null
          priority: number
          read_at: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          actor_user_id?: string | null
          archived_at?: string | null
          body?: string
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json
          organization_id?: string | null
          priority?: number
          read_at?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          actor_user_id?: string | null
          archived_at?: string | null
          body?: string
          created_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json
          organization_id?: string | null
          priority?: number
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_member_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          expires_at: string
          id: string
          invite_email: string | null
          invite_status: Database["public"]["Enums"]["organization_invite_status"]
          invite_token: string
          invited_by_user_id: string | null
          organization_id: string
          role: Database["public"]["Enums"]["organization_member_role"]
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invite_email?: string | null
          invite_status?: Database["public"]["Enums"]["organization_invite_status"]
          invite_token?: string
          invited_by_user_id?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invite_email?: string | null
          invite_status?: Database["public"]["Enums"]["organization_invite_status"]
          invite_token?: string
          invited_by_user_id?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_member_role"]
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_invites_accepted_by_user_id_fkey"
            columns: ["accepted_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_member_invites_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_member_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_member_invites_target_user_id_fkey"
            columns: ["target_user_id"]
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
          active_organization_id: string | null
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
          active_organization_id?: string | null
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
          active_organization_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_member_invite: {
        Args: { p_invite_token: string }
        Returns: {
          acceptance_outcome: string
          invite_id: string
          invite_status: Database["public"]["Enums"]["organization_invite_status"]
          member_id: string
          membership_role: Database["public"]["Enums"]["organization_member_role"]
          organization_id: string
        }[]
      }
      can_access_active_company_conversation: {
        Args: { p_conversation_id: string; p_user_id?: string }
        Returns: boolean
      }
      can_access_active_company_conversation_listing: {
        Args: { p_listing_id: string; p_user_id?: string }
        Returns: boolean
      }
      company_logo_organization_id: {
        Args: { object_name: string }
        Returns: string
      }
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
      create_organization_member_invite: {
        Args: {
          p_expires_in_days?: number
          p_invite_email?: string
          p_organization_id: string
          p_role?: Database["public"]["Enums"]["organization_member_role"]
          p_target_user_id?: string
        }
        Returns: {
          expires_at: string
          invite_email: string
          invite_id: string
          invite_role: Database["public"]["Enums"]["organization_member_role"]
          invite_status: Database["public"]["Enums"]["organization_invite_status"]
          invite_token: string
          organization_id: string
          target_user_id: string
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
      current_active_organization_id: {
        Args: { p_user_id?: string }
        Returns: string
      }
      current_user_primary_email: { Args: never; Returns: string }
      get_company_dashboard_activity_feed: {
        Args: {
          p_limit?: number
          p_organization_id: string
          p_viewer_user_id?: string
        }
        Returns: {
          actor_display_name: string
          actor_user_id: string
          event_id: string
          event_source: string
          event_type: string
          metadata: Json
          occurred_at: string
          target_id: string
          target_label: string
        }[]
      }
      get_company_dashboard_overview: {
        Args: { p_organization_id: string; p_viewer_user_id?: string }
        Returns: {
          active_member_count: number
          draft_count: number
          needs_changes_count: number
          organization_id: string
          pending_invite_count: number
          pending_review_count: number
          published_count: number
          viewer_role: Database["public"]["Enums"]["organization_member_role"]
        }[]
      }
      get_company_dashboard_pending_queue: {
        Args: {
          p_limit?: number
          p_organization_id: string
          p_viewer_user_id?: string
        }
        Returns: {
          assigned_agent_display_name: string
          assigned_agent_user_id: string
          city: string
          created_at: string
          created_by_display_name: string
          created_by_user_id: string
          listing_id: string
          listing_status: Database["public"]["Enums"]["listing_status"]
          listing_type: Database["public"]["Enums"]["listing_type"]
          neighborhood: string
          property_type: Database["public"]["Enums"]["property_type"]
          submitted_at: string
          title: string
          updated_at: string
        }[]
      }
      get_company_listing_workflow_listing: {
        Args: { p_listing_id: string; p_viewer_user_id?: string }
        Returns: {
          assigned_agent_user_id: string
          created_by_user_id: string
          id: string
          listing_status: Database["public"]["Enums"]["listing_status"]
          organization_id: string
          owner_id: string
          published_by_user_id: string
          slug: string
          title: string
          updated_at: string
        }[]
      }
      is_active_organization_member: {
        Args: { p_organization_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_company_listing_reviewer: {
        Args: { p_organization_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_organization_owner_or_admin: {
        Args: { p_organization_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_valid_company_logo_path: {
        Args: { object_name: string }
        Returns: boolean
      }
      is_valid_listing_image_path: {
        Args: { object_name: string }
        Returns: boolean
      }
      is_valid_profile_avatar_path: {
        Args: { object_name: string }
        Returns: boolean
      }
      listing_image_listing_id: {
        Args: { object_name: string }
        Returns: string
      }
      listing_image_owner_id: { Args: { object_name: string }; Returns: string }
      log_listing_workflow_event: {
        Args: {
          p_actor_user_id?: string
          p_event_type: Database["public"]["Enums"]["listing_workflow_event_type"]
          p_from_status?: Database["public"]["Enums"]["listing_status"]
          p_listing_id: string
          p_metadata?: Json
          p_note?: string
          p_to_status?: Database["public"]["Enums"]["listing_status"]
        }
        Returns: string
      }
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
      organization_active_member_count: {
        Args: { p_organization_id: string; p_user_id?: string }
        Returns: number
      }
      organization_active_member_role: {
        Args: { p_organization_id: string; p_user_id?: string }
        Returns: Database["public"]["Enums"]["organization_member_role"]
      }
      organization_active_owner_count: {
        Args: { p_organization_id: string }
        Returns: number
      }
      profile_avatar_owner_id: {
        Args: { object_name: string }
        Returns: string
      }
      remove_organization_member: {
        Args: { p_membership_id: string }
        Returns: {
          membership_id: string
          organization_id: string
          removed_role: Database["public"]["Enums"]["organization_member_role"]
          removed_status: Database["public"]["Enums"]["organization_member_status"]
          user_id: string
        }[]
      }
      revoke_organization_member_invite: {
        Args: { p_invite_id: string }
        Returns: {
          invite_id: string
          invite_role: Database["public"]["Enums"]["organization_member_role"]
          invite_status: Database["public"]["Enums"]["organization_invite_status"]
          organization_id: string
        }[]
      }
      transition_company_listing_workflow: {
        Args: { p_action: string; p_listing_id: string; p_note?: string }
        Returns: {
          event_type: Database["public"]["Enums"]["listing_workflow_event_type"]
          listing_id: string
          next_status: Database["public"]["Enums"]["listing_status"]
          organization_id: string
          previous_status: Database["public"]["Enums"]["listing_status"]
          published_at: string
          published_by_user_id: string
        }[]
      }
      update_organization_member_role: {
        Args: {
          p_membership_id: string
          p_new_role: Database["public"]["Enums"]["organization_member_role"]
        }
        Returns: {
          membership_id: string
          new_role: Database["public"]["Enums"]["organization_member_role"]
          organization_id: string
          previous_role: Database["public"]["Enums"]["organization_member_role"]
          user_id: string
        }[]
      }
      update_organization_member_status: {
        Args: {
          p_membership_id: string
          p_new_status: Database["public"]["Enums"]["organization_member_status"]
        }
        Returns: {
          membership_id: string
          new_status: Database["public"]["Enums"]["organization_member_status"]
          organization_id: string
          previous_status: Database["public"]["Enums"]["organization_member_status"]
          role: Database["public"]["Enums"]["organization_member_role"]
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "seeker" | "provider" | "admin"
      company_internal_conversation_kind: "direct" | "group"
      conversation_owner_mode: "individual_provider" | "company_workspace"
      conversation_routing_status:
        | "direct_provider"
        | "shared_queue"
        | "assigned_member"
      heating_type: "central" | "electric" | "gas" | "district" | "other"
      listing_status:
        | "draft"
        | "published"
        | "paused"
        | "archived"
        | "sold"
        | "rented"
        | "hidden_by_admin"
        | "submitted_for_review"
        | "needs_changes"
        | "approved"
        | "unpublished"
      listing_type: "rent" | "sale"
      listing_edit_submission_status:
        | "draft"
        | "pending_review"
        | "needs_changes"
        | "approved"
        | "rejected"
      listing_workflow_event_type:
        | "created"
        | "submitted_for_review"
        | "needs_changes"
        | "approved"
        | "published"
        | "unpublished"
        | "edit_submission_submitted"
        | "edit_submission_needs_changes"
        | "edit_submission_approved"
        | "edit_submission_rejected"
      organization_invite_status: "pending" | "accepted" | "revoked" | "expired"
      organization_member_role: "owner" | "admin" | "manager" | "agent"
      organization_member_status: "active" | "invited" | "inactive"
      organization_status: "active" | "inactive"
      preferred_contact_method:
        | "in_app"
        | "phone"
        | "email"
        | "whatsapp"
        | "viber"
      property_type: "apartment" | "house" | "studio" | "land" | "commercial"
      provider_account_type: "individual" | "company"
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
      company_internal_conversation_kind: ["direct", "group"],
      conversation_owner_mode: ["individual_provider", "company_workspace"],
      conversation_routing_status: [
        "direct_provider",
        "shared_queue",
        "assigned_member",
      ],
      heating_type: ["central", "electric", "gas", "district", "other"],
      listing_status: [
        "draft",
        "published",
        "paused",
        "archived",
        "sold",
        "rented",
        "hidden_by_admin",
        "submitted_for_review",
        "needs_changes",
        "approved",
        "unpublished",
      ],
      listing_type: ["rent", "sale"],
      listing_edit_submission_status: [
        "draft",
        "pending_review",
        "needs_changes",
        "approved",
        "rejected",
      ],
      listing_workflow_event_type: [
        "created",
        "submitted_for_review",
        "needs_changes",
        "approved",
        "published",
        "unpublished",
        "edit_submission_submitted",
        "edit_submission_needs_changes",
        "edit_submission_approved",
        "edit_submission_rejected",
      ],
      organization_invite_status: ["pending", "accepted", "revoked", "expired"],
      organization_member_role: ["owner", "admin", "manager", "agent"],
      organization_member_status: ["active", "invited", "inactive"],
      organization_status: ["active", "inactive"],
      preferred_contact_method: [
        "in_app",
        "phone",
        "email",
        "whatsapp",
        "viber",
      ],
      property_type: ["apartment", "house", "studio", "land", "commercial"],
      provider_account_type: ["individual", "company"],
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
