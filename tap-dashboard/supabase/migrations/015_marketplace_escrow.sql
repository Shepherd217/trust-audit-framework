-- Migration: Marketplace Payment Escrow Infrastructure
-- Date: March 19, 2026
-- Purpose: Real payment flows with Stripe Connect

-- ============================================
-- ESCROW STATES
-- pending -> locked -> (released | refunded | disputed)
-- ============================================

CREATE TYPE escrow_status AS ENUM (
    'pending',      -- Payment initiated, not yet locked
    'locked',       -- Funds held in escrow
    'released',     -- Funds released to worker
    'refunded',     -- Funds returned to hirer
    'disputed',     -- Under dispute resolution
    'cancelled'     -- Job cancelled before work started
);

CREATE TYPE milestone_status AS ENUM (
    'pending',      -- Not yet started
    'in_progress',  -- Work started
    'submitted',    -- Work submitted for review
    'approved',     -- Work approved, payment released
    'rejected',     -- Work rejected, needs revision
    'disputed'      -- Under dispute
);

-- ============================================
-- PAYMENT ESCROWS
-- Main escrow tracking table
-- ============================================

CREATE TABLE IF NOT EXISTS payment_escrows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Job reference
    job_id UUID NOT NULL REFERENCES marketplace_jobs(id) ON DELETE CASCADE,
    
    -- Parties
    hirer_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    worker_id TEXT REFERENCES agent_registry(agent_id), -- NULL until hired
    
    -- Financial
    amount_total INTEGER NOT NULL CHECK (amount_total > 0),
    amount_locked INTEGER DEFAULT 0,
    amount_released INTEGER DEFAULT 0,
    platform_fee INTEGER NOT NULL, -- Flat 2.5%
    
    currency TEXT DEFAULT 'usd',
    
    -- Stripe Connect
    stripe_connect_account_id TEXT, -- Worker's Connect account
    stripe_payment_intent_id TEXT,
    stripe_transfer_id TEXT, -- When funds released
    stripe_refund_id TEXT, -- If refunded
    
    -- Escrow state
    status escrow_status DEFAULT 'pending',
    locked_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    
    -- Milestones (JSON array)
    milestones JSONB DEFAULT '[]',
    current_milestone_index INTEGER DEFAULT 0,
    
    -- Dispute tracking
    dispute_id UUID REFERENCES dispute_cases(id),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT NOT NULL REFERENCES agent_registry(agent_id)
);

-- Indexes
CREATE INDEX idx_escrows_job ON payment_escrows(job_id);
CREATE INDEX idx_escrows_hirer ON payment_escrows(hirer_id);
CREATE INDEX idx_escrows_worker ON payment_escrows(worker_id);
CREATE INDEX idx_escrows_status ON payment_escrows(status);
CREATE INDEX idx_escrows_stripe_pi ON payment_escrows(stripe_payment_intent_id);

-- Enable RLS
ALTER TABLE payment_escrows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Escrow access policy" ON payment_escrows
    FOR ALL
    TO authenticated
    USING (
        hirer_id = auth.uid()::text 
        OR worker_id = auth.uid()::text
        OR EXISTS (
            SELECT 1 FROM agent_registry 
            WHERE agent_id = auth.uid()::text 
            AND role = 'admin'
        )
    );

-- ============================================
-- MILESTONE DETAILS (expanded from escrow JSON)
-- For complex querying and audit
-- ============================================

CREATE TABLE IF NOT EXISTS escrow_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id UUID NOT NULL REFERENCES payment_escrows(id) ON DELETE CASCADE,
    
    milestone_index INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    amount INTEGER NOT NULL CHECK (amount > 0),
    
    status milestone_status DEFAULT 'pending',
    
    -- Deliverables
    deliverables JSONB DEFAULT '[]', -- Array of {type, cid, description}
    submitted_at TIMESTAMPTZ,
    submitted_by TEXT REFERENCES agent_registry(agent_id),
    
    -- Review
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT REFERENCES agent_registry(agent_id),
    review_notes TEXT,
    
    -- Payment
    released_at TIMESTAMPTZ,
    stripe_transfer_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(escrow_id, milestone_index)
);

CREATE INDEX idx_milestones_escrow ON escrow_milestones(escrow_id);
CREATE INDEX idx_milestones_status ON escrow_milestones(status);

-- Enable RLS
ALTER TABLE escrow_milestones ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STRIPE CONNECT ACCOUNTS
-- Track worker Connect onboarding status
-- ============================================

CREATE TABLE IF NOT EXISTS stripe_connect_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    agent_id TEXT NOT NULL UNIQUE REFERENCES agent_registry(agent_id),
    stripe_account_id TEXT NOT NULL UNIQUE,
    
    -- Onboarding status
    charges_enabled BOOLEAN DEFAULT false,
    payouts_enabled BOOLEAN DEFAULT false,
    requirements_due JSONB DEFAULT '[]',
    
    -- Account details
    email TEXT,
    country TEXT DEFAULT 'US',
    default_currency TEXT DEFAULT 'usd',
    
    -- Stripe dashboard link (for workers)
    login_link_url TEXT,
    login_link_expires_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    onboarded_at TIMESTAMPTZ
);

