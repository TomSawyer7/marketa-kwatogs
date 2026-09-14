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
      account_appeals: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      account_deletion_log: {
        Row: {
          created_at: string
          deleted_at: string
          grace_started_at: string | null
          had_kyc: boolean
          id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string
          grace_started_at?: string | null
          had_kyc?: boolean
          id?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string
          grace_started_at?: string | null
          had_kyc?: boolean
          id?: string
        }
        Relationships: []
      }
      account_lifecycle: {
        Row: {
          created_at: string
          deactivated_at: string | null
          deactivation_days: number | null
          delete_after: string | null
          deletion_requested_at: string | null
          reactivate_at: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          deactivation_days?: number | null
          delete_after?: string | null
          deletion_requested_at?: string | null
          reactivate_at?: string | null
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          deactivation_days?: number | null
          delete_after?: string | null
          deletion_requested_at?: string | null
          reactivate_at?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      account_status: {
        Row: {
          created_at: string
          reason: string | null
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          reason?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          reason?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          browser: string | null
          category: string
          correlation_id: string | null
          created_at: string
          current_hash: string
          description: string | null
          device: string | null
          endpoint: string | null
          entity_id: string | null
          entity_type: string | null
          failure_reason: string | null
          http_method: string | null
          id: string
          ip_address: unknown
          metadata: Json
          operating_system: string | null
          previous_hash: string
          seq: number
          session_id: string | null
          status_code: number | null
          success: boolean
          timestamp: string
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          browser?: string | null
          category: string
          correlation_id?: string | null
          created_at?: string
          current_hash: string
          description?: string | null
          device?: string | null
          endpoint?: string | null
          entity_id?: string | null
          entity_type?: string | null
          failure_reason?: string | null
          http_method?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          operating_system?: string | null
          previous_hash: string
          seq?: number
          session_id?: string | null
          status_code?: number | null
          success?: boolean
          timestamp?: string
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          browser?: string | null
          category?: string
          correlation_id?: string | null
          created_at?: string
          current_hash?: string
          description?: string | null
          device?: string | null
          endpoint?: string | null
          entity_id?: string | null
          entity_type?: string | null
          failure_reason?: string | null
          http_method?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json
          operating_system?: string | null
          previous_hash?: string
          seq?: number
          session_id?: string | null
          status_code?: number | null
          success?: boolean
          timestamp?: string
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      behavior_alerts: {
        Row: {
          category: string
          event_type: string
          first_seen_at: string
          id: string
          last_seen_at: string
          notes: string | null
          occurrences: number
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          category: string
          event_type: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          notes?: string | null
          occurrences?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          category?: string
          event_type?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          notes?: string | null
          occurrences?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      behavior_events: {
        Row: {
          browser: string | null
          category: string
          created_at: string
          description: string | null
          device: string | null
          event_type: string
          id: string
          ip: unknown
          metadata: Json
          score_delta: number
          session_id: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          category: string
          created_at?: string
          description?: string | null
          device?: string | null
          event_type: string
          id?: string
          ip?: unknown
          metadata?: Json
          score_delta?: number
          session_id?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          category?: string
          created_at?: string
          description?: string | null
          device?: string | null
          event_type?: string
          id?: string
          ip?: unknown
          metadata?: Json
          score_delta?: number
          session_id?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          context: string
          created_at: string
          document: string
          id: string
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          context: string
          created_at?: string
          document: string
          id?: string
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          context?: string
          created_at?: string
          document?: string
          id?: string
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          archived_at: string | null
          category: string
          condition: string
          created_at: string
          description: string
          id: string
          images: string[]
          latitude: number | null
          location: string
          longitude: number | null
          price: number
          seller_id: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category: string
          condition: string
          created_at?: string
          description: string
          id?: string
          images?: string[]
          latitude?: number | null
          location: string
          longitude?: number | null
          price: number
          seller_id: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          condition?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          latitude?: number | null
          location?: string
          longitude?: number | null
          price?: number
          seller_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      login_lockouts: {
        Row: {
          failed_count: number
          identifier: string
          lock_level: number
          locked_until: string | null
          updated_at: string
          user_id: string | null
          window_started_at: string | null
        }
        Insert: {
          failed_count?: number
          identifier: string
          lock_level?: number
          locked_until?: string | null
          updated_at?: string
          user_id?: string | null
          window_started_at?: string | null
        }
        Update: {
          failed_count?: number
          identifier?: string
          lock_level?: number
          locked_until?: string | null
          updated_at?: string
          user_id?: string | null
          window_started_at?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string | null
          created_at: string
          edited_at: string | null
          id: string
          image_url: string | null
          is_edited: boolean
          is_unsent: boolean
          kind: string
          meta: Json
          read_at: string | null
          reply_to_message_id: string | null
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          image_url?: string | null
          is_edited?: boolean
          is_unsent?: boolean
          kind?: string
          meta?: Json
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          edited_at?: string | null
          id?: string
          image_url?: string | null
          is_edited?: boolean
          is_unsent?: boolean
          kind?: string
          meta?: Json
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      mpin_lockouts: {
        Row: {
          failed_count: number
          lock_level: number
          locked_until: string | null
          updated_at: string
          user_id: string
          window_started_at: string | null
        }
        Insert: {
          failed_count?: number
          lock_level?: number
          locked_until?: string | null
          updated_at?: string
          user_id: string
          window_started_at?: string | null
        }
        Update: {
          failed_count?: number
          lock_level?: number
          locked_until?: string | null
          updated_at?: string
          user_id?: string
          window_started_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          meta: Json
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          meta?: Json
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          meta?: Json
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          first_name: string | null
          has_seen_onboarding: boolean
          id: string
          is_verified: boolean
          last_name: string | null
          location: string | null
          name: string | null
          notifications: Json
          updated_at: string
          visibility: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          has_seen_onboarding?: boolean
          id: string
          is_verified?: boolean
          last_name?: string | null
          location?: string | null
          name?: string | null
          notifications?: Json
          updated_at?: string
          visibility?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          has_seen_onboarding?: boolean
          id?: string
          is_verified?: boolean
          last_name?: string | null
          location?: string | null
          name?: string | null
          notifications?: Json
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      review_appeals: {
        Row: {
          admin_notes: string | null
          buyer_chat_consent: boolean
          buyer_consent_at: string | null
          buyer_id: string
          created_at: string
          evidence_urls: string[]
          id: string
          reason: string
          resolution_kind: string | null
          resolved_at: string | null
          resolved_by: string | null
          review_id: string
          seller_chat_consent: boolean
          seller_consent_at: string | null
          seller_id: string
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          buyer_chat_consent?: boolean
          buyer_consent_at?: string | null
          buyer_id: string
          created_at?: string
          evidence_urls?: string[]
          id?: string
          reason: string
          resolution_kind?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id: string
          seller_chat_consent?: boolean
          seller_consent_at?: string | null
          seller_id: string
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          buyer_chat_consent?: boolean
          buyer_consent_at?: string | null
          buyer_id?: string
          created_at?: string
          evidence_urls?: string[]
          id?: string
          reason?: string
          resolution_kind?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string
          seller_chat_consent?: boolean
          seller_consent_at?: string | null
          seller_id?: string
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_appeals_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_appeals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          review_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          review_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          role: string
          status: string
          tags: string[]
          transaction_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          role: string
          status?: string
          tags?: string[]
          transaction_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          role?: string
          status?: string
          tags?: string[]
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
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
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          listing_id: string | null
          transaction_id: string | null
          updated_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          buyer_confirmed_at: string | null
          buyer_id: string
          confirmed_at: string | null
          created_at: string
          id: string
          listing_id: string
          seller_confirmed_at: string | null
          seller_id: string
          status: string
          thread_id: string | null
          updated_at: string
        }
        Insert: {
          buyer_confirmed_at?: string | null
          buyer_id: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          listing_id: string
          seller_confirmed_at?: string | null
          seller_id: string
          status?: string
          thread_id?: string | null
          updated_at?: string
        }
        Update: {
          buyer_confirmed_at?: string | null
          buyer_id?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          seller_confirmed_at?: string | null
          seller_id?: string
          status?: string
          thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mpins: {
        Row: {
          created_at: string
          failed_attempts: number
          locked_until: string | null
          mpin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          mpin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          locked_until?: string | null
          mpin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_risk_scores: {
        Row: {
          alerts_count: number
          last_event_at: string | null
          risk_level: string
          score: number
          under_review: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          alerts_count?: number
          last_event_at?: string | null
          risk_level?: string
          score?: number
          under_review?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          alerts_count?: number
          last_event_at?: string | null
          risk_level?: string
          score?: number
          under_review?: boolean
          updated_at?: string
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
      verifications: {
        Row: {
          admin_notes: string | null
          everify_checked_at: string | null
          everify_checked_by: string | null
          everify_notes: string | null
          everify_status: string
          face_match_score: number | null
          id_approved_at: string | null
          id_approved_by: string | null
          id_back_path: string
          id_front_path: string
          liveness_checked_at: string | null
          liveness_frame_paths: string[]
          liveness_passed: boolean
          liveness_video_path: string | null
          ocr_address: string | null
          ocr_blood_type: string | null
          ocr_date_of_birth: string | null
          ocr_date_of_issue: string | null
          ocr_document_number: string | null
          ocr_first_name: string | null
          ocr_full_name: string | null
          ocr_gender: string | null
          ocr_last_name: string | null
          ocr_marital_status: string | null
          ocr_middle_name: string | null
          ocr_nationality: string | null
          ocr_place_of_birth: string | null
          ocr_psn: string | null
          ocr_sex: string | null
          qr_payload: string | null
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          everify_checked_at?: string | null
          everify_checked_by?: string | null
          everify_notes?: string | null
          everify_status?: string
          face_match_score?: number | null
          id_approved_at?: string | null
          id_approved_by?: string | null
          id_back_path: string
          id_front_path: string
          liveness_checked_at?: string | null
          liveness_frame_paths?: string[]
          liveness_passed?: boolean
          liveness_video_path?: string | null
          ocr_address?: string | null
          ocr_blood_type?: string | null
          ocr_date_of_birth?: string | null
          ocr_date_of_issue?: string | null
          ocr_document_number?: string | null
          ocr_first_name?: string | null
          ocr_full_name?: string | null
          ocr_gender?: string | null
          ocr_last_name?: string | null
          ocr_marital_status?: string | null
          ocr_middle_name?: string | null
          ocr_nationality?: string | null
          ocr_place_of_birth?: string | null
          ocr_psn?: string | null
          ocr_sex?: string | null
          qr_payload?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          everify_checked_at?: string | null
          everify_checked_by?: string | null
          everify_notes?: string | null
          everify_status?: string
          face_match_score?: number | null
          id_approved_at?: string | null
          id_approved_by?: string | null
          id_back_path?: string
          id_front_path?: string
          liveness_checked_at?: string | null
          liveness_frame_paths?: string[]
          liveness_passed?: boolean
          liveness_video_path?: string | null
          ocr_address?: string | null
          ocr_blood_type?: string | null
          ocr_date_of_birth?: string | null
          ocr_date_of_issue?: string | null
          ocr_document_number?: string | null
          ocr_first_name?: string | null
          ocr_full_name?: string | null
          ocr_gender?: string | null
          ocr_last_name?: string | null
          ocr_marital_status?: string | null
          ocr_middle_name?: string | null
          ocr_nationality?: string | null
          ocr_place_of_birth?: string | null
          ocr_psn?: string | null
          ocr_sex?: string | null
          qr_payload?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      verified_users: {
        Row: {
          address: string | null
          blood_type: string | null
          date_of_birth: string | null
          date_of_issue: string | null
          document_number: string | null
          first_name: string | null
          full_name: string
          last_name: string | null
          marital_status: string | null
          middle_name: string | null
          nationality: string | null
          place_of_birth: string | null
          sex: string | null
          user_id: string
          verified_at: string
        }
        Insert: {
          address?: string | null
          blood_type?: string | null
          date_of_birth?: string | null
          date_of_issue?: string | null
          document_number?: string | null
          first_name?: string | null
          full_name: string
          last_name?: string | null
          marital_status?: string | null
          middle_name?: string | null
          nationality?: string | null
          place_of_birth?: string | null
          sex?: string | null
          user_id: string
          verified_at?: string
        }
        Update: {
          address?: string | null
          blood_type?: string | null
          date_of_birth?: string | null
          date_of_issue?: string | null
          document_number?: string | null
          first_name?: string | null
          full_name?: string
          last_name?: string | null
          marital_status?: string | null
          middle_name?: string | null
          nationality?: string | null
          place_of_birth?: string | null
          sex?: string | null
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string | null
          location: string | null
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string | null
          location?: string | null
          name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string | null
          location?: string | null
          name?: string | null
        }
        Relationships: []
      }
      user_rating_stats: {
        Row: {
          avg_rating: number | null
          review_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      append_audit_log: { Args: { _payload: Json }; Returns: string }
      bump_risk_score: {
        Args: { _delta: number; _mark_review?: boolean; _user_id: string }
        Returns: undefined
      }
      cancel_deletion: { Args: never; Returns: Json }
      canonical_jsonb: { Args: { _j: Json }; Returns: string }
      check_login_lock: { Args: { _email: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_hidden: { Args: { _user_id: string }; Returns: boolean }
      mpin_status: { Args: never; Returns: Json }
      reactivate_account: { Args: never; Returns: Json }
      recalc_account_status: { Args: { _user_id: string }; Returns: undefined }
      record_behavior_event: {
        Args: {
          _category: string
          _description: string
          _event_type: string
          _mark_review?: boolean
          _metadata?: Json
          _score_delta: number
          _severity: string
          _user_id: string
        }
        Returns: string
      }
      register_login_attempt: {
        Args: { _email: string; _success: boolean; _user_id?: string }
        Returns: Json
      }
      request_deactivation: {
        Args: { _days?: number; _mpin: string }
        Returns: Json
      }
      request_deletion: { Args: { _mpin: string }; Returns: Json }
      resolve_lifecycle_on_login: { Args: never; Returns: Json }
      set_mpin: { Args: { _mpin: string }; Returns: Json }
      verify_audit_chain: {
        Args: { _from_seq?: number; _to_seq?: number }
        Returns: Json
      }
      verify_mpin: { Args: { _mpin: string }; Returns: Json }
      verify_mpin_reset_otp: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
