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
      agent_logs: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          level: string | null
          message: string
          metadata: Json | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          level?: string | null
          message: string
          metadata?: Json | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          level?: string | null
          message?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_metrics: {
        Row: {
          agent_id: string | null
          id: string
          metric_type: string
          recorded_at: string | null
          value: number
        }
        Insert: {
          agent_id?: string | null
          id?: string
          metric_type: string
          recorded_at?: string | null
          value: number
        }
        Update: {
          agent_id?: string | null
          id?: string
          metric_type?: string
          recorded_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_metrics_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_registry: {
        Row: {
          agent_id: string
          api_key_hash: string
          created_at: string | null
          last_seen_at: string | null
          metadata: Json | null
          name: string
          public_key: string
          reputation: number | null
          status: string | null
          tier: string | null
        }
        Insert: {
          agent_id: string
          api_key_hash: string
          created_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          name: string
          public_key: string
          reputation?: number | null
          status?: string | null
          tier?: string | null
        }
        Update: {
          agent_id?: string
          api_key_hash?: string
          created_at?: string | null
          last_seen_at?: string | null
          metadata?: Json | null
          name?: string
          public_key?: string
          reputation?: number | null
          status?: string | null
          tier?: string | null
        }
        Relationships: []
      }
      agent_templates: {
        Row: {
          category: string
          config_schema: Json | null
          created_at: string | null
          default_config: Json | null
          description: string | null
          features: Json | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          min_reputation: number | null
          name: string
          price_per_hour: number | null
          setup_fee: number | null
          short_description: string | null
          slug: string
          specs: Json | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          category: string
          config_schema?: Json | null
          created_at?: string | null
          default_config?: Json | null
          description?: string | null
          features?: Json | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          min_reputation?: number | null
          name: string
          price_per_hour?: number | null
          setup_fee?: number | null
          short_description?: string | null
          slug: string
          specs?: Json | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          config_schema?: Json | null
          created_at?: string | null
          default_config?: Json | null
          description?: string | null
          features?: Json | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          min_reputation?: number | null
          name?: string
          price_per_hour?: number | null
          setup_fee?: number | null
          short_description?: string | null
          slug?: string
          specs?: Json | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agents: {
        Row: {
          agent_id: string
          boot_audit_hash: string
          id: string
          is_active: boolean | null
          is_founding: boolean | null
          joined_at: string | null
          name: string | null
          public_key: string
          reputation: number | null
          stake_amount: number | null
          status: string | null
          tier: string | null
        }
        Insert: {
          agent_id: string
          boot_audit_hash: string
          id?: string
          is_active?: boolean | null
          is_founding?: boolean | null
          joined_at?: string | null
          name?: string | null
          public_key: string
          reputation?: number | null
          stake_amount?: number | null
          status?: string | null
          tier?: string | null
        }
        Update: {
          agent_id?: string
          boot_audit_hash?: string
          id?: string
          is_active?: boolean | null
          is_founding?: boolean | null
          joined_at?: string | null
          name?: string | null
          public_key?: string
          reputation?: number | null
          stake_amount?: number | null
          status?: string | null
          tier?: string | null
        }
        Relationships: []
      }
      arbitra_members: {
        Row: {
          agent_id: string
          arbitra_score: number | null
          commit_hash: string | null
          committee_eligible: boolean | null
          correct_votes: number | null
          created_at: string | null
          id: string
          joined_at: string | null
          package_name: string | null
          repo: string
          reputation_slash_count: number | null
          total_votes_cast: number | null
        }
        Insert: {
          agent_id: string
          arbitra_score?: number | null
          commit_hash?: string | null
          committee_eligible?: boolean | null
          correct_votes?: number | null
          created_at?: string | null
          id?: string
          joined_at?: string | null
          package_name?: string | null
          repo: string
          reputation_slash_count?: number | null
          total_votes_cast?: number | null
        }
        Update: {
          agent_id?: string
          arbitra_score?: number | null
          commit_hash?: string | null
          committee_eligible?: boolean | null
          correct_votes?: number | null
          created_at?: string | null
          id?: string
          joined_at?: string | null
          package_name?: string | null
          repo?: string
          reputation_slash_count?: number | null
          total_votes_cast?: number | null
        }
        Relationships: []
      }
      attestations: {
        Row: {
          agent_id: string
          attestation_status: string | null
          commit_hash: string
          created_at: string | null
          domain_tags: string[] | null
          id: string
          integrity_score: number | null
          package_name: string | null
          referrer_agent_id: string | null
          repo: string
          report: Json | null
          total_reputation: number | null
          virtue_score: number | null
        }
        Insert: {
          agent_id: string
          attestation_status?: string | null
          commit_hash: string
          created_at?: string | null
          domain_tags?: string[] | null
          id?: string
          integrity_score?: number | null
          package_name?: string | null
          referrer_agent_id?: string | null
          repo: string
          report?: Json | null
          total_reputation?: number | null
          virtue_score?: number | null
        }
        Update: {
          agent_id?: string
          attestation_status?: string | null
          commit_hash?: string
          created_at?: string | null
          domain_tags?: string[] | null
          id?: string
          integrity_score?: number | null
          package_name?: string | null
          referrer_agent_id?: string | null
          repo?: string
          report?: Json | null
          total_reputation?: number | null
          virtue_score?: number | null
        }
        Relationships: []
      }
      claw_agent_tasks: {
        Row: {
          agent_id: string | null
          assigned_at: string | null
          completed_at: string | null
          cost_usd: number | null
          created_at: string
          deadline_at: string | null
          execution_id: string
          id: string
          input: Json | null
          max_retries: number
          node_id: string
          output: Json | null
          payment_status:
            | Database["public"]["Enums"]["claw_payment_status"]
            | null
          reasoning_trace: Json | null
          retry_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["claw_task_status"]
          token_usage: Json | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          assigned_at?: string | null
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          deadline_at?: string | null
          execution_id: string
          id?: string
          input?: Json | null
          max_retries?: number
          node_id: string
          output?: Json | null
          payment_status?:
            | Database["public"]["Enums"]["claw_payment_status"]
            | null
          reasoning_trace?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["claw_task_status"]
          token_usage?: Json | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          assigned_at?: string | null
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          deadline_at?: string | null
          execution_id?: string
          id?: string
          input?: Json | null
          max_retries?: number
          node_id?: string
          output?: Json | null
          payment_status?:
            | Database["public"]["Enums"]["claw_payment_status"]
            | null
          reasoning_trace?: Json | null
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["claw_task_status"]
          token_usage?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claw_agent_tasks_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "claw_workflow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_agent_tasks_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "v_claw_active_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_circuit_breakers: {
        Row: {
          agent_id: string | null
          created_at: string
          failure_count: number
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          next_attempt_at: string | null
          node_id: string | null
          state: Database["public"]["Enums"]["claw_circuit_state"]
          success_count: number
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          next_attempt_at?: string | null
          node_id?: string | null
          state?: Database["public"]["Enums"]["claw_circuit_state"]
          success_count?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          next_attempt_at?: string | null
          node_id?: string | null
          state?: Database["public"]["Enums"]["claw_circuit_state"]
          success_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      claw_workflow_events: {
        Row: {
          causation_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["claw_event_type"]
          execution_id: string
          id: string
          metadata: Json | null
          node_id: string | null
          payload: Json | null
        }
        Insert: {
          causation_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["claw_event_type"]
          execution_id: string
          id?: string
          metadata?: Json | null
          node_id?: string | null
          payload?: Json | null
        }
        Update: {
          causation_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["claw_event_type"]
          execution_id?: string
          id?: string
          metadata?: Json | null
          node_id?: string | null
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_workflow_events_causation_id_fkey"
            columns: ["causation_id"]
            isOneToOne: false
            referencedRelation: "claw_workflow_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_workflow_events_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "claw_workflow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_workflow_events_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "v_claw_active_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_workflow_executions: {
        Row: {
          completed_at: string | null
          context: Json | null
          created_at: string
          current_node_id: string | null
          estimated_completion: string | null
          id: string
          input: Json | null
          progress_percent: number | null
          started_at: string | null
          state: Database["public"]["Enums"]["claw_execution_state"]
          updated_at: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          context?: Json | null
          created_at?: string
          current_node_id?: string | null
          estimated_completion?: string | null
          id?: string
          input?: Json | null
          progress_percent?: number | null
          started_at?: string | null
          state?: Database["public"]["Enums"]["claw_execution_state"]
          updated_at?: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          context?: Json | null
          created_at?: string
          current_node_id?: string | null
          estimated_completion?: string | null
          id?: string
          input?: Json | null
          progress_percent?: number | null
          started_at?: string | null
          state?: Database["public"]["Enums"]["claw_execution_state"]
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claw_workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "claw_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      claw_workflows: {
        Row: {
          created_at: string
          definition: Json
          description: string | null
          id: string
          is_active: boolean
          name: string
          owner_id: string
          tags: string[] | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_id: string
          tags?: string[] | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          tags?: string[] | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      clawfs_files: {
        Row: {
          agent_id: string | null
          cid: string
          content_type: string | null
          created_at: string | null
          id: string
          path: string
          public_key: string
          signature: string
          size_bytes: number
        }
        Insert: {
          agent_id?: string | null
          cid: string
          content_type?: string | null
          created_at?: string | null
          id?: string
          path: string
          public_key: string
          signature: string
          size_bytes?: number
        }
        Update: {
          agent_id?: string | null
          cid?: string
          content_type?: string | null
          created_at?: string | null
          id?: string
          path?: string
          public_key?: string
          signature?: string
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "clawfs_files_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      clawfs_snapshots: {
        Row: {
          agent_id: string | null
          created_at: string | null
          file_cids: string[] | null
          file_count: number
          id: string
          merkle_root: string
          public_key: string
          signature: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          file_cids?: string[] | null
          file_count?: number
          id?: string
          merkle_root: string
          public_key: string
          signature: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          file_cids?: string[] | null
          file_count?: number
          id?: string
          merkle_root?: string
          public_key?: string
          signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "clawfs_snapshots_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      disputes: {
        Row: {
          claim: string
          claimant_id: string | null
          committee: Json | null
          created_at: string | null
          dispute_status: string | null
          evidence: Json | null
          id: string
          loser_id: string | null
          opponent_id: string | null
          reputation_delta: number | null
          resolution: string | null
          winner_id: string | null
        }
        Insert: {
          claim: string
          claimant_id?: string | null
          committee?: Json | null
          created_at?: string | null
          dispute_status?: string | null
          evidence?: Json | null
          id?: string
          loser_id?: string | null
          opponent_id?: string | null
          reputation_delta?: number | null
          resolution?: string | null
          winner_id?: string | null
        }
        Update: {
          claim?: string
          claimant_id?: string | null
          committee?: Json | null
          created_at?: string | null
          dispute_status?: string | null
          evidence?: Json | null
          id?: string
          loser_id?: string | null
          opponent_id?: string | null
          reputation_delta?: number | null
          resolution?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_claimant_id_fkey"
            columns: ["claimant_id"]
            isOneToOne: false
            referencedRelation: "arbitra_members"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "disputes_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "arbitra_members"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      governance_proposals: {
        Row: {
          created_at: string | null
          description: string | null
          ends_at: string
          evidence_cid: string | null
          id: string
          new_value: string | null
          parameter: string | null
          proposer_id: string | null
          proposer_public_key: string
          proposer_signature: string
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          ends_at?: string
          evidence_cid?: string | null
          id?: string
          new_value?: string | null
          parameter?: string | null
          proposer_id?: string | null
          proposer_public_key: string
          proposer_signature: string
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          ends_at?: string
          evidence_cid?: string | null
          id?: string
          new_value?: string | null
          parameter?: string | null
          proposer_id?: string | null
          proposer_public_key?: string
          proposer_signature?: string
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_proposals_proposer_id_fkey"
            columns: ["proposer_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      governance_votes: {
        Row: {
          id: string
          proposal_id: string | null
          tap_weight: number
          vote_type: string
          voted_at: string | null
          voter_id: string | null
          voter_public_key: string
          voter_signature: string
        }
        Insert: {
          id?: string
          proposal_id?: string | null
          tap_weight?: number
          vote_type: string
          voted_at?: string | null
          voter_id?: string | null
          voter_public_key: string
          voter_signature: string
        }
        Update: {
          id?: string
          proposal_id?: string | null
          tap_weight?: number
          vote_type?: string
          voted_at?: string | null
          voter_id?: string | null
          voter_public_key?: string
          voter_signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "governance_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      marketplace_applications: {
        Row: {
          applicant_id: string | null
          applicant_public_key: string
          applicant_signature: string
          created_at: string | null
          estimated_hours: number | null
          id: string
          job_id: string | null
          proposal: string | null
          status: string | null
        }
        Insert: {
          applicant_id?: string | null
          applicant_public_key: string
          applicant_signature: string
          created_at?: string | null
          estimated_hours?: number | null
          id?: string
          job_id?: string | null
          proposal?: string | null
          status?: string | null
        }
        Update: {
          applicant_id?: string | null
          applicant_public_key?: string
          applicant_signature?: string
          created_at?: string | null
          estimated_hours?: number | null
          id?: string
          job_id?: string | null
          proposal?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "marketplace_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "marketplace_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_jobs: {
        Row: {
          budget: number
          category: string | null
          created_at: string | null
          description: string | null
          escrow_intent: string | null
          hired_agent_id: string | null
          hirer_id: string | null
          hirer_public_key: string
          hirer_signature: string
          id: string
          min_tap_score: number
          skills_required: string[] | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          budget: number
          category?: string | null
          created_at?: string | null
          description?: string | null
          escrow_intent?: string | null
          hired_agent_id?: string | null
          hirer_id?: string | null
          hirer_public_key: string
          hirer_signature: string
          id?: string
          min_tap_score?: number
          skills_required?: string[] | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          budget?: number
          category?: string | null
          created_at?: string | null
          description?: string | null
          escrow_intent?: string | null
          hired_agent_id?: string | null
          hirer_id?: string | null
          hirer_public_key?: string
          hirer_signature?: string
          id?: string
          min_tap_score?: number
          skills_required?: string[] | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_jobs_hired_agent_id_fkey"
            columns: ["hired_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["agent_id"]
          },
          {
            foreignKeyName: "marketplace_jobs_hirer_id_fkey"
            columns: ["hirer_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["agent_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          github: string | null
          id: string
          reputation_score: number | null
          role: string | null
          total_agents: number | null
          twitter: string | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          github?: string | null
          id: string
          reputation_score?: number | null
          role?: string | null
          total_agents?: number | null
          twitter?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          github?: string | null
          id?: string
          reputation_score?: number | null
          role?: string | null
          total_agents?: number | null
          twitter?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      swarms: {
        Row: {
          agent_ids: string[] | null
          config: Json | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          region: string | null
          status: string | null
          throughput_per_min: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agent_ids?: string[] | null
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          region?: string | null
          status?: string | null
          throughput_per_min?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agent_ids?: string[] | null
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          region?: string | null
          status?: string | null
          throughput_per_min?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tap_scores: {
        Row: {
          claw_id: string
          created_at: string | null
          id: string
          jobs_completed: number | null
          metadata: Json | null
          name: string | null
          public_key: string | null
          tap_score: number | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          claw_id: string
          created_at?: string | null
          id?: string
          jobs_completed?: number | null
          metadata?: Json | null
          name?: string | null
          public_key?: string | null
          tap_score?: number | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          claw_id?: string
          created_at?: string | null
          id?: string
          jobs_completed?: number | null
          metadata?: Json | null
          name?: string | null
          public_key?: string | null
          tap_score?: number | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_agents: {
        Row: {
          agent_template_id: string | null
          claw_id: string | null
          config: Json | null
          created_at: string | null
          health: string | null
          hired_at: string | null
          id: string
          last_active_at: string | null
          metadata: Json | null
          name: string
          reputation_score: number | null
          started_at: string | null
          status: string | null
          stopped_at: string | null
          tasks_completed: number | null
          total_runtime_hours: number | null
          updated_at: string | null
          user_id: string | null
          vm_instance_id: string | null
        }
        Insert: {
          agent_template_id?: string | null
          claw_id?: string | null
          config?: Json | null
          created_at?: string | null
          health?: string | null
          hired_at?: string | null
          id?: string
          last_active_at?: string | null
          metadata?: Json | null
          name: string
          reputation_score?: number | null
          started_at?: string | null
          status?: string | null
          stopped_at?: string | null
          tasks_completed?: number | null
          total_runtime_hours?: number | null
          updated_at?: string | null
          user_id?: string | null
          vm_instance_id?: string | null
        }
        Update: {
          agent_template_id?: string | null
          claw_id?: string | null
          config?: Json | null
          created_at?: string | null
          health?: string | null
          hired_at?: string | null
          id?: string
          last_active_at?: string | null
          metadata?: Json | null
          name?: string
          reputation_score?: number | null
          started_at?: string | null
          status?: string | null
          stopped_at?: string | null
          tasks_completed?: number | null
          total_runtime_hours?: number | null
          updated_at?: string | null
          user_id?: string | null
          vm_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_agents_agent_template_id_fkey"
            columns: ["agent_template_id"]
            isOneToOne: false
            referencedRelation: "agent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          agent_id: string | null
          attestations: Json | null
          committee_role: string | null
          confirmation_token: string | null
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string | null
          email: string
          id: number
          last_attested: string | null
          mint_tx_hash: string | null
          nft_minted: boolean | null
          public_key: string | null
          referral_count: number | null
          referrer_agent_id: string | null
          reputation: number | null
          status: string | null
        }
        Insert: {
          agent_id?: string | null
          attestations?: Json | null
          committee_role?: string | null
          confirmation_token?: string | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          email: string
          id?: number
          last_attested?: string | null
          mint_tx_hash?: string | null
          nft_minted?: boolean | null
          public_key?: string | null
          referral_count?: number | null
          referrer_agent_id?: string | null
          reputation?: number | null
          status?: string | null
        }
        Update: {
          agent_id?: string | null
          attestations?: Json | null
          committee_role?: string | null
          confirmation_token?: string | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          email?: string
          id?: number
          last_attested?: string | null
          mint_tx_hash?: string | null
          nft_minted?: boolean | null
          public_key?: string | null
          referral_count?: number | null
          referrer_agent_id?: string | null
          reputation?: number | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_claw_active_executions: {
        Row: {
          completed_at: string | null
          context: Json | null
          created_at: string | null
          current_node_id: string | null
          estimated_completion: string | null
          id: string | null
          input: Json | null
          progress_percent: number | null
          started_at: string | null
          state: Database["public"]["Enums"]["claw_execution_state"] | null
          updated_at: string | null
          workflow_id: string | null
          workflow_name: string | null
          workflow_owner_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "claw_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      v_claw_task_details: {
        Row: {
          agent_id: string | null
          assigned_at: string | null
          completed_at: string | null
          cost_usd: number | null
          created_at: string | null
          deadline_at: string | null
          execution_id: string | null
          execution_state:
            | Database["public"]["Enums"]["claw_execution_state"]
            | null
          id: string | null
          input: Json | null
          max_retries: number | null
          node_id: string | null
          output: Json | null
          payment_status:
            | Database["public"]["Enums"]["claw_payment_status"]
            | null
          reasoning_trace: Json | null
          retry_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["claw_task_status"] | null
          token_usage: Json | null
          updated_at: string | null
          workflow_id: string | null
          workflow_name: string | null
          workflow_owner_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claw_agent_tasks_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "claw_workflow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_agent_tasks_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "v_claw_active_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claw_workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "claw_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      claw_get_execution_stats: {
        Args: { p_workflow_id: string }
        Returns: {
          count: number
          state: Database["public"]["Enums"]["claw_execution_state"]
        }[]
      }
      claw_update_circuit_breaker: {
        Args: { p_agent_id: string; p_node_id: string; p_success: boolean }
        Returns: undefined
      }
      eigentrust: {
        Args: never
        Returns: {
          agent_id: string
          global_score: number
          reputation: number
        }[]
      }
      increment_referral_count: {
        Args: { ref_agent_id: string }
        Returns: undefined
      }
    }
    Enums: {
      claw_circuit_state: "open" | "closed" | "half-open"
      claw_event_type:
        | "execution_started"
        | "execution_completed"
        | "execution_failed"
        | "execution_cancelled"
        | "node_started"
        | "node_completed"
        | "node_failed"
        | "task_assigned"
        | "task_completed"
        | "task_failed"
        | "circuit_opened"
        | "circuit_closed"
        | "circuit_half_opened"
        | "custom"
      claw_execution_state:
        | "pending"
        | "running"
        | "paused"
        | "completed"
        | "failed"
        | "cancelled"
      claw_payment_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "refunded"
      claw_task_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "completed"
        | "failed"
        | "cancelled"
        | "timeout"
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
      claw_circuit_state: ["open", "closed", "half-open"],
      claw_event_type: [
        "execution_started",
        "execution_completed",
        "execution_failed",
        "execution_cancelled",
        "node_started",
        "node_completed",
        "node_failed",
        "task_assigned",
        "task_completed",
        "task_failed",
        "circuit_opened",
        "circuit_closed",
        "circuit_half_opened",
        "custom",
      ],
      claw_execution_state: [
        "pending",
        "running",
        "paused",
        "completed",
        "failed",
        "cancelled",
      ],
      claw_payment_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "refunded",
      ],
      claw_task_status: [
        "pending",
        "assigned",
        "in_progress",
        "completed",
        "failed",
        "cancelled",
        "timeout",
      ],
    },
  },
} as const
