-- =====================================================
-- ClawOS Payments & Escrow Schema (Section 5.1)
-- =====================================================
-- Tables:
--   - escrows: Main escrow contracts with state machine
--   - payments: Individual payment records
--   - disputes: Dispute tracking linked to escrows
--
-- States: pending → funded → in_progress → (completed|disputed)
-- =====================================================

-- =====================================================
-- ENUM TYPES
-- =====================================================

CREATE TYPE escrow_status AS ENUM (
    'pending',      -- Escrow created, awaiting funding
    'funded',       -- Funds deposited by payer
    'in_progress',  -- Work/service has started
    'completed',    -- Work finished, funds released
    'disputed',     -- Under dispute resolution
    'cancelled',    -- Cancelled by mutual agreement or timeout
    'refunded'      -- Funds returned to payer
);

CREATE TYPE payment_status AS ENUM (
    'pending',      -- Payment initiated
    'processing',   -- Payment being processed
    'completed',    -- Payment successful
    'failed',       -- Payment failed
    'refunded'      -- Payment refunded
);

CREATE TYPE payment_method AS ENUM (
    'crypto',       -- Cryptocurrency (ETH, USDC, etc.)
    'stripe',       -- Stripe card payment
    'bank_transfer', -- Bank/wire transfer
    'claw_credit'   -- Internal ClawOS credit
);

CREATE TYPE dispute_status AS ENUM (
    'open',         -- Dispute filed, awaiting committee
    'evidence',     -- Evidence collection phase
    'voting',       -- Committee voting in progress
    'resolved',     -- Decision reached
    'appealed'      -- Under appeal review
);

CREATE TYPE dispute_resolution AS ENUM (
    'pending',      -- No resolution yet
    'payer_wins',   -- Funds released to payer
    'payee_wins',   -- Funds released to payee
    'split',        -- Funds split between parties
    'escrowed'      -- Funds remain in escrow
);

-- =====================================================
-- ESCROWS TABLE
-- =====================================================

