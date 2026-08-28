export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          access_notes_private: string | null;
          country_code: string;
          created_at: string;
          deleted_at: string | null;
          geog: unknown;
          id: string;
          is_default: boolean;
          island_id: string;
          label: string;
          line1_private: string;
          line2_private: string | null;
          locality: string;
          owner_user_id: string;
          postal_code: string | null;
          updated_at: string;
        };
        Insert: {
          access_notes_private?: string | null;
          country_code?: string;
          created_at?: string;
          deleted_at?: string | null;
          geog?: unknown;
          id?: string;
          is_default?: boolean;
          island_id: string;
          label: string;
          line1_private: string;
          line2_private?: string | null;
          locality: string;
          owner_user_id: string;
          postal_code?: string | null;
          updated_at?: string;
        };
        Update: {
          access_notes_private?: string | null;
          country_code?: string;
          created_at?: string;
          deleted_at?: string | null;
          geog?: unknown;
          id?: string;
          is_default?: boolean;
          island_id?: string;
          label?: string;
          line1_private?: string;
          line2_private?: string | null;
          locality?: string;
          owner_user_id?: string;
          postal_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_island_id_fkey";
            columns: ["island_id"];
            isOneToOne: false;
            referencedRelation: "islands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "addresses_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_access_logs: {
        Row: {
          admin_user_id: string;
          case_id: string | null;
          created_at: string;
          fields_accessed: string[];
          id: string;
          purpose_code: string;
          resource_id: string | null;
          resource_type: string;
        };
        Insert: {
          admin_user_id: string;
          case_id?: string | null;
          created_at?: string;
          fields_accessed?: string[];
          id?: string;
          purpose_code: string;
          resource_id?: string | null;
          resource_type: string;
        };
        Update: {
          admin_user_id?: string;
          case_id?: string | null;
          created_at?: string;
          fields_accessed?: string[];
          id?: string;
          purpose_code?: string;
          resource_id?: string | null;
          resource_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_access_logs_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_audit_logs: {
        Row: {
          action: string;
          actor_id: string;
          after_redacted: Json | null;
          before_redacted: Json | null;
          created_at: string;
          id: string;
          reason: string;
          target_id: string | null;
          target_type: string;
          trace_id: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          after_redacted?: Json | null;
          before_redacted?: Json | null;
          created_at?: string;
          id?: string;
          reason: string;
          target_id?: string | null;
          target_type: string;
          trace_id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          after_redacted?: Json | null;
          before_redacted?: Json | null;
          created_at?: string;
          id?: string;
          reason?: string;
          target_id?: string | null;
          target_type?: string;
          trace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_permissions: {
        Row: {
          admin_user_id: string;
          conditions: Json;
          granted_at: string;
          granted_by: string | null;
          id: string;
          permission_key: string;
          revoked_at: string | null;
        };
        Insert: {
          admin_user_id: string;
          conditions?: Json;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          permission_key: string;
          revoked_at?: string | null;
        };
        Update: {
          admin_user_id?: string;
          conditions?: Json;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          permission_key?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_permissions_admin_user_id_fkey";
            columns: ["admin_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_permissions_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics_daily: {
        Row: {
          created_at: string;
          currency: string | null;
          id: string;
          metric_count: number;
          metric_date: string;
          metric_key: string;
          metric_sum_minor: number | null;
          service_area_id: string | null;
          service_id: string | null;
        };
        Insert: {
          created_at?: string;
          currency?: string | null;
          id?: string;
          metric_count?: number;
          metric_date: string;
          metric_key: string;
          metric_sum_minor?: number | null;
          service_area_id?: string | null;
          service_id?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string | null;
          id?: string;
          metric_count?: number;
          metric_date?: string;
          metric_key?: string;
          metric_sum_minor?: number | null;
          service_area_id?: string | null;
          service_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_daily_service_area_id_fkey";
            columns: ["service_area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analytics_daily_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_exceptions: {
        Row: {
          available: boolean;
          created_at: string;
          ends_at: string;
          id: string;
          reason: string | null;
          seller_id: string;
          service_id: string | null;
          starts_at: string;
          updated_at: string;
        };
        Insert: {
          available: boolean;
          created_at?: string;
          ends_at: string;
          id?: string;
          reason?: string | null;
          seller_id: string;
          service_id?: string | null;
          starts_at: string;
          updated_at?: string;
        };
        Update: {
          available?: boolean;
          created_at?: string;
          ends_at?: string;
          id?: string;
          reason?: string | null;
          seller_id?: string;
          service_id?: string | null;
          starts_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "availability_exceptions_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "availability_exceptions_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_rules: {
        Row: {
          active: boolean;
          capacity: number;
          created_at: string;
          id: string;
          local_end: string;
          local_start: string;
          seller_id: string;
          service_area_id: string | null;
          service_id: string | null;
          timezone: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
          weekday: number;
        };
        Insert: {
          active?: boolean;
          capacity?: number;
          created_at?: string;
          id?: string;
          local_end: string;
          local_start: string;
          seller_id: string;
          service_area_id?: string | null;
          service_id?: string | null;
          timezone?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          weekday: number;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          created_at?: string;
          id?: string;
          local_end?: string;
          local_start?: string;
          seller_id?: string;
          service_area_id?: string | null;
          service_id?: string | null;
          timezone?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "availability_rules_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "availability_rules_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "availability_rules_service_area_id_fkey";
            columns: ["service_area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "availability_rules_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      background_checks: {
        Row: {
          completed_at: string | null;
          consent_id: string | null;
          created_at: string;
          expires_at: string | null;
          external_ref: string | null;
          id: string;
          permitted_summary: string | null;
          seller_id: string;
          status: Database["public"]["Enums"]["verification_status"];
          updated_at: string;
          vendor: string;
          verification_case_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          consent_id?: string | null;
          created_at?: string;
          expires_at?: string | null;
          external_ref?: string | null;
          id?: string;
          permitted_summary?: string | null;
          seller_id: string;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
          vendor?: string;
          verification_case_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          consent_id?: string | null;
          created_at?: string;
          expires_at?: string | null;
          external_ref?: string | null;
          id?: string;
          permitted_summary?: string | null;
          seller_id?: string;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
          vendor?: string;
          verification_case_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "background_checks_consent_id_fkey";
            columns: ["consent_id"];
            isOneToOne: false;
            referencedRelation: "consents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "background_checks_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "background_checks_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "background_checks_verification_case_id_fkey";
            columns: ["verification_case_id"];
            isOneToOne: false;
            referencedRelation: "verification_cases";
            referencedColumns: ["id"];
          },
        ];
      };
      badge_evaluation_runs: {
        Row: {
          badge_id: string;
          cohort_key: string | null;
          evaluated_at: string;
          id: string;
          metrics_snapshot: Json;
          result: boolean;
          result_reason: string | null;
          rule_version: number;
          user_id: string | null;
        };
        Insert: {
          badge_id: string;
          cohort_key?: string | null;
          evaluated_at?: string;
          id?: string;
          metrics_snapshot?: Json;
          result: boolean;
          result_reason?: string | null;
          rule_version: number;
          user_id?: string | null;
        };
        Update: {
          badge_id?: string;
          cohort_key?: string | null;
          evaluated_at?: string;
          id?: string;
          metrics_snapshot?: Json;
          result?: boolean;
          result_reason?: string | null;
          rule_version?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "badge_evaluation_runs_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "badge_evaluation_runs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      badge_requirements: {
        Row: {
          badge_id: string;
          created_at: string;
          id: string;
          metric_key: string;
          operator: string;
          requirement_type: string;
          threshold: number | null;
          window_days: number | null;
        };
        Insert: {
          badge_id: string;
          created_at?: string;
          id?: string;
          metric_key: string;
          operator: string;
          requirement_type: string;
          threshold?: number | null;
          window_days?: number | null;
        };
        Update: {
          badge_id?: string;
          created_at?: string;
          id?: string;
          metric_key?: string;
          operator?: string;
          requirement_type?: string;
          threshold?: number | null;
          window_days?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "badge_requirements_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
        ];
      };
      badges: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          criteria_public: string | null;
          description: string;
          icon_key: string;
          id: string;
          issuer_type: string;
          name: string;
          public: boolean;
          rule_config: Json;
          rule_version: number;
          updated_at: string;
          validity_days: number | null;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          criteria_public?: string | null;
          description: string;
          icon_key: string;
          id?: string;
          issuer_type: string;
          name: string;
          public?: boolean;
          rule_config?: Json;
          rule_version?: number;
          updated_at?: string;
          validity_days?: number | null;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          criteria_public?: string | null;
          description?: string;
          icon_key?: string;
          id?: string;
          issuer_type?: string;
          name?: string;
          public?: boolean;
          rule_config?: Json;
          rule_version?: number;
          updated_at?: string;
          validity_days?: number | null;
        };
        Relationships: [];
      };
      blocks: {
        Row: {
          blocked_user_id: string;
          blocker_user_id: string;
          created_at: string;
          reason_code: string | null;
        };
        Insert: {
          blocked_user_id: string;
          blocker_user_id: string;
          created_at?: string;
          reason_code?: string | null;
        };
        Update: {
          blocked_user_id?: string;
          blocker_user_id?: string;
          created_at?: string;
          reason_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_user_id_fkey";
            columns: ["blocked_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocker_user_id_fkey";
            columns: ["blocker_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_checkins: {
        Row: {
          booking_id: string;
          code_verified: boolean;
          created_at: string;
          event_type: string;
          geofence_outcome: string | null;
          id: string;
          method: string;
          occurred_at: string;
          user_id: string;
        };
        Insert: {
          booking_id: string;
          code_verified?: boolean;
          created_at?: string;
          event_type: string;
          geofence_outcome?: string | null;
          id?: string;
          method?: string;
          occurred_at?: string;
          user_id: string;
        };
        Update: {
          booking_id?: string;
          code_verified?: boolean;
          created_at?: string;
          event_type?: string;
          geofence_outcome?: string | null;
          id?: string;
          method?: string;
          occurred_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_checkins_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_checkins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_extras: {
        Row: {
          booking_id: string;
          extra_id: string;
          name_snapshot: string;
          quantity: number;
          total_minor: number;
          unit_price_minor: number;
        };
        Insert: {
          booking_id: string;
          extra_id: string;
          name_snapshot: string;
          quantity: number;
          total_minor: number;
          unit_price_minor: number;
        };
        Update: {
          booking_id?: string;
          extra_id?: string;
          name_snapshot?: string;
          quantity?: number;
          total_minor?: number;
          unit_price_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "booking_extras_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_extras_extra_id_fkey";
            columns: ["extra_id"];
            isOneToOne: false;
            referencedRelation: "service_extras";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_location_samples: {
        Row: {
          accuracy_band: string | null;
          booking_id: string;
          captured_at: string;
          coarse_geohash: string | null;
          consent_id: string | null;
          created_at: string;
          id: string;
          purge_at: string;
          seller_id: string;
        };
        Insert: {
          accuracy_band?: string | null;
          booking_id: string;
          captured_at?: string;
          coarse_geohash?: string | null;
          consent_id?: string | null;
          created_at?: string;
          id?: string;
          purge_at: string;
          seller_id: string;
        };
        Update: {
          accuracy_band?: string | null;
          booking_id?: string;
          captured_at?: string;
          coarse_geohash?: string | null;
          consent_id?: string | null;
          created_at?: string;
          id?: string;
          purge_at?: string;
          seller_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_location_samples_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_location_samples_consent_id_fkey";
            columns: ["consent_id"];
            isOneToOne: false;
            referencedRelation: "consents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_location_samples_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "booking_location_samples_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      booking_media: {
        Row: {
          booking_id: string;
          consent_id: string | null;
          created_at: string;
          id: string;
          media_type: string;
          moderation_status: Database["public"]["Enums"]["moderation_status"];
          purpose: string;
          retain_until: string | null;
          storage_path: string;
          uploader_id: string;
        };
        Insert: {
          booking_id: string;
          consent_id?: string | null;
          created_at?: string;
          id?: string;
          media_type: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          purpose: string;
          retain_until?: string | null;
          storage_path: string;
          uploader_id: string;
        };
        Update: {
          booking_id?: string;
          consent_id?: string | null;
          created_at?: string;
          id?: string;
          media_type?: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          purpose?: string;
          retain_until?: string | null;
          storage_path?: string;
          uploader_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_media_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_media_consent_id_fkey";
            columns: ["consent_id"];
            isOneToOne: false;
            referencedRelation: "consents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_media_uploader_id_fkey";
            columns: ["uploader_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_offers: {
        Row: {
          amount_minor: number;
          booking_id: string | null;
          created_at: string;
          currency: string;
          decline_code: string | null;
          expires_at: string;
          id: string;
          message: string | null;
          quote_id: string | null;
          rank: number;
          request_id: string;
          responded_at: string | null;
          seller_id: string;
          sent_at: string;
          status: Database["public"]["Enums"]["offer_status"];
          updated_at: string;
          viewed_at: string | null;
        };
        Insert: {
          amount_minor: number;
          booking_id?: string | null;
          created_at?: string;
          currency?: string;
          decline_code?: string | null;
          expires_at: string;
          id?: string;
          message?: string | null;
          quote_id?: string | null;
          rank?: number;
          request_id: string;
          responded_at?: string | null;
          seller_id: string;
          sent_at?: string;
          status?: Database["public"]["Enums"]["offer_status"];
          updated_at?: string;
          viewed_at?: string | null;
        };
        Update: {
          amount_minor?: number;
          booking_id?: string | null;
          created_at?: string;
          currency?: string;
          decline_code?: string | null;
          expires_at?: string;
          id?: string;
          message?: string | null;
          quote_id?: string | null;
          rank?: number;
          request_id?: string;
          responded_at?: string | null;
          seller_id?: string;
          sent_at?: string;
          status?: Database["public"]["Enums"]["offer_status"];
          updated_at?: string;
          viewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_offers_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_offers_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "booking_quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_offers_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_offers_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "booking_offers_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      booking_participants: {
        Row: {
          access_ends_at: string | null;
          access_starts_at: string;
          booking_id: string;
          created_at: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          access_ends_at?: string | null;
          access_starts_at?: string;
          booking_id: string;
          created_at?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          access_ends_at?: string | null;
          access_starts_at?: string;
          booking_id?: string;
          created_at?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_participants_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_quotes: {
        Row: {
          base_minor: number;
          buyer_id: string;
          created_at: string;
          currency: string;
          ends_at: string;
          expires_at: string;
          id: string;
          platform_fee_minor: number;
          policy_snapshot: Json;
          quote_hash: string;
          request_id: string | null;
          seller_id: string;
          service_id: string;
          starts_at: string;
          tax_minor: number;
          total_minor: number | null;
          travel_minor: number;
        };
        Insert: {
          base_minor: number;
          buyer_id: string;
          created_at?: string;
          currency?: string;
          ends_at: string;
          expires_at: string;
          id?: string;
          platform_fee_minor?: number;
          policy_snapshot?: Json;
          quote_hash: string;
          request_id?: string | null;
          seller_id: string;
          service_id: string;
          starts_at: string;
          tax_minor?: number;
          total_minor?: number | null;
          travel_minor?: number;
        };
        Update: {
          base_minor?: number;
          buyer_id?: string;
          created_at?: string;
          currency?: string;
          ends_at?: string;
          expires_at?: string;
          id?: string;
          platform_fee_minor?: number;
          policy_snapshot?: Json;
          quote_hash?: string;
          request_id?: string | null;
          seller_id?: string;
          service_id?: string;
          starts_at?: string;
          tax_minor?: number;
          total_minor?: number | null;
          travel_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "booking_quotes_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_quotes_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_quotes_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "booking_quotes_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "booking_quotes_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_request_intake_answers: {
        Row: {
          buyer_id: string;
          category_code: string;
          created_at: string;
          private_answers: Json;
          public_summary: Json;
          request_id: string;
          subcategory_code: string;
        };
        Insert: {
          buyer_id: string;
          category_code: string;
          created_at?: string;
          private_answers?: Json;
          public_summary?: Json;
          request_id: string;
          subcategory_code: string;
        };
        Update: {
          buyer_id?: string;
          category_code?: string;
          created_at?: string;
          private_answers?: Json;
          public_summary?: Json;
          request_id?: string;
          subcategory_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_request_intake_answers_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_request_intake_answers_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_request_intake_answers_category_code_subcategory_code_fkey";
            columns: ["category_code", "subcategory_code"];
            isOneToOne: false;
            referencedRelation: "care_intake_subcategories";
            referencedColumns: ["category_code", "code"];
          },
        ];
      };
      booking_request_private: {
        Row: {
          access_notes_private: string | null;
          buyer_id: string;
          care_requirements_private: Json;
          created_at: string;
          request_id: string;
          updated_at: string;
        };
        Insert: {
          access_notes_private?: string | null;
          buyer_id: string;
          care_requirements_private?: Json;
          created_at?: string;
          request_id: string;
          updated_at?: string;
        };
        Update: {
          access_notes_private?: string | null;
          buyer_id?: string;
          care_requirements_private?: Json;
          created_at?: string;
          request_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_request_private_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_request_private_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_request_publications: {
        Row: {
          buyer_id: string;
          currency: string;
          duration_days_snapshot: number;
          expires_at: string;
          fee_minor_snapshot: number;
          payment_status: string;
          plan_code: string;
          plan_id: string;
          published_at: string;
          request_id: string;
        };
        Insert: {
          buyer_id: string;
          currency?: string;
          duration_days_snapshot: number;
          expires_at: string;
          fee_minor_snapshot: number;
          payment_status: string;
          plan_code: string;
          plan_id: string;
          published_at?: string;
          request_id: string;
        };
        Update: {
          buyer_id?: string;
          currency?: string;
          duration_days_snapshot?: number;
          expires_at?: string;
          fee_minor_snapshot?: number;
          payment_status?: string;
          plan_code?: string;
          plan_id?: string;
          published_at?: string;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_request_publications_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_request_publications_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "job_posting_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_request_publications_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_request_recipients: {
        Row: {
          birth_month: number | null;
          birth_year: number | null;
          buyer_id: string;
          created_at: string;
          expecting: boolean;
          id: string;
          private_label: string;
          relationship: string;
          request_id: string;
        };
        Insert: {
          birth_month?: number | null;
          birth_year?: number | null;
          buyer_id: string;
          created_at?: string;
          expecting?: boolean;
          id?: string;
          private_label: string;
          relationship: string;
          request_id: string;
        };
        Update: {
          birth_month?: number | null;
          birth_year?: number | null;
          buyer_id?: string;
          created_at?: string;
          expecting?: boolean;
          id?: string;
          private_label?: string;
          relationship?: string;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_request_recipients_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_request_recipients_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_request_schedules: {
        Row: {
          buyer_id: string;
          created_at: string;
          end_date: string | null;
          flexible_start: boolean;
          request_id: string;
          schedule_kind: string;
          schedule_may_vary: boolean;
          specific_end: string | null;
          specific_start: string | null;
          start_date: string;
          time_periods: string[];
          timezone: string;
          weekdays: number[];
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          end_date?: string | null;
          flexible_start?: boolean;
          request_id: string;
          schedule_kind: string;
          schedule_may_vary?: boolean;
          specific_end?: string | null;
          specific_start?: string | null;
          start_date: string;
          time_periods?: string[];
          timezone?: string;
          weekdays?: number[];
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          end_date?: string | null;
          flexible_start?: boolean;
          request_id?: string;
          schedule_kind?: string;
          schedule_may_vary?: boolean;
          specific_end?: string | null;
          specific_start?: string | null;
          start_date?: string;
          time_periods?: string[];
          timezone?: string;
          weekdays?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "booking_request_schedules_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_request_schedules_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_requests: {
        Row: {
          address_id: string | null;
          budget_minor: number | null;
          buyer_id: string;
          care_summary: string;
          created_at: string;
          currency: string;
          desired_end: string;
          desired_start: string;
          expires_at: string | null;
          household_member_id: string | null;
          id: string;
          mode: Database["public"]["Enums"]["booking_mode"];
          posting_plan_id: string | null;
          publication_type: string;
          published_until: string | null;
          rate_max_minor: number | null;
          rate_min_minor: number | null;
          service_area_id: string;
          service_id: string;
          status: Database["public"]["Enums"]["booking_status"];
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address_id?: string | null;
          budget_minor?: number | null;
          buyer_id: string;
          care_summary: string;
          created_at?: string;
          currency?: string;
          desired_end: string;
          desired_start: string;
          expires_at?: string | null;
          household_member_id?: string | null;
          id?: string;
          mode?: Database["public"]["Enums"]["booking_mode"];
          posting_plan_id?: string | null;
          publication_type?: string;
          published_until?: string | null;
          rate_max_minor?: number | null;
          rate_min_minor?: number | null;
          service_area_id: string;
          service_id: string;
          status?: Database["public"]["Enums"]["booking_status"];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address_id?: string | null;
          budget_minor?: number | null;
          buyer_id?: string;
          care_summary?: string;
          created_at?: string;
          currency?: string;
          desired_end?: string;
          desired_start?: string;
          expires_at?: string | null;
          household_member_id?: string | null;
          id?: string;
          mode?: Database["public"]["Enums"]["booking_mode"];
          posting_plan_id?: string | null;
          publication_type?: string;
          published_until?: string | null;
          rate_max_minor?: number | null;
          rate_min_minor?: number | null;
          service_area_id?: string;
          service_id?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_requests_address_id_fkey";
            columns: ["address_id"];
            isOneToOne: false;
            referencedRelation: "addresses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_requests_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_requests_household_member_id_fkey";
            columns: ["household_member_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_requests_posting_plan_id_fkey";
            columns: ["posting_plan_id"];
            isOneToOne: false;
            referencedRelation: "job_posting_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_requests_service_area_id_fkey";
            columns: ["service_area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_requests_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_session_codes: {
        Row: {
          attempt_count: number;
          booking_id: string;
          buyer_verified_at: string | null;
          code_digest: string;
          consumed_at: string | null;
          created_at: string;
          id: string;
          seller_verified_at: string | null;
          valid_from: string;
          valid_until: string;
        };
        Insert: {
          attempt_count?: number;
          booking_id: string;
          buyer_verified_at?: string | null;
          code_digest: string;
          consumed_at?: string | null;
          created_at?: string;
          id?: string;
          seller_verified_at?: string | null;
          valid_from: string;
          valid_until: string;
        };
        Update: {
          attempt_count?: number;
          booking_id?: string;
          buyer_verified_at?: string | null;
          code_digest?: string;
          consumed_at?: string | null;
          created_at?: string;
          id?: string;
          seller_verified_at?: string | null;
          valid_from?: string;
          valid_until?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_session_codes_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_status_history: {
        Row: {
          actor_id: string | null;
          booking_id: string;
          created_at: string;
          from_status: Database["public"]["Enums"]["booking_status"] | null;
          id: string;
          idempotency_key: string | null;
          note: string | null;
          reason_code: string | null;
          source: string;
          to_status: Database["public"]["Enums"]["booking_status"];
        };
        Insert: {
          actor_id?: string | null;
          booking_id: string;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["booking_status"] | null;
          id?: string;
          idempotency_key?: string | null;
          note?: string | null;
          reason_code?: string | null;
          source?: string;
          to_status: Database["public"]["Enums"]["booking_status"];
        };
        Update: {
          actor_id?: string | null;
          booking_id?: string;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["booking_status"] | null;
          id?: string;
          idempotency_key?: string | null;
          note?: string | null;
          reason_code?: string | null;
          source?: string;
          to_status?: Database["public"]["Enums"]["booking_status"];
        };
        Relationships: [
          {
            foreignKeyName: "booking_status_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_status_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          address_id: string | null;
          blocks_calendar: boolean;
          buyer_id: string;
          cancellation_policy_snapshot: Json;
          cancelled_at: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          currency: string;
          ended_at: string | null;
          household_member_id: string | null;
          id: string;
          platform_fee_minor: number;
          price_snapshot: Json;
          quote_id: string | null;
          reference: string;
          request_id: string | null;
          scheduled_end: string;
          scheduled_range: unknown;
          scheduled_start: string;
          seller_id: string;
          seller_net_minor: number;
          service_id: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["booking_status"];
          subtotal_minor: number;
          timezone: string;
          total_minor: number;
          updated_at: string;
          version: number;
        };
        Insert: {
          address_id?: string | null;
          blocks_calendar?: boolean;
          buyer_id: string;
          cancellation_policy_snapshot?: Json;
          cancelled_at?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          ended_at?: string | null;
          household_member_id?: string | null;
          id?: string;
          platform_fee_minor?: number;
          price_snapshot?: Json;
          quote_id?: string | null;
          reference?: string;
          request_id?: string | null;
          scheduled_end: string;
          scheduled_range?: unknown;
          scheduled_start: string;
          seller_id: string;
          seller_net_minor: number;
          service_id: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["booking_status"];
          subtotal_minor: number;
          timezone?: string;
          total_minor: number;
          updated_at?: string;
          version?: number;
        };
        Update: {
          address_id?: string | null;
          blocks_calendar?: boolean;
          buyer_id?: string;
          cancellation_policy_snapshot?: Json;
          cancelled_at?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          ended_at?: string | null;
          household_member_id?: string | null;
          id?: string;
          platform_fee_minor?: number;
          price_snapshot?: Json;
          quote_id?: string | null;
          reference?: string;
          request_id?: string | null;
          scheduled_end?: string;
          scheduled_range?: unknown;
          scheduled_start?: string;
          seller_id?: string;
          seller_net_minor?: number;
          service_id?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["booking_status"];
          subtotal_minor?: number;
          timezone?: string;
          total_minor?: number;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_address_id_fkey";
            columns: ["address_id"];
            isOneToOne: false;
            referencedRelation: "addresses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_household_member_id_fkey";
            columns: ["household_member_id"];
            isOneToOne: false;
            referencedRelation: "household_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "booking_quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "bookings_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "bookings_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_busy_blocks: {
        Row: {
          connection_id: string;
          created_at: string;
          ends_at: string;
          external_event_hash: string;
          id: string;
          starts_at: string;
          status: string;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          ends_at: string;
          external_event_hash: string;
          id?: string;
          starts_at: string;
          status?: string;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          ends_at?: string;
          external_event_hash?: string;
          id?: string;
          starts_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_busy_blocks_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "calendar_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_connections: {
        Row: {
          created_at: string;
          encrypted_token_ref: string;
          id: string;
          last_sync_at: string | null;
          scopes: string[];
          seller_id: string;
          status: string;
          sync_cursor: string | null;
          updated_at: string;
          vendor: string;
        };
        Insert: {
          created_at?: string;
          encrypted_token_ref: string;
          id?: string;
          last_sync_at?: string | null;
          scopes?: string[];
          seller_id: string;
          status?: string;
          sync_cursor?: string | null;
          updated_at?: string;
          vendor: string;
        };
        Update: {
          created_at?: string;
          encrypted_token_ref?: string;
          id?: string;
          last_sync_at?: string | null;
          scopes?: string[];
          seller_id?: string;
          status?: string;
          sync_cursor?: string | null;
          updated_at?: string;
          vendor?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_connections_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "calendar_connections_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      cancellation_policies: {
        Row: {
          active: boolean;
          created_at: string;
          effective_at: string;
          id: string;
          name: string;
          rules: Json;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          effective_at: string;
          id?: string;
          name: string;
          rules: Json;
          version: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          effective_at?: string;
          id?: string;
          name?: string;
          rules?: Json;
          version?: number;
        };
        Relationships: [];
      };
      care_intake_categories: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          description: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          description: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          description?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      care_intake_subcategories: {
        Row: {
          active: boolean;
          category_code: string;
          code: string;
          created_at: string;
          name: string;
          service_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          category_code: string;
          code: string;
          created_at?: string;
          name: string;
          service_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          category_code?: string;
          code?: string;
          created_at?: string;
          name?: string;
          service_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "care_intake_subcategories_category_code_fkey";
            columns: ["category_code"];
            isOneToOne: false;
            referencedRelation: "care_intake_categories";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "care_intake_subcategories_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: true;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      cancellations: {
        Row: {
          actor_id: string;
          booking_id: string;
          created_at: string;
          fee_minor: number;
          id: string;
          policy_snapshot: Json;
          reason_code: string;
          refund_minor: number;
          waived_by: string | null;
          waiver_reason: string | null;
        };
        Insert: {
          actor_id: string;
          booking_id: string;
          created_at?: string;
          fee_minor?: number;
          id?: string;
          policy_snapshot: Json;
          reason_code: string;
          refund_minor?: number;
          waived_by?: string | null;
          waiver_reason?: string | null;
        };
        Update: {
          actor_id?: string;
          booking_id?: string;
          created_at?: string;
          fee_minor?: number;
          id?: string;
          policy_snapshot?: Json;
          reason_code?: string;
          refund_minor?: number;
          waived_by?: string | null;
          waiver_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cancellations_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cancellations_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cancellations_waived_by_fkey";
            columns: ["waived_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      case_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          dispute_id: string;
          event_type: string;
          id: string;
          metadata_redacted: Json;
          note_redacted: string | null;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          dispute_id: string;
          event_type: string;
          id?: string;
          metadata_redacted?: Json;
          note_redacted?: string | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          dispute_id?: string;
          event_type?: string;
          id?: string;
          metadata_redacted?: Json;
          note_redacted?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "case_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_events_dispute_id_fkey";
            columns: ["dispute_id"];
            isOneToOne: false;
            referencedRelation: "service_disputes";
            referencedColumns: ["id"];
          },
        ];
      };
      case_evidence: {
        Row: {
          checksum: string | null;
          created_at: string;
          dispute_id: string;
          evidence_type: string;
          id: string;
          legal_hold: boolean;
          retain_until: string | null;
          scan_status: string;
          storage_path: string;
          uploader_id: string;
        };
        Insert: {
          checksum?: string | null;
          created_at?: string;
          dispute_id: string;
          evidence_type: string;
          id?: string;
          legal_hold?: boolean;
          retain_until?: string | null;
          scan_status?: string;
          storage_path: string;
          uploader_id: string;
        };
        Update: {
          checksum?: string | null;
          created_at?: string;
          dispute_id?: string;
          evidence_type?: string;
          id?: string;
          legal_hold?: boolean;
          retain_until?: string | null;
          scan_status?: string;
          storage_path?: string;
          uploader_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_evidence_dispute_id_fkey";
            columns: ["dispute_id"];
            isOneToOne: false;
            referencedRelation: "service_disputes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "case_evidence_uploader_id_fkey";
            columns: ["uploader_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_rules: {
        Row: {
          active: boolean;
          created_at: string;
          currency: string;
          fee_type: string;
          fee_value: number;
          id: string;
          maximum_minor: number | null;
          minimum_minor: number | null;
          priority: number;
          seller_id: string | null;
          service_area_id: string | null;
          service_id: string | null;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          currency?: string;
          fee_type: string;
          fee_value: number;
          id?: string;
          maximum_minor?: number | null;
          minimum_minor?: number | null;
          priority?: number;
          seller_id?: string | null;
          service_area_id?: string | null;
          service_id?: string | null;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          currency?: string;
          fee_type?: string;
          fee_value?: number;
          id?: string;
          maximum_minor?: number | null;
          minimum_minor?: number | null;
          priority?: number;
          seller_id?: string | null;
          service_area_id?: string | null;
          service_id?: string | null;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commission_rules_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "commission_rules_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "commission_rules_service_area_id_fkey";
            columns: ["service_area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_rules_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      consents: {
        Row: {
          captured_at: string;
          consent_type: string;
          created_at: string;
          document_id: string | null;
          id: string;
          ip_hash: string | null;
          scope: Json;
          status: string;
          user_agent_hash: string | null;
          user_id: string;
          withdrawn_at: string | null;
        };
        Insert: {
          captured_at?: string;
          consent_type: string;
          created_at?: string;
          document_id?: string | null;
          id?: string;
          ip_hash?: string | null;
          scope?: Json;
          status: string;
          user_agent_hash?: string | null;
          user_id: string;
          withdrawn_at?: string | null;
        };
        Update: {
          captured_at?: string;
          consent_type?: string;
          created_at?: string;
          document_id?: string | null;
          id?: string;
          ip_hash?: string | null;
          scope?: Json;
          status?: string;
          user_agent_hash?: string | null;
          user_id?: string;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "consents_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "legal_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          joined_at: string;
          last_read_at: string | null;
          left_at: string | null;
          muted: boolean;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          joined_at?: string;
          last_read_at?: string | null;
          left_at?: string | null;
          muted?: boolean;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          joined_at?: string;
          last_read_at?: string | null;
          left_at?: string | null;
          muted?: boolean;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          booking_id: string | null;
          conversation_type: string;
          created_at: string;
          id: string;
          last_message_at: string | null;
          request_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          booking_id?: string | null;
          conversation_type: string;
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          request_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string | null;
          conversation_type?: string;
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          request_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      dead_letters: {
        Row: {
          attempts: number;
          created_at: string;
          id: string;
          last_error: string;
          message_ref: string | null;
          payload_redacted: Json;
          replayed_at: string | null;
          replayed_by: string | null;
          source_queue: string;
        };
        Insert: {
          attempts: number;
          created_at?: string;
          id?: string;
          last_error: string;
          message_ref?: string | null;
          payload_redacted?: Json;
          replayed_at?: string | null;
          replayed_by?: string | null;
          source_queue: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: string;
          last_error?: string;
          message_ref?: string | null;
          payload_redacted?: Json;
          replayed_at?: string | null;
          replayed_by?: string | null;
          source_queue?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dead_letters_replayed_by_fkey";
            columns: ["replayed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
        Row: {
          app_version: string | null;
          created_at: string;
          id: string;
          last_seen_at: string;
          locale: string | null;
          platform: string;
          push_vendor: string;
          revoked_at: string | null;
          token_ciphertext: string;
          token_hash: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          app_version?: string | null;
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          locale?: string | null;
          platform: string;
          push_vendor: string;
          revoked_at?: string | null;
          token_ciphertext: string;
          token_hash: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          app_version?: string | null;
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          locale?: string | null;
          platform?: string;
          push_vendor?: string;
          revoked_at?: string | null;
          token_ciphertext?: string;
          token_hash?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      domain_events: {
        Row: {
          aggregate_id: string | null;
          aggregate_type: string;
          event_type: string;
          event_version: number;
          id: string;
          occurred_at: string;
          payload_redacted: Json;
          trace_id: string;
        };
        Insert: {
          aggregate_id?: string | null;
          aggregate_type: string;
          event_type: string;
          event_version?: number;
          id?: string;
          occurred_at?: string;
          payload_redacted?: Json;
          trace_id?: string;
        };
        Update: {
          aggregate_id?: string | null;
          aggregate_type?: string;
          event_type?: string;
          event_version?: number;
          id?: string;
          occurred_at?: string;
          payload_redacted?: Json;
          trace_id?: string;
        };
        Relationships: [];
      };
      emergency_contacts: {
        Row: {
          consent_confirmed_at: string | null;
          created_at: string;
          id: string;
          name: string;
          phone_e164: string;
          priority: number;
          relationship: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          consent_confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          phone_e164: string;
          priority?: number;
          relationship: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          consent_confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          phone_e164?: string;
          priority?: number;
          relationship?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          buyer_id: string;
          created_at: string;
          seller_id: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          seller_id: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          seller_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "favorites_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "favorites_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          description: string;
          enabled: boolean;
          key: string;
          rollout_percent: number;
          targeting_rules: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          description: string;
          enabled?: boolean;
          key: string;
          rollout_percent?: number;
          targeting_rules?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          description?: string;
          enabled?: boolean;
          key?: string;
          rollout_percent?: number;
          targeting_rules?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "feature_flags_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_disputes: {
        Row: {
          amount_minor: number;
          created_at: string;
          currency: string;
          evidence_due_at: string | null;
          id: string;
          opened_at: string;
          outcome: string | null;
          payment_intent_id: string;
          processor_case_ref: string | null;
          resolved_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          created_at?: string;
          currency?: string;
          evidence_due_at?: string | null;
          id?: string;
          opened_at?: string;
          outcome?: string | null;
          payment_intent_id: string;
          processor_case_ref?: string | null;
          resolved_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          currency?: string;
          evidence_due_at?: string | null;
          id?: string;
          opened_at?: string;
          outcome?: string | null;
          payment_intent_id?: string;
          processor_case_ref?: string | null;
          resolved_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_disputes_payment_intent_id_fkey";
            columns: ["payment_intent_id"];
            isOneToOne: false;
            referencedRelation: "payment_intents";
            referencedColumns: ["id"];
          },
        ];
      };
      household_members: {
        Row: {
          active: boolean;
          care_notes_private: string | null;
          created_at: string;
          date_of_birth_private: string | null;
          display_name: string;
          household_id: string;
          id: string;
          relationship: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          care_notes_private?: string | null;
          created_at?: string;
          date_of_birth_private?: string | null;
          display_name: string;
          household_id: string;
          id?: string;
          relationship: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          care_notes_private?: string | null;
          created_at?: string;
          date_of_birth_private?: string | null;
          display_name?: string;
          household_id?: string;
          id?: string;
          relationship?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      households: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          owner_user_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          owner_user_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          owner_user_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "households_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      idempotency_keys: {
        Row: {
          actor_id: string;
          created_at: string;
          expires_at: string;
          key: string;
          locked_at: string;
          request_hash: string;
          response_body_redacted: Json | null;
          response_code: number | null;
          scope: string;
          status: string;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          expires_at: string;
          key: string;
          locked_at?: string;
          request_hash: string;
          response_body_redacted?: Json | null;
          response_code?: number | null;
          scope: string;
          status?: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          expires_at?: string;
          key?: string;
          locked_at?: string;
          request_hash?: string;
          response_body_redacted?: Json | null;
          response_code?: number | null;
          scope?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_accounts: {
        Row: {
          config_secret_refs: Json;
          created_at: string;
          external_org_ref: string | null;
          health: Json;
          id: string;
          integration_type: string;
          status: string;
          updated_at: string;
          vendor: string;
        };
        Insert: {
          config_secret_refs?: Json;
          created_at?: string;
          external_org_ref?: string | null;
          health?: Json;
          id?: string;
          integration_type: string;
          status?: string;
          updated_at?: string;
          vendor: string;
        };
        Update: {
          config_secret_refs?: Json;
          created_at?: string;
          external_org_ref?: string | null;
          health?: Json;
          id?: string;
          integration_type?: string;
          status?: string;
          updated_at?: string;
          vendor?: string;
        };
        Relationships: [];
      };
      invoices_receipts: {
        Row: {
          booking_id: string;
          created_at: string;
          document_number: string;
          document_type: string;
          id: string;
          issued_at: string;
          party_id: string;
          storage_path: string | null;
          totals_snapshot: Json;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          document_number: string;
          document_type: string;
          id?: string;
          issued_at?: string;
          party_id: string;
          storage_path?: string | null;
          totals_snapshot: Json;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          document_number?: string;
          document_type?: string;
          id?: string;
          issued_at?: string;
          party_id?: string;
          storage_path?: string | null;
          totals_snapshot?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_receipts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_receipts_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      islands: {
        Row: {
          active: boolean;
          country_code: string;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          country_code?: string;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          country_code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      job_posting_plans: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          currency: string;
          description: string;
          duration_days: number;
          featured: boolean;
          fee_minor: number;
          free_post_allowance: number;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          currency?: string;
          description: string;
          duration_days: number;
          featured?: boolean;
          fee_minor?: number;
          free_post_allowance?: number;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          currency?: string;
          description?: string;
          duration_days?: number;
          featured?: boolean;
          fee_minor?: number;
          free_post_allowance?: number;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      ledger_accounts: {
        Row: {
          account_type: string;
          created_at: string;
          currency: string;
          id: string;
          owner_user_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          account_type: string;
          created_at?: string;
          currency?: string;
          id?: string;
          owner_user_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          account_type?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          owner_user_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          account_id: string;
          amount_minor: number;
          booking_id: string | null;
          buyer_id: string | null;
          created_at: string;
          direction: Database["public"]["Enums"]["ledger_direction"];
          id: string;
          seller_id: string | null;
          transaction_id: string;
        };
        Insert: {
          account_id: string;
          amount_minor: number;
          booking_id?: string | null;
          buyer_id?: string | null;
          created_at?: string;
          direction: Database["public"]["Enums"]["ledger_direction"];
          id?: string;
          seller_id?: string | null;
          transaction_id: string;
        };
        Update: {
          account_id?: string;
          amount_minor?: number;
          booking_id?: string | null;
          buyer_id?: string | null;
          created_at?: string;
          direction?: Database["public"]["Enums"]["ledger_direction"];
          id?: string;
          seller_id?: string | null;
          transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "ledger_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "wallet_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "ledger_entries_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_transactions: {
        Row: {
          created_at: string;
          currency: string;
          description: string;
          event_type: string;
          id: string;
          idempotency_key: string;
          posted_at: string;
          reference_id: string | null;
          reference_type: string;
          reversed_transaction_id: string | null;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          description: string;
          event_type: string;
          id?: string;
          idempotency_key: string;
          posted_at?: string;
          reference_id?: string | null;
          reference_type: string;
          reversed_transaction_id?: string | null;
        };
        Update: {
          created_at?: string;
          currency?: string;
          description?: string;
          event_type?: string;
          id?: string;
          idempotency_key?: string;
          posted_at?: string;
          reference_id?: string | null;
          reference_type?: string;
          reversed_transaction_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_reversed_transaction_id_fkey";
            columns: ["reversed_transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_documents: {
        Row: {
          active: boolean;
          checksum: string;
          content_url: string;
          created_at: string;
          document_type: string;
          effective_at: string;
          id: string;
          locale: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          checksum: string;
          content_url: string;
          created_at?: string;
          document_type: string;
          effective_at: string;
          id?: string;
          locale?: string;
          version: number;
        };
        Update: {
          active?: boolean;
          checksum?: string;
          content_url?: string;
          created_at?: string;
          document_type?: string;
          effective_at?: string;
          id?: string;
          locale?: string;
          version?: number;
        };
        Relationships: [];
      };
      match_candidates: {
        Row: {
          created_at: string;
          eligibility_snapshot: Json;
          excluded_reason_private: string | null;
          match_run_id: string;
          rank: number;
          reason_codes: string[];
          score: number;
          seller_id: string;
        };
        Insert: {
          created_at?: string;
          eligibility_snapshot?: Json;
          excluded_reason_private?: string | null;
          match_run_id: string;
          rank: number;
          reason_codes?: string[];
          score: number;
          seller_id: string;
        };
        Update: {
          created_at?: string;
          eligibility_snapshot?: Json;
          excluded_reason_private?: string | null;
          match_run_id?: string;
          rank?: number;
          reason_codes?: string[];
          score?: number;
          seller_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_candidates_match_run_id_fkey";
            columns: ["match_run_id"];
            isOneToOne: false;
            referencedRelation: "match_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_candidates_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "match_candidates_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      match_runs: {
        Row: {
          algorithm_version: string;
          buyer_id: string;
          created_at: string;
          id: string;
          request_id: string | null;
          sanitized_inputs: Json;
        };
        Insert: {
          algorithm_version: string;
          buyer_id: string;
          created_at?: string;
          id?: string;
          request_id?: string | null;
          sanitized_inputs: Json;
        };
        Update: {
          algorithm_version?: string;
          buyer_id?: string;
          created_at?: string;
          id?: string;
          request_id?: string | null;
          sanitized_inputs?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "match_runs_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_runs_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      message_attachments: {
        Row: {
          checksum: string | null;
          created_at: string;
          id: string;
          media_type: string;
          message_id: string;
          moderation_status: Database["public"]["Enums"]["moderation_status"];
          scan_status: string;
          size_bytes: number;
          storage_path: string;
        };
        Insert: {
          checksum?: string | null;
          created_at?: string;
          id?: string;
          media_type: string;
          message_id: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          scan_status?: string;
          size_bytes: number;
          storage_path: string;
        };
        Update: {
          checksum?: string | null;
          created_at?: string;
          id?: string;
          media_type?: string;
          message_id?: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          scan_status?: string;
          size_bytes?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          message_type: string;
          moderation_status: Database["public"]["Enums"]["moderation_status"];
          reply_to_id: string | null;
          sender_id: string;
          sender_nonce: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          message_type?: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          reply_to_id?: string | null;
          sender_id: string;
          sender_nonce: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          message_type?: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          reply_to_id?: string | null;
          sender_id?: string;
          sender_nonce?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey";
            columns: ["reply_to_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_actions: {
        Row: {
          action: string;
          actor_admin_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          private_note: string | null;
          public_note: string | null;
          reason_code: string;
          report_id: string | null;
          target_id: string;
          target_type: string;
        };
        Insert: {
          action: string;
          actor_admin_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          private_note?: string | null;
          public_note?: string | null;
          reason_code: string;
          report_id?: string | null;
          target_id: string;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_admin_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          private_note?: string | null;
          public_note?: string | null;
          reason_code?: string;
          report_id?: string | null;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_actions_actor_admin_id_fkey";
            columns: ["actor_admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "moderation_reports";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_reports: {
        Row: {
          assigned_admin_id: string | null;
          created_at: string;
          details: string | null;
          id: string;
          priority: Database["public"]["Enums"]["case_priority"];
          reason_code: string;
          reporter_id: string;
          status: Database["public"]["Enums"]["case_status"];
          target_id: string;
          target_type: string;
          updated_at: string;
        };
        Insert: {
          assigned_admin_id?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["case_priority"];
          reason_code: string;
          reporter_id: string;
          status?: Database["public"]["Enums"]["case_status"];
          target_id: string;
          target_type: string;
          updated_at?: string;
        };
        Update: {
          assigned_admin_id?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["case_priority"];
          reason_code?: string;
          reporter_id?: string;
          status?: Database["public"]["Enums"]["case_status"];
          target_id?: string;
          target_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_reports_assigned_admin_id_fkey";
            columns: ["assigned_admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          attempts: number;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          delivered_at: string | null;
          destination_hash: string | null;
          error_code: string | null;
          external_id: string | null;
          failed_at: string | null;
          id: string;
          next_attempt_at: string | null;
          notification_id: string | null;
          outbox_id: string;
          status: Database["public"]["Enums"]["delivery_status"];
          updated_at: string;
          vendor: string;
        };
        Insert: {
          attempts?: number;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          delivered_at?: string | null;
          destination_hash?: string | null;
          error_code?: string | null;
          external_id?: string | null;
          failed_at?: string | null;
          id?: string;
          next_attempt_at?: string | null;
          notification_id?: string | null;
          outbox_id: string;
          status?: Database["public"]["Enums"]["delivery_status"];
          updated_at?: string;
          vendor?: string;
        };
        Update: {
          attempts?: number;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          delivered_at?: string | null;
          destination_hash?: string | null;
          error_code?: string | null;
          external_id?: string | null;
          failed_at?: string | null;
          id?: string;
          next_attempt_at?: string | null;
          notification_id?: string | null;
          outbox_id?: string;
          status?: Database["public"]["Enums"]["delivery_status"];
          updated_at?: string;
          vendor?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_deliveries_outbox_id_fkey";
            columns: ["outbox_id"];
            isOneToOne: false;
            referencedRelation: "notification_outbox";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_outbox: {
        Row: {
          attempts: number;
          available_at: string;
          category: string;
          created_at: string;
          dedupe_key: string;
          domain_event_id: string | null;
          id: string;
          priority: Database["public"]["Enums"]["case_priority"];
          recipient_id: string;
          status: Database["public"]["Enums"]["delivery_status"];
          template_key: string;
          updated_at: string;
          variables_redacted: Json;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          category: string;
          created_at?: string;
          dedupe_key: string;
          domain_event_id?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["case_priority"];
          recipient_id: string;
          status?: Database["public"]["Enums"]["delivery_status"];
          template_key: string;
          updated_at?: string;
          variables_redacted?: Json;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          category?: string;
          created_at?: string;
          dedupe_key?: string;
          domain_event_id?: string | null;
          id?: string;
          priority?: Database["public"]["Enums"]["case_priority"];
          recipient_id?: string;
          status?: Database["public"]["Enums"]["delivery_status"];
          template_key?: string;
          updated_at?: string;
          variables_redacted?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "notification_outbox_domain_event_id_fkey";
            columns: ["domain_event_id"];
            isOneToOne: false;
            referencedRelation: "domain_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_outbox_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          email: boolean;
          event_category: string;
          id: string;
          in_app: boolean;
          push: boolean;
          quiet_hours_end: string | null;
          quiet_hours_start: string | null;
          sms: boolean;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: boolean;
          event_category: string;
          id?: string;
          in_app?: boolean;
          push?: boolean;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          sms?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: boolean;
          event_category?: string;
          id?: string;
          in_app?: boolean;
          push?: boolean;
          quiet_hours_end?: string | null;
          quiet_hours_start?: string | null;
          sms?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_templates: {
        Row: {
          active: boolean;
          approved_by: string | null;
          body: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          id: string;
          locale: string;
          required_variables: string[];
          subject: string | null;
          template_key: string;
          title: string | null;
          version: number;
        };
        Insert: {
          active?: boolean;
          approved_by?: string | null;
          body: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          id?: string;
          locale?: string;
          required_variables?: string[];
          subject?: string | null;
          template_key: string;
          title?: string | null;
          version: number;
        };
        Update: {
          active?: boolean;
          approved_by?: string | null;
          body?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          id?: string;
          locale?: string;
          required_variables?: string[];
          subject?: string | null;
          template_key?: string;
          title?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "notification_templates_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          archived_at: string | null;
          body: string;
          category: string;
          created_at: string;
          deep_link: string | null;
          event_type: string;
          expires_at: string | null;
          id: string;
          read_at: string | null;
          recipient_id: string;
          related_id: string | null;
          related_type: string | null;
          title: string;
        };
        Insert: {
          archived_at?: string | null;
          body: string;
          category: string;
          created_at?: string;
          deep_link?: string | null;
          event_type: string;
          expires_at?: string | null;
          id?: string;
          read_at?: string | null;
          recipient_id: string;
          related_id?: string | null;
          related_type?: string | null;
          title: string;
        };
        Update: {
          archived_at?: string | null;
          body?: string;
          category?: string;
          created_at?: string;
          deep_link?: string | null;
          event_type?: string;
          expires_at?: string | null;
          id?: string;
          read_at?: string | null;
          recipient_id?: string;
          related_id?: string | null;
          related_type?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_customers: {
        Row: {
          created_at: string;
          external_customer_ref: string;
          id: string;
          processor: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          external_customer_ref: string;
          id?: string;
          processor: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          external_customer_ref?: string;
          id?: string;
          processor?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_customers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_events: {
        Row: {
          event_type: string;
          external_event_id: string;
          id: string;
          payload_redacted: Json;
          processed_at: string | null;
          processing_error: string | null;
          processor: string;
          received_at: string;
          signature_verified: boolean;
        };
        Insert: {
          event_type: string;
          external_event_id: string;
          id?: string;
          payload_redacted?: Json;
          processed_at?: string | null;
          processing_error?: string | null;
          processor: string;
          received_at?: string;
          signature_verified: boolean;
        };
        Update: {
          event_type?: string;
          external_event_id?: string;
          id?: string;
          payload_redacted?: Json;
          processed_at?: string | null;
          processing_error?: string | null;
          processor?: string;
          received_at?: string;
          signature_verified?: boolean;
        };
        Relationships: [];
      };
      payment_intents: {
        Row: {
          amount_minor: number;
          authorized_at: string | null;
          booking_id: string | null;
          captured_at: string | null;
          captured_minor: number;
          created_at: string;
          currency: string;
          external_ref: string | null;
          id: string;
          idempotency_key: string;
          payer_id: string;
          processor: string;
          refunded_minor: number;
          request_id: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          authorized_at?: string | null;
          booking_id?: string | null;
          captured_at?: string | null;
          captured_minor?: number;
          created_at?: string;
          currency?: string;
          external_ref?: string | null;
          id?: string;
          idempotency_key: string;
          payer_id: string;
          processor?: string;
          refunded_minor?: number;
          request_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          authorized_at?: string | null;
          booking_id?: string | null;
          captured_at?: string | null;
          captured_minor?: number;
          created_at?: string;
          currency?: string;
          external_ref?: string | null;
          id?: string;
          idempotency_key?: string;
          payer_id?: string;
          processor?: string;
          refunded_minor?: number;
          request_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_intents_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_intents_payer_id_fkey";
            columns: ["payer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_intents_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_methods: {
        Row: {
          brand: string | null;
          created_at: string;
          expiry_display: string | null;
          external_ref: string;
          id: string;
          is_default: boolean;
          last4: string | null;
          method_type: string;
          processor: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          brand?: string | null;
          created_at?: string;
          expiry_display?: string | null;
          external_ref: string;
          id?: string;
          is_default?: boolean;
          last4?: string | null;
          method_type?: string;
          processor?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          brand?: string | null;
          created_at?: string;
          expiry_display?: string | null;
          external_ref?: string;
          id?: string;
          is_default?: boolean;
          last4?: string | null;
          method_type?: string;
          processor?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payout_accounts: {
        Row: {
          capability_flags: Json;
          created_at: string;
          disabled_at: string | null;
          display_label: string | null;
          external_account_ref: string;
          id: string;
          is_default: boolean;
          last4: string | null;
          onboarding_status: string;
          processor: string;
          seller_id: string;
          updated_at: string;
        };
        Insert: {
          capability_flags?: Json;
          created_at?: string;
          disabled_at?: string | null;
          display_label?: string | null;
          external_account_ref: string;
          id?: string;
          is_default?: boolean;
          last4?: string | null;
          onboarding_status?: string;
          processor?: string;
          seller_id: string;
          updated_at?: string;
        };
        Update: {
          capability_flags?: Json;
          created_at?: string;
          disabled_at?: string | null;
          display_label?: string | null;
          external_account_ref?: string;
          id?: string;
          is_default?: boolean;
          last4?: string | null;
          onboarding_status?: string;
          processor?: string;
          seller_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payout_accounts_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "payout_accounts_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      payout_items: {
        Row: {
          adjustment_minor: number;
          booking_id: string;
          fee_minor: number;
          gross_minor: number;
          ledger_transaction_id: string | null;
          net_minor: number;
          payout_id: string;
        };
        Insert: {
          adjustment_minor?: number;
          booking_id: string;
          fee_minor: number;
          gross_minor: number;
          ledger_transaction_id?: string | null;
          net_minor: number;
          payout_id: string;
        };
        Update: {
          adjustment_minor?: number;
          booking_id?: string;
          fee_minor?: number;
          gross_minor?: number;
          ledger_transaction_id?: string | null;
          net_minor?: number;
          payout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payout_items_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payout_items_ledger_transaction_id_fkey";
            columns: ["ledger_transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payout_items_payout_id_fkey";
            columns: ["payout_id"];
            isOneToOne: false;
            referencedRelation: "payouts";
            referencedColumns: ["id"];
          },
        ];
      };
      payouts: {
        Row: {
          amount_minor: number;
          created_at: string;
          currency: string;
          external_ref: string | null;
          failure_code: string | null;
          id: string;
          paid_at: string | null;
          period_end: string | null;
          period_start: string | null;
          processor: string;
          scheduled_at: string | null;
          seller_id: string;
          status: Database["public"]["Enums"]["payout_status"];
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          created_at?: string;
          currency?: string;
          external_ref?: string | null;
          failure_code?: string | null;
          id?: string;
          paid_at?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          processor?: string;
          scheduled_at?: string | null;
          seller_id: string;
          status?: Database["public"]["Enums"]["payout_status"];
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          currency?: string;
          external_ref?: string | null;
          failure_code?: string | null;
          id?: string;
          paid_at?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          processor?: string;
          scheduled_at?: string | null;
          seller_id?: string;
          status?: Database["public"]["Enums"]["payout_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payouts_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "payouts_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      privacy_requests: {
        Row: {
          completed_at: string | null;
          created_at: string;
          due_at: string | null;
          id: string;
          identity_verified_at: string | null;
          request_type: string;
          retention_exceptions: Json;
          status: Database["public"]["Enums"]["case_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          identity_verified_at?: string | null;
          request_type: string;
          retention_exceptions?: Json;
          status?: Database["public"]["Enums"]["case_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          identity_verified_at?: string | null;
          request_type?: string;
          retention_exceptions?: Json;
          status?: Database["public"]["Enums"]["case_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "privacy_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"];
          avatar_path: string | null;
          created_at: string;
          date_of_birth_private: string | null;
          deleted_at: string | null;
          display_name: string;
          first_name_private: string | null;
          id: string;
          last_active_at: string | null;
          last_name_private: string | null;
          locale: string;
          phone_e164: string | null;
          suspended_reason: string | null;
          suspended_until: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"];
          avatar_path?: string | null;
          created_at?: string;
          date_of_birth_private?: string | null;
          deleted_at?: string | null;
          display_name?: string;
          first_name_private?: string | null;
          id: string;
          last_active_at?: string | null;
          last_name_private?: string | null;
          locale?: string;
          phone_e164?: string | null;
          suspended_reason?: string | null;
          suspended_until?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"];
          avatar_path?: string | null;
          created_at?: string;
          date_of_birth_private?: string | null;
          deleted_at?: string | null;
          display_name?: string;
          first_name_private?: string | null;
          id?: string;
          last_active_at?: string | null;
          last_name_private?: string | null;
          locale?: string;
          phone_e164?: string | null;
          suspended_reason?: string | null;
          suspended_until?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      promotion_codes: {
        Row: {
          budget_minor: number | null;
          code_normalized: string;
          created_at: string;
          discount_rules: Json;
          eligibility: Json;
          id: string;
          per_user_limit: number;
          status: string;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
        };
        Insert: {
          budget_minor?: number | null;
          code_normalized: string;
          created_at?: string;
          discount_rules: Json;
          eligibility?: Json;
          id?: string;
          per_user_limit?: number;
          status?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Update: {
          budget_minor?: number | null;
          code_normalized?: string;
          created_at?: string;
          discount_rules?: Json;
          eligibility?: Json;
          id?: string;
          per_user_limit?: number;
          status?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
        };
        Relationships: [];
      };
      promotion_redemptions: {
        Row: {
          amount_minor: number;
          booking_id: string | null;
          created_at: string;
          id: string;
          promotion_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          amount_minor: number;
          booking_id?: string | null;
          created_at?: string;
          id?: string;
          promotion_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          amount_minor?: number;
          booking_id?: string | null;
          created_at?: string;
          id?: string;
          promotion_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promotion_redemptions_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_promotion_id_fkey";
            columns: ["promotion_id"];
            isOneToOne: false;
            referencedRelation: "promotion_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rating_aggregates: {
        Row: {
          bayesian_score: number;
          id: string;
          rating_count: number;
          rating_sum: number;
          service_id: string | null;
          subject_user_id: string;
          updated_at: string;
        };
        Insert: {
          bayesian_score?: number;
          id?: string;
          rating_count?: number;
          rating_sum?: number;
          service_id?: string | null;
          subject_user_id: string;
          updated_at?: string;
        };
        Update: {
          bayesian_score?: number;
          id?: string;
          rating_count?: number;
          rating_sum?: number;
          service_id?: string | null;
          subject_user_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rating_aggregates_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rating_aggregates_subject_user_id_fkey";
            columns: ["subject_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reconciliation_runs: {
        Row: {
          actor_id: string | null;
          completed_at: string | null;
          created_at: string;
          differences: Json;
          id: string;
          period_end: string;
          period_start: string;
          processor: string;
          report_path: string | null;
          status: string;
          totals: Json;
          updated_at: string;
        };
        Insert: {
          actor_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          differences?: Json;
          id?: string;
          period_end: string;
          period_start: string;
          processor: string;
          report_path?: string | null;
          status?: string;
          totals?: Json;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          differences?: Json;
          id?: string;
          period_end?: string;
          period_start?: string;
          processor?: string;
          report_path?: string | null;
          status?: string;
          totals?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reconciliation_runs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      refunds: {
        Row: {
          amount_minor: number;
          approved_by: string | null;
          booking_id: string;
          created_at: string;
          currency: string;
          id: string;
          payment_intent_id: string;
          processed_at: string | null;
          reason: string;
          requested_by: string;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          approved_by?: string | null;
          booking_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          payment_intent_id: string;
          processed_at?: string | null;
          reason: string;
          requested_by: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          approved_by?: string | null;
          booking_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          payment_intent_id?: string;
          processed_at?: string | null;
          reason?: string;
          requested_by?: string;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_payment_intent_id_fkey";
            columns: ["payment_intent_id"];
            isOneToOne: false;
            referencedRelation: "payment_intents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      review_dimension_definitions: {
        Row: {
          active: boolean;
          created_at: string;
          description: string | null;
          dimension_key: string;
          id: string;
          label: string;
          service_id: string | null;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          dimension_key: string;
          id?: string;
          label: string;
          service_id?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          dimension_key?: string;
          id?: string;
          label?: string;
          service_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "review_dimension_definitions_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      review_dimension_scores: {
        Row: {
          dimension_id: string;
          review_id: string;
          score: number;
        };
        Insert: {
          dimension_id: string;
          review_id: string;
          score: number;
        };
        Update: {
          dimension_id?: string;
          review_id?: string;
          score?: number;
        };
        Relationships: [
          {
            foreignKeyName: "review_dimension_scores_dimension_id_fkey";
            columns: ["dimension_id"];
            isOneToOne: false;
            referencedRelation: "review_dimension_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_dimension_scores_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      review_reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason_code: string;
          reporter_id: string;
          review_id: string;
          status: Database["public"]["Enums"]["case_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason_code: string;
          reporter_id: string;
          review_id: string;
          status?: Database["public"]["Enums"]["case_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason_code?: string;
          reporter_id?: string;
          review_id?: string;
          status?: Database["public"]["Enums"]["case_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_reports_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      review_responses: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          moderation_status: Database["public"]["Enums"]["moderation_status"];
          review_id: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          review_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          moderation_status?: Database["public"]["Enums"]["moderation_status"];
          review_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_responses_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_responses_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: true;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      review_revisions: {
        Row: {
          changed_by: string;
          created_at: string;
          id: string;
          prior_body: string | null;
          prior_scores: Json | null;
          reason: string;
          review_id: string;
        };
        Insert: {
          changed_by: string;
          created_at?: string;
          id?: string;
          prior_body?: string | null;
          prior_scores?: Json | null;
          reason: string;
          review_id: string;
        };
        Update: {
          changed_by?: string;
          created_at?: string;
          id?: string;
          prior_body?: string | null;
          prior_scores?: Json | null;
          reason?: string;
          review_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_revisions_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_revisions_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          author_id: string;
          body: string | null;
          booking_id: string;
          created_at: string;
          id: string;
          overall_rating: number;
          published_at: string | null;
          status: Database["public"]["Enums"]["review_status"];
          subject_id: string;
          subject_role: Database["public"]["Enums"]["app_role"];
          submitted_at: string;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body?: string | null;
          booking_id: string;
          created_at?: string;
          id?: string;
          overall_rating: number;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          subject_id: string;
          subject_role: Database["public"]["Enums"]["app_role"];
          submitted_at?: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string | null;
          booking_id?: string;
          created_at?: string;
          id?: string;
          overall_rating?: number;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          subject_id?: string;
          subject_role?: Database["public"]["Enums"]["app_role"];
          submitted_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      risk_signals: {
        Row: {
          booking_id: string | null;
          created_at: string;
          evidence_redacted: Json;
          id: string;
          payment_intent_id: string | null;
          review_id: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          score: number;
          signal_type: string;
          source: string;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          evidence_redacted?: Json;
          id?: string;
          payment_intent_id?: string | null;
          review_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          score: number;
          signal_type: string;
          source: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          evidence_redacted?: Json;
          id?: string;
          payment_intent_id?: string | null;
          review_id?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          score?: number;
          signal_type?: string;
          source?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "risk_signals_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_signals_payment_intent_id_fkey";
            columns: ["payment_intent_id"];
            isOneToOne: false;
            referencedRelation: "payment_intents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_signals_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_signals_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "risk_signals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      safety_incidents: {
        Row: {
          acknowledged_at: string | null;
          assigned_admin_id: string | null;
          booking_id: string | null;
          category: string;
          created_at: string;
          emergency_contact_outcome: string | null;
          id: string;
          reporter_id: string;
          resolved_at: string | null;
          severity: Database["public"]["Enums"]["case_priority"];
          status: Database["public"]["Enums"]["case_status"];
          updated_at: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          assigned_admin_id?: string | null;
          booking_id?: string | null;
          category: string;
          created_at?: string;
          emergency_contact_outcome?: string | null;
          id?: string;
          reporter_id: string;
          resolved_at?: string | null;
          severity?: Database["public"]["Enums"]["case_priority"];
          status?: Database["public"]["Enums"]["case_status"];
          updated_at?: string;
        };
        Update: {
          acknowledged_at?: string | null;
          assigned_admin_id?: string | null;
          booking_id?: string | null;
          category?: string;
          created_at?: string;
          emergency_contact_outcome?: string | null;
          id?: string;
          reporter_id?: string;
          resolved_at?: string | null;
          severity?: Database["public"]["Enums"]["case_priority"];
          status?: Database["public"]["Enums"]["case_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "safety_incidents_assigned_admin_id_fkey";
            columns: ["assigned_admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "safety_incidents_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "safety_incidents_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_searches: {
        Row: {
          alert_opt_in: boolean;
          buyer_id: string;
          created_at: string;
          filters: Json;
          id: string;
          label: string;
          updated_at: string;
        };
        Insert: {
          alert_opt_in?: boolean;
          buyer_id: string;
          created_at?: string;
          filters: Json;
          id?: string;
          label: string;
          updated_at?: string;
        };
        Update: {
          alert_opt_in?: boolean;
          buyer_id?: string;
          created_at?: string;
          filters?: Json;
          id?: string;
          label?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_searches_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_workers: {
        Row: {
          enabled: boolean;
          health_status: string;
          key: string;
          last_run_at: string | null;
          locked_until: string | null;
          next_run_at: string | null;
          schedule: string;
          updated_at: string;
        };
        Insert: {
          enabled?: boolean;
          health_status?: string;
          key: string;
          last_run_at?: string | null;
          locked_until?: string | null;
          next_run_at?: string | null;
          schedule: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          health_status?: string;
          key?: string;
          last_run_at?: string | null;
          locked_until?: string | null;
          next_run_at?: string | null;
          schedule?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seller_credentials: {
        Row: {
          created_at: string;
          credential_type: string;
          expiry_date: string | null;
          id: string;
          identifier_redacted: string | null;
          issue_date: string | null;
          issuing_body: string | null;
          seller_id: string;
          service_id: string | null;
          source_document_id: string | null;
          status: Database["public"]["Enums"]["verification_status"];
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          credential_type: string;
          expiry_date?: string | null;
          id?: string;
          identifier_redacted?: string | null;
          issue_date?: string | null;
          issuing_body?: string | null;
          seller_id: string;
          service_id?: string | null;
          source_document_id?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          credential_type?: string;
          expiry_date?: string | null;
          id?: string;
          identifier_redacted?: string | null;
          issue_date?: string | null;
          issuing_body?: string | null;
          seller_id?: string;
          service_id?: string | null;
          source_document_id?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "seller_credentials_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_credentials_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_credentials_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seller_credentials_source_document_id_fkey";
            columns: ["source_document_id"];
            isOneToOne: false;
            referencedRelation: "seller_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seller_credentials_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      seller_documents: {
        Row: {
          created_at: string;
          document_type: string;
          expiry_date: string | null;
          file_hash: string | null;
          id: string;
          issue_date: string | null;
          metadata_redacted: Json;
          seller_id: string;
          status: Database["public"]["Enums"]["verification_status"];
          storage_path: string;
          updated_at: string;
          uploaded_at: string;
        };
        Insert: {
          created_at?: string;
          document_type: string;
          expiry_date?: string | null;
          file_hash?: string | null;
          id?: string;
          issue_date?: string | null;
          metadata_redacted?: Json;
          seller_id: string;
          status?: Database["public"]["Enums"]["verification_status"];
          storage_path: string;
          updated_at?: string;
          uploaded_at?: string;
        };
        Update: {
          created_at?: string;
          document_type?: string;
          expiry_date?: string | null;
          file_hash?: string | null;
          id?: string;
          issue_date?: string | null;
          metadata_redacted?: Json;
          seller_id?: string;
          status?: Database["public"]["Enums"]["verification_status"];
          storage_path?: string;
          updated_at?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seller_documents_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_documents_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      seller_offer_rules: {
        Row: {
          action: string;
          active: boolean;
          constraints: Json;
          created_at: string;
          id: string;
          seller_id: string;
          service_area_id: string | null;
          service_id: string | null;
          updated_at: string;
        };
        Insert: {
          action?: string;
          active?: boolean;
          constraints?: Json;
          created_at?: string;
          id?: string;
          seller_id: string;
          service_area_id?: string | null;
          service_id?: string | null;
          updated_at?: string;
        };
        Update: {
          action?: string;
          active?: boolean;
          constraints?: Json;
          created_at?: string;
          id?: string;
          seller_id?: string;
          service_area_id?: string | null;
          service_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seller_offer_rules_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_offer_rules_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_offer_rules_service_area_id_fkey";
            columns: ["service_area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seller_offer_rules_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      seller_profiles: {
        Row: {
          additional_details: string[];
          approved_at: string | null;
          avatar_path: string | null;
          completed_bookings: number;
          created_at: string;
          display_name: string;
          headline: string | null;
          island_id: string | null;
          languages: string[];
          locality: string | null;
          pause_reason: string | null;
          profile_published_at: string | null;
          public_slug: string | null;
          rating_average: number;
          rating_count: number;
          response_rate: number;
          status: Database["public"]["Enums"]["seller_status"];
          updated_at: string;
          user_id: string;
          vaccinations: string[];
        };
        Insert: {
          additional_details?: string[];
          approved_at?: string | null;
          avatar_path?: string | null;
          completed_bookings?: number;
          created_at?: string;
          display_name: string;
          headline?: string | null;
          island_id?: string | null;
          languages?: string[];
          locality?: string | null;
          pause_reason?: string | null;
          profile_published_at?: string | null;
          public_slug?: string | null;
          rating_average?: number;
          rating_count?: number;
          response_rate?: number;
          status?: Database["public"]["Enums"]["seller_status"];
          updated_at?: string;
          user_id: string;
          vaccinations?: string[];
        };
        Update: {
          additional_details?: string[];
          approved_at?: string | null;
          avatar_path?: string | null;
          completed_bookings?: number;
          created_at?: string;
          display_name?: string;
          headline?: string | null;
          island_id?: string | null;
          languages?: string[];
          locality?: string | null;
          pause_reason?: string | null;
          profile_published_at?: string | null;
          public_slug?: string | null;
          rating_average?: number;
          rating_count?: number;
          response_rate?: number;
          status?: Database["public"]["Enums"]["seller_status"];
          updated_at?: string;
          user_id?: string;
          vaccinations?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "seller_profiles_island_id_fkey";
            columns: ["island_id"];
            isOneToOne: false;
            referencedRelation: "islands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seller_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      seller_public_safety_checks: {
        Row: {
          check_type: string;
          completed_at: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          public: boolean;
          public_summary: string | null;
          seller_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          check_type: string;
          completed_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          public?: boolean;
          public_summary?: string | null;
          seller_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          check_type?: string;
          completed_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          public?: boolean;
          public_summary?: string | null;
          seller_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seller_public_safety_checks_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_public_safety_checks_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      seller_service_areas: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          radius_km: number | null;
          seller_id: string;
          service_area_id: string;
          travel_fee_minor: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          radius_km?: number | null;
          seller_id: string;
          service_area_id: string;
          travel_fee_minor?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          radius_km?: number | null;
          seller_id?: string;
          service_area_id?: string;
          travel_fee_minor?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seller_service_areas_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_service_areas_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_service_areas_service_area_id_fkey";
            columns: ["service_area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
        ];
      };
      seller_services: {
        Row: {
          active: boolean;
          additional_help: string[];
          booking_modes: Database["public"]["Enums"]["booking_mode"][];
          capabilities: string[];
          created_at: string;
          currency: string;
          id: string;
          maximum_duration_minutes: number | null;
          minimum_duration_minutes: number;
          rate_max_minor: number | null;
          rate_minor: number;
          seller_id: string;
          service_bio: string | null;
          service_id: string;
          updated_at: string;
          years_experience: number;
        };
        Insert: {
          active?: boolean;
          additional_help?: string[];
          booking_modes?: Database["public"]["Enums"]["booking_mode"][];
          capabilities?: string[];
          created_at?: string;
          currency?: string;
          id?: string;
          maximum_duration_minutes?: number | null;
          minimum_duration_minutes?: number;
          rate_max_minor?: number | null;
          rate_minor: number;
          seller_id: string;
          service_bio?: string | null;
          service_id: string;
          updated_at?: string;
          years_experience?: number;
        };
        Update: {
          active?: boolean;
          additional_help?: string[];
          booking_modes?: Database["public"]["Enums"]["booking_mode"][];
          capabilities?: string[];
          created_at?: string;
          currency?: string;
          id?: string;
          maximum_duration_minutes?: number | null;
          minimum_duration_minutes?: number;
          rate_max_minor?: number | null;
          rate_minor?: number;
          seller_id?: string;
          service_bio?: string | null;
          service_id?: string;
          updated_at?: string;
          years_experience?: number;
        };
        Relationships: [
          {
            foreignKeyName: "seller_services_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_services_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      seller_status_history: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["seller_status"] | null;
          id: string;
          note: string | null;
          reason_code: string | null;
          seller_id: string;
          to_status: Database["public"]["Enums"]["seller_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["seller_status"] | null;
          id?: string;
          note?: string | null;
          reason_code?: string | null;
          seller_id: string;
          to_status: Database["public"]["Enums"]["seller_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["seller_status"] | null;
          id?: string;
          note?: string | null;
          reason_code?: string | null;
          seller_id?: string;
          to_status?: Database["public"]["Enums"]["seller_status"];
        };
        Relationships: [
          {
            foreignKeyName: "seller_status_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seller_status_history_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "seller_status_history_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      service_areas: {
        Row: {
          active: boolean;
          boundary: unknown;
          created_at: string;
          id: string;
          island_id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          boundary?: unknown;
          created_at?: string;
          id?: string;
          island_id: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          boundary?: unknown;
          created_at?: string;
          id?: string;
          island_id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_areas_island_id_fkey";
            columns: ["island_id"];
            isOneToOne: false;
            referencedRelation: "islands";
            referencedColumns: ["id"];
          },
        ];
      };
      service_categories: {
        Row: {
          active: boolean;
          created_at: string;
          description: string;
          icon_key: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description: string;
          icon_key: string;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string;
          icon_key?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_disputes: {
        Row: {
          assigned_admin_id: string | null;
          booking_id: string;
          created_at: string;
          id: string;
          opened_by: string;
          priority: Database["public"]["Enums"]["case_priority"];
          reason_code: string;
          resolution_code: string | null;
          resolution_note: string | null;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["case_status"];
          summary: string;
          updated_at: string;
        };
        Insert: {
          assigned_admin_id?: string | null;
          booking_id: string;
          created_at?: string;
          id?: string;
          opened_by: string;
          priority?: Database["public"]["Enums"]["case_priority"];
          reason_code: string;
          resolution_code?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["case_status"];
          summary: string;
          updated_at?: string;
        };
        Update: {
          assigned_admin_id?: string | null;
          booking_id?: string;
          created_at?: string;
          id?: string;
          opened_by?: string;
          priority?: Database["public"]["Enums"]["case_priority"];
          reason_code?: string;
          resolution_code?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["case_status"];
          summary?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_disputes_assigned_admin_id_fkey";
            columns: ["assigned_admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_disputes_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_disputes_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      service_extras: {
        Row: {
          active: boolean;
          created_at: string;
          description: string | null;
          duration_impact_minutes: number;
          id: string;
          maximum_quantity: number;
          minimum_quantity: number;
          name: string;
          price_type: string;
          price_value: number;
          service_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          duration_impact_minutes?: number;
          id?: string;
          maximum_quantity?: number;
          minimum_quantity?: number;
          name: string;
          price_type: string;
          price_value: number;
          service_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          duration_impact_minutes?: number;
          id?: string;
          maximum_quantity?: number;
          minimum_quantity?: number;
          name?: string;
          price_type?: string;
          price_value?: number;
          service_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_extras_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          active: boolean;
          booking_increment_minutes: number;
          booking_modes: Database["public"]["Enums"]["booking_mode"][];
          category_id: string;
          created_at: string;
          description: string;
          id: string;
          location_modes: string[];
          maximum_advance_days: number;
          minimum_duration_minutes: number;
          minimum_lead_minutes: number;
          name: string;
          pricing_unit: string;
          required_credential_types: string[];
          requirements_schema: Json;
          risk_level: string;
          slug: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          booking_increment_minutes?: number;
          booking_modes?: Database["public"]["Enums"]["booking_mode"][];
          category_id: string;
          created_at?: string;
          description: string;
          id?: string;
          location_modes?: string[];
          maximum_advance_days?: number;
          minimum_duration_minutes?: number;
          minimum_lead_minutes?: number;
          name: string;
          pricing_unit: string;
          required_credential_types?: string[];
          requirements_schema?: Json;
          risk_level?: string;
          slug: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          active?: boolean;
          booking_increment_minutes?: number;
          booking_modes?: Database["public"]["Enums"]["booking_mode"][];
          category_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          location_modes?: string[];
          maximum_advance_days?: number;
          minimum_duration_minutes?: number;
          minimum_lead_minutes?: number;
          name?: string;
          pricing_unit?: string;
          required_credential_types?: string[];
          requirements_schema?: Json;
          risk_level?: string;
          slug?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "service_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      support_cases: {
        Row: {
          booking_id: string | null;
          case_type: string;
          created_at: string;
          details_private: string;
          first_response_due_at: string;
          id: string;
          owner_admin_id: string | null;
          payment_intent_id: string | null;
          priority: Database["public"]["Enums"]["case_priority"];
          reference: string;
          requester_id: string;
          resolution_due_at: string;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["case_status"];
          subject: string;
          updated_at: string;
        };
        Insert: {
          booking_id?: string | null;
          case_type: string;
          created_at?: string;
          details_private: string;
          first_response_due_at?: string;
          id?: string;
          owner_admin_id?: string | null;
          payment_intent_id?: string | null;
          priority?: Database["public"]["Enums"]["case_priority"];
          reference?: string;
          requester_id: string;
          resolution_due_at?: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["case_status"];
          subject: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string | null;
          case_type?: string;
          created_at?: string;
          details_private?: string;
          first_response_due_at?: string;
          id?: string;
          owner_admin_id?: string | null;
          payment_intent_id?: string | null;
          priority?: Database["public"]["Enums"]["case_priority"];
          reference?: string;
          requester_id?: string;
          resolution_due_at?: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["case_status"];
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_cases_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_cases_owner_admin_id_fkey";
            columns: ["owner_admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_cases_payment_intent_id_fkey";
            columns: ["payment_intent_id"];
            isOneToOne: false;
            referencedRelation: "payment_intents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_cases_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      system_settings: {
        Row: {
          effective_at: string;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
          version: number;
        };
        Insert: {
          effective_at?: string;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
          version?: number;
        };
        Update: {
          effective_at?: string;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tax_rules: {
        Row: {
          active: boolean;
          calculation_rules: Json;
          created_at: string;
          effective_from: string;
          effective_until: string | null;
          id: string;
          jurisdiction: string;
          service_id: string | null;
          updated_at: string;
          validated_by: string | null;
        };
        Insert: {
          active?: boolean;
          calculation_rules: Json;
          created_at?: string;
          effective_from: string;
          effective_until?: string | null;
          id?: string;
          jurisdiction: string;
          service_id?: string | null;
          updated_at?: string;
          validated_by?: string | null;
        };
        Update: {
          active?: boolean;
          calculation_rules?: Json;
          created_at?: string;
          effective_from?: string;
          effective_until?: string | null;
          id?: string;
          jurisdiction?: string;
          service_id?: string | null;
          updated_at?: string;
          validated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tax_rules_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      travel_pricing_rules: {
        Row: {
          active: boolean;
          created_at: string;
          fee_per_km_minor: number;
          id: string;
          included_km: number;
          maximum_minor: number | null;
          seller_id: string | null;
          service_area_id: string | null;
          service_id: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          fee_per_km_minor?: number;
          id?: string;
          included_km?: number;
          maximum_minor?: number | null;
          seller_id?: string | null;
          service_area_id?: string | null;
          service_id?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          fee_per_km_minor?: number;
          id?: string;
          included_km?: number;
          maximum_minor?: number | null;
          seller_id?: string | null;
          service_area_id?: string | null;
          service_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "travel_pricing_rules_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "travel_pricing_rules_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "travel_pricing_rules_service_area_id_fkey";
            columns: ["service_area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "travel_pricing_rules_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      user_badges: {
        Row: {
          awarded_at: string;
          badge_id: string;
          created_at: string;
          expires_at: string | null;
          id: string;
          metric_snapshot: Json;
          revoked_at: string | null;
          revoked_reason: string | null;
          rule_version: number;
          source_id: string | null;
          source_type: string;
          user_id: string;
        };
        Insert: {
          awarded_at?: string;
          badge_id: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          metric_snapshot?: Json;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          rule_version: number;
          source_id?: string | null;
          source_type: string;
          user_id: string;
        };
        Update: {
          awarded_at?: string;
          badge_id?: string;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          metric_snapshot?: Json;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          rule_version?: number;
          source_id?: string | null;
          source_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_badges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_preferences: {
        Row: {
          created_at: string;
          distance_unit: string;
          high_contrast: boolean;
          locale: string;
          marketing_opt_in: boolean;
          reduced_motion: boolean;
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          distance_unit?: string;
          high_contrast?: boolean;
          locale?: string;
          marketing_opt_in?: boolean;
          reduced_motion?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          distance_unit?: string;
          high_contrast?: boolean;
          locale?: string;
          marketing_opt_in?: boolean;
          reduced_motion?: boolean;
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          id: string;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          revoked_at?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_cases: {
        Row: {
          admin_reviewer_id: string | null;
          created_at: string;
          decided_at: string | null;
          decision_reason: string | null;
          expires_at: string | null;
          external_ref: string | null;
          id: string;
          initiated_at: string;
          result_summary: string | null;
          seller_id: string;
          status: Database["public"]["Enums"]["verification_status"];
          updated_at: string;
          vendor: string;
          verification_type: string;
        };
        Insert: {
          admin_reviewer_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decision_reason?: string | null;
          expires_at?: string | null;
          external_ref?: string | null;
          id?: string;
          initiated_at?: string;
          result_summary?: string | null;
          seller_id: string;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
          vendor?: string;
          verification_type: string;
        };
        Update: {
          admin_reviewer_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decision_reason?: string | null;
          expires_at?: string | null;
          external_ref?: string | null;
          id?: string;
          initiated_at?: string;
          result_summary?: string | null;
          seller_id?: string;
          status?: Database["public"]["Enums"]["verification_status"];
          updated_at?: string;
          vendor?: string;
          verification_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verification_cases_admin_reviewer_id_fkey";
            columns: ["admin_reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verification_cases_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_directory";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "verification_cases_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "seller_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      waitlist_entries: {
        Row: {
          buyer_id: string;
          created_at: string;
          ends_at: string | null;
          expires_at: string | null;
          id: string;
          maximum_minor: number | null;
          priority: number;
          request_id: string | null;
          service_area_id: string;
          service_id: string;
          starts_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          buyer_id: string;
          created_at?: string;
          ends_at?: string | null;
          expires_at?: string | null;
          id?: string;
          maximum_minor?: number | null;
          priority?: number;
          request_id?: string | null;
          service_area_id: string;
          service_id: string;
          starts_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          buyer_id?: string;
          created_at?: string;
          ends_at?: string | null;
          expires_at?: string | null;
          id?: string;
          maximum_minor?: number | null;
          priority?: number;
          request_id?: string | null;
          service_area_id?: string;
          service_id?: string;
          starts_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_entries_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "booking_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_entries_service_area_id_fkey";
            columns: ["service_area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_entries_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_deliveries: {
        Row: {
          attempt: number;
          created_at: string;
          event_id: string;
          id: string;
          next_attempt_at: string | null;
          response_code: number | null;
          signature_metadata: Json;
          status: Database["public"]["Enums"]["delivery_status"];
          subscription_id: string;
          updated_at: string;
        };
        Insert: {
          attempt?: number;
          created_at?: string;
          event_id: string;
          id?: string;
          next_attempt_at?: string | null;
          response_code?: number | null;
          signature_metadata?: Json;
          status?: Database["public"]["Enums"]["delivery_status"];
          subscription_id: string;
          updated_at?: string;
        };
        Update: {
          attempt?: number;
          created_at?: string;
          event_id?: string;
          id?: string;
          next_attempt_at?: string | null;
          response_code?: number | null;
          signature_metadata?: Json;
          status?: Database["public"]["Enums"]["delivery_status"];
          subscription_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "domain_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_deliveries_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "webhook_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_subscriptions: {
        Row: {
          created_at: string;
          endpoint_url: string;
          event_types: string[];
          id: string;
          owner_user_id: string | null;
          rate_limit_per_minute: number;
          signing_secret_ref: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          endpoint_url: string;
          event_types: string[];
          id?: string;
          owner_user_id?: string | null;
          rate_limit_per_minute?: number;
          signing_secret_ref: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          endpoint_url?: string;
          event_types?: string[];
          id?: string;
          owner_user_id?: string | null;
          rate_limit_per_minute?: number;
          signing_secret_ref?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_subscriptions_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_runs: {
        Row: {
          cursor: Json | null;
          ended_at: string | null;
          error_summary: string | null;
          id: string;
          processed_count: number;
          started_at: string;
          status: string;
          trace_id: string;
          worker_key: string;
        };
        Insert: {
          cursor?: Json | null;
          ended_at?: string | null;
          error_summary?: string | null;
          id?: string;
          processed_count?: number;
          started_at?: string;
          status?: string;
          trace_id?: string;
          worker_key: string;
        };
        Update: {
          cursor?: Json | null;
          ended_at?: string | null;
          error_summary?: string | null;
          id?: string;
          processed_count?: number;
          started_at?: string;
          status?: string;
          trace_id?: string;
          worker_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_runs_worker_key_fkey";
            columns: ["worker_key"];
            isOneToOne: false;
            referencedRelation: "scheduled_workers";
            referencedColumns: ["key"];
          },
        ];
      };
    };
    Views: {
      admin_overview: {
        Row: {
          active_bookings: number | null;
          active_users: number | null;
          moderation_queue: number | null;
          open_care_requests: number | null;
          open_disputes: number | null;
          sellers_under_review: number | null;
          simulated_volume_minor: number | null;
        };
        Relationships: [];
      };
      seller_directory: {
        Row: {
          additional_details: string[] | null;
          availability: Json | null;
          availability_updated_at: string | null;
          avatar_path: string | null;
          badges: Json | null;
          completed_bookings: number | null;
          credentials: Json | null;
          display_name: string | null;
          headline: string | null;
          island: string | null;
          languages: string[] | null;
          locality: string | null;
          public_slug: string | null;
          rating_average: number | null;
          rating_count: number | null;
          response_rate: number | null;
          safety_checks: Json | null;
          services: Json | null;
          user_id: string | null;
          vaccinations: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "seller_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      wallet_balances: {
        Row: {
          account_id: string | null;
          account_type: string | null;
          balance_minor: number | null;
          currency: string | null;
          last_activity_at: string | null;
          owner_user_id: string | null;
          status: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      accept_booking_offer: {
        Args: {
          p_accept: boolean;
          p_decline_code?: string;
          p_idempotency_key?: string;
          p_offer_id: string;
        };
        Returns: Json;
      };
      accept_quote_with_simulated_payment: {
        Args: { p_idempotency_key: string; p_quote_id: string };
        Returns: Json;
      };
      activate_seller_profile: {
        Args: { p_display_name: string };
        Returns: Json;
      };
      admin_conversation_messages: {
        Args: { p_conversation_id: string; p_purpose_code: string };
        Returns: Json;
      };
      admin_manage_operations_case: {
        Args: {
          p_action: string;
          p_case_id: string;
          p_case_kind: string;
          p_note: string;
        };
        Returns: Json;
      };
      admin_resolve_moderation_report: {
        Args: {
          p_action: string;
          p_expires_at?: string;
          p_private_note?: string;
          p_public_note?: string;
          p_reason_code: string;
          p_report_id: string;
        };
        Returns: Json;
      };
      admin_resolve_service_dispute: {
        Args: {
          p_dispute_id: string;
          p_note: string;
          p_refund_minor?: number;
          p_resolution_code: string;
        };
        Returns: Json;
      };
      admin_review_verification: {
        Args: {
          p_case_id: string;
          p_decision: Database["public"]["Enums"]["verification_status"];
          p_note: string;
        };
        Returns: Json;
      };
      admin_update_feature_flag: {
        Args: { p_enabled: boolean; p_key: string; p_reason: string };
        Returns: Json;
      };
      admin_upsert_job_posting_plan: {
        Args: {
          p_active: boolean;
          p_code: string;
          p_description: string;
          p_duration_days: number;
          p_featured: boolean;
          p_fee_minor: number;
          p_free_post_allowance: number;
          p_name: string;
          p_plan_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      admin_upsert_service: {
        Args: {
          p_active: boolean;
          p_category_id: string;
          p_description: string;
          p_name: string;
          p_pricing_unit: string;
          p_reason: string;
          p_risk_level: string;
          p_service_id: string;
        };
        Returns: Json;
      };
      admin_upsert_service_area: {
        Args: {
          p_active: boolean;
          p_area_id: string;
          p_island_id: string;
          p_name: string;
          p_reason: string;
        };
        Returns: Json;
      };
      admin_user_action: {
        Args: {
          p_action: string;
          p_reason: string;
          p_target_user_id: string;
          p_until?: string;
        };
        Returns: Json;
      };
      cancel_booking: {
        Args: {
          p_booking_id: string;
          p_idempotency_key: string;
          p_reason_code: string;
        };
        Returns: Json;
      };
      create_care_request: { Args: { p_payload: Json }; Returns: Json };
      create_support_case: {
        Args: {
          p_booking_id?: string;
          p_case_type: string;
          p_details: string;
          p_subject: string;
        };
        Returns: Json;
      };
      generate_session_code: { Args: { p_booking_id: string }; Returns: Json };
      open_service_dispute: {
        Args: {
          p_booking_id: string;
          p_reason_code: string;
          p_summary: string;
        };
        Returns: Json;
      };
      preview_booking_cancellation: {
        Args: { p_booking_id: string };
        Returns: Json;
      };
      report_content: {
        Args: {
          p_details?: string;
          p_reason_code: string;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: Json;
      };
      request_privacy_action: {
        Args: { p_request_type: string };
        Returns: Json;
      };
      submit_seller_quote: {
        Args: {
          p_expires_at?: string;
          p_message?: string;
          p_rate_minor: number;
          p_request_id: string;
          p_travel_minor?: number;
        };
        Returns: Json;
      };
      submit_verification_document: {
        Args: {
          p_document_type: string;
          p_original_name?: string;
          p_storage_path: string;
        };
        Returns: Json;
      };
      submit_verified_review: {
        Args: { p_body?: string; p_booking_id: string; p_rating: number };
        Returns: Json;
      };
      transition_booking: {
        Args: {
          p_booking_id: string;
          p_idempotency_key?: string;
          p_reason?: string;
          p_target: Database["public"]["Enums"]["booking_status"];
        };
        Returns: Json;
      };
      verify_session_code: {
        Args: { p_booking_id: string; p_code: string };
        Returns: Json;
      };
    };
    Enums: {
      account_status:
        "pending" | "active" | "restricted" | "suspended" | "closed";
      app_role: "buyer" | "seller" | "admin";
      booking_mode: "scheduled" | "on_demand";
      booking_status:
        | "draft"
        | "quoted"
        | "payment_pending"
        | "requested"
        | "offered"
        | "confirmed"
        | "in_progress"
        | "completion_pending"
        | "completed"
        | "cancelled"
        | "expired"
        | "disputed"
        | "resolved";
      case_priority: "low" | "normal" | "high" | "urgent";
      case_status:
        | "open"
        | "awaiting_user"
        | "awaiting_admin"
        | "escalated"
        | "resolved"
        | "closed";
      delivery_status:
        | "queued"
        | "processing"
        | "delivered"
        | "failed"
        | "suppressed"
        | "dead_letter";
      ledger_direction: "debit" | "credit";
      moderation_status: "pending" | "allowed" | "limited" | "removed";
      notification_channel: "in_app" | "push" | "email" | "sms";
      offer_status:
        | "queued"
        | "sent"
        | "viewed"
        | "accepted"
        | "declined"
        | "expired"
        | "withdrawn";
      payment_status:
        | "requires_method"
        | "requires_action"
        | "authorized"
        | "captured"
        | "partially_refunded"
        | "refunded"
        | "failed"
        | "cancelled"
        | "disputed";
      payout_status:
        | "pending"
        | "scheduled"
        | "processing"
        | "paid"
        | "failed"
        | "reversed"
        | "held";
      review_status: "pending_peer" | "published" | "hidden" | "removed";
      seller_status:
        | "draft"
        | "submitted"
        | "needs_information"
        | "under_review"
        | "approved"
        | "rejected"
        | "paused"
        | "suspended";
      verification_status:
        | "not_started"
        | "pending"
        | "needs_information"
        | "approved"
        | "rejected"
        | "expired"
        | "revoked";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_status: [
        "pending",
        "active",
        "restricted",
        "suspended",
        "closed",
      ],
      app_role: ["buyer", "seller", "admin"],
      booking_mode: ["scheduled", "on_demand"],
      booking_status: [
        "draft",
        "quoted",
        "payment_pending",
        "requested",
        "offered",
        "confirmed",
        "in_progress",
        "completion_pending",
        "completed",
        "cancelled",
        "expired",
        "disputed",
        "resolved",
      ],
      case_priority: ["low", "normal", "high", "urgent"],
      case_status: [
        "open",
        "awaiting_user",
        "awaiting_admin",
        "escalated",
        "resolved",
        "closed",
      ],
      delivery_status: [
        "queued",
        "processing",
        "delivered",
        "failed",
        "suppressed",
        "dead_letter",
      ],
      ledger_direction: ["debit", "credit"],
      moderation_status: ["pending", "allowed", "limited", "removed"],
      notification_channel: ["in_app", "push", "email", "sms"],
      offer_status: [
        "queued",
        "sent",
        "viewed",
        "accepted",
        "declined",
        "expired",
        "withdrawn",
      ],
      payment_status: [
        "requires_method",
        "requires_action",
        "authorized",
        "captured",
        "partially_refunded",
        "refunded",
        "failed",
        "cancelled",
        "disputed",
      ],
      payout_status: [
        "pending",
        "scheduled",
        "processing",
        "paid",
        "failed",
        "reversed",
        "held",
      ],
      review_status: ["pending_peer", "published", "hidden", "removed"],
      seller_status: [
        "draft",
        "submitted",
        "needs_information",
        "under_review",
        "approved",
        "rejected",
        "paused",
        "suspended",
      ],
      verification_status: [
        "not_started",
        "pending",
        "needs_information",
        "approved",
        "rejected",
        "expired",
        "revoked",
      ],
    },
  },
} as const;