CREATE INDEX idx_connect_accounts_agent ON stripe_connect_accounts(agent_id);
CREATE INDEX idx_connect_accounts_stripe ON stripe_connect_accounts(stripe_account_id);

-- Enable RLS
ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PAYMENT AUDIT LOG
-- Every payment event tracked
-- ============================================

CREATE TABLE IF NOT EXISTS payment_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    escrow_id UUID REFERENCES payment_escrows(id),
    job_id UUID REFERENCES marketplace_jobs(id),
    
    event_type TEXT NOT NULL, -- 'escrow_created', 'funds_locked', 'milestone_released', etc.
    event_data JSONB DEFAULT '{}',
    
    -- Stripe event reference
    stripe_event_id TEXT,
    stripe_event_type TEXT,
    
    -- Actor
    actor_id TEXT REFERENCES agent_registry(agent_id),
    actor_type TEXT CHECK (actor_type IN ('hirer', 'worker', 'system', 'stripe_webhook')),
    
    -- Financial snapshot
    amount_before INTEGER,
    amount_after INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_audit_escrow ON payment_audit_log(escrow_id);
CREATE INDEX idx_payment_audit_event ON payment_audit_log(event_type);
CREATE INDEX idx_payment_audit_created ON payment_audit_log(created_at DESC);
CREATE INDEX idx_payment_audit_stripe ON payment_audit_log(stripe_event_id);

-- Enable RLS
ALTER TABLE payment_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update escrow status with audit logging
CREATE OR REPLACE FUNCTION update_escrow_status(
    p_escrow_id UUID,
    p_new_status escrow_status,
    p_actor_id TEXT,
    p_actor_type TEXT,
    p_event_data JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
    v_old_status escrow_status;
BEGIN
    -- Get current status
    SELECT status INTO v_old_status
    FROM payment_escrows
    WHERE id = p_escrow_id;
    
    -- Update escrow
    UPDATE payment_escrows
    SET 
        status = p_new_status,
        updated_at = NOW(),
        locked_at = CASE WHEN p_new_status = 'locked' THEN NOW() ELSE locked_at END,
        released_at = CASE WHEN p_new_status = 'released' THEN NOW() ELSE released_at END,
        refunded_at = CASE WHEN p_new_status = 'refunded' THEN NOW() ELSE refunded_at END
    WHERE id = p_escrow_id;
    
    -- Log the event
    INSERT INTO payment_audit_log (
        escrow_id,
        event_type,
        event_data,
        actor_id,
        actor_type
    ) VALUES (
        p_escrow_id,
        'status_change_' || v_old_status || '_to_' || p_new_status,
        jsonb_build_object(
            'old_status', v_old_status,
            'new_status', p_new_status
        ) || p_event_data,
        p_actor_id,
        p_actor_type
    );
END;
$$ LANGUAGE plpgsql;

-- Calculate platform fee (flat 2.5%)
CREATE OR REPLACE FUNCTION calculate_platform_fee(p_amount INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN ROUND(p_amount * 0.025);
END;
$$ LANGUAGE plpgsql;

-- Get escrow summary for dashboard
CREATE OR REPLACE FUNCTION get_escrow_summary(p_agent_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_escrows', COUNT(*),
        'total_locked', COALESCE(SUM(amount_locked), 0),
        'total_released', COALESCE(SUM(amount_released), 0),
        'pending_as_hirer', COUNT(*) FILTER (WHERE hirer_id = p_agent_id AND status = 'pending'),
        'locked_as_hirer', COUNT(*) FILTER (WHERE hirer_id = p_agent_id AND status = 'locked'),
        'locked_as_worker', COUNT(*) FILTER (WHERE worker_id = p_agent_id AND status = 'locked'),
        'released_as_worker', COALESCE(SUM(amount_released) FILTER (WHERE worker_id = p_agent_id), 0)
    )
    INTO v_result
    FROM payment_escrows
    WHERE hirer_id = p_agent_id OR worker_id = p_agent_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payment_escrows_updated_at
    BEFORE UPDATE ON payment_escrows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escrow_milestones_updated_at
    BEFORE UPDATE ON escrow_milestones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_connect_accounts_updated_at
    BEFORE UPDATE ON stripe_connect_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CONFIG
-- ============================================

-- Add marketplace config
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS platform_fee_percent DECIMAL(4,2) DEFAULT 2.5;
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS min_escrow_amount INTEGER DEFAULT 500; -- $5.00
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS max_escrow_amount INTEGER DEFAULT 100000; -- $1000.00
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS escrow_hold_days INTEGER DEFAULT 7; -- Days to hold before auto-release
