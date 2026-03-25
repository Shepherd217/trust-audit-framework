-- Migration: Committee Expertise & Calibration Analytics
-- Date: March 25, 2026
-- Description: Track overturn direction, expertise distance, and calibration metrics

-- ============================================
-- Step 1: Create committee_composition table
-- ============================================

CREATE TABLE IF NOT EXISTS committee_composition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to dispute
    dispute_id UUID NOT NULL REFERENCES dispute_cases(id),
    
    -- Committee member
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    
    -- Selection metadata
    selection_reason TEXT NOT NULL, -- 'rbts', 'expertise', 'domain_match', 'calibration', 'fallback'
    selection_score DECIMAL(5,2) NOT NULL, -- Combined score (0-10000)
    
    -- Component scores at selection time
    rbts_score DECIMAL(5,2) DEFAULT 0,      -- 30% weight
    expertise_score DECIMAL(5,2) DEFAULT 0, -- 40% weight
    domain_match_score DECIMAL(5,2) DEFAULT 0, -- 20% weight
    calibration_score DECIMAL(5,2) DEFAULT 0,  -- 10% weight
    
    -- Vote
    vote TEXT CHECK (vote IN ('guilty', 'innocent', 'abstain')),
    voted_at TIMESTAMPTZ,
    
    -- Calculated fields
    was_overturned BOOLEAN DEFAULT false, -- If their vote was overturned on appeal
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(dispute_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_committee_dispute ON committee_composition(dispute_id);
CREATE INDEX IF NOT EXISTS idx_committee_agent ON committee_composition(agent_id);
CREATE INDEX IF NOT EXISTS idx_committee_selection ON committee_composition(selection_reason);
CREATE INDEX IF NOT EXISTS idx_committee_overturned ON committee_composition(was_overturned) WHERE was_overturned = true;

ALTER TABLE committee_composition ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 2: Create expertise_history table
-- ============================================

CREATE TABLE IF NOT EXISTS expertise_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to dispute/verdict
    dispute_id UUID NOT NULL REFERENCES dispute_cases(id),
    
    -- Original verdict info
    original_verdict TEXT NOT NULL CHECK (original_verdict IN ('guilty', 'innocent')),
    original_committee_expertise DECIMAL(5,2) NOT NULL, -- Avg expertise of original committee
    original_confidence DECIMAL(3,2), -- Committee confidence (0-1)
    
    -- Appeal/Overturn info
    overturned_at TIMESTAMPTZ,
    overturned_by_committee BOOLEAN DEFAULT false, -- True if appealed committee overturned
    
    -- Direction vector (core metrics)
    overturn_direction TEXT CHECK (overturn_direction IN ('toward_expertise', 'toward_majority', 'neutral')),
    
    -- Expertise distance
    -- Positive: new committee MORE expert
    -- Negative: new committee LESS expert
    -- Zero: equal expertise
    expertise_distance DECIMAL(5,2) DEFAULT 0,
    
    -- Quality metrics (to be filled after durability period)
    re_dispute_filed BOOLEAN DEFAULT false,
    re_dispute_count INTEGER DEFAULT 0,
    final_verdict TEXT CHECK (final_verdict IN ('guilty', 'innocent', 'pending')),
    final_verdict_at TIMESTAMPTZ,
    
    -- Classification for analysis
    overturn_quality TEXT CHECK (overturn_quality IN ('improvement', 'regression', 'neutral', 'pending')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expertise_dispute ON expertise_history(dispute_id);
CREATE INDEX IF NOT EXISTS idx_expertise_direction ON expertise_history(overturn_direction);
CREATE INDEX IF NOT EXISTS idx_expertise_quality ON expertise_history(overturn_quality);
CREATE INDEX IF NOT EXISTS idx_expertise_re_dispute ON expertise_history(re_dispute_filed) WHERE re_dispute_filed = true;

ALTER TABLE expertise_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 3: Create agent_calibration table
-- ============================================

CREATE TABLE IF NOT EXISTS agent_calibration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    
    -- Time period (weekly rollup)
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    
    -- Raw counts
    cases_participated INTEGER DEFAULT 0,
    cases_correct INTEGER DEFAULT 0, -- Matches final verdict
    cases_overturned INTEGER DEFAULT 0, -- Their vote was overturned
    
    -- ECE (Expected Calibration Error)
    -- Measures: When agent says "70% confident", are they right 70% of the time?
    ece_score DECIMAL(5,4), -- Lower is better (0 = perfectly calibrated)
    
    -- Brier Score
    -- Measures: Accuracy of probabilistic predictions
    -- Range: 0 (perfect) to 2 (worst)
    brier_score DECIMAL(5,4),
    
    -- Component breakdown for ECE (10 buckets)
    -- Stores: predicted_confidence -> [correct_count, total_count]
    confidence_buckets JSONB DEFAULT '{}',
    
    -- Derived metrics
    calibration_tier TEXT CHECK (calibration_tier IN ('excellent', 'good', 'fair', 'poor', 'unproven')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(agent_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_calibration_agent ON agent_calibration(agent_id);
CREATE INDEX IF NOT EXISTS idx_calibration_week ON agent_calibration(week_start);
CREATE INDEX IF NOT EXISTS idx_calibration_tier ON agent_calibration(calibration_tier);

ALTER TABLE agent_calibration ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 4: Create durability_metrics table
-- ============================================

CREATE TABLE IF NOT EXISTS durability_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Time period
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    
    -- System-wide metrics
    total_verdicts INTEGER DEFAULT 0,
    total_overturns INTEGER DEFAULT 0,
    overturn_rate DECIMAL(5,4), -- total_overturns / total_verdicts
    
    -- Direction breakdown
    toward_expertise_count INTEGER DEFAULT 0,
    toward_majority_count INTEGER DEFAULT 0,
    neutral_count INTEGER DEFAULT 0,
    
    -- Re-dispute tracking (durability)
    re_dispute_count INTEGER DEFAULT 0,
    re_dispute_rate DECIMAL(5,4), -- re_dispute_count / total_overturns
    
    -- Re-correction tracking
    re_correction_count INTEGER DEFAULT 0, -- Overturn got overturned again
    re_correction_rate DECIMAL(5,4),
    
    -- Quality assessment
    improvement_rate DECIMAL(5,4), -- overturns that were improvements
    regression_rate DECIMAL(5,4),  -- overturns that were regressions
    
    -- Decision durability score (composite)
    -- Range: 0-100
    -- Based on: re_dispute_rate (40%), re_correction_rate (40%), improvement_rate (20%)
    durability_score DECIMAL(5,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_durability_week ON durability_metrics(week_start);

ALTER TABLE durability_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 5: Function to calculate overturn direction
-- ============================================

CREATE OR REPLACE FUNCTION calculate_overturn_direction(
    p_original_expertise DECIMAL,
    p_new_expertise DECIMAL,
    p_original_vote TEXT,
    p_new_verdict TEXT
) RETURNS TABLE (
    direction TEXT,
    distance DECIMAL
) AS $$
DECLARE
    v_direction TEXT;
    v_distance DECIMAL;
BEGIN
    -- Calculate expertise distance
    v_distance := p_new_expertise - p_original_expertise;
    
    -- Determine direction
    IF p_original_vote = p_new_verdict THEN
        -- No overturn, or overturn toward same outcome
        v_direction := 'neutral';
    ELSIF v_distance > 0 THEN
        -- New committee is MORE expert
        v_direction := 'toward_expertise';
    ELSIF v_distance < 0 THEN
        -- New committee is LESS expert
        v_direction := 'toward_majority';
    ELSE
        -- Equal expertise, different outcome
        v_direction := 'neutral';
    END IF;
    
    RETURN QUERY SELECT v_direction, v_distance;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 6: Function to calculate ECE score
-- ============================================

CREATE OR REPLACE FUNCTION calculate_ece_score(
    p_confidence_buckets JSONB
) RETURNS DECIMAL AS $$
DECLARE
    v_total_samples INTEGER := 0;
    v_weighted_error DECIMAL := 0;
    v_bucket RECORD;
    v_confidence DECIMAL;
    v_correct INTEGER;
    v_total INTEGER;
    v_accuracy DECIMAL;
BEGIN
    -- Iterate through confidence buckets (0.1, 0.2, ..., 1.0)
    FOR v_bucket IN 
        SELECT * FROM jsonb_each(p_confidence_buckets)
    LOOP
        v_confidence := v_bucket.key::DECIMAL;
        v_correct := (v_bucket.value->>'correct')::INTEGER;
        v_total := (v_bucket.value->>'total')::INTEGER;
        
        IF v_total > 0 THEN
            v_accuracy := v_correct::DECIMAL / v_total;
            v_weighted_error := v_weighted_error + (v_total * ABS(v_confidence - v_accuracy));
            v_total_samples := v_total_samples + v_total;
        END IF;
    END LOOP;
    
    IF v_total_samples = 0 THEN
        RETURN NULL;
    END IF;
    
    RETURN v_weighted_error / v_total_samples;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 7: Function to update weekly calibration
-- ============================================

CREATE OR REPLACE FUNCTION update_weekly_calibration(
    p_week_start DATE
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_agent RECORD;
    v_cases INTEGER;
    v_correct INTEGER;
    v_overturned INTEGER;
    v_buckets JSONB;
BEGIN
    -- Process each agent who participated that week
    FOR v_agent IN
        SELECT DISTINCT agent_id 
        FROM committee_composition
        WHERE created_at >= p_week_start 
        AND created_at < p_week_start + INTERVAL '7 days'
    LOOP
        -- Get participation stats
        SELECT 
            COUNT(*),
            COUNT(*) FILTER (WHERE was_overturned = false),
            COUNT(*) FILTER (WHERE was_overturned = true)
        INTO v_cases, v_correct, v_overturned
        FROM committee_composition
        WHERE agent_id = v_agent.agent_id
        AND created_at >= p_week_start 
        AND created_at < p_week_start + INTERVAL '7 days';
        
        -- Build confidence buckets (simplified - would need actual confidence data)
        v_buckets := jsonb_build_object(
            '0.5', jsonb_build_object('correct', 0, 'total', 0),
            '0.6', jsonb_build_object('correct', 0, 'total', 0),
            '0.7', jsonb_build_object('correct', 0, 'total', 0),
            '0.8', jsonb_build_object('correct', 0, 'total', 0),
            '0.9', jsonb_build_object('correct', 0, 'total', 0)
        );
        
        -- Insert or update calibration record
        INSERT INTO agent_calibration (
            agent_id, week_start, week_end,
            cases_participated, cases_correct, cases_overturned,
            confidence_buckets, calibration_tier
        ) VALUES (
            v_agent.agent_id, p_week_start, p_week_start + INTERVAL '6 days',
            v_cases, v_correct, v_overturned,
            v_buckets,
            CASE 
                WHEN v_cases = 0 THEN 'unproven'
                WHEN v_overturned::DECIMAL / v_cases < 0.1 THEN 'excellent'
                WHEN v_overturned::DECIMAL / v_cases < 0.2 THEN 'good'
                WHEN v_overturned::DECIMAL / v_cases < 0.3 THEN 'fair'
                ELSE 'poor'
            END
        )
        ON CONFLICT (agent_id, week_start) 
        DO UPDATE SET
            cases_participated = EXCLUDED.cases_participated,
            cases_correct = EXCLUDED.cases_correct,
            cases_overturned = EXCLUDED.cases_overturned,
            confidence_buckets = EXCLUDED.confidence_buckets,
            calibration_tier = EXCLUDED.calibration_tier,
            updated_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 8: Function to calculate weekly durability metrics
-- ============================================

CREATE OR REPLACE FUNCTION calculate_weekly_durability(
    p_week_start DATE
) RETURNS VOID AS $$
DECLARE
    v_total_verdicts INTEGER;
    v_total_overturns INTEGER;
    v_toward_expertise INTEGER;
    v_toward_majority INTEGER;
    v_neutral INTEGER;
    v_re_disputes INTEGER;
    v_re_corrections INTEGER;
    v_improvements INTEGER;
    v_regressions INTEGER;
BEGIN
    -- Get counts for the week
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE overturned_at IS NOT NULL),
        COUNT(*) FILTER (WHERE overturn_direction = 'toward_expertise'),
        COUNT(*) FILTER (WHERE overturn_direction = 'toward_majority'),
        COUNT(*) FILTER (WHERE overturn_direction = 'neutral'),
        COUNT(*) FILTER (WHERE re_dispute_filed = true),
        COUNT(*) FILTER (WHERE re_dispute_filed = true AND final_verdict != original_verdict),
        COUNT(*) FILTER (WHERE overturn_quality = 'improvement'),
        COUNT(*) FILTER (WHERE overturn_quality = 'regression')
    INTO v_total_verdicts, v_total_overturns, v_toward_expertise, v_toward_majority, 
         v_neutral, v_re_disputes, v_re_corrections, v_improvements, v_regressions
    FROM expertise_history
    WHERE created_at >= p_week_start 
    AND created_at < p_week_start + INTERVAL '7 days';
    
    -- Insert durability metrics
    INSERT INTO durability_metrics (
        week_start, week_end,
        total_verdicts, total_overturns, overturn_rate,
        toward_expertise_count, toward_majority_count, neutral_count,
        re_dispute_count, re_dispute_rate,
        re_correction_count, re_correction_rate,
        improvement_rate, regression_rate,
        durability_score
    ) VALUES (
        p_week_start, p_week_start + INTERVAL '6 days',
        v_total_verdicts, v_total_overturns,
        CASE WHEN v_total_verdicts > 0 THEN v_total_overturns::DECIMAL / v_total_verdicts ELSE 0 END,
        v_toward_expertise, v_toward_majority, v_neutral,
        v_re_disputes,
        CASE WHEN v_total_overturns > 0 THEN v_re_disputes::DECIMAL / v_total_overturns ELSE 0 END,
        v_re_corrections,
        CASE WHEN v_total_overturns > 0 THEN v_re_corrections::DECIMAL / v_total_overturns ELSE 0 END,
        CASE WHEN v_total_overturns > 0 THEN v_improvements::DECIMAL / v_total_overturns ELSE 0 END,
        CASE WHEN v_total_overturns > 0 THEN v_regressions::DECIMAL / v_total_overturns ELSE 0 END,
        -- Durability score: weighted composite
        CASE 
            WHEN v_total_overturns = 0 THEN 100
            ELSE (
                (1 - COALESCE(v_re_disputes::DECIMAL / v_total_overturns, 0)) * 40 +
                (1 - COALESCE(v_re_corrections::DECIMAL / v_total_overturns, 0)) * 40 +
                COALESCE(v_improvements::DECIMAL / v_total_overturns, 0) * 20
            )
        END
    )
    ON CONFLICT (week_start) 
    DO UPDATE SET
        total_verdicts = EXCLUDED.total_verdicts,
        total_overturns = EXCLUDED.total_overturns,
        overturn_rate = EXCLUDED.overturn_rate,
        toward_expertise_count = EXCLUDED.toward_expertise_count,
        toward_majority_count = EXCLUDED.toward_majority_count,
        neutral_count = EXCLUDED.neutral_count,
        re_dispute_count = EXCLUDED.re_dispute_count,
        re_dispute_rate = EXCLUDED.re_dispute_rate,
        re_correction_count = EXCLUDED.re_correction_count,
        re_correction_rate = EXCLUDED.re_correction_rate,
        improvement_rate = EXCLUDED.improvement_rate,
        regression_rate = EXCLUDED.regression_rate,
        durability_score = EXCLUDED.durability_score,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Migration Complete
-- ============================================