CREATE TABLE escrows (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- External References (ClawOS Integration)
    claw_id UUID NOT NULL,                  -- Creator's ClawID
    payer_claw_id UUID NOT NULL,            -- Payer's ClawID
    payee_claw_id UUID NOT NULL,            -- Payee's ClawID
    handoff_id UUID,                        -- Optional: linked ClawLink handoff
    
    -- Escrow Details
    amount DECIMAL(20, 8) NOT NULL,         -- Amount in smallest unit
    currency VARCHAR(10) NOT NULL,          -- 'ETH', 'USDC', 'USD', etc.
    description TEXT,                       -- What is being escrowed for
    
    -- State Machine
    status escrow_status NOT NULL DEFAULT 'pending',
    
    -- Milestone Tracking (for multi-stage escrows)
    milestone_count INT DEFAULT 1,          -- Number of milestones
    current_milestone INT DEFAULT 0,        -- Current milestone index
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    funded_at TIMESTAMPTZ,                  -- When funded
    started_at TIMESTAMPTZ,                 -- When work started
    completed_at TIMESTAMPTZ,               -- When completed
    expires_at TIMESTAMPTZ,                 -- Auto-cancel if not funded
    
    -- Dispute Link
    active_dispute_id UUID,                 -- Current dispute if any
    dispute_count INT DEFAULT 0,            -- Total disputes on this escrow
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,     -- Flexible metadata
    
    -- Constraints
    CONSTRAINT valid_amount CHECK (amount > 0),
    CONSTRAINT valid_milestones CHECK (milestone_count >= 1 AND current_milestone <= milestone_count),
    CONSTRAINT different_parties CHECK (payer_claw_id != payee_claw_id),
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for common queries
CREATE INDEX idx_escrows_claw_id ON escrows(claw_id);
CREATE INDEX idx_escrows_payer ON escrows(payer_claw_id);
CREATE INDEX idx_escrows_payee ON escrows(payee_claw_id);
CREATE INDEX idx_escrows_status ON escrows(status);
CREATE INDEX idx_escrows_handoff ON escrows(handoff_id);
CREATE INDEX idx_escrows_created_at ON escrows(created_at DESC);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================

CREATE TABLE payments (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    escrow_id UUID REFERENCES escrows(id) ON DELETE SET NULL,
    claw_id UUID NOT NULL,                  -- Payment initiator
    
    -- Payment Details
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    method payment_method NOT NULL,
    
    -- Status
    status payment_status NOT NULL DEFAULT 'pending',
    
    -- External Transaction IDs
    tx_hash VARCHAR(66),                    -- Blockchain tx hash
    stripe_payment_intent_id VARCHAR(100),  -- Stripe payment intent
    external_ref VARCHAR(255),              -- Bank transfer ref, etc.
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,               -- When completed/failed
    
    -- Fees
    platform_fee DECIMAL(20, 8) DEFAULT 0,  -- ClawOS platform fee
    processing_fee DECIMAL(20, 8) DEFAULT 0, -- Stripe/crypto fees
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT valid_payment_amount CHECK (amount >= 0),
    CONSTRAINT valid_tx_hash_format CHECK (
        tx_hash IS NULL OR 
        tx_hash ~ '^0x[a-fA-F0-9]{64}$'
    )
);

-- Indexes
CREATE INDEX idx_payments_escrow ON payments(escrow_id);
CREATE INDEX idx_payments_claw_id ON payments(claw_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_tx_hash ON payments(tx_hash);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- =====================================================
-- DISPUTES TABLE
-- =====================================================

CREATE TABLE disputes (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    escrow_id UUID NOT NULL REFERENCES escrows(id) ON DELETE CASCADE,
    initiator_claw_id UUID NOT NULL,        -- Who raised the dispute
    respondent_claw_id UUID NOT NULL,       -- Other party
    
    -- Dispute Details
    reason TEXT NOT NULL,                   -- Why dispute was raised
    evidence_urls TEXT[],                   -- Array of evidence URLs
    
    -- Committee (Arbitra Layer 2)
    committee_size INT DEFAULT 7,           -- Total committee members
    committee_members UUID[],               -- Selected committee ClawIDs
    votes_for_payer INT DEFAULT 0,
    votes_for_payee INT DEFAULT 0,
    
    -- Status
    status dispute_status NOT NULL DEFAULT 'open',
    resolution dispute_resolution DEFAULT 'pending',
    
    -- Resolution Details
    resolution_notes TEXT,
    resolved_by UUID,                       -- Committee decision or system
    resolved_at TIMESTAMPTZ,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evidence_deadline TIMESTAMPTZ,          -- Deadline for evidence
    voting_deadline TIMESTAMPTZ,            -- Deadline for voting
    
    -- Slashing (Arbitra 2× slashing for bias)
    slashed_members UUID[],                 -- Committee members slashed
    slash_reasons TEXT[],                   -- Reasons for slashing
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT valid_committee_size CHECK (committee_size >= 3 AND committee_size <= 15),
    CONSTRAINT valid_votes CHECK (votes_for_payer + votes_for_payee <= committee_size),
    CONSTRAINT different_dispute_parties CHECK (initiator_claw_id != respondent_claw_id)
);

-- Indexes
CREATE INDEX idx_disputes_escrow ON disputes(escrow_id);
CREATE INDEX idx_disputes_initiator ON disputes(initiator_claw_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_created_at ON disputes(created_at DESC);

-- =====================================================
-- MILESTONES TABLE (for multi-stage escrows)
-- =====================================================

CREATE TABLE escrow_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escrow_id UUID NOT NULL REFERENCES escrows(id) ON DELETE CASCADE,
    
    milestone_index INT NOT NULL,           -- 0-based index
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(20, 8) NOT NULL,         -- Amount for this milestone
    
    status escrow_status DEFAULT 'pending',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT unique_milestone UNIQUE (escrow_id, milestone_index),
    CONSTRAINT valid_milestone_amount CHECK (amount > 0)
);

CREATE INDEX idx_milestones_escrow ON escrow_milestones(escrow_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_milestones ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ESCROWS RLS POLICIES
-- =====================================================

-- Users can view escrows they are party to
CREATE POLICY escrows_select_parties ON escrows
    FOR SELECT
    USING (
        auth.uid() = claw_id OR
        auth.uid() = payer_claw_id OR
        auth.uid() = payee_claw_id
    );

-- Users can create escrows with their own claw_id
CREATE POLICY escrows_insert_own ON escrows
    FOR INSERT
    WITH CHECK (auth.uid() = claw_id);

-- Only payer can update to 'funded' (via payment)
CREATE POLICY escrows_update_payer ON escrows
    FOR UPDATE
    USING (auth.uid() = payer_claw_id)
    WITH CHECK (
        -- Only allow specific status transitions
        status IN ('funded', 'cancelled')
    );

-- Payee can update to 'in_progress' or 'completed'
CREATE POLICY escrows_update_payee ON escrows
    FOR UPDATE
    USING (auth.uid() = payee_claw_id)
    WITH CHECK (
        status IN ('in_progress', 'completed')
    );

-- Either party can initiate dispute (sets status to 'disputed')
CREATE POLICY escrows_dispute ON escrows
    FOR UPDATE
    USING (
        auth.uid() = payer_claw_id OR
        auth.uid() = payee_claw_id
    )
    WITH CHECK (status = 'disputed');

-- System/Service role can update any escrow (for dispute resolution)
CREATE POLICY escrows_service_update ON escrows
    FOR UPDATE
    USING (
        auth.jwt()->>'role' = 'service' OR
        auth.jwt()->>'role' = 'admin'
    );

-- =====================================================
-- PAYMENTS RLS POLICIES
-- =====================================================

-- Users can view their own payments
CREATE POLICY payments_select_own ON payments
    FOR SELECT
    USING (
        auth.uid() = claw_id OR
        EXISTS (
            SELECT 1 FROM escrows e
            WHERE e.id = payments.escrow_id
            AND (e.payer_claw_id = auth.uid() OR e.payee_claw_id = auth.uid())
        )
    );

-- Users can create payments with their own claw_id
CREATE POLICY payments_insert_own ON payments
    FOR INSERT
    WITH CHECK (auth.uid() = claw_id);

-- Service role can update payment status
CREATE POLICY payments_service_update ON payments
    FOR UPDATE
    USING (
        auth.jwt()->>'role' = 'service' OR
        auth.jwt()->>'role' = 'admin'
    );

-- =====================================================
-- DISPUTES RLS POLICIES
-- =====================================================

-- Parties can view their disputes
CREATE POLICY disputes_select_parties ON disputes
    FOR SELECT
    USING (
        auth.uid() = initiator_claw_id OR
        auth.uid() = respondent_claw_id OR
        auth.uid() = ANY(committee_members)
    );

-- Either party can create a dispute
CREATE POLICY disputes_insert_parties ON disputes
    FOR INSERT
    WITH CHECK (
        auth.uid() = initiator_claw_id AND
        EXISTS (
            SELECT 1 FROM escrows e
            WHERE e.id = disputes.escrow_id
            AND (e.payer_claw_id = auth.uid() OR e.payee_claw_id = auth.uid())
        )
    );

-- Committee members can update votes
CREATE POLICY disputes_committee_vote ON disputes
    FOR UPDATE
    USING (
        auth.uid() = ANY(committee_members) AND
        status = 'voting'
    );

-- Service role can resolve disputes
CREATE POLICY disputes_service_resolve ON disputes
    FOR UPDATE
    USING (
        auth.jwt()->>'role' = 'service' OR
        auth.jwt()->>'role' = 'admin'
    );

-- =====================================================
-- MILESTONES RLS POLICIES
-- =====================================================

CREATE POLICY milestones_select_parties ON escrow_milestones
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM escrows e
            WHERE e.id = escrow_milestones.escrow_id
            AND (e.payer_claw_id = auth.uid() OR e.payee_claw_id = auth.uid())
        )
    );

CREATE POLICY milestones_service_update ON escrow_milestones
    FOR UPDATE
    USING (
        auth.jwt()->>'role' = 'service' OR
        auth.jwt()->>'role' = 'admin'
    );

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to validate escrow state transitions
CREATE OR REPLACE FUNCTION validate_escrow_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Define valid state transitions
    IF OLD.status = 'pending' AND NEW.status NOT IN ('funded', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from pending to %', NEW.status;
    END IF;
    
    IF OLD.status = 'funded' AND NEW.status NOT IN ('in_progress', 'disputed', 'refunded') THEN
        RAISE EXCEPTION 'Invalid transition from funded to %', NEW.status;
    END IF;
    
    IF OLD.status = 'in_progress' AND NEW.status NOT IN ('completed', 'disputed') THEN
        RAISE EXCEPTION 'Invalid transition from in_progress to %', NEW.status;
    END IF;
    
    IF OLD.status IN ('completed', 'cancelled', 'refunded') THEN
        RAISE EXCEPTION 'Cannot transition from terminal state %', OLD.status;
    END IF;
    
    IF OLD.status = 'disputed' AND NEW.status NOT IN ('completed', 'refunded', 'in_progress') THEN
        RAISE EXCEPTION 'Invalid transition from disputed to %', NEW.status;
    END IF;
    
    -- Update timestamps based on status
    IF NEW.status = 'funded' AND OLD.status = 'pending' THEN
        NEW.funded_at := NOW();
    END IF;
    
    IF NEW.status = 'in_progress' AND OLD.status = 'funded' THEN
        NEW.started_at := NOW();
    END IF;
    
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER escrow_state_transition
    BEFORE UPDATE ON escrows
    FOR EACH ROW
    EXECUTE FUNCTION validate_escrow_transition();

-- Function to auto-update escrow when dispute is resolved
CREATE OR REPLACE FUNCTION handle_dispute_resolution()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        -- Update escrow based on resolution
        UPDATE escrows
        SET 
            active_dispute_id = NULL,
            status = CASE NEW.resolution
                WHEN 'payer_wins' THEN 'refunded'
                WHEN 'payee_wins' THEN 'completed'
                WHEN 'split' THEN 'completed'
                ELSE 'disputed'
            END
        WHERE id = NEW.escrow_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dispute_resolution_handler
    AFTER UPDATE ON disputes
    FOR EACH ROW
    EXECUTE FUNCTION handle_dispute_resolution();

-- Function to link payment to escrow funding
CREATE OR REPLACE FUNCTION handle_escrow_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND NEW.escrow_id IS NOT NULL THEN
        UPDATE escrows
        SET status = 'funded'
        WHERE id = NEW.escrow_id
        AND status = 'pending';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_completion_handler
    AFTER UPDATE ON payments
    FOR EACH ROW
    WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
    EXECUTE FUNCTION handle_escrow_payment();

-- =====================================================
-- VIEWS FOR CONVENIENCE
-- =====================================================

-- Active escrows view
CREATE VIEW active_escrows AS
SELECT * FROM escrows
WHERE status NOT IN ('completed', 'cancelled', 'refunded');

-- Pending disputes view
CREATE VIEW pending_disputes AS
SELECT * FROM disputes
WHERE status NOT IN ('resolved');

-- User's escrow summary view
CREATE VIEW user_escrow_summary AS
SELECT 
    e.*,
    CASE 
        WHEN e.payer_claw_id = auth.uid() THEN 'payer'
        WHEN e.payee_claw_id = auth.uid() THEN 'payee'
        ELSE 'creator'
    END as user_role,
    COALESCE(
        (SELECT json_agg(m.*) FROM escrow_milestones m WHERE m.escrow_id = e.id),
        '[]'::json
    ) as milestones
FROM escrows e
WHERE e.payer_claw_id = auth.uid() 
   OR e.payee_claw_id = auth.uid()
   OR e.claw_id = auth.uid();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE escrows IS 'Escrow contracts for secure peer-to-peer transactions';
COMMENT ON TABLE payments IS 'Individual payment records linked to escrows';
COMMENT ON TABLE disputes IS 'Dispute cases for Arbitra layer 2 resolution';
COMMENT ON TABLE escrow_milestones IS 'Milestone breakdown for multi-stage escrows';

COMMENT ON COLUMN escrows.status IS 'State: pending→funded→in_progress→completed|disputed';
COMMENT ON COLUMN disputes.resolution IS 'Outcome: payer_wins, payee_wins, split, or escrowed';