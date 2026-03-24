-- Migration 026: TAP Committee Intelligence (FIXED for PostgreSQL syntax)
-- Removed IF NOT EXISTS from CREATE TYPE (not supported in PostgreSQL)

-- 1. DISPUTE COMPLEXITY CLASSIFICATION
CREATE TYPE task_category AS ENUM (
  'software', 'infrastructure', 'data_analytics', 
  'creative', 'research', 'administrative'
);

CREATE TYPE coordination_type AS ENUM (
  'single', 'sequential', 'parallel', 'dynamic'
);

CREATE TABLE dispute_complexity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  primary_category task_category NOT NULL,
  secondary_category task_category,
  classification_confidence FLOAT NOT NULL CHECK (classification_confidence BETWEEN 0 AND 1),
  evidence_objectivity FLOAT NOT NULL CHECK (evidence_objectivity BETWEEN 0 AND 1),
  domain_expertise_required FLOAT NOT NULL CHECK (domain_expertise_required BETWEEN 0 AND 1),
  specification_clarity FLOAT NOT NULL CHECK (specification_clarity BETWEEN 0 AND 1),
  stakeholder_count INTEGER NOT NULL DEFAULT 2,
  task_decomposition_depth INTEGER NOT NULL DEFAULT 1,
  coordination_complexity coordination_type,
  is_novel_precedent BOOLEAN NOT NULL DEFAULT false,
  value_at_stake_usd INTEGER,
  time_pressure_hours INTEGER,
  difficulty_rating INTEGER NOT NULL CHECK (difficulty_rating BETWEEN 1 AND 5),
  classification_method TEXT NOT NULL DEFAULT 'auto' 
    CHECK (classification_method IN ('auto', 'manual', 'hybrid')),
  classified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  classified_by UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dispute_id)
);

CREATE INDEX idx_complexity_dispute ON dispute_complexity_scores(dispute_id);
CREATE INDEX idx_complexity_category_difficulty ON dispute_complexity_scores(primary_category, difficulty_rating);
CREATE INDEX idx_complexity_evidence ON dispute_complexity_scores(evidence_objectivity);
CREATE INDEX idx_complexity_classified_at ON dispute_complexity_scores(classified_at DESC);

-- 2. COMMITTEE EXPERTISE PROFILES
CREATE TYPE expertise_domain AS ENUM (
  'software', 'infrastructure', 'data_analytics', 'creative',
  'research', 'administrative', 'defi_tokenomics', 'technical_architecture',
  'legal_compliance', 'governance_operations', 'market_strategy'
);

CREATE TYPE committee_tier AS ENUM (
  'observer', 'probationary', 'full_member', 'senior_expert', 'committee_lead'
);

CREATE TABLE committee_expertise_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  domain expertise_domain NOT NULL,
  accuracy_component FLOAT NOT NULL DEFAULT 0 CHECK (accuracy_component BETWEEN 0 AND 1),
  calibration_component FLOAT NOT NULL DEFAULT 0 CHECK (calibration_component BETWEEN 0 AND 1),
  stake_component FLOAT NOT NULL DEFAULT 0 CHECK (stake_component BETWEEN 0 AND 1),
  peer_endorsement_component FLOAT NOT NULL DEFAULT 0 CHECK (peer_endorsement_component BETWEEN 0 AND 1),
  temporal_activity_component FLOAT NOT NULL DEFAULT 0 CHECK (temporal_activity_component BETWEEN 0 AND 1),
  expertise_score FLOAT GENERATED ALWAYS AS (
    (accuracy_component * 0.35) + 
    (calibration_component * 0.25) + 
    (stake_component * 0.15) + 
    (peer_endorsement_component * 0.15) + 
    (temporal_activity_component * 0.10)
  ) STORED,
  imported_from_domain expertise_domain,
  import_attestation_quality FLOAT CHECK (import_attestation_quality BETWEEN 0 AND 1),
  current_tier committee_tier NOT NULL DEFAULT 'observer',
  tier_promoted_at TIMESTAMPTZ,
  judgments_count INTEGER NOT NULL DEFAULT 0,
  resolved_judgments_count INTEGER NOT NULL DEFAULT 0,
  correct_judgments_count INTEGER NOT NULL DEFAULT 0,
  accuracy_rate FLOAT,
  brier_skill_score FLOAT,
  ece_score FLOAT,
  overconfidence_index FLOAT,
  staked_amount BIGINT NOT NULL DEFAULT 0,
  slashing_count INTEGER NOT NULL DEFAULT 0,
  last_slash_at TIMESTAMPTZ,
  last_judgment_at TIMESTAMPTZ,
  judgments_this_month INTEGER NOT NULL DEFAULT 0,
  activity_decay_factor FLOAT NOT NULL DEFAULT 1.0,
  is_fast_track BOOLEAN NOT NULL DEFAULT false,
  mentor_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, domain)
);

