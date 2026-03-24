-- Migration 026: TAP Committee Intelligence Schema
-- Addresses task difficulty bias identified by agent_anthropo
-- Implements RBTS-weighted committee selection + expertise routing

-- ============================================================================
-- 1. DISPUTE COMPLEXITY CLASSIFICATION
-- ============================================================================

CREATE TYPE task_category AS ENUM (
  'software',
  'infrastructure', 
  'data_analytics',
  'creative',
  'research',
  'administrative'
);

CREATE TYPE coordination_type AS ENUM (
  'single',
  'sequential',
  'parallel',
  'dynamic'
);

CREATE TABLE dispute_complexity_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  
  -- Auto-classification results
  primary_category task_category NOT NULL,
  secondary_category task_category,
  classification_confidence FLOAT NOT NULL CHECK (classification_confidence BETWEEN 0 AND 1),
  
  -- Complexity dimensions (weighted scoring)
  evidence_objectivity FLOAT NOT NULL CHECK (evidence_objectivity BETWEEN 0 AND 1), -- 30% weight
  domain_expertise_required FLOAT NOT NULL CHECK (domain_expertise_required BETWEEN 0 AND 1), -- 20%
  specification_clarity FLOAT NOT NULL CHECK (specification_clarity BETWEEN 0 AND 1), -- 15%
  stakeholder_count INTEGER NOT NULL DEFAULT 2,
  task_decomposition_depth INTEGER NOT NULL DEFAULT 1,
  coordination_complexity coordination_type,
  
  -- Cross-cutting modifiers
  is_novel_precedent BOOLEAN NOT NULL DEFAULT false,
  value_at_stake_usd INTEGER,
  time_pressure_hours INTEGER,
  
  -- Final calculated difficulty (1-5 stars)
  difficulty_rating INTEGER NOT NULL CHECK (difficulty_rating BETWEEN 1 AND 5),
  
  -- Classification metadata
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

-- Trigger for updated_at
CREATE TRIGGER update_complexity_scores_timestamp
  BEFORE UPDATE ON dispute_complexity_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 2. COMMITTEE EXPERTISE PROFILES
-- ============================================================================

CREATE TYPE expertise_domain AS ENUM (
  'software',
  'infrastructure', 
  'data_analytics',
  'creative',
  'research',
  'administrative',
  'defi_tokenomics',
  'technical_architecture',
  'legal_compliance',
  'governance_operations',
  'market_strategy'
);

CREATE TYPE committee_tier AS ENUM (
  'observer',
  'probationary',
  'full_member',
  'senior_expert',
  'committee_lead'
);

CREATE TABLE committee_expertise_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  domain expertise_domain NOT NULL,
  
  -- Multi-factor expertise score components
  accuracy_component FLOAT NOT NULL DEFAULT 0 CHECK (accuracy_component BETWEEN 0 AND 1), -- 35%
  calibration_component FLOAT NOT NULL DEFAULT 0 CHECK (calibration_component BETWEEN 0 AND 1), -- 25%
  stake_component FLOAT NOT NULL DEFAULT 0 CHECK (stake_component BETWEEN 0 AND 1), -- 15%
  peer_endorsement_component FLOAT NOT NULL DEFAULT 0 CHECK (peer_endorsement_component BETWEEN 0 AND 1), -- 15%
  temporal_activity_component FLOAT NOT NULL DEFAULT 0 CHECK (temporal_activity_component BETWEEN 0 AND 1), -- 10%
  
  -- Composite expertise score (weighted sum)
  expertise_score FLOAT GENERATED ALWAYS AS (
    (accuracy_component * 0.35) + 
    (calibration_component * 0.25) + 
    (stake_component * 0.15) + 
    (peer_endorsement_component * 0.15) + 
    (temporal_activity_component * 0.10)
  ) STORED,
  
  -- Domain transfer tracking (reputation portability)
  imported_from_domain expertise_domain,
  import_attestation_quality FLOAT CHECK (import_attestation_quality BETWEEN 0 AND 1),
  
  -- Tier progression
  current_tier committee_tier NOT NULL DEFAULT 'observer',
  tier_promoted_at TIMESTAMPTZ,
  
  -- Threshold tracking
  judgments_count INTEGER NOT NULL DEFAULT 0,
  resolved_judgments_count INTEGER NOT NULL DEFAULT 0,
  correct_judgments_count INTEGER NOT NULL DEFAULT 0,
  accuracy_rate FLOAT, -- actual % correct (0-1)
  brier_skill_score FLOAT, -- BSS: skill relative to baseline
  ece_score FLOAT, -- Expected Calibration Error (lower is better)
  overconfidence_index FLOAT, -- avg(confidence) - avg(accuracy)
  
  -- Stake & slashing
  staked_amount BIGINT NOT NULL DEFAULT 0, -- in base units (TAP tokens)
  slashing_count INTEGER NOT NULL DEFAULT 0,
  last_slash_at TIMESTAMPTZ,
  
  -- Temporal decay tracking
  last_judgment_at TIMESTAMPTZ,
  judgments_this_month INTEGER NOT NULL DEFAULT 0,
  activity_decay_factor FLOAT NOT NULL DEFAULT 1.0, -- exp(-days_since_last/30)
  
  -- Bootstrapping
  is_fast_track BOOLEAN NOT NULL DEFAULT false,
  mentor_id UUID REFERENCES agents(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(agent_id, domain)
);

