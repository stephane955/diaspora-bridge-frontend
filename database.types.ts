export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      escrow_funder_approvals: {
        Row: {
          approved_at: string
          funder_id: string
          funding_request_id: string
          id: string
        }
        Insert: {
          approved_at?: string
          funder_id: string
          funding_request_id: string
          id?: string
        }
        Update: {
          approved_at?: string
          funder_id?: string
          funding_request_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_funder_approvals_funding_request_id_fkey"
            columns: ["funding_request_id"]
            isOneToOne: false
            referencedRelation: "escrow_funding_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_funding_requests: {
        Row: {
          amount_xaf: number
          consumed_at: string | null
          created_at: string
          id: string
          project_id: string
          requested_by: string
          status: string
        }
        Insert: {
          amount_xaf: number
          consumed_at?: string | null
          created_at?: string
          id: string
          project_id: string
          requested_by: string
          status?: string
        }
        Update: {
          amount_xaf?: number
          consumed_at?: string | null
          created_at?: string
          id?: string
          project_id?: string
          requested_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_funding_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_providers: {
        Row: {
          client_id: string
          created_at: string
          id: string
          provider_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          provider_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          provider_id?: string
        }
        Relationships: []
      }
      fx_quotes: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          funding_request_id: string
          fx_provider: string
          id: string
          payment_id: string | null
          project_id: string
          provider_quote_ref: string
          quote_request_id: string | null
          quoted_rate: number | null
          requested_by: string
          source_amount_minor: number
          source_currency: string
          status: string
          target_amount_xaf: number
          target_currency: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          funding_request_id: string
          fx_provider: string
          id?: string
          payment_id?: string | null
          project_id: string
          provider_quote_ref: string
          quote_request_id?: string | null
          quoted_rate?: number | null
          requested_by: string
          source_amount_minor: number
          source_currency: string
          status?: string
          target_amount_xaf: number
          target_currency?: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          funding_request_id?: string
          fx_provider?: string
          id?: string
          payment_id?: string | null
          project_id?: string
          provider_quote_ref?: string
          quote_request_id?: string | null
          quoted_rate?: number | null
          requested_by?: string
          source_amount_minor?: number
          source_currency?: string
          status?: string
          target_amount_xaf?: number
          target_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "fx_quotes_funding_request_id_fkey"
            columns: ["funding_request_id"]
            isOneToOne: false
            referencedRelation: "escrow_funding_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_quotes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fx_quotes_source_currency_fkey"
            columns: ["source_currency"]
            isOneToOne: false
            referencedRelation: "platform_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_quotes_target_currency_fkey"
            columns: ["target_currency"]
            isOneToOne: false
            referencedRelation: "platform_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      hidden_projects: {
        Row: {
          created_at: string
          id: string
          project_id: string
          provider_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          provider_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          balance_xaf: number
          created_at: string
          currency: string
          id: string
          owner_id: string | null
          owner_type: Database["public"]["Enums"]["ledger_owner_type"]
          purpose: Database["public"]["Enums"]["ledger_account_purpose"]
        }
        Insert: {
          balance_xaf?: number
          created_at?: string
          currency?: string
          id?: string
          owner_id?: string | null
          owner_type: Database["public"]["Enums"]["ledger_owner_type"]
          purpose: Database["public"]["Enums"]["ledger_account_purpose"]
        }
        Update: {
          balance_xaf?: number
          created_at?: string
          currency?: string
          id?: string
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["ledger_owner_type"]
          purpose?: Database["public"]["Enums"]["ledger_account_purpose"]
        }
        Relationships: []
      }
      ledger_journals: {
        Row: {
          business_object_id: string | null
          business_object_type: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          idempotency_key: string
          journal_type: Database["public"]["Enums"]["ledger_journal_type"]
          posted_at: string
          psp_ref: string | null
          reversal_of_journal_id: string | null
          source: Database["public"]["Enums"]["ledger_journal_source"]
        }
        Insert: {
          business_object_id?: string | null
          business_object_type?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          idempotency_key: string
          journal_type: Database["public"]["Enums"]["ledger_journal_type"]
          posted_at?: string
          psp_ref?: string | null
          reversal_of_journal_id?: string | null
          source: Database["public"]["Enums"]["ledger_journal_source"]
        }
        Update: {
          business_object_id?: string | null
          business_object_type?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          idempotency_key?: string
          journal_type?: Database["public"]["Enums"]["ledger_journal_type"]
          posted_at?: string
          psp_ref?: string | null
          reversal_of_journal_id?: string | null
          source?: Database["public"]["Enums"]["ledger_journal_source"]
        }
        Relationships: [
          {
            foreignKeyName: "ledger_journals_reversal_fk"
            columns: ["reversal_of_journal_id"]
            isOneToOne: false
            referencedRelation: "ledger_journals"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_lines: {
        Row: {
          account_id: string
          advance_id: string | null
          credit_xaf: number
          debit_xaf: number
          id: string
          journal_id: string
          milestone_id: string | null
          payment_id: string | null
          project_id: string | null
        }
        Insert: {
          account_id: string
          advance_id?: string | null
          credit_xaf: number
          debit_xaf: number
          id?: string
          journal_id: string
          milestone_id?: string | null
          payment_id?: string | null
          project_id?: string | null
        }
        Update: {
          account_id?: string
          advance_id?: string | null
          credit_xaf?: number
          debit_xaf?: number
          id?: string
          journal_id?: string
          milestone_id?: string | null
          payment_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_lines_account_fk"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_lines_journal_fk"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "ledger_journals"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_posted_events: {
        Row: {
          event_type: string | null
          id: string
          journal_id: string | null
          processed_at: string | null
          psp_event_id: string
          psp_ref: string | null
          received_at: string
          status: Database["public"]["Enums"]["ledger_event_status"]
        }
        Insert: {
          event_type?: string | null
          id?: string
          journal_id?: string | null
          processed_at?: string | null
          psp_event_id: string
          psp_ref?: string | null
          received_at?: string
          status?: Database["public"]["Enums"]["ledger_event_status"]
        }
        Update: {
          event_type?: string | null
          id?: string
          journal_id?: string | null
          processed_at?: string | null
          psp_event_id?: string
          psp_ref?: string | null
          received_at?: string
          status?: Database["public"]["Enums"]["ledger_event_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ledger_posted_events_journal_fk"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "ledger_journals"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audio_url: string | null
          content: string | null
          created_at: string
          id: string
          project_id: string
          recipient_id: string
          sender_id: string
          transcription_text: string | null
          translation_lang: string | null
          translation_text: string | null
        }
        Insert: {
          audio_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          project_id: string
          recipient_id: string
          sender_id: string
          transcription_text?: string | null
          translation_lang?: string | null
          translation_text?: string | null
        }
        Update: {
          audio_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          project_id?: string
          recipient_id?: string
          sender_id?: string
          transcription_text?: string | null
          translation_lang?: string | null
          translation_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          amount_minor: number | null
          created_at: string
          currency: string
          dispute_status: string
          disputed_at: string | null
          id: string
          project_id: string
          status: string
          step_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          amount_minor?: number | null
          created_at?: string
          currency?: string
          dispute_status?: string
          disputed_at?: string | null
          id?: string
          project_id: string
          status?: string
          step_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          amount_minor?: number | null
          created_at?: string
          currency?: string
          dispute_status?: string
          disputed_at?: string | null
          id?: string
          project_id?: string
          status?: string
          step_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json
          project_id: string | null
          route: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json
          project_id?: string | null
          route?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json
          project_id?: string | null
          route?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          attempt_request_id: string
          canceled_at: string | null
          created_at: string
          failed_at: string | null
          failure_code: string | null
          failure_detail_safe: string | null
          fx_quote_id: string | null
          id: string
          payment_id: string
          processing_at: string | null
          provider_attempt_ref: string | null
          psp_provider: string
          status: string
          submitted_at: string | null
          succeeded_at: string | null
          updated_at: string
        }
        Insert: {
          attempt_request_id: string
          canceled_at?: string | null
          created_at?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_detail_safe?: string | null
          fx_quote_id?: string | null
          id?: string
          payment_id: string
          processing_at?: string | null
          provider_attempt_ref?: string | null
          psp_provider: string
          status?: string
          submitted_at?: string | null
          succeeded_at?: string | null
          updated_at?: string
        }
        Update: {
          attempt_request_id?: string
          canceled_at?: string | null
          created_at?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_detail_safe?: string | null
          fx_quote_id?: string | null
          id?: string
          payment_id?: string
          processing_at?: string | null
          provider_attempt_ref?: string | null
          psp_provider?: string
          status?: string
          submitted_at?: string | null
          succeeded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_fx_quote_id_fkey"
            columns: ["fx_quote_id"]
            isOneToOne: false
            referencedRelation: "fx_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_attempts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_xaf: number
          client_id: string
          client_request_id: string
          created_at: string
          funding_mode: string | null
          id: string
          ledger_journal_id: string | null
          ledger_posted_at: string | null
          project_id: string
          psp_provider: string
          psp_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_xaf: number
          client_id: string
          client_request_id: string
          created_at?: string
          funding_mode?: string | null
          id?: string
          ledger_journal_id?: string | null
          ledger_posted_at?: string | null
          project_id: string
          psp_provider: string
          psp_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_xaf?: number
          client_id?: string
          client_request_id?: string
          created_at?: string
          funding_mode?: string | null
          id?: string
          ledger_journal_id?: string | null
          ledger_posted_at?: string | null
          project_id?: string
          psp_provider?: string
          psp_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_client_request_id_fkey"
            columns: ["client_request_id"]
            isOneToOne: true
            referencedRelation: "escrow_funding_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_ledger_journal_id_fkey"
            columns: ["ledger_journal_id"]
            isOneToOne: true
            referencedRelation: "ledger_journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["platform_admin_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          role: Database["public"]["Enums"]["platform_admin_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["platform_admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      platform_currencies: {
        Row: {
          code: string
          is_funding: boolean
          is_settlement: boolean
          minor_units: number
          name: string
        }
        Insert: {
          code: string
          is_funding?: boolean
          is_settlement?: boolean
          minor_units: number
          name: string
        }
        Update: {
          code?: string
          is_funding?: boolean
          is_settlement?: boolean
          minor_units?: number
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          push_token: string | null
          rating: number | null
          role: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          push_token?: string | null
          rating?: number | null
          role?: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          push_token?: string | null
          rating?: number | null
          role?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      project_applications: {
        Row: {
          bid_amount: number | null
          created_at: string
          id: string
          material_estimate: number | null
          message: string | null
          project_id: string
          provider_id: string
          status: string
          time_to_completion_days: number | null
          updated_at: string
        }
        Insert: {
          bid_amount?: number | null
          created_at?: string
          id?: string
          material_estimate?: number | null
          message?: string | null
          project_id: string
          provider_id: string
          status?: string
          time_to_completion_days?: number | null
          updated_at?: string
        }
        Update: {
          bid_amount?: number | null
          created_at?: string
          id?: string
          material_estimate?: number | null
          message?: string | null
          project_id?: string
          provider_id?: string
          status?: string
          time_to_completion_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contracts: {
        Row: {
          client_signature_url: string | null
          client_signed_at: string | null
          created_at: string
          id: string
          pdf_url: string | null
          project_id: string
          provider_signature_url: string | null
          provider_signed_at: string | null
          updated_at: string
        }
        Insert: {
          client_signature_url?: string | null
          client_signed_at?: string | null
          created_at?: string
          id?: string
          pdf_url?: string | null
          project_id: string
          provider_signature_url?: string | null
          provider_signed_at?: string | null
          updated_at?: string
        }
        Update: {
          client_signature_url?: string | null
          client_signed_at?: string | null
          created_at?: string
          id?: string
          pdf_url?: string | null
          project_id?: string
          provider_signature_url?: string | null
          provider_signed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_defects: {
        Row: {
          created_at: string
          description: string
          id: string
          project_id: string
          reported_by: string
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          project_id: string
          reported_by: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          reported_by?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_defects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_disputes: {
        Row: {
          created_at: string
          id: string
          milestone_id: string | null
          opened_by: string | null
          project_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          milestone_id?: string | null
          opened_by?: string | null
          project_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          milestone_id?: string | null
          opened_by?: string | null
          project_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_disputes_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_disputes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_expenses: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          extracted_amount: number | null
          id: string
          project_id: string
          provider_id: string | null
          receipt_url: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          extracted_amount?: number | null
          id?: string
          project_id: string
          provider_id?: string | null
          receipt_url?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          extracted_amount?: number | null
          id?: string
          project_id?: string
          provider_id?: string | null
          receipt_url?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_material_carts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          items: Json
          labor_amount_cfa: number | null
          payment_status: string
          project_id: string
          provider_id: string
          status: string
          supplier_id: string | null
          total_amount_cfa: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          items?: Json
          labor_amount_cfa?: number | null
          payment_status?: string
          project_id: string
          provider_id: string
          status?: string
          supplier_id?: string | null
          total_amount_cfa?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          items?: Json
          labor_amount_cfa?: number | null
          payment_status?: string
          project_id?: string
          provider_id?: string
          status?: string
          supplier_id?: string | null
          total_amount_cfa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_material_carts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_material_carts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_observers: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          invite_token: string
          project_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          invite_token: string
          project_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          invite_token?: string
          project_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_observers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_updates: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          photo_url: string | null
          project_id: string
          title: string | null
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          project_id: string
          title?: string | null
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          project_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assigned_provider_id: string | null
          city: string | null
          created_at: string
          currency: string
          description: string | null
          dispute_milestone_id: string | null
          estimated_budget_minor: number | null
          funder_ids: string[]
          id: string
          image_url: string | null
          material_budget_minor: number | null
          owner_id: string
          status: string
          title: string | null
          updated_at: string
          warranty_hold_until: string | null
          warranty_retainage_minor: number | null
          warranty_status: string
        }
        Insert: {
          assigned_provider_id?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dispute_milestone_id?: string | null
          estimated_budget_minor?: number | null
          funder_ids?: string[]
          id?: string
          image_url?: string | null
          material_budget_minor?: number | null
          owner_id: string
          status?: string
          title?: string | null
          updated_at?: string
          warranty_hold_until?: string | null
          warranty_retainage_minor?: number | null
          warranty_status?: string
        }
        Update: {
          assigned_provider_id?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          dispute_milestone_id?: string | null
          estimated_budget_minor?: number | null
          funder_ids?: string[]
          id?: string
          image_url?: string | null
          material_budget_minor?: number | null
          owner_id?: string
          status?: string
          title?: string | null
          updated_at?: string
          warranty_hold_until?: string | null
          warranty_retainage_minor?: number | null
          warranty_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_dispute_milestone_id_fkey"
            columns: ["dispute_milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_advances: {
        Row: {
          amount_minor: number | null
          created_at: string
          currency: string
          id: string
          project_id: string
          provider_id: string
          status: string
        }
        Insert: {
          amount_minor?: number | null
          created_at?: string
          currency?: string
          id?: string
          project_id: string
          provider_id: string
          status?: string
        }
        Update: {
          amount_minor?: number | null
          created_at?: string
          currency?: string
          id?: string
          project_id?: string
          provider_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_advances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          id: string
          project_id: string
          provider_id: string
          rating: number
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          project_id: string
          provider_id: string
          rating: number
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          project_id?: string
          provider_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          id: number
          type: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          id?: number
          type?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          id?: number
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number | null
          amount_minor: number | null
          created_at: string
          currency: string | null
          id: number
          status: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          amount_minor?: number | null
          created_at?: string
          currency?: string | null
          id?: number
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          amount_minor?: number | null
          created_at?: string
          currency?: string | null
          id?: number
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          id: string | null
        }
        Insert: {
          id?: string | null
        }
        Update: {
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      c12_caller_is_service: { Args: never; Returns: boolean }
      escrow_all_funders_approved_for_request: {
        Args: { p_funding_request_id: string }
        Returns: boolean
      }
      escrow_caller_may_fund_project: {
        Args: { p_project_id: string; p_uid: string }
        Returns: boolean
      }
      escrow_is_funding_request_participant: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      escrow_mark_funding_request_consumed: {
        Args: { p_funding_request_id: string }
        Returns: undefined
      }
      get_provider_advance_eligibility: {
        Args: { p_provider_id: string }
        Returns: Json
      }
      get_provider_stats: { Args: { p_provider_id: string }; Returns: Json }
      has_admin_role: {
        Args: {
          p_required?: Database["public"]["Enums"]["platform_admin_role"]
        }
        Returns: boolean
      }
      ledger_assert_journal_balanced: {
        Args: { p_journal_id: string }
        Returns: undefined
      }
      ledger_assert_owner_consistency: {
        Args: {
          p_owner_id: string
          p_owner_type: Database["public"]["Enums"]["ledger_owner_type"]
          p_purpose: Database["public"]["Enums"]["ledger_account_purpose"]
        }
        Returns: undefined
      }
      ledger_balance_sheet_probe: {
        Args: never
        Returns: {
          asset_balances: number
          equity_balances: number
          expense_balances: number
          income_balances: number
          liability_balances: number
        }[]
      }
      ledger_canonical_psp_event_id: {
        Args: { p_psp_event_id: string; p_psp_provider: string }
        Returns: string
      }
      ledger_ensure_account: {
        Args: {
          p_currency?: string
          p_owner_id?: string
          p_owner_type: Database["public"]["Enums"]["ledger_owner_type"]
          p_purpose: Database["public"]["Enums"]["ledger_account_purpose"]
        }
        Returns: string
      }
      ledger_healthcheck: { Args: never; Returns: Json }
      ledger_post_journal: {
        Args: {
          p_business_object_id?: string
          p_business_object_type?: string
          p_created_by?: string
          p_currency?: string
          p_idempotency_key: string
          p_journal_type: Database["public"]["Enums"]["ledger_journal_type"]
          p_lines: Json
          p_psp_ref?: string
          p_source: Database["public"]["Enums"]["ledger_journal_source"]
        }
        Returns: Json
      }
      ledger_psp_purpose_for_provider: {
        Args: { p_psp_provider: string }
        Returns: Database["public"]["Enums"]["ledger_account_purpose"]
      }
      ledger_purpose_allows_negative: {
        Args: {
          p_purpose: Database["public"]["Enums"]["ledger_account_purpose"]
        }
        Returns: boolean
      }
      ledger_purpose_normal_side: {
        Args: {
          p_purpose: Database["public"]["Enums"]["ledger_account_purpose"]
        }
        Returns: string
      }
      ledger_seed_system_accounts: { Args: never; Returns: undefined }
      ledger_trial_balance: {
        Args: never
        Returns: {
          balance_xaf: number
          normal_side: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["ledger_owner_type"]
          purpose: Database["public"]["Enums"]["ledger_account_purpose"]
        }[]
      }
      ledger_validate_phase3a_matrix: {
        Args: {
          p_journal_type: Database["public"]["Enums"]["ledger_journal_type"]
          p_lines: Json
        }
        Returns: undefined
      }
      ledger_verify_journal_equality: {
        Args: never
        Returns: {
          is_balanced: boolean
          journal_count: number
          total_credit_xaf: number
          total_debit_xaf: number
        }[]
      }
      payment_caller_may_fund_project: {
        Args: { p_project_id: string; p_uid: string }
        Returns: boolean
      }
      platform_assert_settlement_currency: {
        Args: { p_currency: string }
        Returns: undefined
      }
      platform_fee_bps_minor: {
        Args: { p_amount_minor: number; p_basis_points: number }
        Returns: number
      }
      platform_fee_insurance_minor: {
        Args: { p_gross_minor: number }
        Returns: number
      }
      platform_milestone_amounts_conflict: {
        Args: { p_amount: number; p_amount_cfa: number; p_amount_minor: number }
        Returns: boolean
      }
      platform_resolve_amount_minor: {
        Args: { p_amount: number; p_amount_cfa: number; p_amount_minor: number }
        Returns: number
      }
      rpc_abandon_payment: {
        Args: { p_payment_id: string; p_status: string }
        Returns: Json
      }
      rpc_approve_funding_request: {
        Args: { p_funding_request_id: string }
        Returns: Json
      }
      rpc_attach_payment_attempt_ref: {
        Args: { p_attempt_id: string; p_provider_attempt_ref: string }
        Returns: Json
      }
      rpc_attach_payment_psp_ref: {
        Args: { p_payment_id: string; p_psp_ref: string }
        Returns: Json
      }
      rpc_begin_psp_webhook_event: {
        Args: {
          p_event_type: string
          p_psp_event_id: string
          p_psp_provider: string
          p_psp_ref: string
        }
        Returns: Json
      }
      rpc_complete_psp_webhook_event: {
        Args: {
          p_event_id: string
          p_journal_id?: string
          p_status: Database["public"]["Enums"]["ledger_event_status"]
        }
        Returns: undefined
      }
      rpc_create_cross_border_payment_intent: {
        Args: { p_fx_quote_id: string; p_psp_provider: string }
        Returns: Json
      }
      rpc_create_funding_request: {
        Args: {
          p_amount_xaf: number
          p_client_request_id: string
          p_project_id: string
        }
        Returns: Json
      }
      rpc_create_payment_attempt: {
        Args: {
          p_attempt_request_id: string
          p_fx_quote_id?: string
          p_payment_id: string
        }
        Returns: Json
      }
      rpc_create_payment_intent: {
        Args: {
          p_amount_xaf: number
          p_client_request_id: string
          p_project_id: string
          p_psp_provider: string
        }
        Returns: Json
      }
      rpc_create_xaf_payment_intent: {
        Args: {
          p_amount_xaf: number
          p_client_request_id: string
          p_project_id: string
          p_psp_provider: string
        }
        Returns: Json
      }
      rpc_fail_payment_attempt: {
        Args: {
          p_attempt_id: string
          p_failure_code?: string
          p_failure_detail_safe?: string
          p_outcome?: string
        }
        Returns: Json
      }
      rpc_finalize_payment_attempt_success: {
        Args: {
          p_attempt_id: string
          p_provider_attempt_ref: string
          p_psp_provider: string
        }
        Returns: Json
      }
      rpc_get_user_available_balance: { Args: never; Returns: string }
      rpc_mark_payment_succeeded: {
        Args: {
          p_amount_xaf: number
          p_currency: string
          p_payment_id: string
          p_psp_provider: string
          p_psp_ref: string
        }
        Returns: Json
      }
      rpc_post_escrow_funding: { Args: { p_payment_id: string }; Returns: Json }
      rpc_record_fx_quote: {
        Args: {
          p_expires_at: string
          p_funding_request_id: string
          p_fx_provider: string
          p_provider_quote_ref: string
          p_quote_request_id?: string
          p_quoted_rate?: number
          p_source_amount_minor: number
          p_source_currency: string
        }
        Returns: Json
      }
      rpc_revoke_funding_approval: {
        Args: { p_funding_request_id: string }
        Returns: Json
      }
      rpc_set_project_funders: {
        Args: { p_funder_ids: string[]; p_project_id: string }
        Returns: string[]
      }
      trigger_dispute: { Args: { p_project_id: string }; Returns: Json }
      user_can_access_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      user_can_read_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      user_can_write_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
    }
    Enums: {
      ledger_account_purpose:
        | "psp_stripe"
        | "psp_momo"
        | "psp_orange"
        | "platform_credit"
        | "user_available"
        | "user_payout_clearing"
        | "user_refund_clearing"
        | "project_escrow"
        | "project_retainage"
        | "project_materials_escrow"
        | "provider_payable"
        | "supplier_payable"
        | "platform_compliance_hold"
        | "platform_suspense"
        | "platform_fees"
        | "platform_insurance"
        | "platform_equity"
        | "platform_loss"
      ledger_event_status: "received" | "processed" | "ignored" | "failed"
      ledger_journal_source: "rpc" | "webhook" | "backfill" | "ops"
      ledger_journal_type:
        | "escrow_funding"
        | "compliance_hold"
        | "compliance_release"
        | "insurance_fee"
        | "platform_fee"
        | "milestone_release"
        | "retainage_release"
        | "wallet_credit"
        | "wallet_debit"
        | "payout_requested"
        | "payout_settled"
        | "payout_failed"
        | "refund"
        | "refund_settled"
        | "provider_advance_disbursement"
        | "provider_advance_repayment"
        | "material_funding"
        | "supplier_payment"
        | "milestone_release_reversal"
        | "chargeback"
        | "platform_capital_injection"
        | "payout_reversed"
      ledger_owner_type: "user" | "project" | "platform" | "psp" | "supplier"
      platform_admin_role:
        | "support"
        | "kyc_reviewer"
        | "compliance"
        | "treasury"
        | "treasury_approver"
        | "super_admin"
        | "auditor"
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
      ledger_account_purpose: [
        "psp_stripe",
        "psp_momo",
        "psp_orange",
        "platform_credit",
        "user_available",
        "user_payout_clearing",
        "user_refund_clearing",
        "project_escrow",
        "project_retainage",
        "project_materials_escrow",
        "provider_payable",
        "supplier_payable",
        "platform_compliance_hold",
        "platform_suspense",
        "platform_fees",
        "platform_insurance",
        "platform_equity",
        "platform_loss",
      ],
      ledger_event_status: ["received", "processed", "ignored", "failed"],
      ledger_journal_source: ["rpc", "webhook", "backfill", "ops"],
      ledger_journal_type: [
        "escrow_funding",
        "compliance_hold",
        "compliance_release",
        "insurance_fee",
        "platform_fee",
        "milestone_release",
        "retainage_release",
        "wallet_credit",
        "wallet_debit",
        "payout_requested",
        "payout_settled",
        "payout_failed",
        "refund",
        "refund_settled",
        "provider_advance_disbursement",
        "provider_advance_repayment",
        "material_funding",
        "supplier_payment",
        "milestone_release_reversal",
        "chargeback",
        "platform_capital_injection",
        "payout_reversed",
      ],
      ledger_owner_type: ["user", "project", "platform", "psp", "supplier"],
      platform_admin_role: [
        "support",
        "kyc_reviewer",
        "compliance",
        "treasury",
        "treasury_approver",
        "super_admin",
        "auditor",
      ],
    },
  },
} as const

