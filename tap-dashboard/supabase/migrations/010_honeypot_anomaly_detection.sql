-- Migration: Honeypot Agents & Anomaly Detection (Phase 4)
-- Date: March 19, 2026
-- Description: Fake agents to catch bad actors + behavioral monitoring

-- ============================================
-- Step 1: Create honeypot_agents table
-- ============================================

CREATE TABLE IF NOT EXISTS honeypot_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Fake agent identity
    agent_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    public_key TEXT NOT NULL,
    
    -- Honeypot configuration
    bait_type TEXT NOT NULL CHECK (bait_type IN ('reputation_grab', 'collusion_bait', 'sybil_trap', 'suspicious_behavior')),
    
    -- Fake attributes designed to attract attacks
    fake_reputation INTEGER NOT NULL DEFAULT 500,
    fake_role TEXT DEFAULT 'standard', -- 'moderator', 'validator', etc.
    
    -- Deployment status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'retired')),
    
    -- Trigger tracking
    triggered_at TIMESTAMPTZ,
    triggered_by TEXT, -- Agent IDs that interacted suspiciously
    trigger_evidence JSONB DEFAULT '[]', -- Array of suspicious events
    
    -- Deployment metadata
    deployed_at TIMESTAMPTZ DEFAULT NOW(),
    deployed_by TEXT REFERENCES agent_registry(agent_id),
    
    -- Expected attack patterns
    expected_attacks TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_honeypot_status ON honeypot_agents(status);
CREATE INDEX IF NOT EXISTS idx_honeypot_bait ON honeypot_agents(bait_type);
CREATE INDEX IF NOT EXISTS idx_honeypot_triggered ON honeypot_agents(triggered_at);

-- Enable RLS
ALTER TABLE honeypot_agents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 2: Create anomaly_events table
-- ============================================