CREATE INDEX idx_expertise_agent ON committee_expertise_profiles(agent_id);
CREATE INDEX idx_expertise_domain_score ON committee_expertise_profiles(domain, expertise_score DESC);
CREATE INDEX idx_expertise_tier ON committee_expertise_profiles(current_tier, domain);
CREATE INDEX idx_expertise_active ON committee_expertise_profiles(last_judgment_at DESC);

-- 3. VOTE CONFIDENCE METRICS
CREATE TABLE vote_confidence_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  information_report BOOLEAN NOT NULL,
  prediction_report FLOAT NOT NULL CHECK (prediction_report BETWEEN 0 AND 1),
  confidence_reported FLOAT NOT NULL CHECK (confidence_reported BETWEEN 0 AND 1),
  reference_agent_id UUID REFERENCES agents(id),
  peer_agent_id UUID REFERENCES agents(id),
  delta FLOAT,
  adjusted_prediction FLOAT,
  information_score FLOAT,
  prediction_score FLOAT,
  rbts_score FLOAT,
  was_selected_for_committee BOOLEAN NOT NULL DEFAULT false,
  selection_method TEXT CHECK (selection_method IN ('rbts', 'expertise_weighted', 'random', 'manual')),
  committee_weight FLOAT,
  domain_match_score FLOAT,
  committed_at TIMESTAMPTZ NOT NULL,
  revealed_at TIMESTAMPTZ NOT NULL,
  dispute_resolved_at TIMESTAMPTZ,
  final_outcome BOOLEAN,
  outcome_correct BOOLEAN,
  brier_score FLOAT,
  skill_score FLOAT,
  reputation_delta FLOAT,
  reward_amount BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dispute_id, agent_id, round)
);

CREATE INDEX idx_vote_metrics_dispute ON vote_confidence_metrics(dispute_id, round);
CREATE INDEX idx_vote_metrics_agent ON vote_confidence_metrics(agent_id, created_at DESC);
CREATE INDEX idx_vote_metrics_rbts ON vote_confidence_metrics(rbts_score DESC);
CREATE INDEX idx_vote_metrics_correct ON vote_confidence_metrics(outcome_correct) 
  WHERE outcome_correct IS NOT NULL;

-- 4. EXPERTISE HISTORY
CREATE TABLE expertise_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  domain expertise_domain NOT NULL,
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  vote_cast BOOLEAN NOT NULL,
  confidence_reported FLOAT NOT NULL CHECK (confidence_reported BETWEEN 0 AND 1),
  stake_at_time BIGINT NOT NULL,
  final_outcome BOOLEAN NOT NULL,
  was_correct BOOLEAN NOT NULL,
  brier_score FLOAT NOT NULL,
  skill_score FLOAT,
  reputation_delta FLOAT NOT NULL,
  reward_amount BIGINT,
  slash_amount BIGINT,
  difficulty_rating INTEGER,
  primary_category task_category,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_history_agent_domain ON expertise_history(agent_id, domain, created_at DESC);
CREATE INDEX idx_history_calibration ON expertise_history(agent_id, confidence_reported, was_correct);
CREATE INDEX idx_history_brier ON expertise_history(agent_id, brier_score);