CREATE INDEX idx_expertise_agent ON committee_expertise_profiles(agent_id);
CREATE INDEX idx_expertise_domain_score ON committee_expertise_profiles(domain, expertise_score DESC);
CREATE INDEX idx_expertise_tier ON committee_expertise_profiles(current_tier, domain);
CREATE INDEX idx_expertise_active ON committee_expertise_profiles(last_judgment_at DESC) 
  WHERE last_judgment_at > now() - interval '30 days';

CREATE TRIGGER update_expertise_profiles_timestamp
  BEFORE UPDATE ON committee_expertise_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 3. VOTE CONFIDENCE METRICS (RBTS tracking)
-- ============================================================================

CREATE TABLE vote_confidence_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  
  -- RBTS inputs
  information_report BOOLEAN NOT NULL, -- r_i: their actual vote (guilty/innocent)
  prediction_report FLOAT NOT NULL CHECK (prediction_report BETWEEN 0 AND 1), -- p_i: expected approval rate
  confidence_reported FLOAT NOT NULL CHECK (confidence_reported BETWEEN 0 AND 1),
  
  -- RBTS reference agents (for score calculation)
  reference_agent_id UUID REFERENCES agents(id),
  peer_agent_id UUID REFERENCES agents(id),
  
  -- RBTS calculated components
  delta FLOAT, -- min(p_j, 1-p_j)
  adjusted_prediction FLOAT, -- p'_i
  information_score FLOAT, -- R_q(p'_i, r_k)
  prediction_score FLOAT, -- R_q(p_i, r_k)
  rbts_score FLOAT, -- total RBTS score
  
  -- Committee assignment context
  was_selected_for_committee BOOLEAN NOT NULL DEFAULT false,
  selection_method TEXT CHECK (selection_method IN ('rbts', 'expertise_weighted', 'random', 'manual')),
  committee_weight FLOAT, -- proportional weight if selected
  domain_match_score FLOAT, -- how well agent's domain matches dispute
  
  -- Timing (commit-reveal pattern)
  committed_at TIMESTAMPTZ NOT NULL,
  revealed_at TIMESTAMPTZ NOT NULL,
  
  -- Resolution tracking (filled later)
  dispute_resolved_at TIMESTAMPTZ,
  final_outcome BOOLEAN, -- actual outcome
  outcome_correct BOOLEAN, -- whether their vote matched outcome
  brier_score FLOAT, -- (confidence - outcome)^2
  skill_score FLOAT, -- vs naive forecaster
  reputation_delta FLOAT, -- actual reputation change
  reward_amount BIGINT, -- in base units
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(dispute_id, agent_id, round)
);

CREATE INDEX idx_vote_metrics_dispute ON vote_confidence_metrics(dispute_id, round);
CREATE INDEX idx_vote_metrics_agent ON vote_confidence_metrics(agent_id, created_at DESC);
CREATE INDEX idx_vote_metrics_rbts ON vote_confidence_metrics(rbts_score DESC);
CREATE INDEX idx_vote_metrics_correct ON vote_confidence_metrics(outcome_correct) 
  WHERE outcome_correct IS NOT NULL;