CREATE TABLE IF NOT EXISTS anomaly_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who triggered it
    agent_id TEXT REFERENCES agent_registry(agent_id),
    
    -- What type of anomaly
    anomaly_type TEXT NOT NULL CHECK (
        anomaly_type IN (
            'rapid_attestation',      -- Too many attestations too fast
            'reputation_grinding',    -- Suspicious rep growth pattern
            'collusion_detected',     -- Circular trust patterns
            'sybil_cluster',          -- Similar behavior from new accounts
            'honeypot_triggered',     -- Interacted with fake agent
            'coordination_pattern',   -- Synchronized actions
            'score_manipulation'      -- Attempted to game the system
        )
    ),
    
    -- Severity
    severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Detection details
    detection_data JSONB NOT NULL DEFAULT '{}',
    -- Includes: pattern_type, confidence_score, related_agents[], evidence
    
    -- Related records
    related_vouches UUID[],
    related_attestations UUID[],
    related_honeypot_id UUID REFERENCES honeypot_agents(id),
    
    -- Status
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'confirmed', 'false_positive', 'resolved')),
    
    -- Investigation
    assigned_to TEXT REFERENCES agent_registry(agent_id),
    investigation_notes TEXT,
    
    -- Resolution
    resolution_type TEXT CHECK (resolution_type IN ('slashed', 'warned', 'dismissed', 'escalated')),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT REFERENCES agent_registry(agent_id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_anomaly_agent ON anomaly_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_type ON anomaly_events(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_severity ON anomaly_events(severity);
CREATE INDEX IF NOT EXISTS idx_anomaly_status ON anomaly_events(status);
CREATE INDEX IF NOT EXISTS idx_anomaly_created ON anomaly_events(created_at DESC);

-- Enable RLS
ALTER TABLE anomaly_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 3: Create behavior_metrics table for tracking patterns
-- ============================================

CREATE TABLE IF NOT EXISTS behavior_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    
    -- Time window
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    window_type TEXT NOT NULL CHECK (window_type IN ('hour', 'day', 'week')),
    
    -- Activity metrics
    attestations_given INTEGER DEFAULT 0,
    attestations_received INTEGER DEFAULT 0,
    vouches_given INTEGER DEFAULT 0,
    vouches_received INTEGER DEFAULT 0,
    disputes_filed INTEGER DEFAULT 0,
    disputes_against INTEGER DEFAULT 0,
    
    -- Network metrics
    unique_interactions INTEGER DEFAULT 0,  -- Unique agents interacted with
    reciprocity_score DECIMAL(5,4) DEFAULT 0, -- Score of mutual attestations
    clustering_coefficient DECIMAL(5,4) DEFAULT 0, -- How clustered their network is
    
    -- Velocity metrics
    reputation_delta INTEGER DEFAULT 0,
    stake_delta INTEGER DEFAULT 0,
    
    -- Calculated risk score
    anomaly_score DECIMAL(5,4) DEFAULT 0, -- 0-1, higher = more suspicious
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_behavior_agent ON behavior_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_behavior_window ON behavior_metrics(window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_behavior_anomaly ON behavior_metrics(anomaly_score) WHERE anomaly_score > 0.7;

-- Enable RLS
ALTER TABLE behavior_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Step 4: Create function to detect rapid attestation pattern
-- ============================================

CREATE OR REPLACE FUNCTION find_rapid_attesters(
    p_window_hours INTEGER DEFAULT 1,
    p_threshold INTEGER DEFAULT 10
) RETURNS TABLE(agent_id TEXT, vouch_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        av.voucher_id as agent_id,
        COUNT(*) as vouch_count
    FROM agent_vouches av
    WHERE av.created_at > NOW() - (p_window_hours || ' hours')::INTERVAL
    AND av.status = 'active'
    GROUP BY av.voucher_id
    HAVING COUNT(*) >= p_threshold;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 5: Create function to detect collusion (circular vouching)
-- ============================================

CREATE OR REPLACE FUNCTION detect_collusion_ring(
    p_agent_id TEXT,
    p_depth INTEGER DEFAULT 3
) RETURNS TABLE(
    ring_agent_id TEXT,
    path_length INTEGER,
    cycle_detected BOOLEAN
) AS $$
BEGIN
    -- Find agents that form circular vouching patterns
    -- A collusion ring: A vouches for B, B vouches for C, C vouches for A
    RETURN QUERY
    WITH RECURSIVE trust_chain AS (
        -- Base case: direct vouches from agent
        SELECT 
            voucher_id as start_agent,
            vouchee_id as current_agent,
            ARRAY[voucher_id, vouchee_id] as path,
            1 as depth,
            FALSE as is_cycle
        FROM agent_vouches
        WHERE voucher_id = p_agent_id
        AND status = 'active'
        
        UNION ALL
        
        -- Recursive: follow the chain
        SELECT 
            tc.start_agent,
            av.vouchee_id,
            tc.path || av.vouchee_id,
            tc.depth + 1,
            av.vouchee_id = ANY(tc.path) -- Cycle detected if we see someone twice
        FROM trust_chain tc
        JOIN agent_vouches av ON tc.current_agent = av.voucher_id
        WHERE tc.depth < p_depth
        AND av.status = 'active'
        AND NOT tc.is_cycle -- Stop if we already found a cycle
    )
    SELECT 
        tc.current_agent as ring_agent_id,
        tc.depth as path_length,
        tc.is_cycle as cycle_detected
    FROM trust_chain tc
    WHERE tc.is_cycle = TRUE
    OR (tc.depth > 1 AND tc.current_agent = p_agent_id) -- Back to start = cycle
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 6: Create function to trigger honeypot alert
-- ============================================

CREATE OR REPLACE FUNCTION trigger_honeypot_alert(
    p_honeypot_id UUID,
    p_triggered_by TEXT,
    p_evidence JSONB
) RETURNS UUID AS $$
DECLARE
    v_anomaly_id UUID;
BEGIN
    -- Update honeypot status
    UPDATE honeypot_agents
    SET status = 'triggered',
        triggered_at = NOW(),
        triggered_by = COALESCE(triggered_by || ', ' || p_triggered_by, p_triggered_by),
        trigger_evidence = trigger_evidence || p_evidence
    WHERE id = p_honeypot_id;
    
    -- Create anomaly event
    INSERT INTO anomaly_events (
        agent_id,
        anomaly_type,
        severity,
        detection_data,
        related_honeypot_id,
        status,
        created_at
    ) VALUES (
        p_triggered_by,
        'honeypot_triggered',
        'high',
        jsonb_build_object(
            'honeypot_id', p_honeypot_id,
            'trigger_type', p_evidence->>'type',
            'confidence', 1.0
        ),
        p_honeypot_id,
        'open',
        NOW()
    )
    RETURNING id INTO v_anomaly_id;
    
    RETURN v_anomaly_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 7: Insert sample honeypot agents
-- ============================================

INSERT INTO honeypot_agents (agent_id, name, public_key, bait_type, fake_reputation, fake_role, expected_attacks)
VALUES 
    ('honeypot_001', 'Moderator Bot 7', 'hp_pk_001_reputation_grab', 'reputation_grab', 800, 'moderator', ARRAY['rapid_attestation', 'score_manipulation']),
    ('honeypot_002', 'Validator Node Alpha', 'hp_pk_002_collusion', 'collusion_bait', 1200, 'validator', ARRAY['collusion_detected', 'coordination_pattern']),
    ('honeypot_003', 'New User 4829', 'hp_pk_003_sybil', 'sybil_trap', 50, 'standard', ARRAY['sybil_cluster', 'rapid_attestation'])
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================
-- Step 8: Create view for anomaly dashboard
-- ============================================

CREATE OR REPLACE VIEW v_anomaly_dashboard AS
SELECT 
    ae.*,
    ar.name as agent_name,
    ar.reputation as agent_reputation,
    ar.activation_status as agent_status,
    CASE 
        WHEN ae.severity = 'critical' THEN 4
        WHEN ae.severity = 'high' THEN 3
        WHEN ae.severity = 'medium' THEN 2
        ELSE 1
    END as severity_rank
FROM anomaly_events ae
LEFT JOIN agent_registry ar ON ae.agent_id = ar.agent_id
WHERE ae.status IN ('open', 'investigating')
ORDER BY severity_rank DESC, ae.created_at DESC;

-- ============================================
-- Migration Complete
-- ============================================