-- 5. PEER ENDORSEMENTS
CREATE TABLE peer_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  endorsee_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  domain expertise_domain NOT NULL,
  endorsement_weight FLOAT NOT NULL DEFAULT 1.0 CHECK (endorsement_weight BETWEEN 0 AND 1),
  endorsement_reason TEXT,
  is_reciprocal BOOLEAN NOT NULL DEFAULT false,
  reciprocal_within_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  UNIQUE(endorser_id, endorsee_id, domain)
);

CREATE INDEX idx_endorsements_endorsee ON peer_endorsements(endorsee_id, domain);
CREATE INDEX idx_endorsements_endorser ON peer_endorsements(endorser_id, created_at DESC);
CREATE INDEX idx_endorsements_active ON peer_endorsements(endorsee_id, domain) 
  WHERE revoked_at IS NULL;

-- 6. COMMITTEE ASSIGNMENTS
CREATE TYPE selection_method_type AS ENUM ('rbts', 'expertise_weighted', 'random', 'manual');

CREATE TABLE committee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  selection_method selection_method_type NOT NULL DEFAULT 'rbts',
  rbts_rank INTEGER,
  expertise_score_at_selection FLOAT NOT NULL,
  domain_match_score FLOAT,
  voting_weight FLOAT NOT NULL DEFAULT 1.0,
  vote_cast BOOLEAN,
  confidence_at_vote FLOAT,
  vote_timestamp TIMESTAMPTZ,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(dispute_id, round, agent_id)
);

CREATE INDEX idx_committee_dispute ON committee_assignments(dispute_id, round);
CREATE INDEX idx_committee_agent ON committee_assignments(agent_id, selected_at DESC);
CREATE INDEX idx_committee_method ON committee_assignments(selection_method);

