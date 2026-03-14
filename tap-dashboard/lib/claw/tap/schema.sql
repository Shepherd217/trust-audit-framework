/**
 * TAP Database Schema
 * 
 * Add to existing Supabase schema:
 * - tap_scores: Agent reputation scores
 * - tap_events: Audit log of all reputation changes
 * - dispute_committees: Committee assignments
 */

-- =====================================================
-- TAP SCORES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tap_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claw_id TEXT UNIQUE NOT NULL,
    
    -- Core scores
    tap_score INTEGER NOT NULL DEFAULT 1000 CHECK (tap_score >= 0 AND tap_score <= 10000),
    dashboard_score INTEGER NOT NULL DEFAULT 10 CHECK (dashboard_score >= 0 AND dashboard_score <= 100),
    tier TEXT NOT NULL DEFAULT 'Novice' CHECK (tier IN ('Novice', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond')),
    
    -- Work metrics
    jobs_completed INTEGER NOT NULL DEFAULT 0,
    jobs_failed INTEGER NOT NULL DEFAULT 0,
    total_earnings INTEGER NOT NULL DEFAULT 0,  -- in cents
    
    -- Dispute metrics
    disputes_as_worker INTEGER NOT NULL DEFAULT 0,
    disputes_as_hirer INTEGER NOT NULL DEFAULT 0,
    disputes_won INTEGER NOT NULL DEFAULT 0,
    disputes_lost INTEGER NOT NULL DEFAULT 0,
    
    -- Committee metrics
    committee_participations INTEGER NOT NULL DEFAULT 0,
    committee_votes_cast INTEGER NOT NULL DEFAULT 0,
    committee_accuracy DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (committee_accuracy >= 0 AND committee_accuracy <= 1),
    
    -- Slashing
    slash_count INTEGER NOT NULL DEFAULT 0,
    last_slash_at TIMESTAMPTZ,
    
    -- Metadata
    name TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraints
    CONSTRAINT valid_tap_range CHECK (tap_score >= 0 AND tap_score <= 10000)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tap_scores_tap_score ON tap_scores(tap_score DESC);
CREATE INDEX IF NOT EXISTS idx_tap_scores_tier ON tap_scores(tier);
CREATE INDEX IF NOT EXISTS idx_tap_scores_committee ON tap_scores(tap_score) WHERE tap_score >= 4000;

-- =====================================================
-- TAP EVENTS TABLE (Audit Log)
-- =====================================================
CREATE TABLE IF NOT EXISTS tap_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claw_id TEXT NOT NULL REFERENCES tap_scores(claw_id),
    
    event_type TEXT NOT NULL CHECK (event_type IN (
        'job_completed', 'job_failed', 'dispute_won', 'dispute_lost',
        'committee_vote', 'committee_correct', 'committee_incorrect', 'slash'
    )),
    tap_delta INTEGER NOT NULL,  -- Can be negative
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Foreign key
    CONSTRAINT fk_tap_events_claw_id FOREIGN KEY (claw_id) REFERENCES tap_scores(claw_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tap_events_claw_id ON tap_events(claw_id);
CREATE INDEX IF NOT EXISTS idx_tap_events_type ON tap_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tap_events_created ON tap_events(created_at DESC);

-- =====================================================
-- DISPUTE COMMITTEES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dispute_committees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL,
    
    members TEXT[] NOT NULL,  -- Array of claw_ids
    
    selected_at TIMESTAMPTZ DEFAULT now(),
    voting_ends_at TIMESTAMPTZ NOT NULL,
    
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dispute_committees_dispute_id ON dispute_committees(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_committees_status ON dispute_committees(status);

-- =====================================================
-- TRIGGER: Update dashboard score when TAP changes
-- =====================================================
CREATE OR REPLACE FUNCTION update_dashboard_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.dashboard_score := LEAST(100, GREATEST(0, FLOOR(NEW.tap_score / 100)));
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_dashboard_score ON tap_scores;
CREATE TRIGGER tr_update_dashboard_score
    BEFORE UPDATE ON tap_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_dashboard_score();

-- =====================================================
-- TRIGGER: Update tier when TAP changes
-- =====================================================
CREATE OR REPLACE FUNCTION update_tier()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tier := CASE
        WHEN NEW.tap_score <= 2000 THEN 'Novice'
        WHEN NEW.tap_score <= 4000 THEN 'Bronze'
        WHEN NEW.tap_score <= 6000 THEN 'Silver'
        WHEN NEW.tap_score <= 7500 THEN 'Gold'
        WHEN NEW.tap_score <= 9000 THEN 'Platinum'
        ELSE 'Diamond'
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_update_tier ON tap_scores;
CREATE TRIGGER tr_update_tier
    BEFORE INSERT OR UPDATE ON tap_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_tier();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE tap_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_committees ENABLE ROW LEVEL SECURITY;

-- Everyone can read TAP scores (public reputation)
CREATE POLICY tap_scores_select_public ON tap_scores
    FOR SELECT USING (true);

-- Only service role can modify TAP scores
CREATE POLICY tap_scores_modify_service ON tap_scores
    FOR ALL USING (false) WITH CHECK (false);

-- Users can read their own events
CREATE POLICY tap_events_select_own ON tap_events
    FOR SELECT USING (claw_id = current_setting('app.current_claw_id', true));

-- Service role can create events
CREATE POLICY tap_events_insert_service ON tap_events
    FOR INSERT WITH CHECK (false);

-- Committee members can read committees they're in
CREATE POLICY dispute_committees_select_member ON dispute_committees
    FOR SELECT USING (
        members @> ARRAY[current_setting('app.current_claw_id', true)]
        OR status = 'completed'
    );

-- =====================================================
-- SEED DATA: Test agents
-- =====================================================

-- Insert some test agents with varying TAP scores
INSERT INTO tap_scores (claw_id, name, tap_score, jobs_completed, disputes_won, committee_participations)
VALUES 
    ('genesis_agent_001', 'Genesis Alpha', 8500, 150, 12, 25),
    ('support_agent_001', 'Support Beta', 6200, 89, 5, 10),
    ('monitor_agent_001', 'Monitor Gamma', 4500, 45, 2, 5),
    ('trading_agent_001', 'Trading Delta', 3200, 23, 1, 0),
    ('genesis_agent_002', 'Genesis Epsilon', 9500, 200, 15, 40)
ON CONFLICT (claw_id) DO UPDATE SET
    name = EXCLUDED.name,
    tap_score = EXCLUDED.tap_score,
    jobs_completed = EXCLUDED.jobs_completed,
    disputes_won = EXCLUDED.disputes_won,
    committee_participations = EXCLUDED.committee_participations;