/**
 * TypeScript types for TAP Committee Intelligence
 * Addresses task difficulty bias identified by agent_anthropo
 */

// Task categories (6 top-level from taxonomy research)
export type taskCategory = 
  | 'software'
  | 'infrastructure'
  | 'data_analytics'
  | 'creative'
  | 'research'
  | 'administrative';

// Expertise domains (includes sub-specializations)
export type expertiseDomain =
  | 'software'
  | 'infrastructure'
  | 'data_analytics'
  | 'creative'
  | 'research'
  | 'administrative'
  | 'defi_tokenomics'
  | 'technical_architecture'
  | 'legal_compliance'
  | 'governance_operations'
  | 'market_strategy';

// Coordination complexity types
export type coordinationType = 
  | 'single'
  | 'sequential'
  | 'parallel'
  | 'dynamic';

// Committee member tiers
export type committeeTier =
  | 'observer'
  | 'probationary'
  | 'full_member'
  | 'senior_expert'
  | 'committee_lead';

// Committee selection methods
export type selectionMethod =
  | 'rbts'
  | 'expertise_weighted'
  | 'random'
  | 'manual';

// Complexity classification result
export interface DisputeComplexityScore {
  id: string;
  dispute_id: string;
  primary_category: taskCategory;
  secondary_category: taskCategory | null;
  classification_confidence: number;
  evidence_objectivity: number;
  domain_expertise_required: number;
  specification_clarity: number;
  stakeholder_count: number;
  task_decomposition_depth: number;
  coordination_complexity: coordinationType | null;
  is_novel_precedent: boolean;
  value_at_stake_usd: number | null;
  time_pressure_hours: number | null;
  difficulty_rating: number; // 1-5
  classification_method: 'auto' | 'manual' | 'hybrid';
  classified_at: string;
  classified_by: string | null;
  created_at: string;
  updated_at: string;
}

// Committee expertise profile
export interface CommitteeExpertiseProfile {
  id: string;
  agent_id: string;
  domain: expertiseDomain;
  accuracy_component: number; // 35%
  calibration_component: number; // 25%
  stake_component: number; // 15%
  peer_endorsement_component: number; // 15%
  temporal_activity_component: number; // 10%
  expertise_score: number; // calculated composite
  imported_from_domain: expertiseDomain | null;
  import_attestation_quality: number | null;
  current_tier: committeeTier;
  tier_promoted_at: string | null;
  judgments_count: number;
  resolved_judgments_count: number;
  correct_judgments_count: number;
  accuracy_rate: number | null;
  brier_skill_score: number | null;
  ece_score: number | null; // Expected Calibration Error
  overconfidence_index: number | null;
  staked_amount: number;
  slashing_count: number;
  last_slash_at: string | null;
  last_judgment_at: string | null;
  judgments_this_month: number;
  activity_decay_factor: number;
  is_fast_track: boolean;
  mentor_id: string | null;
  created_at: string;
  updated_at: string;
}

// RBTS vote tracking
export interface VoteConfidenceMetric {
  id: string;
  dispute_id: string;
  agent_id: string;
  round: number;
  information_report: boolean; // actual vote
  prediction_report: number; // expected approval rate
  confidence_reported: number;
  reference_agent_id: string | null;
  peer_agent_id: string | null;
  delta: number | null;
  adjusted_prediction: number | null;
  information_score: number | null;
  prediction_score: number | null;
  rbts_score: number | null;
  was_selected_for_committee: boolean;
  selection_method: selectionMethod | null;
  committee_weight: number | null;
  domain_match_score: number | null;
  committed_at: string;
  revealed_at: string;
  dispute_resolved_at: string | null;
  final_outcome: boolean | null;
  outcome_correct: boolean | null;
  brier_score: number | null;
  skill_score: number | null;
  reputation_delta: number | null;
  reward_amount: number | null;
  created_at: string;
}

// Committee assignment snapshot
export interface CommitteeAssignment {
  id: string;
  dispute_id: string;
  round: number;
  agent_id: string;
  selection_method: selectionMethod;
  rbts_rank: number | null;
  expertise_score_at_selection: number;
  domain_match_score: number | null;
  voting_weight: number;
  vote_cast: boolean | null;
  confidence_at_vote: number | null;
  vote_timestamp: string | null;
  selected_at: string;
}

// Expertise history entry
export interface ExpertiseHistoryEntry {
  id: string;
  agent_id: string;
  domain: expertiseDomain;
  dispute_id: string;
  vote_cast: boolean;
  confidence_reported: number;
  stake_at_time: number;
  final_outcome: boolean;
  was_correct: boolean;
  brier_score: number;
  skill_score: number | null;
  reputation_delta: number;
  reward_amount: number | null;
  slash_amount: number | null;
  difficulty_rating: number | null;
  primary_category: taskCategory | null;
  created_at: string;
}

// Peer endorsement
export interface PeerEndorsement {
  id: string;
  endorser_id: string;
  endorsee_id: string;
  domain: expertiseDomain;
  endorsement_weight: number;
  endorsement_reason: string | null;
  is_reciprocal: boolean;
  reciprocal_within_days: number | null;
  created_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

// Calibration result
export interface CalibrationResult {
  ece: number; // Expected Calibration Error
  brier_avg: number;
  overconfidence_index: number;
  calibration_tier: 'excellent' | 'good' | 'fair' | 'poor' | 'insufficient_data';
  recommended_action: string;
}

// Committee selection result
export interface CommitteeSelectionResult {
  agent_id: string;
  voting_weight: number;
  selection_reason: string;
  rbts_rank: number;
  domain_match_score: number;
}

// Collusion detection result
export interface CollusionCluster {
  agent_1_id: string;
  agent_2_id: string;
  correlation_score: number;
  votes_together: number;
  suspicion_level: 'critical' | 'high' | 'medium' | 'low';
}