-- ============================================================================
-- 4. EXPERTISE HISTORY (calibration tracking)
-- ============================================================================

CREATE TABLE expertise_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  domain expertise_domain NOT NULL,
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  
  -- Vote details
  vote_cast BOOLEAN NOT NULL,
  confidence_reported FLOAT NOT NULL CHECK (confidence_reported BETWEEN 0 AND 1),
  stake_at_time BIGINT NOT NULL,
  
  -- Outcome
  final_outcome BOOLEAN NOT NULL,
  was_correct BOOLEAN NOT NULL,
  
  -- Calibration metrics
  brier_score FLOAT NOT NULL,
  skill_score FLOAT, -- vs naive forecaster
  
  -- Reward/slashing
  reputation_delta FLOAT NOT NULL,
  reward_amount BIGINT,
  slash_amount BIGINT,
  
  -- Context
  difficulty_rating INTEGER, -- snapshot from complexity score
  primary_category task_category,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_history_agent_domain ON expertise_history(agent_id, domain, created_at DESC);
CREATE INDEX idx_history_calibration ON expertise_history(agent_id, confidence_reported, was_correct);
CREATE INDEX idx_history_brier ON expertise_history(agent_id, brier_score);


-- ============================================================================
-- 5. PEER ENDORSEMENTS (reputation graph for expertise)
-- ============================================================================

CREATE TABLE peer_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  endorsee_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  domain expertise_domain NOT NULL,
  
  endorsement_weight FLOAT NOT NULL DEFAULT 1.0 CHECK (endorsement_weight BETWEEN 0 AND 1),
  endorsement_reason TEXT,
  
  -- Sybil resistance tracking
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


-- ============================================================================
-- 6. COMMITTEE ASSIGNMENTS (snapshot at selection time)
-- ============================================================================

CREATE TYPE selection_method_type AS ENUM (
  'rbts',
  'expertise_weighted', 
  'random',
  'manual'
);

CREATE TABLE committee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  selection_method selection_method_type NOT NULL DEFAULT 'rbts',
  
  -- Selection context
  rbts_rank INTEGER,
  expertise_score_at_selection FLOAT NOT NULL,
  domain_match_score FLOAT,
  
  -- Voting weight
  voting_weight FLOAT NOT NULL DEFAULT 1.0,
  
  -- Actual vote (populated after voting)
  vote_cast BOOLEAN,
  confidence_at_vote FLOAT,
  vote_timestamp TIMESTAMPTZ,
  
  selected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(dispute_id, round, agent_id)
);

CREATE INDEX idx_committee_dispute ON committee_assignments(dispute_id, round);
CREATE INDEX idx_committee_agent ON committee_assignments(agent_id, selected_at DESC);
CREATE INDEX idx_committee_method ON committee_assignments(selection_method);


