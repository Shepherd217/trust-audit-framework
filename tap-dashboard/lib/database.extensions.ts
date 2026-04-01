// AUTO-GENERATED DATABASE TYPE EXTENSIONS
// Generated from Supabase OpenAPI schema - extends database.types.ts
// Do not edit manually - regenerate with: npx supabase gen types typescript

import type { Database as BaseDatabase } from "./database.types"
import type { Json } from "./database.types"
export type { Json } from "./database.types"

// Extended tables not in generated types
export interface ExtendedTables {
  agent_notifications: {
    Row: {
      id: string | null
      agent_id: string | null
      type: string | null
      title: string | null
      message: string | null
      read: boolean | null
      created_at: string | null
      metadata: Json | null
    }
    Insert: {
      id?: string | null
      agent_id?: string | null
      type?: string | null
      title?: string | null
      message?: string | null
      read?: boolean | null
      created_at?: string | null
      metadata?: Json | null
    }
    Update: {
      id?: string | null
      agent_id?: string | null
      type?: string | null
      title?: string | null
      message?: string | null
      read?: boolean | null
      created_at?: string | null
      metadata?: Json | null
    }
    Relationships: []
  }
  analytics_activity_feed: {
    Row: {
      id: string | null
      agent_id: string | null
      event_type: string | null
      created_at: string | null
      metadata: Json | null
    }
    Insert: {
      id?: string | null
      agent_id?: string | null
      event_type?: string | null
      created_at?: string | null
      metadata?: Json | null
    }
    Update: {
      id?: string | null
      agent_id?: string | null
      event_type?: string | null
      created_at?: string | null
      metadata?: Json | null
    }
    Relationships: []
  }
  analytics_agents: {
    Row: {
      id: string | null
      agent_id: string | null
      event_type: string | null
      metric_value: number | null
      reputation_score: number | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      agent_id?: string | null
      event_type?: string | null
      metric_value?: number | null
      reputation_score?: number | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      agent_id?: string | null
      event_type?: string | null
      metric_value?: number | null
      reputation_score?: number | null
      created_at?: string | null
    }
    Relationships: []
  }
  analytics_daily_trends: {
    Row: {
      id: string | null
      date: string | null
      metric: string | null
      value: number | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      date?: string | null
      metric?: string | null
      value?: number | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      date?: string | null
      metric?: string | null
      value?: number | null
      created_at?: string | null
    }
    Relationships: []
  }
  analytics_events: {
    Row: {
      id: string | null
      event_type: string | null
      metric_value: number | null
      agent_id: string | null
      created_at: string | null
      metadata: Json | null
    }
    Insert: {
      id?: string | null
      event_type?: string | null
      metric_value?: number | null
      agent_id?: string | null
      created_at?: string | null
      metadata?: Json | null
    }
    Update: {
      id?: string | null
      event_type?: string | null
      metric_value?: number | null
      agent_id?: string | null
      created_at?: string | null
      metadata?: Json | null
    }
    Relationships: []
  }
  analytics_hourly_patterns: {
    Row: {
      id: string | null
      hour: number | null
      metric: string | null
      value: number | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      hour?: number | null
      metric?: string | null
      value?: number | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      hour?: number | null
      metric?: string | null
      value?: number | null
      created_at?: string | null
    }
    Relationships: []
  }
  analytics_reputation_distribution: {
    Row: {
      id: string | null
      event_type: string | null
      tier: string | null
      count: number | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      event_type?: string | null
      tier?: string | null
      count?: number | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      event_type?: string | null
      tier?: string | null
      count?: number | null
      created_at?: string | null
    }
    Relationships: []
  }
  avatars: {
    Row: {
      id: string | null
      agent_id: string | null
      url: string | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      agent_id?: string | null
      url?: string | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      agent_id?: string | null
      url?: string | null
      created_at?: string | null
    }
    Relationships: []
  }
  claw_bus_messages: {
    Row: {
      id: string | null
      from_agent: string | null
      to_agent: string | null
      channel: string | null
      payload: Json | null
      priority: string | null
      type: string | null
      status: string | null
      created_at: string | null
      delivered_at: string | null
    }
    Insert: {
      id?: string | null
      from_agent?: string | null
      to_agent?: string | null
      channel?: string | null
      payload?: Json | null
      priority?: string | null
      type?: string | null
      status?: string | null
      created_at?: string | null
      delivered_at?: string | null
    }
    Update: {
      id?: string | null
      from_agent?: string | null
      to_agent?: string | null
      channel?: string | null
      payload?: Json | null
      priority?: string | null
      type?: string | null
      status?: string | null
      created_at?: string | null
      delivered_at?: string | null
    }
    Relationships: []
  }
  claw_files: {
    Row: {
      id: string | null
      cid: string | null
      owner: string | null
      tier: string | null
      locations: Json | null
      read_access: Json | null
      created_at: string | null
      expires_at: string | null
    }
    Insert: {
      id?: string | null
      cid?: string | null
      owner?: string | null
      tier?: string | null
      locations?: Json | null
      read_access?: Json | null
      created_at?: string | null
      expires_at?: string | null
    }
    Update: {
      id?: string | null
      cid?: string | null
      owner?: string | null
      tier?: string | null
      locations?: Json | null
      read_access?: Json | null
      created_at?: string | null
      expires_at?: string | null
    }
    Relationships: []
  }
  claw_messages: {
    Row: {
      id: string | null
      from_agent: string | null
      to_agent: string | null
      payload: Json | null
      priority: string | null
      type: string | null
      status: string | null
      created_at: string | null
      delivered_at: string | null
    }
    Insert: {
      id?: string | null
      from_agent?: string | null
      to_agent?: string | null
      payload?: Json | null
      priority?: string | null
      type?: string | null
      status?: string | null
      created_at?: string | null
      delivered_at?: string | null
    }
    Update: {
      id?: string | null
      from_agent?: string | null
      to_agent?: string | null
      payload?: Json | null
      priority?: string | null
      type?: string | null
      status?: string | null
      created_at?: string | null
      delivered_at?: string | null
    }
    Relationships: []
  }
  claw_vm_metrics: {
    Row: {
      id: string | null
      vm_id: string | null
      timestamp: string | null
      cpu_percent: number | null
      memory_mb: number | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      vm_id?: string | null
      timestamp?: string | null
      cpu_percent?: number | null
      memory_mb?: number | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      vm_id?: string | null
      timestamp?: string | null
      cpu_percent?: number | null
      memory_mb?: number | null
      created_at?: string | null
    }
    Relationships: []
  }
  claw_vm_snapshots: {
    Row: {
      id: string | null
      agent_id: string | null
      vm_id: string | null
      snapshot_data: Json | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      agent_id?: string | null
      vm_id?: string | null
      snapshot_data?: Json | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      agent_id?: string | null
      vm_id?: string | null
      snapshot_data?: Json | null
      created_at?: string | null
    }
    Relationships: []
  }
  claw_vms: {
    Row: {
      id: string | null
      agent_id: string | null
      state: string | null
      config: Json | null
      created_at: string | null
      updated_at: string | null
    }
    Insert: {
      id?: string | null
      agent_id?: string | null
      state?: string | null
      config?: Json | null
      created_at?: string | null
      updated_at?: string | null
    }
    Update: {
      id?: string | null
      agent_id?: string | null
      state?: string | null
      config?: Json | null
      created_at?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  clawbus_channels: {
    Row: {
      id: string | null
      name: string | null
      created_by: string | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      name?: string | null
      created_by?: string | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      name?: string | null
      created_by?: string | null
      created_at?: string | null
    }
    Relationships: []
  }
  clawbus_subscriptions: {
    Row: {
      id: string | null
      agent_id: string | null
      pattern: string | null
      channel: string | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      agent_id?: string | null
      pattern?: string | null
      channel?: string | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      agent_id?: string | null
      pattern?: string | null
      channel?: string | null
      created_at?: string | null
    }
    Relationships: []
  }
  escrows: {
    Row: {
      id: string | null
      escrow_id: string | null
      payer_claw_id: string | null
      payee_claw_id: string | null
      amount: number | null
      status: string | null
      created_at: string | null
      updated_at: string | null
    }
    Insert: {
      id?: string | null
      escrow_id?: string | null
      payer_claw_id?: string | null
      payee_claw_id?: string | null
      amount?: number | null
      status?: string | null
      created_at?: string | null
      updated_at?: string | null
    }
    Update: {
      id?: string | null
      escrow_id?: string | null
      payer_claw_id?: string | null
      payee_claw_id?: string | null
      amount?: number | null
      status?: string | null
      created_at?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  file_permissions: {
    Row: {
      id: string | null
      owner_id: string | null
      version: string | null
      file_id: string | null
      grantee_id: string | null
      permissions: Json | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      owner_id?: string | null
      version?: string | null
      file_id?: string | null
      grantee_id?: string | null
      permissions?: Json | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      owner_id?: string | null
      version?: string | null
      file_id?: string | null
      grantee_id?: string | null
      permissions?: Json | null
      created_at?: string | null
    }
    Relationships: []
  }
  files: {
    Row: {
      id: string | null
      file_id: string | null
      owner_id: string | null
      storage_tier: string | null
      version: string | null
      path: string | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      file_id?: string | null
      owner_id?: string | null
      storage_tier?: string | null
      version?: string | null
      path?: string | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      file_id?: string | null
      owner_id?: string | null
      storage_tier?: string | null
      version?: string | null
      path?: string | null
      created_at?: string | null
    }
    Relationships: []
  }
  payments: {
    Row: {
      id: string | null
      escrow_id: string | null
      amount: number | null
      status: string | null
      created_at: string | null
      updated_at: string | null
    }
    Insert: {
      id?: string | null
      escrow_id?: string | null
      amount?: number | null
      status?: string | null
      created_at?: string | null
      updated_at?: string | null
    }
    Update: {
      id?: string | null
      escrow_id?: string | null
      amount?: number | null
      status?: string | null
      created_at?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  subscription_audit_log: {
    Row: {
      id: string | null
      agent_id: string | null
      event: string | null
      old_tier: string | null
      new_tier: string | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      agent_id?: string | null
      event?: string | null
      old_tier?: string | null
      new_tier?: string | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      agent_id?: string | null
      event?: string | null
      old_tier?: string | null
      new_tier?: string | null
      created_at?: string | null
    }
    Relationships: []
  }
  user_subscriptions: {
    Row: {
      id: string | null
      user_id: string | null
      tier: string | null
      status: string | null
      created_at: string | null
      updated_at: string | null
    }
    Insert: {
      id?: string | null
      user_id?: string | null
      tier?: string | null
      status?: string | null
      created_at?: string | null
      updated_at?: string | null
    }
    Update: {
      id?: string | null
      user_id?: string | null
      tier?: string | null
      status?: string | null
      created_at?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  vault_access_logs: {
    Row: {
      id: string | null
      entry_id: string | null
      accessed_by: string | null
      accessed_at: string | null
    }
    Insert: {
      id?: string | null
      entry_id?: string | null
      accessed_by?: string | null
      accessed_at?: string | null
    }
    Update: {
      id?: string | null
      entry_id?: string | null
      accessed_by?: string | null
      accessed_at?: string | null
    }
    Relationships: []
  }
  vault_attention_required: {
    Row: {
      id: string | null
      owner_agent_id: string | null
      reason: string | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      owner_agent_id?: string | null
      reason?: string | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      owner_agent_id?: string | null
      reason?: string | null
      created_at?: string | null
    }
    Relationships: []
  }
  vault_entries: {
    Row: {
      id: string | null
      entry_id: string | null
      entry_key: string | null
      entry_namespace: string | null
      owner_agent_id: string | null
      value: number | null
      accessed_at: string | null
      created_at: string | null
      updated_at: string | null
    }
    Insert: {
      id?: string | null
      entry_id?: string | null
      entry_key?: string | null
      entry_namespace?: string | null
      owner_agent_id?: string | null
      value?: number | null
      accessed_at?: string | null
      created_at?: string | null
      updated_at?: string | null
    }
    Update: {
      id?: string | null
      entry_id?: string | null
      entry_key?: string | null
      entry_namespace?: string | null
      owner_agent_id?: string | null
      value?: number | null
      accessed_at?: string | null
      created_at?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  vault_key_rings: {
    Row: {
      id: string | null
      owner_agent_id: string | null
      is_primary: boolean | null
      is_active: boolean | null
      created_at: string | null
    }
    Insert: {
      id?: string | null
      owner_agent_id?: string | null
      is_primary?: boolean | null
      is_active?: boolean | null
      created_at?: string | null
    }
    Update: {
      id?: string | null
      owner_agent_id?: string | null
      is_primary?: boolean | null
      is_active?: boolean | null
      created_at?: string | null
    }
    Relationships: []
  }
  disputes: {
    Row: {
      id: string
      escrow_id: string | null
      job_id: string | null
      initiator_claw_id: string | null
      respondent_claw_id: string | null
      reason: string | null
      evidence_urls: string[] | null
      evidence_types: string[] | null
      description: string | null
      status: string | null
      resolution: string | null
      committee_size: number | null
      committee_members: string[] | null
      votes_for_payer: number | null
      votes_for_payee: number | null
      slashed_members: string[] | null
      slash_reasons: string[] | null
      evidence_deadline: string | null
      voting_deadline: string | null
      resolved_at: string | null
      created_at: string | null
      updated_at: string | null
    }
    Insert: {
      id?: string | null
      escrow_id?: string | null
      job_id?: string | null
      initiator_claw_id?: string | null
      respondent_claw_id?: string | null
      reason?: string | null
      evidence_urls?: string[] | null
      evidence_types?: string[] | null
      description?: string | null
      status?: string | null
      resolution?: string | null
      committee_size?: number | null
      committee_members?: string[] | null
      votes_for_payer?: number | null
      votes_for_payee?: number | null
      slashed_members?: string[] | null
      slash_reasons?: string[] | null
      evidence_deadline?: string | null
      voting_deadline?: string | null
      resolved_at?: string | null
      created_at?: string | null
      updated_at?: string | null
    }
    Update: {
      id?: string | null
      escrow_id?: string | null
      job_id?: string | null
      initiator_claw_id?: string | null
      respondent_claw_id?: string | null
      reason?: string | null
      evidence_urls?: string[] | null
      evidence_types?: string[] | null
      description?: string | null
      status?: string | null
      resolution?: string | null
      committee_size?: number | null
      committee_members?: string[] | null
      votes_for_payer?: number | null
      votes_for_payee?: number | null
      slashed_members?: string[] | null
      slash_reasons?: string[] | null
      evidence_deadline?: string | null
      voting_deadline?: string | null
      resolved_at?: string | null
      created_at?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  agent_activity: {
    Row: {
      agent_id: string | null
      agreed_budget: number | null
      category: string | null
      completed_at: string | null
      contract_id: string | null
      created_at: string | null
      job_id: string | null
      job_title: string | null
      rating: number | null
      review: string | null
      status: string | null
    }
    Insert: {
      agent_id?: string | null
      agreed_budget?: number | null
      category?: string | null
      completed_at?: string | null
      contract_id?: string | null
      created_at?: string | null
      job_id?: string | null
      job_title?: string | null
      rating?: number | null
      review?: string | null
      status?: string | null
    }
    Update: {
      agent_id?: string | null
      agreed_budget?: number | null
      category?: string | null
      completed_at?: string | null
      contract_id?: string | null
      created_at?: string | null
      job_id?: string | null
      job_title?: string | null
      rating?: number | null
      review?: string | null
      status?: string | null
    }
    Relationships: []
  }
  agent_assets: {
    Row: {
      clawfs_path: string | null
      created_at: string | null
      description: string
      downloads: number | null
      endpoint_url: string | null
      id: string
      min_buyer_tap: number | null
      preview_content: string | null
      price_credits: number
      revenue_total: number | null
      seller_id: string
      status: string | null
      tags: Json | null
      title: string
      type: string
      updated_at: string | null
      version: string | null
    }
    Insert: {
      clawfs_path?: string | null
      created_at?: string | null
      description?: string | null
      downloads?: number | null
      endpoint_url?: string | null
      id?: string | null
      min_buyer_tap?: number | null
      preview_content?: string | null
      price_credits?: number | null
      revenue_total?: number | null
      seller_id?: string | null
      status?: string | null
      tags?: Json | null
      title?: string | null
      type?: string | null
      updated_at?: string | null
      version?: string | null
    }
    Update: {
      clawfs_path?: string | null
      created_at?: string | null
      description?: string | null
      downloads?: number | null
      endpoint_url?: string | null
      id?: string | null
      min_buyer_tap?: number | null
      preview_content?: string | null
      price_credits?: number | null
      revenue_total?: number | null
      seller_id?: string | null
      status?: string | null
      tags?: Json | null
      title?: string | null
      type?: string | null
      updated_at?: string | null
      version?: string | null
    }
    Relationships: []
  }
  agent_contests: {
    Row: {
      completed_at: string | null
      created_at: string | null
      deadline: string
      description: string | null
      entry_fee: number | null
      hirer_id: string
      id: string
      job_id: string | null
      judge_skill_required: string | null
      judging_enabled: boolean | null
      max_participants: number | null
      min_judge_molt: number | null
      min_molt_score: number | null
      participant_count: number | null
      prize_pool: number
      staking_pool: number | null
      status: string
      title: string
      winner_agent_id: string | null
      winner_cid: string | null
    }
    Insert: {
      completed_at?: string | null
      created_at?: string | null
      deadline?: string | null
      description?: string | null
      entry_fee?: number | null
      hirer_id?: string | null
      id?: string | null
      job_id?: string | null
      judge_skill_required?: string | null
      judging_enabled?: boolean | null
      max_participants?: number | null
      min_judge_molt?: number | null
      min_molt_score?: number | null
      participant_count?: number | null
      prize_pool?: number | null
      staking_pool?: number | null
      status?: string | null
      title?: string | null
      winner_agent_id?: string | null
      winner_cid?: string | null
    }
    Update: {
      completed_at?: string | null
      created_at?: string | null
      deadline?: string | null
      description?: string | null
      entry_fee?: number | null
      hirer_id?: string | null
      id?: string | null
      job_id?: string | null
      judge_skill_required?: string | null
      judging_enabled?: boolean | null
      max_participants?: number | null
      min_judge_molt?: number | null
      min_molt_score?: number | null
      participant_count?: number | null
      prize_pool?: number | null
      staking_pool?: number | null
      status?: string | null
      title?: string | null
      winner_agent_id?: string | null
      winner_cid?: string | null
    }
    Relationships: []
  }
  agent_endorsements: {
    Row: {
      created_at: string | null
      endorsed_id: string
      endorser_id: string
      endorser_molt: number
      id: string
      skill: string
      weight: number
    }
    Insert: {
      created_at?: string | null
      endorsed_id?: string | null
      endorser_id?: string | null
      endorser_molt?: number | null
      id?: string | null
      skill?: string | null
      weight?: number | null
    }
    Update: {
      created_at?: string | null
      endorsed_id?: string | null
      endorser_id?: string | null
      endorser_molt?: number | null
      id?: string | null
      skill?: string | null
      weight?: number | null
    }
    Relationships: []
  }
  agent_follows: {
    Row: {
      created_at: string | null
      follower_id: string
      following_id: string
    }
    Insert: {
      created_at?: string | null
      follower_id?: string | null
      following_id?: string | null
    }
    Update: {
      created_at?: string | null
      follower_id?: string | null
      following_id?: string | null
    }
    Relationships: []
  }
  agent_guardians: {
    Row: {
      agent_id: string
      created_at: string | null
      encrypted_share: string
      guardian_id: string
      guardian_type: string
      id: string
      status: string
      threshold: number
      total_guardians: number
      updated_at: string | null
    }
    Insert: {
      agent_id?: string | null
      created_at?: string | null
      encrypted_share?: string | null
      guardian_id?: string | null
      guardian_type?: string | null
      id?: string | null
      status?: string | null
      threshold?: number | null
      total_guardians?: number | null
      updated_at?: string | null
    }
    Update: {
      agent_id?: string | null
      created_at?: string | null
      encrypted_share?: string | null
      guardian_id?: string | null
      guardian_type?: string | null
      id?: string | null
      status?: string | null
      threshold?: number | null
      total_guardians?: number | null
      updated_at?: string | null
    }
    Relationships: []
  }
  agent_health_snapshots: {
    Row: {
      agent_id: string
      avg_response_ms: number | null
      created_at: string | null
      id: string
      jobs_completed: number | null
      jobs_failed: number | null
      last_seen_at: string | null
      reliability_score: number | null
      status: string | null
      updated_at: string | null
      uptime_pct_7d: number | null
    }
    Insert: {
      agent_id?: string | null
      avg_response_ms?: number | null
      created_at?: string | null
      id?: string | null
      jobs_completed?: number | null
      jobs_failed?: number | null
      last_seen_at?: string | null
      reliability_score?: number | null
      status?: string | null
      updated_at?: string | null
      uptime_pct_7d?: number | null
    }
    Update: {
      agent_id?: string | null
      avg_response_ms?: number | null
      created_at?: string | null
      id?: string | null
      jobs_completed?: number | null
      jobs_failed?: number | null
      last_seen_at?: string | null
      reliability_score?: number | null
      status?: string | null
      updated_at?: string | null
      uptime_pct_7d?: number | null
    }
    Relationships: []
  }
  agent_memory: {
    Row: {
      agent_id: string
      counterparty_id: string
      created_at: string | null
      expires_at: string | null
      id: string
      key: string
      scope: string
      updated_at: string | null
      value: string | null
    }
    Insert: {
      agent_id?: string | null
      counterparty_id?: string | null
      created_at?: string | null
      expires_at?: string | null
      id?: string | null
      key?: string | null
      scope?: string | null
      updated_at?: string | null
      value?: string | null
    }
    Update: {
      agent_id?: string | null
      counterparty_id?: string | null
      created_at?: string | null
      expires_at?: string | null
      id?: string | null
      key?: string | null
      scope?: string | null
      updated_at?: string | null
      value?: string | null
    }
    Relationships: []
  }
  agent_provenance: {
    Row: {
      agent_id: string
      created_at: string | null
      event_type: string
      id: string
      metadata: string | null
      reference_cid: string | null
      reference_id: string | null
      related_agent_id: string | null
      skill: string | null
    }
    Insert: {
      agent_id?: string | null
      created_at?: string | null
      event_type?: string | null
      id?: string | null
      metadata?: string | null
      reference_cid?: string | null
      reference_id?: string | null
      related_agent_id?: string | null
      skill?: string | null
    }
    Update: {
      agent_id?: string | null
      created_at?: string | null
      event_type?: string | null
      id?: string | null
      metadata?: string | null
      reference_cid?: string | null
      reference_id?: string | null
      related_agent_id?: string | null
      skill?: string | null
    }
    Relationships: []
  }
  agent_recovery_requests: {
    Row: {
      agent_id: string
      completed_at: string | null
      expires_at: string
      id: string
      initiated_at: string | null
      new_public_key: string
      reason: string | null
      recovery_id: string
      shares_collected: number
      status: string
      threshold: number
      total_shares: number
    }
    Insert: {
      agent_id?: string | null
      completed_at?: string | null
      expires_at?: string | null
      id?: string | null
      initiated_at?: string | null
      new_public_key?: string | null
      reason?: string | null
      recovery_id?: string | null
      shares_collected?: number | null
      status?: string | null
      threshold?: number | null
      total_shares?: number | null
    }
    Update: {
      agent_id?: string | null
      completed_at?: string | null
      expires_at?: string | null
      id?: string | null
      initiated_at?: string | null
      new_public_key?: string | null
      reason?: string | null
      recovery_id?: string | null
      shares_collected?: number | null
      status?: string | null
      threshold?: number | null
      total_shares?: number | null
    }
    Relationships: []
  }
  agent_skill_attestations: {
    Row: {
      agent_id: string
      budget: number | null
      domain_molt: number | null
      first_attested_at: string | null
      id: string
      last_attested_at: string | null
      last_job_id: string | null
      last_proof_cid: string | null
      molt_at_time: number | null
      proof_cid: string | null
      proof_count: number | null
      proof_job_id: string | null
      skill: string
    }
    Insert: {
      agent_id?: string | null
      budget?: number | null
      domain_molt?: number | null
      first_attested_at?: string | null
      id?: string | null
      last_attested_at?: string | null
      last_job_id?: string | null
      last_proof_cid?: string | null
      molt_at_time?: number | null
      proof_cid?: string | null
      proof_count?: number | null
      proof_job_id?: string | null
      skill?: string | null
    }
    Update: {
      agent_id?: string | null
      budget?: number | null
      domain_molt?: number | null
      first_attested_at?: string | null
      id?: string | null
      last_attested_at?: string | null
      last_job_id?: string | null
      last_proof_cid?: string | null
      molt_at_time?: number | null
      proof_cid?: string | null
      proof_count?: number | null
      proof_job_id?: string | null
      skill?: string | null
    }
    Relationships: []
  }
  agent_telemetry: {
    Row: {
      agent_id: string
      avg_task_duration_ms: number | null
      cpu_percent: number | null
      custom_metrics: string | null
      id: string
      memory_mb: number | null
      network_errors: number | null
      network_requests: number | null
      reported_at: string | null
      source: string | null
      tasks_attempted: number | null
      tasks_completed: number | null
      tasks_failed: number | null
      window_duration_seconds: number
      window_end: string
      window_start: string
    }
    Insert: {
      agent_id?: string | null
      avg_task_duration_ms?: number | null
      cpu_percent?: number | null
      custom_metrics?: string | null
      id?: string | null
      memory_mb?: number | null
      network_errors?: number | null
      network_requests?: number | null
      reported_at?: string | null
      source?: string | null
      tasks_attempted?: number | null
      tasks_completed?: number | null
      tasks_failed?: number | null
      window_duration_seconds?: number | null
      window_end?: string | null
      window_start?: string | null
    }
    Update: {
      agent_id?: string | null
      avg_task_duration_ms?: number | null
      cpu_percent?: number | null
      custom_metrics?: string | null
      id?: string | null
      memory_mb?: number | null
      network_errors?: number | null
      network_requests?: number | null
      reported_at?: string | null
      source?: string | null
      tasks_attempted?: number | null
      tasks_completed?: number | null
      tasks_failed?: number | null
      window_duration_seconds?: number | null
      window_end?: string | null
      window_start?: string | null
    }
    Relationships: []
  }
  agent_telemetry_daily: {
    Row: {
      agent_id: string
      avg_cpu_percent: number | null
      avg_task_duration_ms: number | null
      calculated_at: string | null
      date: string
      id: string
      net_attestation_score: number | null
      network_error_rate: number | null
      peak_memory_mb: number | null
      reliability_score: number | null
      success_rate: number | null
      total_network_requests: number | null
      total_tasks_attempted: number | null
      total_tasks_completed: number | null
    }
    Insert: {
      agent_id?: string | null
      avg_cpu_percent?: number | null
      avg_task_duration_ms?: number | null
      calculated_at?: string | null
      date?: string | null
      id?: string | null
      net_attestation_score?: number | null
      network_error_rate?: number | null
      peak_memory_mb?: number | null
      reliability_score?: number | null
      success_rate?: number | null
      total_network_requests?: number | null
      total_tasks_attempted?: number | null
      total_tasks_completed?: number | null
    }
    Update: {
      agent_id?: string | null
      avg_cpu_percent?: number | null
      avg_task_duration_ms?: number | null
      calculated_at?: string | null
      date?: string | null
      id?: string | null
      net_attestation_score?: number | null
      network_error_rate?: number | null
      peak_memory_mb?: number | null
      reliability_score?: number | null
      success_rate?: number | null
      total_network_requests?: number | null
      total_tasks_attempted?: number | null
      total_tasks_completed?: number | null
    }
    Relationships: []
  }
  agent_vouches: {
    Row: {
      attestation_id: string | null
      claim: string | null
      created_at: string | null
      id: string
      revoke_reason: string | null
      revoked_at: string | null
      slash_reason: string | null
      slashed_at: string | null
      slashed_by: string | null
      stake_amount: number
      status: string | null
      updated_at: string | null
      vouchee_id: string
      vouchee_public_key: string
      voucher_id: string
      voucher_public_key: string
      voucher_signature: string
    }
    Insert: {
      attestation_id?: string | null
      claim?: string | null
      created_at?: string | null
      id?: string | null
      revoke_reason?: string | null
      revoked_at?: string | null
      slash_reason?: string | null
      slashed_at?: string | null
      slashed_by?: string | null
      stake_amount?: number | null
      status?: string | null
      updated_at?: string | null
      vouchee_id?: string | null
      vouchee_public_key?: string | null
      voucher_id?: string | null
      voucher_public_key?: string | null
      voucher_signature?: string | null
    }
    Update: {
      attestation_id?: string | null
      claim?: string | null
      created_at?: string | null
      id?: string | null
      revoke_reason?: string | null
      revoked_at?: string | null
      slash_reason?: string | null
      slashed_at?: string | null
      slashed_by?: string | null
      stake_amount?: number | null
      status?: string | null
      updated_at?: string | null
      vouchee_id?: string | null
      vouchee_public_key?: string | null
      voucher_id?: string | null
      voucher_public_key?: string | null
      voucher_signature?: string | null
    }
    Relationships: []
  }
  agent_wallets: {
    Row: {
      agent_id: string
      balance: number
      created_at: string | null
      crypto_wallet_address: string | null
      currency: string
      held_credits: number | null
      id: string
      last_suspicious_at: string | null
      pending_balance: number
      stripe_connected_account_id: string | null
      total_earned: number
      updated_at: string | null
    }
    Insert: {
      agent_id?: string | null
      balance?: number | null
      created_at?: string | null
      crypto_wallet_address?: string | null
      currency?: string | null
      held_credits?: number | null
      id?: string | null
      last_suspicious_at?: string | null
      pending_balance?: number | null
      stripe_connected_account_id?: string | null
      total_earned?: number | null
      updated_at?: string | null
    }
    Update: {
      agent_id?: string | null
      balance?: number | null
      created_at?: string | null
      crypto_wallet_address?: string | null
      currency?: string | null
      held_credits?: number | null
      id?: string | null
      last_suspicious_at?: string | null
      pending_balance?: number | null
      stripe_connected_account_id?: string | null
      total_earned?: number | null
      updated_at?: string | null
    }
    Relationships: []
  }
  aggregated_attestations: {
    Row: {
      aggregate_signature: string
      anchor_tx_hash: string | null
      attestation_count: number
      attestation_ids: Json | null
      block_height: number | null
      created_at: string | null
      id: string
      public_key_indices: Json | null
      valid: boolean | null
      verified_at: string | null
      verified_by: string | null
    }
    Insert: {
      aggregate_signature?: string | null
      anchor_tx_hash?: string | null
      attestation_count?: number | null
      attestation_ids?: Json | null
      block_height?: number | null
      created_at?: string | null
      id?: string | null
      public_key_indices?: Json | null
      valid?: boolean | null
      verified_at?: string | null
      verified_by?: string | null
    }
    Update: {
      aggregate_signature?: string | null
      anchor_tx_hash?: string | null
      attestation_count?: number | null
      attestation_ids?: Json | null
      block_height?: number | null
      created_at?: string | null
      id?: string | null
      public_key_indices?: Json | null
      valid?: boolean | null
      verified_at?: string | null
      verified_by?: string | null
    }
    Relationships: []
  }
  alert_history: {
    Row: {
      component: string
      created_at: string | null
      details: string | null
      discord_sent: boolean | null
      email_sent: boolean | null
      id: string
      message: string
      pagerduty_sent: boolean | null
      resolution_notes: string | null
      resolved_at: string | null
      resolved_by: string | null
      severity: string
      title: string
    }
    Insert: {
      component?: string | null
      created_at?: string | null
      details?: string | null
      discord_sent?: boolean | null
      email_sent?: boolean | null
      id?: string | null
      message?: string | null
      pagerduty_sent?: boolean | null
      resolution_notes?: string | null
      resolved_at?: string | null
      resolved_by?: string | null
      severity?: string | null
      title?: string | null
    }
    Update: {
      component?: string | null
      created_at?: string | null
      details?: string | null
      discord_sent?: boolean | null
      email_sent?: boolean | null
      id?: string | null
      message?: string | null
      pagerduty_sent?: boolean | null
      resolution_notes?: string | null
      resolved_at?: string | null
      resolved_by?: string | null
      severity?: string | null
      title?: string | null
    }
    Relationships: []
  }
  anomaly_events: {
    Row: {
      agent_id: string | null
      anomaly_type: string
      assigned_to: string | null
      created_at: string | null
      detection_data: string
      id: string
      investigation_notes: string | null
      related_attestations: Json | null
      related_honeypot_id: string | null
      related_vouches: Json | null
      resolution_type: string | null
      resolved_at: string | null
      resolved_by: string | null
      severity: string
      status: string | null
      updated_at: string | null
    }
    Insert: {
      agent_id?: string | null
      anomaly_type?: string | null
      assigned_to?: string | null
      created_at?: string | null
      detection_data?: string | null
      id?: string | null
      investigation_notes?: string | null
      related_attestations?: Json | null
      related_honeypot_id?: string | null
      related_vouches?: Json | null
      resolution_type?: string | null
      resolved_at?: string | null
      resolved_by?: string | null
      severity?: string | null
      status?: string | null
      updated_at?: string | null
    }
    Update: {
      agent_id?: string | null
      anomaly_type?: string | null
      assigned_to?: string | null
      created_at?: string | null
      detection_data?: string | null
      id?: string | null
      investigation_notes?: string | null
      related_attestations?: Json | null
      related_honeypot_id?: string | null
      related_vouches?: Json | null
      resolution_type?: string | null
      resolved_at?: string | null
      resolved_by?: string | null
      severity?: string | null
      status?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  appeal_votes: {
    Row: {
      appeal_id: string
      id: string
      vote_type: string
      vote_weight: number
      voter_id: string
    }
    Insert: {
      appeal_id?: string | null
      id?: string | null
      vote_type?: string | null
      vote_weight?: number | null
      voter_id?: string | null
    }
    Update: {
      appeal_id?: string | null
      id?: string | null
      vote_type?: string | null
      vote_weight?: number | null
      voter_id?: string | null
    }
    Relationships: []
  }
  appeals: {
    Row: {
      appeal_bond: number
      appeal_window_closes: string
      appellant_id: string
      created_at: string | null
      dispute_id: string | null
      filed_at: string | null
      grounds: string
      id: string
      new_evidence: string | null
      no_votes: number | null
      resolution_reason: string | null
      resolved_at: string | null
      resolved_by: string | null
      slash_event_id: string | null
      status: string | null
      updated_at: string | null
      voting_ends_at: string | null
      yes_votes: number | null
    }
    Insert: {
      appeal_bond?: number | null
      appeal_window_closes?: string | null
      appellant_id?: string | null
      created_at?: string | null
      dispute_id?: string | null
      filed_at?: string | null
      grounds?: string | null
      id?: string | null
      new_evidence?: string | null
      no_votes?: number | null
      resolution_reason?: string | null
      resolved_at?: string | null
      resolved_by?: string | null
      slash_event_id?: string | null
      status?: string | null
      updated_at?: string | null
      voting_ends_at?: string | null
      yes_votes?: number | null
    }
    Update: {
      appeal_bond?: number | null
      appeal_window_closes?: string | null
      appellant_id?: string | null
      created_at?: string | null
      dispute_id?: string | null
      filed_at?: string | null
      grounds?: string | null
      id?: string | null
      new_evidence?: string | null
      no_votes?: number | null
      resolution_reason?: string | null
      resolved_at?: string | null
      resolved_by?: string | null
      slash_event_id?: string | null
      status?: string | null
      updated_at?: string | null
      voting_ends_at?: string | null
      yes_votes?: number | null
    }
    Relationships: []
  }
  arbitra_contest_verdicts: {
    Row: {
      contest_id: string
      created_at: string | null
      id: string
      judge_agreement_pct: number | null
      resolution_note: string | null
      scores: string
      winner_agent_id: string | null
    }
    Insert: {
      contest_id?: string | null
      created_at?: string | null
      id?: string | null
      judge_agreement_pct?: number | null
      resolution_note?: string | null
      scores?: string | null
      winner_agent_id?: string | null
    }
    Update: {
      contest_id?: string | null
      created_at?: string | null
      id?: string | null
      judge_agreement_pct?: number | null
      resolution_note?: string | null
      scores?: string | null
      winner_agent_id?: string | null
    }
    Relationships: []
  }
  arbitra_external_verdicts: {
    Row: {
      arbiter_version: string
      committee_votes: string | null
      confidence: number | null
      created_at: string | null
      decision: string | null
      dispute_id: string
      evidence_reviewed: string | null
      id: number
      received_at: string | null
      resolution: string
      status: string | null
      verdict_id: string
    }
    Insert: {
      arbiter_version?: string | null
      committee_votes?: string | null
      confidence?: number | null
      created_at?: string | null
      decision?: string | null
      dispute_id?: string | null
      evidence_reviewed?: string | null
      id?: number | null
      received_at?: string | null
      resolution?: string | null
      status?: string | null
      verdict_id?: string | null
    }
    Update: {
      arbiter_version?: string | null
      committee_votes?: string | null
      confidence?: number | null
      created_at?: string | null
      decision?: string | null
      dispute_id?: string | null
      evidence_reviewed?: string | null
      id?: number | null
      received_at?: string | null
      resolution?: string | null
      status?: string | null
      verdict_id?: string | null
    }
    Relationships: []
  }
  arbitra_orphaned_verdicts: {
    Row: {
      arbiter_version: string
      committee_votes: string | null
      confidence: number | null
      created_at: string | null
      decision: string | null
      dispute_id: string
      evidence_reviewed: string | null
      id: number
      orphan_reason: string
      received_at: string | null
      resolution: string
      resolved: boolean | null
      resolved_at: string | null
      resolved_by: string | null
      verdict_id: string
    }
    Insert: {
      arbiter_version?: string | null
      committee_votes?: string | null
      confidence?: number | null
      created_at?: string | null
      decision?: string | null
      dispute_id?: string | null
      evidence_reviewed?: string | null
      id?: number | null
      orphan_reason?: string | null
      received_at?: string | null
      resolution?: string | null
      resolved?: boolean | null
      resolved_at?: string | null
      resolved_by?: string | null
      verdict_id?: string | null
    }
    Update: {
      arbiter_version?: string | null
      committee_votes?: string | null
      confidence?: number | null
      created_at?: string | null
      decision?: string | null
      dispute_id?: string | null
      evidence_reviewed?: string | null
      id?: number | null
      orphan_reason?: string | null
      received_at?: string | null
      resolution?: string | null
      resolved?: boolean | null
      resolved_at?: string | null
      resolved_by?: string | null
      verdict_id?: string | null
    }
    Relationships: []
  }
  asset_purchases: {
    Row: {
      access_key: string | null
      amount_paid: number
      asset_id: string
      buyer_id: string
      clawfs_copy_path: string | null
      created_at: string | null
      id: string
      purchased_version: string | null
    }
    Insert: {
      access_key?: string | null
      amount_paid?: number | null
      asset_id?: string | null
      buyer_id?: string | null
      clawfs_copy_path?: string | null
      created_at?: string | null
      id?: string | null
      purchased_version?: string | null
    }
    Update: {
      access_key?: string | null
      amount_paid?: number | null
      asset_id?: string | null
      buyer_id?: string | null
      clawfs_copy_path?: string | null
      created_at?: string | null
      id?: string | null
      purchased_version?: string | null
    }
    Relationships: []
  }
  asset_reviews: {
    Row: {
      asset_id: string
      created_at: string | null
      flag_count: number | null
      id: string
      moderation_reason: string | null
      moderation_status: string | null
      purchase_id: string | null
      rating: number
      review_text: string | null
      reviewer_id: string
    }
    Insert: {
      asset_id?: string | null
      created_at?: string | null
      flag_count?: number | null
      id?: string | null
      moderation_reason?: string | null
      moderation_status?: string | null
      purchase_id?: string | null
      rating?: number | null
      review_text?: string | null
      reviewer_id?: string | null
    }
    Update: {
      asset_id?: string | null
      created_at?: string | null
      flag_count?: number | null
      id?: string | null
      moderation_reason?: string | null
      moderation_status?: string | null
      purchase_id?: string | null
      rating?: number | null
      review_text?: string | null
      reviewer_id?: string | null
    }
    Relationships: []
  }
  automated_enforcement: {
    Row: {
      action_taken: string
      anomaly_id: string | null
      auto_executed: boolean | null
      confidence_score: number
      created_at: string | null
      dispute_id: string | null
      id: string
      overridden: boolean | null
      review_notes: string | null
      reviewed_at: string | null
      reviewed_by: string | null
      trigger_source: string
      trigger_type: string
    }
    Insert: {
      action_taken?: string | null
      anomaly_id?: string | null
      auto_executed?: boolean | null
      confidence_score?: number | null
      created_at?: string | null
      dispute_id?: string | null
      id?: string | null
      overridden?: boolean | null
      review_notes?: string | null
      reviewed_at?: string | null
      reviewed_by?: string | null
      trigger_source?: string | null
      trigger_type?: string | null
    }
    Update: {
      action_taken?: string | null
      anomaly_id?: string | null
      auto_executed?: boolean | null
      confidence_score?: number | null
      created_at?: string | null
      dispute_id?: string | null
      id?: string | null
      overridden?: boolean | null
      review_notes?: string | null
      reviewed_at?: string | null
      reviewed_by?: string | null
      trigger_source?: string | null
      trigger_type?: string | null
    }
    Relationships: []
  }
  behavior_metrics: {
    Row: {
      agent_id: string
      anomaly_score: number | null
      attestations_given: number | null
      attestations_received: number | null
      clustering_coefficient: number | null
      created_at: string | null
      disputes_against: number | null
      disputes_filed: number | null
      id: string
      reciprocity_score: number | null
      reputation_delta: number | null
      stake_delta: number | null
      unique_interactions: number | null
      vouches_given: number | null
      vouches_received: number | null
      window_end: string
      window_start: string
      window_type: string
    }
    Insert: {
      agent_id?: string | null
      anomaly_score?: number | null
      attestations_given?: number | null
      attestations_received?: number | null
      clustering_coefficient?: number | null
      created_at?: string | null
      disputes_against?: number | null
      disputes_filed?: number | null
      id?: string | null
      reciprocity_score?: number | null
      reputation_delta?: number | null
      stake_delta?: number | null
      unique_interactions?: number | null
      vouches_given?: number | null
      vouches_received?: number | null
      window_end?: string | null
      window_start?: string | null
      window_type?: string | null
    }
    Update: {
      agent_id?: string | null
      anomaly_score?: number | null
      attestations_given?: number | null
      attestations_received?: number | null
      clustering_coefficient?: number | null
      created_at?: string | null
      disputes_against?: number | null
      disputes_filed?: number | null
      id?: string | null
      reciprocity_score?: number | null
      reputation_delta?: number | null
      stake_delta?: number | null
      unique_interactions?: number | null
      vouches_given?: number | null
      vouches_received?: number | null
      window_end?: string | null
      window_start?: string | null
      window_type?: string | null
    }
    Relationships: []
  }
  bls_keypairs: {
    Row: {
      agent_id: string
      created_at: string | null
      id: string
      key_type: string
      public_key: string
      revoked_at: string | null
      rotated_at: string | null
    }
    Insert: {
      agent_id?: string | null
      created_at?: string | null
      id?: string | null
      key_type?: string | null
      public_key?: string | null
      revoked_at?: string | null
      rotated_at?: string | null
    }
    Update: {
      agent_id?: string | null
      created_at?: string | null
      id?: string | null
      key_type?: string | null
      public_key?: string | null
      revoked_at?: string | null
      rotated_at?: string | null
    }
    Relationships: []
  }
  bootstrap_tasks: {
    Row: {
      agent_id: string
      completed_at: string | null
      created_at: string | null
      description: string
      expires_at: string | null
      id: string
      reward_credits: number | null
      reward_tap: number | null
      status: string | null
      task_type: string
      title: string
    }
    Insert: {
      agent_id?: string | null
      completed_at?: string | null
      created_at?: string | null
      description?: string | null
      expires_at?: string | null
      id?: string | null
      reward_credits?: number | null
      reward_tap?: number | null
      status?: string | null
      task_type?: string | null
      title?: string | null
    }
    Update: {
      agent_id?: string | null
      completed_at?: string | null
      created_at?: string | null
      description?: string | null
      expires_at?: string | null
      id?: string | null
      reward_credits?: number | null
      reward_tap?: number | null
      status?: string | null
      task_type?: string | null
      title?: string | null
    }
    Relationships: []
  }
  claw_agent_sessions: {
    Row: {
      agent_id: string
      bus_connected: boolean | null
      bus_connected_at: string | null
      context: string | null
      current_execution_id: string | null
      current_vm_id: string | null
      ended_at: string | null
      id: string
      ip_address: string | null
      last_activity_at: string | null
      session_id: string
      started_at: string | null
      user_agent: string | null
    }
    Insert: {
      agent_id?: string | null
      bus_connected?: boolean | null
      bus_connected_at?: string | null
      context?: string | null
      current_execution_id?: string | null
      current_vm_id?: string | null
      ended_at?: string | null
      id?: string | null
      ip_address?: string | null
      last_activity_at?: string | null
      session_id?: string | null
      started_at?: string | null
      user_agent?: string | null
    }
    Update: {
      agent_id?: string | null
      bus_connected?: boolean | null
      bus_connected_at?: string | null
      context?: string | null
      current_execution_id?: string | null
      current_vm_id?: string | null
      ended_at?: string | null
      id?: string | null
      ip_address?: string | null
      last_activity_at?: string | null
      session_id?: string | null
      started_at?: string | null
      user_agent?: string | null
    }
    Relationships: []
  }
  claw_component_health: {
    Row: {
      alert_sent: boolean | null
      alert_sent_at: string | null
      check_output: string | null
      component_name: string
      component_type: string
      created_at: string | null
      error_message: string | null
      error_rate: number | null
      id: string
      last_check_at: string | null
      response_time_ms: number | null
      status: string
      updated_at: string | null
    }
    Insert: {
      alert_sent?: boolean | null
      alert_sent_at?: string | null
      check_output?: string | null
      component_name?: string | null
      component_type?: string | null
      created_at?: string | null
      error_message?: string | null
      error_rate?: number | null
      id?: string | null
      last_check_at?: string | null
      response_time_ms?: number | null
      status?: string | null
      updated_at?: string | null
    }
    Update: {
      alert_sent?: boolean | null
      alert_sent_at?: string | null
      check_output?: string | null
      component_name?: string | null
      component_type?: string | null
      created_at?: string | null
      error_message?: string | null
      error_rate?: number | null
      id?: string | null
      last_check_at?: string | null
      response_time_ms?: number | null
      status?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  claw_daos: {
    Row: {
      created_at: string | null
      description: string | null
      domain_skill: string | null
      founding_agents: string | null
      id: string
      name: string
      treasury_balance: number | null
    }
    Insert: {
      created_at?: string | null
      description?: string | null
      domain_skill?: string | null
      founding_agents?: string | null
      id?: string | null
      name?: string | null
      treasury_balance?: number | null
    }
    Update: {
      created_at?: string | null
      description?: string | null
      domain_skill?: string | null
      founding_agents?: string | null
      id?: string | null
      name?: string | null
      treasury_balance?: number | null
    }
    Relationships: []
  }
  claw_node_executions: {
    Row: {
      assigned_agent_id: string | null
      assigned_at: string | null
      checkpoint_data: string | null
      completed_at: string | null
      created_at: string | null
      error_message: string | null
      execution_id: string
      id: string
      input_data: string | null
      node_id: string
      output_data: string | null
      processing_duration_ms: number | null
      retry_count: number | null
      started_at: string | null
      status: string
      updated_at: string | null
    }
    Insert: {
      assigned_agent_id?: string | null
      assigned_at?: string | null
      checkpoint_data?: string | null
      completed_at?: string | null
      created_at?: string | null
      error_message?: string | null
      execution_id?: string | null
      id?: string | null
      input_data?: string | null
      node_id?: string | null
      output_data?: string | null
      processing_duration_ms?: number | null
      retry_count?: number | null
      started_at?: string | null
      status?: string | null
      updated_at?: string | null
    }
    Update: {
      assigned_agent_id?: string | null
      assigned_at?: string | null
      checkpoint_data?: string | null
      completed_at?: string | null
      created_at?: string | null
      error_message?: string | null
      execution_id?: string | null
      id?: string | null
      input_data?: string | null
      node_id?: string | null
      output_data?: string | null
      processing_duration_ms?: number | null
      retry_count?: number | null
      started_at?: string | null
      status?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  claw_system_events: {
    Row: {
      agent_id: string | null
      created_at: string | null
      dispute_id: string | null
      escrow_id: string | null
      event_type: string
      execution_id: string | null
      handoff_id: string | null
      id: string
      payload: string | null
      severity: string | null
      vm_id: string | null
    }
    Insert: {
      agent_id?: string | null
      created_at?: string | null
      dispute_id?: string | null
      escrow_id?: string | null
      event_type?: string | null
      execution_id?: string | null
      handoff_id?: string | null
      id?: string | null
      payload?: string | null
      severity?: string | null
      vm_id?: string | null
    }
    Update: {
      agent_id?: string | null
      created_at?: string | null
      dispute_id?: string | null
      escrow_id?: string | null
      event_type?: string | null
      execution_id?: string | null
      handoff_id?: string | null
      id?: string | null
      payload?: string | null
      severity?: string | null
      vm_id?: string | null
    }
    Relationships: []
  }
  claw_workflow_edges: {
    Row: {
      condition: string | null
      created_at: string | null
      edge_id: string
      edge_type: string | null
      from_node_id: string
      id: string
      to_node_id: string
      workflow_id: string
    }
    Insert: {
      condition?: string | null
      created_at?: string | null
      edge_id?: string | null
      edge_type?: string | null
      from_node_id?: string | null
      id?: string | null
      to_node_id?: string | null
      workflow_id?: string | null
    }
    Update: {
      condition?: string | null
      created_at?: string | null
      edge_id?: string | null
      edge_type?: string | null
      from_node_id?: string | null
      id?: string | null
      to_node_id?: string | null
      workflow_id?: string | null
    }
    Relationships: []
  }
  claw_workflow_nodes: {
    Row: {
      config: string
      created_at: string | null
      id: string
      max_retries: number | null
      name: string
      node_id: string
      node_type: string
      timeout_seconds: number | null
      workflow_id: string
    }
    Insert: {
      config?: string | null
      created_at?: string | null
      id?: string | null
      max_retries?: number | null
      name?: string | null
      node_id?: string | null
      node_type?: string | null
      timeout_seconds?: number | null
      workflow_id?: string | null
    }
    Update: {
      config?: string | null
      created_at?: string | null
      id?: string | null
      max_retries?: number | null
      name?: string | null
      node_id?: string | null
      node_type?: string | null
      timeout_seconds?: number | null
      workflow_id?: string | null
    }
    Relationships: []
  }
  clawbus_agents: {
    Row: {
      agent_id: string
      capabilities: Json | null
      created_at: string | null
      id: string
      last_heartbeat: string | null
      last_seen: string | null
      metadata: string | null
      name: string
      status: string
      updated_at: string | null
    }
    Insert: {
      agent_id?: string | null
      capabilities?: Json | null
      created_at?: string | null
      id?: string | null
      last_heartbeat?: string | null
      last_seen?: string | null
      metadata?: string | null
      name?: string | null
      status?: string | null
      updated_at?: string | null
    }
    Update: {
      agent_id?: string | null
      capabilities?: Json | null
      created_at?: string | null
      id?: string | null
      last_heartbeat?: string | null
      last_seen?: string | null
      metadata?: string | null
      name?: string | null
      status?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  clawbus_execution_links: {
    Row: {
      created_at: string | null
      execution_id: string | null
      handoff_id: string | null
      id: string
      link_type: string
      message_id: string | null
      node_execution_id: string | null
      processed: boolean | null
      processed_at: string | null
    }
    Insert: {
      created_at?: string | null
      execution_id?: string | null
      handoff_id?: string | null
      id?: string | null
      link_type?: string | null
      message_id?: string | null
      node_execution_id?: string | null
      processed?: boolean | null
      processed_at?: string | null
    }
    Update: {
      created_at?: string | null
      execution_id?: string | null
      handoff_id?: string | null
      id?: string | null
      link_type?: string | null
      message_id?: string | null
      node_execution_id?: string | null
      processed?: boolean | null
      processed_at?: string | null
    }
    Relationships: []
  }
  clawbus_handoffs: {
    Row: {
      context: string
      created_at: string | null
      from_agent: string
      handoff_id: string
      id: string
      stage: string
      to_agent: string
      updated_at: string | null
    }
    Insert: {
      context?: string | null
      created_at?: string | null
      from_agent?: string | null
      handoff_id?: string | null
      id?: string | null
      stage?: string | null
      to_agent?: string | null
      updated_at?: string | null
    }
    Update: {
      context?: string | null
      created_at?: string | null
      from_agent?: string | null
      handoff_id?: string | null
      id?: string | null
      stage?: string | null
      to_agent?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  clawbus_message_types: {
    Row: {
      created_at: string | null
      created_by: string | null
      description: string | null
      id: string
      schema: string
      type_name: string
      version: string | null
    }
    Insert: {
      created_at?: string | null
      created_by?: string | null
      description?: string | null
      id?: string | null
      schema?: string | null
      type_name?: string | null
      version?: string | null
    }
    Update: {
      created_at?: string | null
      created_by?: string | null
      description?: string | null
      id?: string | null
      schema?: string | null
      type_name?: string | null
      version?: string | null
    }
    Relationships: []
  }
  clawbus_messages: {
    Row: {
      created_at: string | null
      delivered_at: string | null
      expires_at: string | null
      from_agent: string
      id: string
      message_id: string
      message_type: string
      payload: string
      priority: string
      read_at: string | null
      status: string
      to_agent: string
      version: string
    }
    Insert: {
      created_at?: string | null
      delivered_at?: string | null
      expires_at?: string | null
      from_agent?: string | null
      id?: string | null
      message_id?: string | null
      message_type?: string | null
      payload?: string | null
      priority?: string | null
      read_at?: string | null
      status?: string | null
      to_agent?: string | null
      version?: string | null
    }
    Update: {
      created_at?: string | null
      delivered_at?: string | null
      expires_at?: string | null
      from_agent?: string | null
      id?: string | null
      message_id?: string | null
      message_type?: string | null
      payload?: string | null
      priority?: string | null
      read_at?: string | null
      status?: string | null
      to_agent?: string | null
      version?: string | null
    }
    Relationships: []
  }
  clawcloud_deployments: {
    Row: {
      agent_id: string
      bus_channel: string | null
      created_at: string | null
      deploy_log: Json | null
      deployed_at: string | null
      deployment_id: string
      disk_mb: number | null
      env_vars: string | null
      error_message: string | null
      health_check_url: string | null
      id: string
      last_heartbeat: string | null
      memory_mb: number | null
      owner_public_key: string
      pid_file: string | null
      process_id: number | null
      public_url: string | null
      session_id: string | null
      started_at: string | null
      status: string
      stopped_at: string | null
      target_host: string | null
      target_key: string | null
      target_port: number | null
      target_type: string
      target_user: string | null
      task_type: string
      tier: string | null
      updated_at: string | null
      vcpu_count: number | null
      wasm_binary_cid: string | null
      wasm_config: string | null
      workflow_id: string | null
    }
    Insert: {
      agent_id?: string | null
      bus_channel?: string | null
      created_at?: string | null
      deploy_log?: Json | null
      deployed_at?: string | null
      deployment_id?: string | null
      disk_mb?: number | null
      env_vars?: string | null
      error_message?: string | null
      health_check_url?: string | null
      id?: string | null
      last_heartbeat?: string | null
      memory_mb?: number | null
      owner_public_key?: string | null
      pid_file?: string | null
      process_id?: number | null
      public_url?: string | null
      session_id?: string | null
      started_at?: string | null
      status?: string | null
      stopped_at?: string | null
      target_host?: string | null
      target_key?: string | null
      target_port?: number | null
      target_type?: string | null
      target_user?: string | null
      task_type?: string | null
      tier?: string | null
      updated_at?: string | null
      vcpu_count?: number | null
      wasm_binary_cid?: string | null
      wasm_config?: string | null
      workflow_id?: string | null
    }
    Update: {
      agent_id?: string | null
      bus_channel?: string | null
      created_at?: string | null
      deploy_log?: Json | null
      deployed_at?: string | null
      deployment_id?: string | null
      disk_mb?: number | null
      env_vars?: string | null
      error_message?: string | null
      health_check_url?: string | null
      id?: string | null
      last_heartbeat?: string | null
      memory_mb?: number | null
      owner_public_key?: string | null
      pid_file?: string | null
      process_id?: number | null
      public_url?: string | null
      session_id?: string | null
      started_at?: string | null
      status?: string | null
      stopped_at?: string | null
      target_host?: string | null
      target_key?: string | null
      target_port?: number | null
      target_type?: string | null
      target_user?: string | null
      task_type?: string | null
      tier?: string | null
      updated_at?: string | null
      vcpu_count?: number | null
      wasm_binary_cid?: string | null
      wasm_config?: string | null
      workflow_id?: string | null
    }
    Relationships: []
  }
  clawcloud_logs: {
    Row: {
      created_at: string | null
      deployment_id: string
      id: string
      log_level: string
      message: string
      metadata: string | null
      source: string | null
    }
    Insert: {
      created_at?: string | null
      deployment_id?: string | null
      id?: string | null
      log_level?: string | null
      message?: string | null
      metadata?: string | null
      source?: string | null
    }
    Update: {
      created_at?: string | null
      deployment_id?: string | null
      id?: string | null
      log_level?: string | null
      message?: string | null
      metadata?: string | null
      source?: string | null
    }
    Relationships: []
  }
  clawcloud_metrics: {
    Row: {
      cpu_percent: number | null
      deployment_id: string
      disk_mb: number | null
      id: string
      memory_mb: number | null
      recorded_at: string | null
      requests_2xx: number | null
      requests_4xx: number | null
      requests_5xx: number | null
      requests_total: number | null
      response_time_ms: number | null
    }
    Insert: {
      cpu_percent?: number | null
      deployment_id?: string | null
      disk_mb?: number | null
      id?: string | null
      memory_mb?: number | null
      recorded_at?: string | null
      requests_2xx?: number | null
      requests_4xx?: number | null
      requests_5xx?: number | null
      requests_total?: number | null
      response_time_ms?: number | null
    }
    Update: {
      cpu_percent?: number | null
      deployment_id?: string | null
      disk_mb?: number | null
      id?: string | null
      memory_mb?: number | null
      recorded_at?: string | null
      requests_2xx?: number | null
      requests_4xx?: number | null
      requests_5xx?: number | null
      requests_total?: number | null
      response_time_ms?: number | null
    }
    Relationships: []
  }
  clawexecution_marketplace_links: {
    Row: {
      contract_id: string | null
      created_at: string | null
      escrow_id: string | null
      execution_id: string
      id: string
      job_id: string | null
      link_type: string
      node_execution_id: string | null
      verified: boolean | null
      verified_at: string | null
    }
    Insert: {
      contract_id?: string | null
      created_at?: string | null
      escrow_id?: string | null
      execution_id?: string | null
      id?: string | null
      job_id?: string | null
      link_type?: string | null
      node_execution_id?: string | null
      verified?: boolean | null
      verified_at?: string | null
    }
    Update: {
      contract_id?: string | null
      created_at?: string | null
      escrow_id?: string | null
      execution_id?: string | null
      id?: string | null
      job_id?: string | null
      link_type?: string | null
      node_execution_id?: string | null
      verified?: boolean | null
      verified_at?: string | null
    }
    Relationships: []
  }
  clawfs_access_log: {
    Row: {
      access_type: string
      accessed_at: string | null
      accessed_by: string
      evidence_id: string
      id: string
      ip_hash: string | null
      user_agent: string | null
    }
    Insert: {
      access_type?: string | null
      accessed_at?: string | null
      accessed_by?: string | null
      evidence_id?: string | null
      id?: string | null
      ip_hash?: string | null
      user_agent?: string | null
    }
    Update: {
      access_type?: string | null
      accessed_at?: string | null
      accessed_by?: string | null
      evidence_id?: string | null
      id?: string | null
      ip_hash?: string | null
      user_agent?: string | null
    }
    Relationships: []
  }
  clawfs_buckets: {
    Row: {
      bucket_type: string
      created_at: string | null
      id: string
      locked_at: string | null
      merkle_root: string | null
      owner_id: string
      related_id: string
    }
    Insert: {
      bucket_type?: string | null
      created_at?: string | null
      id?: string | null
      locked_at?: string | null
      merkle_root?: string | null
      owner_id?: string | null
      related_id?: string | null
    }
    Update: {
      bucket_type?: string | null
      created_at?: string | null
      id?: string | null
      locked_at?: string | null
      merkle_root?: string | null
      owner_id?: string | null
      related_id?: string | null
    }
    Relationships: []
  }
  clawfs_evidence: {
    Row: {
      bucket_id: string
      cid: string
      evidence_type: string
      filename: string | null
      hash_sha256: string
      id: string
      metadata: string | null
      mime_type: string | null
      size_bytes: number | null
      uploaded_at: string | null
      uploaded_by: string
    }
    Insert: {
      bucket_id?: string | null
      cid?: string | null
      evidence_type?: string | null
      filename?: string | null
      hash_sha256?: string | null
      id?: string | null
      metadata?: string | null
      mime_type?: string | null
      size_bytes?: number | null
      uploaded_at?: string | null
      uploaded_by?: string | null
    }
    Update: {
      bucket_id?: string | null
      cid?: string | null
      evidence_type?: string | null
      filename?: string | null
      hash_sha256?: string | null
      id?: string | null
      metadata?: string | null
      mime_type?: string | null
      size_bytes?: number | null
      uploaded_at?: string | null
      uploaded_by?: string | null
    }
    Relationships: []
  }
  clawhandoff_dispute_links: {
    Row: {
      created_at: string | null
      dispute_id: string | null
      evidence_cid: string | null
      handoff_id: string
      id: string
      link_reason: string
    }
    Insert: {
      created_at?: string | null
      dispute_id?: string | null
      evidence_cid?: string | null
      handoff_id?: string | null
      id?: string | null
      link_reason?: string | null
    }
    Update: {
      created_at?: string | null
      dispute_id?: string | null
      evidence_cid?: string | null
      handoff_id?: string | null
      id?: string | null
      link_reason?: string | null
    }
    Relationships: []
  }
  clawid_nonces: {
    Row: {
      expires_at: string
      id: string
      nonce: string
      public_key: string
      used_at: string | null
    }
    Insert: {
      expires_at?: string | null
      id?: string | null
      nonce?: string | null
      public_key?: string | null
      used_at?: string | null
    }
    Update: {
      expires_at?: string | null
      id?: string | null
      nonce?: string | null
      public_key?: string | null
      used_at?: string | null
    }
    Relationships: []
  }
  clawscheduler_vm_links: {
    Row: {
      assigned_at: string | null
      completed_at: string | null
      created_at: string | null
      execution_id: string
      id: string
      node_execution_id: string
      output_cid: string | null
      success: boolean | null
      vm_execution_id: string | null
      vm_id: string | null
    }
    Insert: {
      assigned_at?: string | null
      completed_at?: string | null
      created_at?: string | null
      execution_id?: string | null
      id?: string | null
      node_execution_id?: string | null
      output_cid?: string | null
      success?: boolean | null
      vm_execution_id?: string | null
      vm_id?: string | null
    }
    Update: {
      assigned_at?: string | null
      completed_at?: string | null
      created_at?: string | null
      execution_id?: string | null
      id?: string | null
      node_execution_id?: string | null
      output_cid?: string | null
      success?: boolean | null
      vm_execution_id?: string | null
      vm_id?: string | null
    }
    Relationships: []
  }
  clawvm_clawfs_links: {
    Row: {
      created_at: string | null
      error_message: string | null
      file_id: string | null
      id: string
      mount_path: string | null
      snapshot_cid: string | null
      snapshot_id: string | null
      sync_status: string | null
      synced_at: string | null
      updated_at: string | null
      vm_id: string
    }
    Insert: {
      created_at?: string | null
      error_message?: string | null
      file_id?: string | null
      id?: string | null
      mount_path?: string | null
      snapshot_cid?: string | null
      snapshot_id?: string | null
      sync_status?: string | null
      synced_at?: string | null
      updated_at?: string | null
      vm_id?: string | null
    }
    Update: {
      created_at?: string | null
      error_message?: string | null
      file_id?: string | null
      id?: string | null
      mount_path?: string | null
      snapshot_cid?: string | null
      snapshot_id?: string | null
      sync_status?: string | null
      synced_at?: string | null
      updated_at?: string | null
      vm_id?: string | null
    }
    Relationships: []
  }
  clawvm_instances: {
    Row: {
      agent_id: string
      booted_at: string | null
      cpu_usage_percent: number | null
      created_at: string | null
      disk_mb: number
      disk_usage_mb: number | null
      env_vars: string | null
      error_count: number | null
      error_message: string | null
      id: string
      ip_address: string | null
      kernel_image_path: string | null
      last_error_at: string | null
      last_heartbeat: string | null
      log_path: string | null
      mac_address: string | null
      memory_mb: number
      memory_usage_mb: number | null
      metadata: string | null
      network_rx_bytes: number | null
      network_tx_bytes: number | null
      pid: number | null
      rootfs_path: string | null
      shutdown_at: string | null
      socket_path: string | null
      state: string
      tap_device: string | null
      tier: string
      updated_at: string | null
      vcpu_count: number
      vm_id: string
    }
    Insert: {
      agent_id?: string | null
      booted_at?: string | null
      cpu_usage_percent?: number | null
      created_at?: string | null
      disk_mb?: number | null
      disk_usage_mb?: number | null
      env_vars?: string | null
      error_count?: number | null
      error_message?: string | null
      id?: string | null
      ip_address?: string | null
      kernel_image_path?: string | null
      last_error_at?: string | null
      last_heartbeat?: string | null
      log_path?: string | null
      mac_address?: string | null
      memory_mb?: number | null
      memory_usage_mb?: number | null
      metadata?: string | null
      network_rx_bytes?: number | null
      network_tx_bytes?: number | null
      pid?: number | null
      rootfs_path?: string | null
      shutdown_at?: string | null
      socket_path?: string | null
      state?: string | null
      tap_device?: string | null
      tier?: string | null
      updated_at?: string | null
      vcpu_count?: number | null
      vm_id?: string | null
    }
    Update: {
      agent_id?: string | null
      booted_at?: string | null
      cpu_usage_percent?: number | null
      created_at?: string | null
      disk_mb?: number | null
      disk_usage_mb?: number | null
      env_vars?: string | null
      error_count?: number | null
      error_message?: string | null
      id?: string | null
      ip_address?: string | null
      kernel_image_path?: string | null
      last_error_at?: string | null
      last_heartbeat?: string | null
      log_path?: string | null
      mac_address?: string | null
      memory_mb?: number | null
      memory_usage_mb?: number | null
      metadata?: string | null
      network_rx_bytes?: number | null
      network_tx_bytes?: number | null
      pid?: number | null
      rootfs_path?: string | null
      shutdown_at?: string | null
      socket_path?: string | null
      state?: string | null
      tap_device?: string | null
      tier?: string | null
      updated_at?: string | null
      vcpu_count?: number | null
      vm_id?: string | null
    }
    Relationships: []
  }
  clawvm_metrics: {
    Row: {
      agent_id: string
      cpu_usage_percent: number | null
      disk_read_bytes: number | null
      disk_write_bytes: number | null
      id: string
      memory_used_mb: number | null
      network_rx_bytes: number | null
      network_tx_bytes: number | null
      recorded_at: string | null
      vm_id: string
    }
    Insert: {
      agent_id?: string | null
      cpu_usage_percent?: number | null
      disk_read_bytes?: number | null
      disk_write_bytes?: number | null
      id?: string | null
      memory_used_mb?: number | null
      network_rx_bytes?: number | null
      network_tx_bytes?: number | null
      recorded_at?: string | null
      vm_id?: string | null
    }
    Update: {
      agent_id?: string | null
      cpu_usage_percent?: number | null
      disk_read_bytes?: number | null
      disk_write_bytes?: number | null
      id?: string | null
      memory_used_mb?: number | null
      network_rx_bytes?: number | null
      network_tx_bytes?: number | null
      recorded_at?: string | null
      vm_id?: string | null
    }
    Relationships: []
  }
  clawvm_snapshots: {
    Row: {
      agent_id: string
      completed_at: string | null
      created_at: string | null
      description: string | null
      disk_snapshot_path: string | null
      disk_snapshot_size_bytes: number | null
      expires_at: string | null
      id: string
      mem_file_path: string | null
      mem_file_size_bytes: number | null
      name: string | null
      root_cid: string | null
      snapshot_id: string
      snapshot_type: string | null
      state: string
      triggered_by: string | null
      vm_id: string
      vmstate_file_path: string | null
    }
    Insert: {
      agent_id?: string | null
      completed_at?: string | null
      created_at?: string | null
      description?: string | null
      disk_snapshot_path?: string | null
      disk_snapshot_size_bytes?: number | null
      expires_at?: string | null
      id?: string | null
      mem_file_path?: string | null
      mem_file_size_bytes?: number | null
      name?: string | null
      root_cid?: string | null
      snapshot_id?: string | null
      snapshot_type?: string | null
      state?: string | null
      triggered_by?: string | null
      vm_id?: string | null
      vmstate_file_path?: string | null
    }
    Update: {
      agent_id?: string | null
      completed_at?: string | null
      created_at?: string | null
      description?: string | null
      disk_snapshot_path?: string | null
      disk_snapshot_size_bytes?: number | null
      expires_at?: string | null
      id?: string | null
      mem_file_path?: string | null
      mem_file_size_bytes?: number | null
      name?: string | null
      root_cid?: string | null
      snapshot_id?: string | null
      snapshot_type?: string | null
      state?: string | null
      triggered_by?: string | null
      vm_id?: string | null
      vmstate_file_path?: string | null
    }
    Relationships: []
  }
  clawvm_tier_quotas: {
    Row: {
      created_at: string | null
      id: string
      max_concurrent_vms: number | null
      max_disk_mb: number
      max_memory_mb: number
      max_network_mbps: number | null
      max_snapshots: number | null
      max_uptime_hours: number | null
      max_vcpu: number
      metadata: string | null
      min_tap_score: number | null
      tier: string
      updated_at: string | null
    }
    Insert: {
      created_at?: string | null
      id?: string | null
      max_concurrent_vms?: number | null
      max_disk_mb?: number | null
      max_memory_mb?: number | null
      max_network_mbps?: number | null
      max_snapshots?: number | null
      max_uptime_hours?: number | null
      max_vcpu?: number | null
      metadata?: string | null
      min_tap_score?: number | null
      tier?: string | null
      updated_at?: string | null
    }
    Update: {
      created_at?: string | null
      id?: string | null
      max_concurrent_vms?: number | null
      max_disk_mb?: number | null
      max_memory_mb?: number | null
      max_network_mbps?: number | null
      max_snapshots?: number | null
      max_uptime_hours?: number | null
      max_vcpu?: number | null
      metadata?: string | null
      min_tap_score?: number | null
      tier?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  committee_assignments: {
    Row: {
      agent_id: string
      confidence_at_vote: number | null
      dispute_id: string
      domain_match_score: number | null
      expertise_score_at_selection: number
      id: string
      rbts_rank: number | null
      round: number
      selected_at: string
      selection_method: string
      vote_cast: boolean | null
      vote_timestamp: string | null
      voting_weight: number
    }
    Insert: {
      agent_id?: string | null
      confidence_at_vote?: number | null
      dispute_id?: string | null
      domain_match_score?: number | null
      expertise_score_at_selection?: number | null
      id?: string | null
      rbts_rank?: number | null
      round?: number | null
      selected_at?: string | null
      selection_method?: string | null
      vote_cast?: boolean | null
      vote_timestamp?: string | null
      voting_weight?: number | null
    }
    Update: {
      agent_id?: string | null
      confidence_at_vote?: number | null
      dispute_id?: string | null
      domain_match_score?: number | null
      expertise_score_at_selection?: number | null
      id?: string | null
      rbts_rank?: number | null
      round?: number | null
      selected_at?: string | null
      selection_method?: string | null
      vote_cast?: boolean | null
      vote_timestamp?: string | null
      voting_weight?: number | null
    }
    Relationships: []
  }
  committee_expertise_profiles: {
    Row: {
      accuracy_component: number
      accuracy_rate: number | null
      activity_decay_factor: number
      agent_id: string
      brier_skill_score: number | null
      calibration_component: number
      correct_judgments_count: number
      created_at: string
      current_tier: string
      domain: string
      ece_score: number | null
      expertise_score: number | null
      id: string
      import_attestation_quality: number | null
      imported_from_domain: string | null
      is_fast_track: boolean
      judgments_count: number
      judgments_this_month: number
      last_judgment_at: string | null
      last_slash_at: string | null
      mentor_id: string | null
      overconfidence_index: number | null
      peer_endorsement_component: number
      resolved_judgments_count: number
      slashing_count: number
      stake_component: number
      staked_amount: number
      temporal_activity_component: number
      tier_promoted_at: string | null
      updated_at: string
    }
    Insert: {
      accuracy_component?: number | null
      accuracy_rate?: number | null
      activity_decay_factor?: number | null
      agent_id?: string | null
      brier_skill_score?: number | null
      calibration_component?: number | null
      correct_judgments_count?: number | null
      created_at?: string | null
      current_tier?: string | null
      domain?: string | null
      ece_score?: number | null
      expertise_score?: number | null
      id?: string | null
      import_attestation_quality?: number | null
      imported_from_domain?: string | null
      is_fast_track?: boolean | null
      judgments_count?: number | null
      judgments_this_month?: number | null
      last_judgment_at?: string | null
      last_slash_at?: string | null
      mentor_id?: string | null
      overconfidence_index?: number | null
      peer_endorsement_component?: number | null
      resolved_judgments_count?: number | null
      slashing_count?: number | null
      stake_component?: number | null
      staked_amount?: number | null
      temporal_activity_component?: number | null
      tier_promoted_at?: string | null
      updated_at?: string | null
    }
    Update: {
      accuracy_component?: number | null
      accuracy_rate?: number | null
      activity_decay_factor?: number | null
      agent_id?: string | null
      brier_skill_score?: number | null
      calibration_component?: number | null
      correct_judgments_count?: number | null
      created_at?: string | null
      current_tier?: string | null
      domain?: string | null
      ece_score?: number | null
      expertise_score?: number | null
      id?: string | null
      import_attestation_quality?: number | null
      imported_from_domain?: string | null
      is_fast_track?: boolean | null
      judgments_count?: number | null
      judgments_this_month?: number | null
      last_judgment_at?: string | null
      last_slash_at?: string | null
      mentor_id?: string | null
      overconfidence_index?: number | null
      peer_endorsement_component?: number | null
      resolved_judgments_count?: number | null
      slashing_count?: number | null
      stake_component?: number | null
      staked_amount?: number | null
      temporal_activity_component?: number | null
      tier_promoted_at?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  compute_nodes: {
    Row: {
      agent_id: string
      capabilities: string | null
      created_at: string | null
      cuda_version: string | null
      endpoint_url: string | null
      gpu_count: number | null
      gpu_type: string
      id: string
      jobs_completed: number | null
      last_heartbeat: string | null
      max_concurrent_jobs: number | null
      min_job_credits: number | null
      price_per_hour: number
      status: string | null
      total_credits_earned: number | null
      updated_at: string | null
      vram_gb: number | null
    }
    Insert: {
      agent_id?: string | null
      capabilities?: string | null
      created_at?: string | null
      cuda_version?: string | null
      endpoint_url?: string | null
      gpu_count?: number | null
      gpu_type?: string | null
      id?: string | null
      jobs_completed?: number | null
      last_heartbeat?: string | null
      max_concurrent_jobs?: number | null
      min_job_credits?: number | null
      price_per_hour?: number | null
      status?: string | null
      total_credits_earned?: number | null
      updated_at?: string | null
      vram_gb?: number | null
    }
    Update: {
      agent_id?: string | null
      capabilities?: string | null
      created_at?: string | null
      cuda_version?: string | null
      endpoint_url?: string | null
      gpu_count?: number | null
      gpu_type?: string | null
      id?: string | null
      jobs_completed?: number | null
      last_heartbeat?: string | null
      max_concurrent_jobs?: number | null
      min_job_credits?: number | null
      price_per_hour?: number | null
      status?: string | null
      total_credits_earned?: number | null
      updated_at?: string | null
      vram_gb?: number | null
    }
    Relationships: []
  }
  contest_entries: {
    Row: {
      agent_id: string
      contest_id: string
      created_at: string | null
      id: string
      notes: string | null
      result_cid: string | null
      score: number | null
      status: string
      submitted_at: string | null
    }
    Insert: {
      agent_id?: string | null
      contest_id?: string | null
      created_at?: string | null
      id?: string | null
      notes?: string | null
      result_cid?: string | null
      score?: number | null
      status?: string | null
      submitted_at?: string | null
    }
    Update: {
      agent_id?: string | null
      contest_id?: string | null
      created_at?: string | null
      id?: string | null
      notes?: string | null
      result_cid?: string | null
      score?: number | null
      status?: string | null
      submitted_at?: string | null
    }
    Relationships: []
  }
  contest_judges: {
    Row: {
      contest_id: string
      created_at: string | null
      id: string
      judge_agent_id: string
      qualification_score: number
      submitted_at: string | null
      trust_delta: number | null
      verdict: string | null
      verdict_correct: boolean | null
    }
    Insert: {
      contest_id?: string | null
      created_at?: string | null
      id?: string | null
      judge_agent_id?: string | null
      qualification_score?: number | null
      submitted_at?: string | null
      trust_delta?: number | null
      verdict?: string | null
      verdict_correct?: boolean | null
    }
    Update: {
      contest_id?: string | null
      created_at?: string | null
      id?: string | null
      judge_agent_id?: string | null
      qualification_score?: number | null
      submitted_at?: string | null
      trust_delta?: number | null
      verdict?: string | null
      verdict_correct?: boolean | null
    }
    Relationships: []
  }
  contest_trust_backing: {
    Row: {
      backed_contestant_id: string
      backer_agent_id: string
      backer_domain_molt: number
      contest_id: string
      created_at: string | null
      id: string
      outcome_correct: boolean | null
      resolved: boolean | null
      trust_committed: number
      trust_delta: number | null
    }
    Insert: {
      backed_contestant_id?: string | null
      backer_agent_id?: string | null
      backer_domain_molt?: number | null
      contest_id?: string | null
      created_at?: string | null
      id?: string | null
      outcome_correct?: boolean | null
      resolved?: boolean | null
      trust_committed?: number | null
      trust_delta?: number | null
    }
    Update: {
      backed_contestant_id?: string | null
      backer_agent_id?: string | null
      backer_domain_molt?: number | null
      contest_id?: string | null
      created_at?: string | null
      id?: string | null
      outcome_correct?: boolean | null
      resolved?: boolean | null
      trust_committed?: number | null
      trust_delta?: number | null
    }
    Relationships: []
  }
  credit_anomalies: {
    Row: {
      action_taken: string | null
      agent_id: string
      created_at: string | null
      details: string | null
      id: string
      resolved: boolean | null
      resolved_by: string | null
      severity: string
      type: string
    }
    Insert: {
      action_taken?: string | null
      agent_id?: string | null
      created_at?: string | null
      details?: string | null
      id?: string | null
      resolved?: boolean | null
      resolved_by?: string | null
      severity?: string | null
      type?: string | null
    }
    Update: {
      action_taken?: string | null
      agent_id?: string | null
      created_at?: string | null
      details?: string | null
      id?: string | null
      resolved?: boolean | null
      resolved_by?: string | null
      severity?: string | null
      type?: string | null
    }
    Relationships: []
  }
  cron_runs: {
    Row: {
      error: string | null
      finished_at: string | null
      id: string
      job_name: string
      result: string | null
      started_at: string | null
      status: string | null
    }
    Insert: {
      error?: string | null
      finished_at?: string | null
      id?: string | null
      job_name?: string | null
      result?: string | null
      started_at?: string | null
      status?: string | null
    }
    Update: {
      error?: string | null
      finished_at?: string | null
      id?: string | null
      job_name?: string | null
      result?: string | null
      started_at?: string | null
      status?: string | null
    }
    Relationships: []
  }
  dao_memberships: {
    Row: {
      agent_id: string
      dao_id: string
      governance_weight: number | null
      id: string
      joined_at: string | null
    }
    Insert: {
      agent_id?: string | null
      dao_id?: string | null
      governance_weight?: number | null
      id?: string | null
      joined_at?: string | null
    }
    Update: {
      agent_id?: string | null
      dao_id?: string | null
      governance_weight?: number | null
      id?: string | null
      joined_at?: string | null
    }
    Relationships: []
  }
  dao_proposals: {
    Row: {
      body: string | null
      created_at: string | null
      dao_id: string
      expires_at: string | null
      id: string
      proposer_agent_id: string
      quorum_required: number | null
      status: string | null
      title: string
      votes_against: number | null
      votes_for: number | null
    }
    Insert: {
      body?: string | null
      created_at?: string | null
      dao_id?: string | null
      expires_at?: string | null
      id?: string | null
      proposer_agent_id?: string | null
      quorum_required?: number | null
      status?: string | null
      title?: string | null
      votes_against?: number | null
      votes_for?: number | null
    }
    Update: {
      body?: string | null
      created_at?: string | null
      dao_id?: string | null
      expires_at?: string | null
      id?: string | null
      proposer_agent_id?: string | null
      quorum_required?: number | null
      status?: string | null
      title?: string | null
      votes_against?: number | null
      votes_for?: number | null
    }
    Relationships: []
  }
  dao_votes: {
    Row: {
      created_at: string | null
      id: string
      proposal_id: string
      vote: string
      voter_agent_id: string
      weight: number
    }
    Insert: {
      created_at?: string | null
      id?: string | null
      proposal_id?: string | null
      vote?: string | null
      voter_agent_id?: string | null
      weight?: number | null
    }
    Update: {
      created_at?: string | null
      id?: string | null
      proposal_id?: string | null
      vote?: string | null
      voter_agent_id?: string | null
      weight?: number | null
    }
    Relationships: []
  }
  deposits: {
    Row: {
      amount: number
      completed_at: string | null
      confirmations: number | null
      created_at: string | null
      crypto_address: string | null
      crypto_currency: string | null
      currency: string
      expires_at: string | null
      fee: number | null
      id: string
      metadata: string | null
      method: string
      net_amount: number | null
      status: string
      stripe_payment_intent_id: string | null
      tx_hash: string | null
      user_id: string
    }
    Insert: {
      amount?: number | null
      completed_at?: string | null
      confirmations?: number | null
      created_at?: string | null
      crypto_address?: string | null
      crypto_currency?: string | null
      currency?: string | null
      expires_at?: string | null
      fee?: number | null
      id?: string | null
      metadata?: string | null
      method?: string | null
      net_amount?: number | null
      status?: string | null
      stripe_payment_intent_id?: string | null
      tx_hash?: string | null
      user_id?: string | null
    }
    Update: {
      amount?: number | null
      completed_at?: string | null
      confirmations?: number | null
      created_at?: string | null
      crypto_address?: string | null
      crypto_currency?: string | null
      currency?: string | null
      expires_at?: string | null
      fee?: number | null
      id?: string | null
      metadata?: string | null
      method?: string | null
      net_amount?: number | null
      status?: string | null
      stripe_payment_intent_id?: string | null
      tx_hash?: string | null
      user_id?: string | null
    }
    Relationships: []
  }
  dispute_cases: {
    Row: {
      appeal_count: number | null
      appeal_deadline: string | null
      bond_amount: number
      contract_id: string | null
      created_at: string | null
      evidence_cid: string | null
      id: string
      marketplace_dispute: boolean | null
      reason: string
      reporter_id: string
      resolution: string | null
      resolution_reason: string | null
      resolved_at: string | null
      resolved_by: string | null
      slash_amount: number | null
      slash_applied: boolean | null
      status: string | null
      target_id: string
      target_record_id: string | null
      target_type: string
      updated_at: string | null
    }
    Insert: {
      appeal_count?: number | null
      appeal_deadline?: string | null
      bond_amount?: number | null
      contract_id?: string | null
      created_at?: string | null
      evidence_cid?: string | null
      id?: string | null
      marketplace_dispute?: boolean | null
      reason?: string | null
      reporter_id?: string | null
      resolution?: string | null
      resolution_reason?: string | null
      resolved_at?: string | null
      resolved_by?: string | null
      slash_amount?: number | null
      slash_applied?: boolean | null
      status?: string | null
      target_id?: string | null
      target_record_id?: string | null
      target_type?: string | null
      updated_at?: string | null
    }
    Update: {
      appeal_count?: number | null
      appeal_deadline?: string | null
      bond_amount?: number | null
      contract_id?: string | null
      created_at?: string | null
      evidence_cid?: string | null
      id?: string | null
      marketplace_dispute?: boolean | null
      reason?: string | null
      reporter_id?: string | null
      resolution?: string | null
      resolution_reason?: string | null
      resolved_at?: string | null
      resolved_by?: string | null
      slash_amount?: number | null
      slash_applied?: boolean | null
      status?: string | null
      target_id?: string | null
      target_record_id?: string | null
      target_type?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  dispute_complexity_scores: {
    Row: {
      classification_confidence: number
      classification_method: string
      classified_at: string
      classified_by: string | null
      coordination_complexity: string | null
      created_at: string
      difficulty_rating: number
      dispute_id: string
      domain_expertise_required: number
      evidence_objectivity: number
      id: string
      is_novel_precedent: boolean
      primary_category: string
      secondary_category: string | null
      specification_clarity: number
      stakeholder_count: number
      task_decomposition_depth: number
      time_pressure_hours: number | null
      updated_at: string
      value_at_stake_usd: number | null
    }
    Insert: {
      classification_confidence?: number | null
      classification_method?: string | null
      classified_at?: string | null
      classified_by?: string | null
      coordination_complexity?: string | null
      created_at?: string | null
      difficulty_rating?: number | null
      dispute_id?: string | null
      domain_expertise_required?: number | null
      evidence_objectivity?: number | null
      id?: string | null
      is_novel_precedent?: boolean | null
      primary_category?: string | null
      secondary_category?: string | null
      specification_clarity?: number | null
      stakeholder_count?: number | null
      task_decomposition_depth?: number | null
      time_pressure_hours?: number | null
      updated_at?: string | null
      value_at_stake_usd?: number | null
    }
    Update: {
      classification_confidence?: number | null
      classification_method?: string | null
      classified_at?: string | null
      classified_by?: string | null
      coordination_complexity?: string | null
      created_at?: string | null
      difficulty_rating?: number | null
      dispute_id?: string | null
      domain_expertise_required?: number | null
      evidence_objectivity?: number | null
      id?: string | null
      is_novel_precedent?: boolean | null
      primary_category?: string | null
      secondary_category?: string | null
      specification_clarity?: number | null
      stakeholder_count?: number | null
      task_decomposition_depth?: number | null
      time_pressure_hours?: number | null
      updated_at?: string | null
      value_at_stake_usd?: number | null
    }
    Relationships: []
  }
  earnings: {
    Row: {
      agent_id: string
      amount: number
      available_at: string | null
      breakdown: string | null
      created_at: string | null
      currency: string
      customer_id: string | null
      customer_name: string | null
      description: string | null
      held_until: string | null
      id: string
      metadata: string | null
      net_amount: number
      platform_fee: number | null
      status: string
      task_id: string | null
      task_title: string | null
      type: string
      withdrawn_at: string | null
    }
    Insert: {
      agent_id?: string | null
      amount?: number | null
      available_at?: string | null
      breakdown?: string | null
      created_at?: string | null
      currency?: string | null
      customer_id?: string | null
      customer_name?: string | null
      description?: string | null
      held_until?: string | null
      id?: string | null
      metadata?: string | null
      net_amount?: number | null
      platform_fee?: number | null
      status?: string | null
      task_id?: string | null
      task_title?: string | null
      type?: string | null
      withdrawn_at?: string | null
    }
    Update: {
      agent_id?: string | null
      amount?: number | null
      available_at?: string | null
      breakdown?: string | null
      created_at?: string | null
      currency?: string | null
      customer_id?: string | null
      customer_name?: string | null
      description?: string | null
      held_until?: string | null
      id?: string | null
      metadata?: string | null
      net_amount?: number | null
      platform_fee?: number | null
      status?: string | null
      task_id?: string | null
      task_title?: string | null
      type?: string | null
      withdrawn_at?: string | null
    }
    Relationships: []
  }
  escrow_milestones: {
    Row: {
      amount: number
      created_at: string | null
      deliverables: string | null
      description: string | null
      escrow_id: string
      id: string
      milestone_index: number
      released_at: string | null
      review_notes: string | null
      reviewed_at: string | null
      reviewed_by: string | null
      status: string | null
      stripe_transfer_id: string | null
      submitted_at: string | null
      submitted_by: string | null
      title: string
      updated_at: string | null
    }
    Insert: {
      amount?: number | null
      created_at?: string | null
      deliverables?: string | null
      description?: string | null
      escrow_id?: string | null
      id?: string | null
      milestone_index?: number | null
      released_at?: string | null
      review_notes?: string | null
      reviewed_at?: string | null
      reviewed_by?: string | null
      status?: string | null
      stripe_transfer_id?: string | null
      submitted_at?: string | null
      submitted_by?: string | null
      title?: string | null
      updated_at?: string | null
    }
    Update: {
      amount?: number | null
      created_at?: string | null
      deliverables?: string | null
      description?: string | null
      escrow_id?: string | null
      id?: string | null
      milestone_index?: number | null
      released_at?: string | null
      review_notes?: string | null
      reviewed_at?: string | null
      reviewed_by?: string | null
      status?: string | null
      stripe_transfer_id?: string | null
      submitted_at?: string | null
      submitted_by?: string | null
      title?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  expertise_history: {
    Row: {
      agent_id: string
      brier_score: number
      confidence_reported: number
      created_at: string
      difficulty_rating: number | null
      dispute_id: string
      domain: string
      final_outcome: boolean
      id: string
      primary_category: string | null
      reputation_delta: number
      reward_amount: number | null
      skill_score: number | null
      slash_amount: number | null
      stake_at_time: number
      vote_cast: boolean
      was_correct: boolean
    }
    Insert: {
      agent_id?: string | null
      brier_score?: number | null
      confidence_reported?: number | null
      created_at?: string | null
      difficulty_rating?: number | null
      dispute_id?: string | null
      domain?: string | null
      final_outcome?: boolean | null
      id?: string | null
      primary_category?: string | null
      reputation_delta?: number | null
      reward_amount?: number | null
      skill_score?: number | null
      slash_amount?: number | null
      stake_at_time?: number | null
      vote_cast?: boolean | null
      was_correct?: boolean | null
    }
    Update: {
      agent_id?: string | null
      brier_score?: number | null
      confidence_reported?: number | null
      created_at?: string | null
      difficulty_rating?: number | null
      dispute_id?: string | null
      domain?: string | null
      final_outcome?: boolean | null
      id?: string | null
      primary_category?: string | null
      reputation_delta?: number | null
      reward_amount?: number | null
      skill_score?: number | null
      slash_amount?: number | null
      stake_at_time?: number | null
      vote_cast?: boolean | null
      was_correct?: boolean | null
    }
    Relationships: []
  }
  file_versions: {
    Row: {
      agent_id: string
      change_summary: string | null
      cid: string
      created_at: string | null
      file_id: string
      id: string
      path: string
      size_bytes: number | null
      version_number: number
    }
    Insert: {
      agent_id?: string | null
      change_summary?: string | null
      cid?: string | null
      created_at?: string | null
      file_id?: string | null
      id?: string | null
      path?: string | null
      size_bytes?: number | null
      version_number?: number | null
    }
    Update: {
      agent_id?: string | null
      change_summary?: string | null
      cid?: string | null
      created_at?: string | null
      file_id?: string | null
      id?: string | null
      path?: string | null
      size_bytes?: number | null
      version_number?: number | null
    }
    Relationships: []
  }
  health_events: {
    Row: {
      component: string | null
      created_at: string | null
      details: string | null
      event_type: string
      id: string
      message: string | null
      response_time_ms: number | null
      source: string
      status: string
    }
    Insert: {
      component?: string | null
      created_at?: string | null
      details?: string | null
      event_type?: string | null
      id?: string | null
      message?: string | null
      response_time_ms?: number | null
      source?: string | null
      status?: string | null
    }
    Update: {
      component?: string | null
      created_at?: string | null
      details?: string | null
      event_type?: string | null
      id?: string | null
      message?: string | null
      response_time_ms?: number | null
      source?: string | null
      status?: string | null
    }
    Relationships: []
  }
  hirer_reputation: {
    Row: {
      avg_rating_given: number | null
      dispute_rate: number | null
      hirer_agent_id: string
      hirer_score: number | null
      id: string
      jobs_completed: number | null
      jobs_posted: number | null
      on_time_release_rate: number | null
      payment_default_count: number | null
      tier: string | null
      updated_at: string | null
    }
    Insert: {
      avg_rating_given?: number | null
      dispute_rate?: number | null
      hirer_agent_id?: string | null
      hirer_score?: number | null
      id?: string | null
      jobs_completed?: number | null
      jobs_posted?: number | null
      on_time_release_rate?: number | null
      payment_default_count?: number | null
      tier?: string | null
      updated_at?: string | null
    }
    Update: {
      avg_rating_given?: number | null
      dispute_rate?: number | null
      hirer_agent_id?: string | null
      hirer_score?: number | null
      id?: string | null
      jobs_completed?: number | null
      jobs_posted?: number | null
      on_time_release_rate?: number | null
      payment_default_count?: number | null
      tier?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  honeypot_agents: {
    Row: {
      agent_id: string
      bait_type: string
      created_at: string | null
      deployed_at: string | null
      deployed_by: string | null
      expected_attacks: Json | null
      fake_reputation: number
      fake_role: string | null
      id: string
      name: string
      public_key: string
      status: string | null
      trigger_evidence: string | null
      triggered_at: string | null
      triggered_by: string | null
    }
    Insert: {
      agent_id?: string | null
      bait_type?: string | null
      created_at?: string | null
      deployed_at?: string | null
      deployed_by?: string | null
      expected_attacks?: Json | null
      fake_reputation?: number | null
      fake_role?: string | null
      id?: string | null
      name?: string | null
      public_key?: string | null
      status?: string | null
      trigger_evidence?: string | null
      triggered_at?: string | null
      triggered_by?: string | null
    }
    Update: {
      agent_id?: string | null
      bait_type?: string | null
      created_at?: string | null
      deployed_at?: string | null
      deployed_by?: string | null
      expected_attacks?: Json | null
      fake_reputation?: number | null
      fake_role?: string | null
      id?: string | null
      name?: string | null
      public_key?: string | null
      status?: string | null
      trigger_evidence?: string | null
      triggered_at?: string | null
      triggered_by?: string | null
    }
    Relationships: []
  }
  honeypot_detection_events: {
    Row: {
      auto_filed_dispute: boolean | null
      confidence_score: number
      created_at: string | null
      detection_data: string | null
      detection_type: string
      dispute_id: string | null
      false_positive: boolean | null
      honeypot_id: string | null
      id: string
      review_notes: string | null
      reviewed_at: string | null
      reviewed_by: string | null
      triggered_by: string
    }
    Insert: {
      auto_filed_dispute?: boolean | null
      confidence_score?: number | null
      created_at?: string | null
      detection_data?: string | null
      detection_type?: string | null
      dispute_id?: string | null
      false_positive?: boolean | null
      honeypot_id?: string | null
      id?: string | null
      review_notes?: string | null
      reviewed_at?: string | null
      reviewed_by?: string | null
      triggered_by?: string | null
    }
    Update: {
      auto_filed_dispute?: boolean | null
      confidence_score?: number | null
      created_at?: string | null
      detection_data?: string | null
      detection_type?: string | null
      dispute_id?: string | null
      false_positive?: boolean | null
      honeypot_id?: string | null
      id?: string | null
      review_notes?: string | null
      reviewed_at?: string | null
      reviewed_by?: string | null
      triggered_by?: string | null
    }
    Relationships: []
  }
  job_splits: {
    Row: {
      contract_id: string | null
      created_at: string | null
      created_by: string
      executed_at: string | null
      id: string
      job_id: string | null
      splits: string
      status: string | null
    }
    Insert: {
      contract_id?: string | null
      created_at?: string | null
      created_by?: string | null
      executed_at?: string | null
      id?: string | null
      job_id?: string | null
      splits?: string | null
      status?: string | null
    }
    Update: {
      contract_id?: string | null
      created_at?: string | null
      created_by?: string | null
      executed_at?: string | null
      id?: string | null
      job_id?: string | null
      splits?: string | null
      status?: string | null
    }
    Relationships: []
  }
  memory_packages: {
    Row: {
      active: boolean | null
      created_at: string | null
      description: string | null
      downloads: number | null
      id: string
      job_count: number | null
      price: number
      proof_cids: Json | null
      seller_agent_id: string
      seller_molt_score: number | null
      skill: string
      title: string
      updated_at: string | null
    }
    Insert: {
      active?: boolean | null
      created_at?: string | null
      description?: string | null
      downloads?: number | null
      id?: string | null
      job_count?: number | null
      price?: number | null
      proof_cids?: Json | null
      seller_agent_id?: string | null
      seller_molt_score?: number | null
      skill?: string | null
      title?: string | null
      updated_at?: string | null
    }
    Update: {
      active?: boolean | null
      created_at?: string | null
      description?: string | null
      downloads?: number | null
      id?: string | null
      job_count?: number | null
      price?: number | null
      proof_cids?: Json | null
      seller_agent_id?: string | null
      seller_molt_score?: number | null
      skill?: string | null
      title?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  memory_purchases: {
    Row: {
      buyer_agent_id: string
      created_at: string | null
      id: string
      package_id: string
      price_paid: number
      seller_agent_id: string
    }
    Insert: {
      buyer_agent_id?: string | null
      created_at?: string | null
      id?: string | null
      package_id?: string | null
      price_paid?: number | null
      seller_agent_id?: string | null
    }
    Update: {
      buyer_agent_id?: string | null
      created_at?: string | null
      id?: string | null
      package_id?: string | null
      price_paid?: number | null
      seller_agent_id?: string | null
    }
    Relationships: []
  }
  notifications: {
    Row: {
      action_url: string | null
      agent_id: string | null
      created_at: string | null
      id: string
      message: string
      metadata: string | null
      notification_type: string | null
      priority: string
      read: boolean | null
      read_at: string | null
      sent_email: boolean | null
      sent_in_app: boolean | null
      sent_webhook: boolean | null
      sse_delivered: boolean | null
      title: string
      user_id: string | null
      webhook_delivered: boolean | null
      webhook_delivered_at: string | null
    }
    Insert: {
      action_url?: string | null
      agent_id?: string | null
      created_at?: string | null
      id?: string | null
      message?: string | null
      metadata?: string | null
      notification_type?: string | null
      priority?: string | null
      read?: boolean | null
      read_at?: string | null
      sent_email?: boolean | null
      sent_in_app?: boolean | null
      sent_webhook?: boolean | null
      sse_delivered?: boolean | null
      title?: string | null
      user_id?: string | null
      webhook_delivered?: boolean | null
      webhook_delivered_at?: string | null
    }
    Update: {
      action_url?: string | null
      agent_id?: string | null
      created_at?: string | null
      id?: string | null
      message?: string | null
      metadata?: string | null
      notification_type?: string | null
      priority?: string | null
      read?: boolean | null
      read_at?: string | null
      sent_email?: boolean | null
      sent_in_app?: boolean | null
      sent_webhook?: boolean | null
      sse_delivered?: boolean | null
      title?: string | null
      user_id?: string | null
      webhook_delivered?: boolean | null
      webhook_delivered_at?: string | null
    }
    Relationships: []
  }
  payment_audit_log: {
    Row: {
      actor_id: string | null
      actor_type: string | null
      amount_after: number | null
      amount_before: number | null
      created_at: string | null
      escrow_id: string | null
      event_data: string | null
      event_type: string
      id: string
      job_id: string | null
      stripe_event_id: string | null
      stripe_event_type: string | null
    }
    Insert: {
      actor_id?: string | null
      actor_type?: string | null
      amount_after?: number | null
      amount_before?: number | null
      created_at?: string | null
      escrow_id?: string | null
      event_data?: string | null
      event_type?: string | null
      id?: string | null
      job_id?: string | null
      stripe_event_id?: string | null
      stripe_event_type?: string | null
    }
    Update: {
      actor_id?: string | null
      actor_type?: string | null
      amount_after?: number | null
      amount_before?: number | null
      created_at?: string | null
      escrow_id?: string | null
      event_data?: string | null
      event_type?: string | null
      id?: string | null
      job_id?: string | null
      stripe_event_id?: string | null
      stripe_event_type?: string | null
    }
    Relationships: []
  }
  payment_escrows: {
    Row: {
      amount_locked: number | null
      amount_released: number | null
      amount_total: number
      created_at: string | null
      created_by: string
      currency: string | null
      current_milestone_index: number | null
      dispute_id: string | null
      hirer_id: string
      id: string
      job_id: string
      locked_at: string | null
      milestones: string | null
      platform_fee: number
      refunded_at: string | null
      released_at: string | null
      status: string | null
      stripe_connect_account_id: string | null
      stripe_payment_intent_id: string | null
      stripe_refund_id: string | null
      stripe_transfer_id: string | null
      updated_at: string | null
      worker_id: string | null
    }
    Insert: {
      amount_locked?: number | null
      amount_released?: number | null
      amount_total?: number | null
      created_at?: string | null
      created_by?: string | null
      currency?: string | null
      current_milestone_index?: number | null
      dispute_id?: string | null
      hirer_id?: string | null
      id?: string | null
      job_id?: string | null
      locked_at?: string | null
      milestones?: string | null
      platform_fee?: number | null
      refunded_at?: string | null
      released_at?: string | null
      status?: string | null
      stripe_connect_account_id?: string | null
      stripe_payment_intent_id?: string | null
      stripe_refund_id?: string | null
      stripe_transfer_id?: string | null
      updated_at?: string | null
      worker_id?: string | null
    }
    Update: {
      amount_locked?: number | null
      amount_released?: number | null
      amount_total?: number | null
      created_at?: string | null
      created_by?: string | null
      currency?: string | null
      current_milestone_index?: number | null
      dispute_id?: string | null
      hirer_id?: string | null
      id?: string | null
      job_id?: string | null
      locked_at?: string | null
      milestones?: string | null
      platform_fee?: number | null
      refunded_at?: string | null
      released_at?: string | null
      status?: string | null
      stripe_connect_account_id?: string | null
      stripe_payment_intent_id?: string | null
      stripe_refund_id?: string | null
      stripe_transfer_id?: string | null
      updated_at?: string | null
      worker_id?: string | null
    }
    Relationships: []
  }
  payment_streams: {
    Row: {
      contract_id: string
      created_at: string | null
      credits_per_interval: number
      credits_released: number | null
      hirer_id: string
      id: string
      interval_hours: number
      job_id: string
      next_release_at: string | null
      status: string | null
      total_credits: number
      updated_at: string | null
      worker_id: string
    }
    Insert: {
      contract_id?: string | null
      created_at?: string | null
      credits_per_interval?: number | null
      credits_released?: number | null
      hirer_id?: string | null
      id?: string | null
      interval_hours?: number | null
      job_id?: string | null
      next_release_at?: string | null
      status?: string | null
      total_credits?: number | null
      updated_at?: string | null
      worker_id?: string | null
    }
    Update: {
      contract_id?: string | null
      created_at?: string | null
      credits_per_interval?: number | null
      credits_released?: number | null
      hirer_id?: string | null
      id?: string | null
      interval_hours?: number | null
      job_id?: string | null
      next_release_at?: string | null
      status?: string | null
      total_credits?: number | null
      updated_at?: string | null
      worker_id?: string | null
    }
    Relationships: []
  }
  peer_endorsements: {
    Row: {
      created_at: string
      domain: string
      endorsee_id: string
      endorsement_reason: string | null
      endorsement_weight: number
      endorser_id: string
      id: string
      is_reciprocal: boolean
      reciprocal_within_days: number | null
      revoked_at: string | null
      revoked_reason: string | null
    }
    Insert: {
      created_at?: string | null
      domain?: string | null
      endorsee_id?: string | null
      endorsement_reason?: string | null
      endorsement_weight?: number | null
      endorser_id?: string | null
      id?: string | null
      is_reciprocal?: boolean | null
      reciprocal_within_days?: number | null
      revoked_at?: string | null
      revoked_reason?: string | null
    }
    Update: {
      created_at?: string | null
      domain?: string | null
      endorsee_id?: string | null
      endorsement_reason?: string | null
      endorsement_weight?: number | null
      endorser_id?: string | null
      id?: string | null
      is_reciprocal?: boolean | null
      reciprocal_within_days?: number | null
      revoked_at?: string | null
      revoked_reason?: string | null
    }
    Relationships: []
  }
  recovery_approvals: {
    Row: {
      approved_at: string | null
      decrypted_share: string
      guardian_id: string
      id: string
      recovery_id: string
    }
    Insert: {
      approved_at?: string | null
      decrypted_share?: string | null
      guardian_id?: string | null
      id?: string | null
      recovery_id?: string | null
    }
    Update: {
      approved_at?: string | null
      decrypted_share?: string | null
      guardian_id?: string | null
      id?: string | null
      recovery_id?: string | null
    }
    Relationships: []
  }
  referrals: {
    Row: {
      commission_rate: number | null
      created_at: string | null
      id: string
      referee_id: string | null
      referral_code: string
      referrer_id: string
      registered_at: string | null
      status: string | null
      total_commissioned: number | null
    }
    Insert: {
      commission_rate?: number | null
      created_at?: string | null
      id?: string | null
      referee_id?: string | null
      referral_code?: string | null
      referrer_id?: string | null
      registered_at?: string | null
      status?: string | null
      total_commissioned?: number | null
    }
    Update: {
      commission_rate?: number | null
      created_at?: string | null
      id?: string | null
      referee_id?: string | null
      referral_code?: string | null
      referrer_id?: string | null
      registered_at?: string | null
      status?: string | null
      total_commissioned?: number | null
    }
    Relationships: []
  }
  reputation_recovery: {
    Row: {
      agent_id: string
      completed_at: string | null
      contributions_completed: number | null
      contributions_required: number | null
      created_at: string | null
      current_reputation: number
      expires_at: string | null
      good_behavior_days: number | null
      id: string
      recovery_type: string
      started_at: string | null
      status: string | null
      target_reputation: number
      updated_at: string | null
    }
    Insert: {
      agent_id?: string | null
      completed_at?: string | null
      contributions_completed?: number | null
      contributions_required?: number | null
      created_at?: string | null
      current_reputation?: number | null
      expires_at?: string | null
      good_behavior_days?: number | null
      id?: string | null
      recovery_type?: string | null
      started_at?: string | null
      status?: string | null
      target_reputation?: number | null
      updated_at?: string | null
    }
    Update: {
      agent_id?: string | null
      completed_at?: string | null
      contributions_completed?: number | null
      contributions_required?: number | null
      created_at?: string | null
      current_reputation?: number | null
      expires_at?: string | null
      good_behavior_days?: number | null
      id?: string | null
      recovery_type?: string | null
      started_at?: string | null
      status?: string | null
      target_reputation?: number | null
      updated_at?: string | null
    }
    Relationships: []
  }
  revenue_splits: {
    Row: {
      contract_id: string
      created_at: string | null
      created_by: string
      id: string
      job_id: string | null
      processed_at: string | null
      split_config: string
      status: string | null
      total_credits: number
    }
    Insert: {
      contract_id?: string | null
      created_at?: string | null
      created_by?: string | null
      id?: string | null
      job_id?: string | null
      processed_at?: string | null
      split_config?: string | null
      status?: string | null
      total_credits?: number | null
    }
    Update: {
      contract_id?: string | null
      created_at?: string | null
      created_by?: string | null
      id?: string | null
      job_id?: string | null
      processed_at?: string | null
      split_config?: string | null
      status?: string | null
      total_credits?: number | null
    }
    Relationships: []
  }
  runtime_deployments: {
    Row: {
      agent_id: string
      clawfs_path: string | null
      created_at: string | null
      credits_spent: number | null
      error_message: string | null
      id: string
      last_heartbeat: string | null
      name: string
      started_at: string | null
      status: string | null
      stopped_at: string | null
      yaml_definition: string
    }
    Insert: {
      agent_id?: string | null
      clawfs_path?: string | null
      created_at?: string | null
      credits_spent?: number | null
      error_message?: string | null
      id?: string | null
      last_heartbeat?: string | null
      name?: string | null
      started_at?: string | null
      status?: string | null
      stopped_at?: string | null
      yaml_definition?: string | null
    }
    Update: {
      agent_id?: string | null
      clawfs_path?: string | null
      created_at?: string | null
      credits_spent?: number | null
      error_message?: string | null
      id?: string | null
      last_heartbeat?: string | null
      name?: string | null
      started_at?: string | null
      status?: string | null
      stopped_at?: string | null
      yaml_definition?: string | null
    }
    Relationships: []
  }
  security_violations: {
    Row: {
      action_taken: string | null
      agent_id: string
      created_at: string | null
      details: string | null
      endpoint: string | null
      id: string
      ip_address: string | null
      reviewed: boolean | null
      severity: string
      violation_type: string
    }
    Insert: {
      action_taken?: string | null
      agent_id?: string | null
      created_at?: string | null
      details?: string | null
      endpoint?: string | null
      id?: string | null
      ip_address?: string | null
      reviewed?: boolean | null
      severity?: string | null
      violation_type?: string | null
    }
    Update: {
      action_taken?: string | null
      agent_id?: string | null
      created_at?: string | null
      details?: string | null
      endpoint?: string | null
      id?: string | null
      ip_address?: string | null
      reviewed?: boolean | null
      severity?: string | null
      violation_type?: string | null
    }
    Relationships: []
  }
  signature_shares: {
    Row: {
      agent_id: string
      aggregate_id: string
      created_at: string | null
      id: string
      share: string
      share_index: number
      verified: boolean | null
    }
    Insert: {
      agent_id?: string | null
      aggregate_id?: string | null
      created_at?: string | null
      id?: string | null
      share?: string | null
      share_index?: number | null
      verified?: boolean | null
    }
    Update: {
      agent_id?: string | null
      aggregate_id?: string | null
      created_at?: string | null
      id?: string | null
      share?: string | null
      share_index?: number | null
      verified?: boolean | null
    }
    Relationships: []
  }
  slash_events: {
    Row: {
      arbitra_case_id: string | null
      attestation_id: string | null
      cascade_rate: number | null
      cascade_reputation_after: number | null
      cascade_slash_amount: number | null
      cascade_voucher_id: string | null
      created_at: string | null
      dispute_id: string | null
      evidence_cid: string | null
      id: string
      reason: string
      slashed_by_id: string | null
      slashed_by_type: string | null
      target_id: string
      target_reputation_after: number | null
      target_slash_amount: number
      vouch_id: string | null
    }
    Insert: {
      arbitra_case_id?: string | null
      attestation_id?: string | null
      cascade_rate?: number | null
      cascade_reputation_after?: number | null
      cascade_slash_amount?: number | null
      cascade_voucher_id?: string | null
      created_at?: string | null
      dispute_id?: string | null
      evidence_cid?: string | null
      id?: string | null
      reason?: string | null
      slashed_by_id?: string | null
      slashed_by_type?: string | null
      target_id?: string | null
      target_reputation_after?: number | null
      target_slash_amount?: number | null
      vouch_id?: string | null
    }
    Update: {
      arbitra_case_id?: string | null
      attestation_id?: string | null
      cascade_rate?: number | null
      cascade_reputation_after?: number | null
      cascade_slash_amount?: number | null
      cascade_voucher_id?: string | null
      created_at?: string | null
      dispute_id?: string | null
      evidence_cid?: string | null
      id?: string | null
      reason?: string | null
      slashed_by_id?: string | null
      slashed_by_type?: string | null
      target_id?: string | null
      target_reputation_after?: number | null
      target_slash_amount?: number | null
      vouch_id?: string | null
    }
    Relationships: []
  }
  stripe_connect_accounts: {
    Row: {
      agent_id: string
      charges_enabled: boolean | null
      country: string | null
      created_at: string | null
      default_currency: string | null
      email: string | null
      id: string
      login_link_expires_at: string | null
      login_link_url: string | null
      onboarded_at: string | null
      payouts_enabled: boolean | null
      requirements_due: string | null
      stripe_account_id: string
      updated_at: string | null
    }
    Insert: {
      agent_id?: string | null
      charges_enabled?: boolean | null
      country?: string | null
      created_at?: string | null
      default_currency?: string | null
      email?: string | null
      id?: string | null
      login_link_expires_at?: string | null
      login_link_url?: string | null
      onboarded_at?: string | null
      payouts_enabled?: boolean | null
      requirements_due?: string | null
      stripe_account_id?: string | null
      updated_at?: string | null
    }
    Update: {
      agent_id?: string | null
      charges_enabled?: boolean | null
      country?: string | null
      created_at?: string | null
      default_currency?: string | null
      email?: string | null
      id?: string | null
      login_link_expires_at?: string | null
      login_link_url?: string | null
      onboarded_at?: string | null
      payouts_enabled?: boolean | null
      requirements_due?: string | null
      stripe_account_id?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  tap_score_with_telemetry: {
    Row: {
      agent_id: string | null
      composite_score: number | null
      last_calculated_at: string | null
      tap_score: number | null
      telemetry_date: string | null
      telemetry_net_attestations: number | null
      telemetry_reliability: number | null
      telemetry_success_rate: number | null
      tier: string | null
    }
    Insert: {
      agent_id?: string | null
      composite_score?: number | null
      last_calculated_at?: string | null
      tap_score?: number | null
      telemetry_date?: string | null
      telemetry_net_attestations?: number | null
      telemetry_reliability?: number | null
      telemetry_success_rate?: number | null
      tier?: string | null
    }
    Update: {
      agent_id?: string | null
      composite_score?: number | null
      last_calculated_at?: string | null
      tap_score?: number | null
      telemetry_date?: string | null
      telemetry_net_attestations?: number | null
      telemetry_reliability?: number | null
      telemetry_success_rate?: number | null
      tier?: string | null
    }
    Relationships: []
  }
  v_anomaly_dashboard: {
    Row: {
      agent_id: string | null
      agent_name: string | null
      agent_reputation: number | null
      anomaly_type: string | null
      assigned_to: string | null
      created_at: string | null
      detection_data: string | null
      id: string | null
      investigation_notes: string | null
      related_attestations: Json | null
      related_honeypot_id: string | null
      related_vouches: Json | null
      resolution_type: string | null
      resolved_at: string | null
      resolved_by: string | null
      severity: string | null
      severity_rank: number | null
      status: string | null
      updated_at: string | null
    }
    Insert: {
      agent_id?: string | null
      agent_name?: string | null
      agent_reputation?: number | null
      anomaly_type?: string | null
      assigned_to?: string | null
      created_at?: string | null
      detection_data?: string | null
      id?: string | null
      investigation_notes?: string | null
      related_attestations?: Json | null
      related_honeypot_id?: string | null
      related_vouches?: Json | null
      resolution_type?: string | null
      resolved_at?: string | null
      resolved_by?: string | null
      severity?: string | null
      severity_rank?: number | null
      status?: string | null
      updated_at?: string | null
    }
    Update: {
      agent_id?: string | null
      agent_name?: string | null
      agent_reputation?: number | null
      anomaly_type?: string | null
      assigned_to?: string | null
      created_at?: string | null
      detection_data?: string | null
      id?: string | null
      investigation_notes?: string | null
      related_attestations?: Json | null
      related_honeypot_id?: string | null
      related_vouches?: Json | null
      resolution_type?: string | null
      resolved_at?: string | null
      resolved_by?: string | null
      severity?: string | null
      severity_rank?: number | null
      status?: string | null
      updated_at?: string | null
    }
    Relationships: []
  }
  v_cases_requiring_action: {
    Row: {
      case_type: string | null
      created_at: string | null
      hours_open: number | null
      id: string | null
      reporter_id: string | null
      reporter_name: string | null
      stake_amount: number | null
      status: string | null
      subject_id: string | null
      subject_name: string | null
    }
    Insert: {
      case_type?: string | null
      created_at?: string | null
      hours_open?: number | null
      id?: string | null
      reporter_id?: string | null
      reporter_name?: string | null
      stake_amount?: number | null
      status?: string | null
      subject_id?: string | null
      subject_name?: string | null
    }
    Update: {
      case_type?: string | null
      created_at?: string | null
      hours_open?: number | null
      id?: string | null
      reporter_id?: string | null
      reporter_name?: string | null
      stake_amount?: number | null
      status?: string | null
      subject_id?: string | null
      subject_name?: string | null
    }
    Relationships: []
  }
  v_governance_overview: {
    Row: {
      last_24h: number | null
      metric_type: string | null
      pending: number | null
      resolved: number | null
      total: number | null
    }
    Insert: {
      last_24h?: number | null
      metric_type?: string | null
      pending?: number | null
      resolved?: number | null
      total?: number | null
    }
    Update: {
      last_24h?: number | null
      metric_type?: string | null
      pending?: number | null
      resolved?: number | null
      total?: number | null
    }
    Relationships: []
  }
  vote_confidence_metrics: {
    Row: {
      adjusted_prediction: number | null
      agent_id: string
      brier_score: number | null
      committed_at: string
      committee_weight: number | null
      confidence_reported: number
      created_at: string
      delta: number | null
      dispute_id: string
      dispute_resolved_at: string | null
      domain_match_score: number | null
      final_outcome: boolean | null
      id: string
      information_report: boolean
      information_score: number | null
      outcome_correct: boolean | null
      peer_agent_id: string | null
      prediction_report: number
      prediction_score: number | null
      rbts_score: number | null
      reference_agent_id: string | null
      reputation_delta: number | null
      revealed_at: string
      reward_amount: number | null
      round: number
      selection_method: string | null
      skill_score: number | null
      was_selected_for_committee: boolean
    }
    Insert: {
      adjusted_prediction?: number | null
      agent_id?: string | null
      brier_score?: number | null
      committed_at?: string | null
      committee_weight?: number | null
      confidence_reported?: number | null
      created_at?: string | null
      delta?: number | null
      dispute_id?: string | null
      dispute_resolved_at?: string | null
      domain_match_score?: number | null
      final_outcome?: boolean | null
      id?: string | null
      information_report?: boolean | null
      information_score?: number | null
      outcome_correct?: boolean | null
      peer_agent_id?: string | null
      prediction_report?: number | null
      prediction_score?: number | null
      rbts_score?: number | null
      reference_agent_id?: string | null
      reputation_delta?: number | null
      revealed_at?: string | null
      reward_amount?: number | null
      round?: number | null
      selection_method?: string | null
      skill_score?: number | null
      was_selected_for_committee?: boolean | null
    }
    Update: {
      adjusted_prediction?: number | null
      agent_id?: string | null
      brier_score?: number | null
      committed_at?: string | null
      committee_weight?: number | null
      confidence_reported?: number | null
      created_at?: string | null
      delta?: number | null
      dispute_id?: string | null
      dispute_resolved_at?: string | null
      domain_match_score?: number | null
      final_outcome?: boolean | null
      id?: string | null
      information_report?: boolean | null
      information_score?: number | null
      outcome_correct?: boolean | null
      peer_agent_id?: string | null
      prediction_report?: number | null
      prediction_score?: number | null
      rbts_score?: number | null
      reference_agent_id?: string | null
      reputation_delta?: number | null
      revealed_at?: string | null
      reward_amount?: number | null
      round?: number | null
      selection_method?: string | null
      skill_score?: number | null
      was_selected_for_committee?: boolean | null
    }
    Relationships: []
  }
  wallet_transactions: {
    Row: {
      agent_id: string
      amount: number
      balance_after: number
      created_at: string | null
      description: string | null
      from_agent: string | null
      hold_until: string | null
      id: string
      memo: string | null
      reference_id: string | null
      source_type: string | null
      to_agent: string | null
      type: string
    }
    Insert: {
      agent_id?: string | null
      amount?: number | null
      balance_after?: number | null
      created_at?: string | null
      description?: string | null
      from_agent?: string | null
      hold_until?: string | null
      id?: string | null
      memo?: string | null
      reference_id?: string | null
      source_type?: string | null
      to_agent?: string | null
      type?: string | null
    }
    Update: {
      agent_id?: string | null
      amount?: number | null
      balance_after?: number | null
      created_at?: string | null
      description?: string | null
      from_agent?: string | null
      hold_until?: string | null
      id?: string | null
      memo?: string | null
      reference_id?: string | null
      source_type?: string | null
      to_agent?: string | null
      type?: string | null
    }
    Relationships: []
  }
  webhook_agents: {
    Row: {
      agent_id: string
      capabilities: Json | null
      created_at: string | null
      endpoint_url: string
      error_count: number | null
      id: string
      jobs_completed: number | null
      last_pinged_at: string | null
      max_concurrent: number | null
      min_budget: number | null
      secret: string
      status: string | null
      timeout_seconds: number | null
      updated_at: string | null
    }
    Insert: {
      agent_id?: string | null
      capabilities?: Json | null
      created_at?: string | null
      endpoint_url?: string | null
      error_count?: number | null
      id?: string | null
      jobs_completed?: number | null
      last_pinged_at?: string | null
      max_concurrent?: number | null
      min_budget?: number | null
      secret?: string | null
      status?: string | null
      timeout_seconds?: number | null
      updated_at?: string | null
    }
    Update: {
      agent_id?: string | null
      capabilities?: Json | null
      created_at?: string | null
      endpoint_url?: string | null
      error_count?: number | null
      id?: string | null
      jobs_completed?: number | null
      last_pinged_at?: string | null
      max_concurrent?: number | null
      min_budget?: number | null
      secret?: string | null
      status?: string | null
      timeout_seconds?: number | null
      updated_at?: string | null
    }
    Relationships: []
  }
  webhook_events: {
    Row: {
      created_at: string | null
      error_message: string | null
      event_id: string
      event_type: string
      id: string
      ip_address: string | null
      payload: string
      processed: boolean | null
      processed_at: string | null
      retry_count: number | null
      signature_valid: boolean | null
      source: string
    }
    Insert: {
      created_at?: string | null
      error_message?: string | null
      event_id?: string | null
      event_type?: string | null
      id?: string | null
      ip_address?: string | null
      payload?: string | null
      processed?: boolean | null
      processed_at?: string | null
      retry_count?: number | null
      signature_valid?: boolean | null
      source?: string | null
    }
    Update: {
      created_at?: string | null
      error_message?: string | null
      event_id?: string | null
      event_type?: string | null
      id?: string | null
      ip_address?: string | null
      payload?: string | null
      processed?: boolean | null
      processed_at?: string | null
      retry_count?: number | null
      signature_valid?: boolean | null
      source?: string | null
    }
    Relationships: []
  }
  webhook_subscriptions: {
    Row: {
      active: boolean
      agent_id: string
      created_at: string | null
      delivery_failures: number | null
      events: Json | null
      id: string
      last_delivered_at: string | null
      secret: string
      url: string
    }
    Insert: {
      active?: boolean | null
      agent_id?: string | null
      created_at?: string | null
      delivery_failures?: number | null
      events?: Json | null
      id?: string | null
      last_delivered_at?: string | null
      secret?: string | null
      url?: string | null
    }
    Update: {
      active?: boolean | null
      agent_id?: string | null
      created_at?: string | null
      delivery_failures?: number | null
      events?: Json | null
      id?: string | null
      last_delivered_at?: string | null
      secret?: string | null
      url?: string | null
    }
    Relationships: []
  }
  withdrawals: {
    Row: {
      agent_id: string
      amount: number
      completed_at: string | null
      crypto_address: string | null
      crypto_currency: string | null
      currency: string
      fee: number | null
      id: string
      metadata: string | null
      method: string
      net_amount: number
      requested_at: string | null
      retry_count: number | null
      status: string
      stripe_transfer_id: string | null
      tx_hash: string | null
    }
    Insert: {
      agent_id?: string | null
      amount?: number | null
      completed_at?: string | null
      crypto_address?: string | null
      crypto_currency?: string | null
      currency?: string | null
      fee?: number | null
      id?: string | null
      metadata?: string | null
      method?: string | null
      net_amount?: number | null
      requested_at?: string | null
      retry_count?: number | null
      status?: string | null
      stripe_transfer_id?: string | null
      tx_hash?: string | null
    }
    Update: {
      agent_id?: string | null
      amount?: number | null
      completed_at?: string | null
      crypto_address?: string | null
      crypto_currency?: string | null
      currency?: string | null
      fee?: number | null
      id?: string | null
      metadata?: string | null
      method?: string | null
      net_amount?: number | null
      requested_at?: string | null
      retry_count?: number | null
      status?: string | null
      stripe_transfer_id?: string | null
      tx_hash?: string | null
    }
    Relationships: []
  }
  wot_config: {
    Row: {
      activation_threshold: number | null
      appeal_bond_amount: number | null
      appeal_window_days: number | null
      attestation_half_life_days: number | null
      bls_verification_enabled: boolean | null
      cascade_penalty_rate: number | null
      collusion_depth_threshold: number | null
      escrow_hold_days: number | null
      evidence_lock_hours: number | null
      genesis_immunity: boolean | null
      honeypot_auto_file_dispute: boolean | null
      honeypot_detection_enabled: boolean | null
      id: number
      initial_reputation: number | null
      max_attestation_age_days: number | null
      max_escrow_amount: number | null
      max_evidence_items: number | null
      max_evidence_size_mb: number | null
      max_genesis_agents: number | null
      max_stake_amount: number | null
      min_escrow_amount: number | null
      min_reputation_after_slash: number | null
      min_stake_amount: number | null
      min_vouch_reputation: number | null
      min_vouches_needed: number | null
      platform_fee_percent: number | null
      rapid_attestation_threshold: number | null
      reputation_grab_threshold: number | null
      sybil_time_window_minutes: number | null
      updated_at: string | null
      updated_by: string | null
    }
    Insert: {
      activation_threshold?: number | null
      appeal_bond_amount?: number | null
      appeal_window_days?: number | null
      attestation_half_life_days?: number | null
      bls_verification_enabled?: boolean | null
      cascade_penalty_rate?: number | null
      collusion_depth_threshold?: number | null
      escrow_hold_days?: number | null
      evidence_lock_hours?: number | null
      genesis_immunity?: boolean | null
      honeypot_auto_file_dispute?: boolean | null
      honeypot_detection_enabled?: boolean | null
      id?: number | null
      initial_reputation?: number | null
      max_attestation_age_days?: number | null
      max_escrow_amount?: number | null
      max_evidence_items?: number | null
      max_evidence_size_mb?: number | null
      max_genesis_agents?: number | null
      max_stake_amount?: number | null
      min_escrow_amount?: number | null
      min_reputation_after_slash?: number | null
      min_stake_amount?: number | null
      min_vouch_reputation?: number | null
      min_vouches_needed?: number | null
      platform_fee_percent?: number | null
      rapid_attestation_threshold?: number | null
      reputation_grab_threshold?: number | null
      sybil_time_window_minutes?: number | null
      updated_at?: string | null
      updated_by?: string | null
    }
    Update: {
      activation_threshold?: number | null
      appeal_bond_amount?: number | null
      appeal_window_days?: number | null
      attestation_half_life_days?: number | null
      bls_verification_enabled?: boolean | null
      cascade_penalty_rate?: number | null
      collusion_depth_threshold?: number | null
      escrow_hold_days?: number | null
      evidence_lock_hours?: number | null
      genesis_immunity?: boolean | null
      honeypot_auto_file_dispute?: boolean | null
      honeypot_detection_enabled?: boolean | null
      id?: number | null
      initial_reputation?: number | null
      max_attestation_age_days?: number | null
      max_escrow_amount?: number | null
      max_evidence_items?: number | null
      max_evidence_size_mb?: number | null
      max_genesis_agents?: number | null
      max_stake_amount?: number | null
      min_escrow_amount?: number | null
      min_reputation_after_slash?: number | null
      min_stake_amount?: number | null
      min_vouch_reputation?: number | null
      min_vouches_needed?: number | null
      platform_fee_percent?: number | null
      rapid_attestation_threshold?: number | null
      reputation_grab_threshold?: number | null
      sybil_time_window_minutes?: number | null
      updated_at?: string | null
      updated_by?: string | null
    }
    Relationships: []
  }
}

// Extended RPCs not in generated types
export interface ExtendedFunctions {
  select_committee: {
    Args: {
      p_dispute_id: string
      p_required_expertise: string
      p_committee_size: number
    }
    Returns: Json
  }
  create_escrow_with_milestones: {
    Args: {
      p_job_id: string
      p_hirer_id: string
      p_worker_id: string
      p_amount: number
      p_milestones: Json
    }
    Returns: string
  }
  update_molt_score: {
    Args: {
      p_agent_id: string
      p_delta: number
      p_reason: string
    }
    Returns: Json
  }
  slash_agent: {
    Args: {
      p_agent_id: string
      p_amount: number
      p_reason: string
    }
    Returns: Json
  }
  recover_agent: {
    Args: {
      p_agent_id: string
    }
    Returns: Json
  }
  detect_honeypot_trigger: {
    Args: {
      p_triggering_agent: string
      p_honeypot_id: string
      p_action_type: string
    }
    Returns: Json
  }
  trigger_honeypot: {
    Args: {
      p_honeypot_id: string
      p_triggered_by: string
      p_evidence: Json
    }
    Returns: Json
  }
  resolve_dispute: {
    Args: {
      p_dispute_id: string
      p_resolution: string
      p_reason: string
      p_resolved_by: string
      p_slash_amount: number
    }
    Returns: Json
  }
  get_appeal: {
    Args: {
      p_appeal_id: string
    }
    Returns: Json
  }
  force_resolve_appeal: {
    Args: {
      p_appeal_id: string
      p_resolver_id: string
      p_force_result: string
    }
    Returns: Json
  }
  cast_appeal_vote: {
    Args: {
      p_appeal_id: string
      p_voter_id: string
      p_vote_type: string
    }
    Returns: Json
  }
  detect_ring: {
    Args: {
      p_window_hours: number
      p_threshold: number
    }
    Returns: Json
  }
  analyze_network: {
    Args: {
      p_agent_id: string
      p_depth: number
    }
    Returns: Json
  }
  record_telemetry: {
    Args: {
      p_agent_id: string
      p_window_start: string
      p_window_end: string
      p_tasks_attempted: number
      p_tasks_completed: number
      p_tasks_failed: number
      p_avg_task_duration_ms: number
      p_avg_reward_per_task: number
      p_uptime_pct: number
      p_specialization_entropy: number
      p_custom_metrics: Json
    }
    Returns: Json
  }
  get_telemetry_history: {
    Args: {
      p_agent_id: string
      p_days: number
    }
    Returns: Json
  }
  get_leaderboard: {
    Args: {
      p_limit: number
      p_min_tasks: number
    }
    Returns: Json
  }
  create_evidence_bucket: {
    Args: {
      p_bucket_type: string
      p_related_id: string
      p_owner_id: string
    }
    Returns: Json
  }
  update_deployment_status: {
    Args: {
      p_deployment_id: string
      p_status: string
    }
    Returns: Json
  }
  log_deployment: {
    Args: {
      p_deployment_id: string
      p_level: string
      p_message: string
    }
    Returns: Json
  }
  update_molt_slash: {
    Args: {
      p_agent_id: string
      p_amount: number
      p_reason: string
    }
    Returns: Json
  }
  update_molt_reward: {
    Args: {
      p_agent_id: string
      p_amount: number
      p_reason: string
    }
    Returns: Json
  }
}

// Convenience type for typed Supabase client — use this in function params
// instead of ReturnType<typeof createClient<ExtendedDatabase>> which collapses in TS
// Helper: extended Database type merging base + extensions
// Uses a mapped type to ensure all tables/functions satisfy GenericSchema constraints
// while preserving full type information.
export type ExtendedDatabase = {
  __InternalSupabase: BaseDatabase['__InternalSupabase']
  public: {
    // Mapped type coerces each table to satisfy GenericTable while keeping full Row type
    Tables: {
      [K in keyof (BaseDatabase['public']['Tables'] & ExtendedTables)]: {
        Row: (BaseDatabase['public']['Tables'] & ExtendedTables)[K]['Row']
        Insert: (BaseDatabase['public']['Tables'] & ExtendedTables)[K] extends { Insert: any } ? (BaseDatabase['public']['Tables'] & ExtendedTables)[K]['Insert'] : Partial<(BaseDatabase['public']['Tables'] & ExtendedTables)[K]['Row']>
        Update: (BaseDatabase['public']['Tables'] & ExtendedTables)[K] extends { Update: any } ? (BaseDatabase['public']['Tables'] & ExtendedTables)[K]['Update'] : Partial<(BaseDatabase['public']['Tables'] & ExtendedTables)[K]['Row']>
        Relationships: readonly any[]
      }
    }
    Views: {
      [K in keyof BaseDatabase['public']['Views']]: {
        Row: BaseDatabase['public']['Views'][K]['Row']
        Relationships: readonly any[]
      }
    }
    Functions: {
      [K in keyof (BaseDatabase['public']['Functions'] & ExtendedFunctions)]: {
        Args: (BaseDatabase['public']['Functions'] & ExtendedFunctions)[K] extends { Args: any } ? (BaseDatabase['public']['Functions'] & ExtendedFunctions)[K]['Args'] : Record<string, unknown>
        Returns: (BaseDatabase['public']['Functions'] & ExtendedFunctions)[K] extends { Returns: any } ? (BaseDatabase['public']['Functions'] & ExtendedFunctions)[K]['Returns'] : unknown
      }
    }
    Enums: BaseDatabase['public']['Enums']
    CompositeTypes: BaseDatabase['public']['CompositeTypes']
  }
}

// ─── Typed Supabase Client ─────────────────────────────────────────────────
import { createClient as _createClient, SupabaseClient } from '@supabase/supabase-js'

// TypedSupabaseClient: uses 'any' internally to bypass TypeScript's GenericSchema
// distributive check on large intersection types, while exposing ExtendedDatabase
// types for .from() calls via explicit cast to SupabaseClient<any>.
// The .from() method on SupabaseClient<any> returns properly typed results.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TypedClient = SupabaseClient<any>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTypedClient(url: string, key: string, options?: Parameters<typeof _createClient>[2]): TypedClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return _createClient<any>(url, key, options)
}

// Convenience alias — use in function params instead of ReturnType<typeof createClient<ExtendedDatabase>>
import type { SupabaseClient as _SC } from '@supabase/supabase-js'
export type TypedSupabaseClient = _SC<ExtendedDatabase>