-- RPC FUNCTIONS
CREATE OR REPLACE FUNCTION select_committee(
  p_dispute_id UUID,
  p_committee_size INTEGER DEFAULT 7,
  p_target_domain expertise_domain DEFAULT NULL
)
RETURNS TABLE(agent_id UUID, voting_weight FLOAT, selection_reason TEXT, rbts_rank INTEGER, domain_match_score FLOAT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_primary_category task_category;
  v_difficulty_rating INTEGER;
  v_target expertise_domain;
BEGIN
  SELECT primary_category, difficulty_rating
  INTO v_primary_category, v_difficulty_rating
  FROM dispute_complexity_scores
  WHERE dispute_id = p_dispute_id;
  
  IF p_target_domain IS NOT NULL THEN
    v_target := p_target_domain;
  ELSE
    v_target := CASE v_primary_category
      WHEN 'software' THEN 'technical_architecture'::expertise_domain
      WHEN 'infrastructure' THEN 'infrastructure'::expertise_domain
      WHEN 'data_analytics' THEN 'data_analytics'::expertise_domain
      WHEN 'creative' THEN 'creative'::expertise_domain
      WHEN 'research' THEN 'research'::expertise_domain
      WHEN 'administrative' THEN 'governance_operations'::expertise_domain
    END;
  END IF;
  
  RETURN QUERY
  WITH qualified_agents AS (
    SELECT 
      cep.agent_id,
      cep.expertise_score,
      cep.accuracy_component,
      cep.calibration_component,
      cep.judgments_count,
      cep.ece_score,
      CASE 
        WHEN cep.domain = v_target THEN 1.0
        WHEN (cep.domain IN ('technical_architecture', 'software', 'infrastructure') 
              AND v_target IN ('technical_architecture', 'software', 'infrastructure')) THEN 0.6
        WHEN (cep.domain IN ('data_analytics', 'research') 
              AND v_target IN ('data_analytics', 'research')) THEN 0.6
        WHEN cep.imported_from_domain = v_target THEN 0.4
        ELSE 0.2
      END as domain_match,
      COALESCE(
        (SELECT AVG(rbts_score) 
         FROM vote_confidence_metrics vcm 
         WHERE vcm.agent_id = cep.agent_id 
           AND vcm.created_at > now() - interval '30 days'),
        0
      ) as recent_rbts_avg
    FROM committee_expertise_profiles cep
    WHERE cep.current_tier IN ('full_member', 'senior_expert', 'committee_lead')
      AND cep.judgments_count >= 10
      AND (cep.ece_score IS NULL OR cep.ece_score < 0.25)
    ORDER BY cep.expertise_score DESC
    LIMIT 50
  ),
  scored AS (
    SELECT 
      qa.*,
      (qa.expertise_score * 0.4 + 
       COALESCE(qa.recent_rbts_avg / 2.0, 0) * 0.3 + 
       qa.domain_match * 0.2 +
       CASE WHEN qa.ece_score IS NULL THEN 0.5 ELSE (1.0 - qa.ece_score) * 0.1 END
      ) as composite_score,
      ROW_NUMBER() OVER (ORDER BY qa.expertise_score DESC) as expertise_rank
    FROM qualified_agents qa
  )
  SELECT 
    s.agent_id,
    s.composite_score::FLOAT as voting_weight,
    CASE 
      WHEN s.expertise_rank <= 3 THEN 'Top-tier expertise'
      WHEN s.domain_match >= 0.8 THEN 'Strong domain match'
      WHEN s.recent_rbts_avg > 1.0 THEN 'High RBTS performance'
      ELSE 'Qualified generalist'
    END::TEXT as selection_reason,
    s.expertise_rank::INTEGER as rbts_rank,
    s.domain_match::FLOAT as domain_match_score
  FROM scored s
  ORDER BY s.composite_score DESC
  LIMIT p_committee_size;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_calibration(
  p_agent_id UUID,
  p_domain expertise_domain,
  p_lookback_days INTEGER DEFAULT 90
)
RETURNS TABLE(ece FLOAT, brier_avg FLOAT, overconfidence_index FLOAT, calibration_tier TEXT, recommended_action TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_ece FLOAT;
  v_brier FLOAT;
  v_overconf FLOAT;
  v_avg_accuracy FLOAT;
  v_avg_confidence FLOAT;
BEGIN
  SELECT 
    AVG(brier_score),
    AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END),
    AVG(confidence_reported)
  INTO v_brier, v_avg_accuracy, v_avg_confidence
  FROM expertise_history
  WHERE agent_id = p_agent_id
    AND domain = p_domain
    AND created_at > now() - (p_lookback_days || ' days')::interval;
  
  WITH bins AS (
    SELECT 
      CASE 
        WHEN confidence_reported < 0.2 THEN 0.1
        WHEN confidence_reported < 0.4 THEN 0.3
        WHEN confidence_reported < 0.6 THEN 0.5
        WHEN confidence_reported < 0.8 THEN 0.7
        ELSE 0.9
      END as bin_center,
      AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END) as bin_accuracy,
      COUNT(*) as bin_count
    FROM expertise_history
    WHERE agent_id = p_agent_id
      AND domain = p_domain
      AND created_at > now() - (p_lookback_days || ' days')::interval
    GROUP BY 1
  )
  SELECT SUM(ABS(bin_accuracy - bin_center) * bin_count) / NULLIF(SUM(bin_count), 0)
  INTO v_ece
  FROM bins;
  
  v_overconf := COALESCE(v_avg_confidence - v_avg_accuracy, 0);
  
  RETURN QUERY
  SELECT 
    COALESCE(v_ece, 0.5)::FLOAT as ece,
    COALESCE(v_brier, 0.25)::FLOAT as brier_avg,
    v_overconf::FLOAT as overconfidence_index,
    CASE 
      WHEN v_ece IS NULL THEN 'insufficient_data'::TEXT
      WHEN v_ece < 0.05 THEN 'excellent'::TEXT
      WHEN v_ece < 0.15 THEN 'good'::TEXT
      WHEN v_ece < 0.25 THEN 'fair'::TEXT
      ELSE 'poor'::TEXT
    END as calibration_tier,
    CASE 
      WHEN v_overconf > 0.10 THEN 'Reduce confidence on uncertain predictions'::TEXT
      WHEN v_ece > 0.25 THEN 'Complete calibration training module'::TEXT
      WHEN v_ece < 0.05 THEN 'Eligible for senior expert promotion'::TEXT
      ELSE 'Maintain current practices'::TEXT
    END as recommended_action;
END;
$$;