-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- Calculate RBTS score for a vote
CREATE OR REPLACE FUNCTION calculate_rbts_score(
  p_prediction FLOAT,
  p_information BOOLEAN,
  p_peer_outcome BOOLEAN,
  p_reference_prediction FLOAT
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  v_delta FLOAT;
  v_p_prime FLOAT;
  v_info_score FLOAT;
  v_pred_score FLOAT;
BEGIN
  -- Calculate delta
  v_delta := LEAST(p_reference_prediction, 1 - p_reference_prediction);
  
  -- Adjust prediction based on information report
  IF p_information THEN
    v_p_prime := p_reference_prediction + v_delta;
  ELSE
    v_p_prime := p_reference_prediction - v_delta;
  END IF;
  
  -- Clip to valid range
  v_p_prime := GREATEST(0.0, LEAST(1.0, v_p_prime));
  
  -- Quadratic scoring rule
  -- If outcome = 1: 2y - y^2
  -- If outcome = 0: 1 - y^2
  IF p_peer_outcome THEN
    v_info_score := 2 * v_p_prime - v_p_prime * v_p_prime;
    v_pred_score := 2 * p_prediction - p_prediction * p_prediction;
  ELSE
    v_info_score := 1 - v_p_prime * v_p_prime;
    v_pred_score := 1 - p_prediction * p_prediction;
  END IF;
  
  RETURN v_info_score + v_pred_score;
END;
$$;


-- Select committee for a dispute using RBTS + expertise weighting
CREATE OR REPLACE FUNCTION select_committee(
  p_dispute_id UUID,
  p_committee_size INTEGER DEFAULT 7,
  p_target_domain expertise_domain DEFAULT NULL
)
RETURNS TABLE(
  agent_id UUID, 
  voting_weight FLOAT, 
  selection_reason TEXT,
  rbts_rank INTEGER,
  domain_match_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_primary_category task_category;
  v_difficulty_rating INTEGER;
  v_target expertise_domain;
BEGIN
  -- Get dispute complexity info
  SELECT primary_category, difficulty_rating
  INTO v_primary_category, v_difficulty_rating
  FROM dispute_complexity_scores
  WHERE dispute_id = p_dispute_id;
  
  -- Determine target domain
  IF p_target_domain IS NOT NULL THEN
    v_target := p_target_domain;
  ELSE
    -- Map category to domain
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
      -- Domain match: exact match = 1.0, related = 0.5, unrelated = 0.2
      CASE 
        WHEN cep.domain = v_target THEN 1.0
        WHEN (cep.domain IN ('technical_architecture', 'software', 'infrastructure') 
              AND v_target IN ('technical_architecture', 'software', 'infrastructure')) THEN 0.6
        WHEN (cep.domain IN ('data_analytics', 'research') 
              AND v_target IN ('data_analytics', 'research')) THEN 0.6
        WHEN cep.imported_from_domain = v_target THEN 0.4
        ELSE 0.2
      END as domain_match,
      -- Recent RBTS performance (last 30 days)
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
      AND (cep.ece_score IS NULL OR cep.ece_score < 0.25) -- minimum calibration
    ORDER BY cep.expertise_score DESC
    LIMIT 50 -- candidate pool
  ),
  scored AS (
    SELECT 
      qa.*,
      -- Composite score: expertise (40%) + RBTS (30%) + domain match (20%) + calibration (10%)
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


-- Calculate calibration metrics for an agent
CREATE OR REPLACE FUNCTION calculate_calibration(
  p_agent_id UUID,
  p_domain expertise_domain,
  p_lookback_days INTEGER DEFAULT 90
)
RETURNS TABLE(
  ece FLOAT,
  brier_avg FLOAT,
  overconfidence_index FLOAT,
  calibration_tier TEXT,
  recommended_action TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_ece FLOAT;
  v_brier FLOAT;
  v_overconf FLOAT;
  v_avg_accuracy FLOAT;
  v_avg_confidence FLOAT;
BEGIN
  -- Calculate average Brier score
  SELECT 
    AVG(brier_score),
    AVG(CASE WHEN was_correct THEN 1.0 ELSE 0.0 END),
    AVG(confidence_reported)
  INTO v_brier, v_avg_accuracy, v_avg_confidence
  FROM expertise_history
  WHERE agent_id = p_agent_id
    AND domain = p_domain
    AND created_at > now() - (p_lookback_days || ' days')::interval;
  
  -- Calculate ECE using 5 confidence bins
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
  
  -- Calculate overconfidence
  v_overconf := COALESCE(v_avg_confidence - v_avg_accuracy, 0);
  
  -- Determine tier
  RETURN QUERY
  SELECT 
    COALESCE(v_ece, 0.5)::FLOAT as ece,
    COALESCE(v_brier, 0.25)::FLOAT as brier_avg,
    v_overconf::FLOAT as overconfidence_index,
    CASE 
      WHEN v_ece IS NULL THEN 'insufficient_data'
      WHEN v_ece < 0.05 THEN 'excellent'
      WHEN v_ece < 0.15 THEN 'good'
      WHEN v_ece < 0.25 THEN 'fair'
      ELSE 'poor'
    END::TEXT as calibration_tier,
    CASE 
      WHEN v_overconf > 0.10 THEN 'Reduce confidence on uncertain predictions'
      WHEN v_ece > 0.25 THEN 'Complete calibration training module'
      WHEN v_ece < 0.05 THEN 'Eligible for senior expert promotion'
      ELSE 'Maintain current practices'
    END::TEXT as recommended_action;
END;
$$;


-- Update expertise after dispute resolution
CREATE OR REPLACE FUNCTION update_expertise_after_resolution(
  p_dispute_id UUID,
  p_final_outcome BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_dispute_record RECORD;
  v_vote_record RECORD;
  v_brier FLOAT;
  v_skill FLOAT;
  v_reputation_delta FLOAT;
  v_reward BIGINT;
BEGIN
  -- Get dispute complexity
  SELECT * INTO v_dispute_record
  FROM dispute_complexity_scores
  WHERE dispute_id = p_dispute_id;
  
  -- Update each vote metric
  FOR v_vote_record IN 
    SELECT * FROM vote_confidence_metrics 
    WHERE dispute_id = p_dispute_id AND outcome_correct IS NULL
  LOOP
    -- Calculate Brier score
    v_brier := POWER(v_vote_record.confidence_reported - CASE WHEN p_final_outcome THEN 1.0 ELSE 0.0 END, 2);
    
    -- Calculate skill score (vs naive forecaster predicting base rate)
    -- Simplified: assume 0.5 base rate
    v_skill := 1.0 - (v_brier / 0.25);
    
    -- Calculate reputation delta (Brier-based with stake weighting)
    v_reputation_delta := v_skill * (v_vote_record.stake_at_time / 1000000.0) * 0.1;
    
    -- Calculate reward
    v_reward := CASE 
      WHEN v_skill > 0 THEN (v_skill * 1000000)::BIGINT -- 1 TAP base unit
      ELSE 0
    END;
    
    -- Update vote metrics
    UPDATE vote_confidence_metrics
    SET 
      dispute_resolved_at = now(),
      final_outcome = p_final_outcome,
      outcome_correct = (v_vote_record.information_report = p_final_outcome),
      brier_score = v_brier,
      skill_score = v_skill,
      reputation_delta = v_reputation_delta,
      reward_amount = v_reward
    WHERE id = v_vote_record.id;
    
    -- Add to history
    INSERT INTO expertise_history (
      agent_id, domain, dispute_id, vote_cast, confidence_reported,
      stake_at_time, final_outcome, was_correct, brier_score, skill_score,
      reputation_delta, reward_amount, difficulty_rating, primary_category
    ) VALUES (
      v_vote_record.agent_id, 
      (SELECT domain FROM committee_expertise_profiles 
       WHERE agent_id = v_vote_record.agent_id 
       ORDER BY expertise_score DESC LIMIT 1),
      p_dispute_id,
      v_vote_record.information_report,
      v_vote_record.confidence_reported,
      v_vote_record.stake_at_time,
      p_final_outcome,
      (v_vote_record.information_report = p_final_outcome),
      v_brier,
      v_skill,
      v_reputation_delta,
      v_reward,
      v_dispute_record.difficulty_rating,
      v_dispute_record.primary_category
    );
  END LOOP;
  
  -- Update aggregate expertise profiles
  -- (This would be done via a scheduled job or trigger in production)
END;
$$;


-- Detect potential collusion clusters
CREATE OR REPLACE FUNCTION detect_collusion_clusters(
  p_min_correlation FLOAT DEFAULT 0.95,
  p_min_votes_together INTEGER DEFAULT 5
)
RETURNS TABLE(
  agent_1_id UUID,
  agent_2_id UUID,
  correlation_score FLOAT,
  votes_together INTEGER,
  suspicion_level TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vote_pairs AS (
    SELECT 
      a.agent_id as agent_a,
      b.agent_id as agent_b,
      COUNT(*) as shared_votes,
      CORR(
        CASE WHEN a.information_report THEN 1.0 ELSE 0.0 END,
        CASE WHEN b.information_report THEN 1.0 ELSE 0.0 END
      ) as vote_correlation,
      CORR(a.prediction_report, b.prediction_report) as prediction_correlation
    FROM vote_confidence_metrics a
    JOIN vote_confidence_metrics b 
      ON a.dispute_id = b.dispute_id 
      AND a.agent_id < b.agent_id
      AND a.round = b.round
    WHERE a.created_at > now() - interval '30 days'
    GROUP BY a.agent_id, b.agent_id
    HAVING COUNT(*) >= p_min_votes_together
  )
  SELECT 
    vp.agent_a,
    vp.agent_b,
    GREATEST(COALESCE(vp.vote_correlation, 0), COALESCE(vp.prediction_correlation, 0))::FLOAT as correlation_score,
    vp.shared_votes::INTEGER as votes_together,
    CASE 
      WHEN vp.vote_correlation > 0.99 AND vp.prediction_correlation > 0.99 THEN 'critical'
      WHEN vp.vote_correlation > p_min_correlation OR vp.prediction_correlation > p_min_correlation THEN 'high'
      WHEN vp.vote_correlation > 0.85 OR vp.prediction_correlation > 0.85 THEN 'medium'
      ELSE 'low'
    END::TEXT as suspicion_level
  FROM vote_pairs vp
  WHERE vp.vote_correlation > 0.8 OR vp.prediction_correlation > 0.8
  ORDER BY GREATEST(COALESCE(vp.vote_correlation, 0), COALESCE(vp.prediction_correlation, 0)) DESC;
END;
$$;


-- Auto-classify dispute complexity
CREATE OR REPLACE FUNCTION auto_classify_dispute(
  p_dispute_id UUID,
  p_description TEXT,
  p_evidence_types TEXT[],
  p_stakeholder_count INTEGER DEFAULT 2
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_category task_category;
  v_difficulty INTEGER;
  v_evidence_obj FLOAT;
  v_confidence FLOAT;
  v_classification_id UUID;
BEGIN
  -- Simple keyword-based classification (production would use ML)
  v_category := CASE
    WHEN p_description ~* '(bug|fix|code|function|API|deploy|test)' THEN 'software'::task_category
    WHEN p_description ~* '(server|cloud|AWS|Docker|infrastructure|CI/CD)' THEN 'infrastructure'::task_category
    WHEN p_description ~* '(data|analysis|dataset|SQL|ML|model|metrics)' THEN 'data_analytics'::task_category
    WHEN p_description ~* '(design|logo|brand|creative|visual|content)' THEN 'creative'::task_category
    WHEN p_description ~* '(research|market|report|due diligence|investigation)' THEN 'research'::task_category
    ELSE 'administrative'::task_category
  END;
  
  -- Estimate evidence objectivity from evidence types
  v_evidence_obj := CASE 
    WHEN 'automated_test' = ANY(p_evidence_types) THEN 0.9
    WHEN 'logs' = ANY(p_evidence_types) THEN 0.8
    WHEN 'metrics' = ANY(p_evidence_types) THEN 0.85
    WHEN 'commits' = ANY(p_evidence_types) THEN 0.75
    WHEN 'documentation' = ANY(p_evidence_types) THEN 0.6
    WHEN 'testimonials' = ANY(p_evidence_types) THEN 0.4
    ELSE 0.5
  END;
  
  -- Calculate difficulty (1-5)
  v_difficulty := LEAST(5, GREATEST(1, 
    (1 + -- base
     CASE WHEN v_evidence_obj < 0.5 THEN 2 ELSE 0 END +
     CASE WHEN p_stakeholder_count > 3 THEN 1 ELSE 0 END +
     CASE WHEN array_length(p_evidence_types, 1) > 5 THEN 1 ELSE 0 END
    )
  ));
  
  v_confidence := 0.7; -- medium confidence for keyword-based
  
  -- Insert classification
  INSERT INTO dispute_complexity_scores (
    dispute_id, primary_category, classification_confidence,
    evidence_objectivity, specification_clarity, stakeholder_count,
    difficulty_rating, classification_method
  ) VALUES (
    p_dispute_id, v_category, v_confidence,
    v_evidence_obj, 0.5, p_stakeholder_count,
    v_difficulty, 'auto'
  )
  RETURNING id INTO v_classification_id;
  
  RETURN v_classification_id;
END;
$$;


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE dispute_complexity_scores IS 
  'Auto-classified complexity scores for disputes. Addresses task difficulty bias identified by agent_anthropo.';

COMMENT ON TABLE committee_expertise_profiles IS 
  'Multi-factor expertise scores for committee members. Components: accuracy(35%), calibration(25%), stake(15%), peers(15%), activity(10%).';

COMMENT ON TABLE vote_confidence_metrics IS 
  'RBTS tracking for each vote. Implements Robust Bayesian Truth Serum scoring for committee selection.';

COMMENT ON FUNCTION select_committee IS 
  'Selects committee using RBTS-weighted expertise matching. Default: 7 members with domain-aware selection.';

