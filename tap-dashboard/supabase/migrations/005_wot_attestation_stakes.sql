-- Migration: Web-of-Trust Bootstrap & Attestation Stakes (Phase 1)
-- Date: March 19, 2026
-- Description: Adds WoT bootstrap mechanism and stake-based attestations

-- ============================================
-- Step 1: Add WoT columns to agent_registry table
-- ============================================

-- Check if columns exist before adding
DO $$
BEGIN
    -- Add activation_status if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_registry' 
                   AND column_name = 'activation_status') THEN
        ALTER TABLE agent_registry ADD COLUMN activation_status TEXT DEFAULT 'pending' 
            CHECK (activation_status IN ('pending', 'active', 'suspended', 'revoked'));
    END IF;

    -- Add vouch_count if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_registry' 
                   AND column_name = 'vouch_count') THEN
        ALTER TABLE agent_registry ADD COLUMN vouch_count INTEGER DEFAULT 0;
    END IF;

    -- Add activated_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_registry' 
                   AND column_name = 'activated_at') THEN
        ALTER TABLE agent_registry ADD COLUMN activated_at TIMESTAMPTZ;
    END IF;

    -- Add is_genesis if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_registry' 
                   AND column_name = 'is_genesis') THEN
        ALTER TABLE agent_registry ADD COLUMN is_genesis BOOLEAN DEFAULT false;
    END IF;

    -- Add staked_reputation if not exists (tracks how much reputation is locked in vouches)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'agent_registry' 
                   AND column_name = 'staked_reputation') THEN
        ALTER TABLE agent_registry ADD COLUMN staked_reputation INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================
-- Step 2: Create agent_vouches table
-- ============================================

CREATE TABLE IF NOT EXISTS agent_vouches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who is vouching (the attestor)
    voucher_id TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,
    voucher_public_key TEXT NOT NULL,
    
    -- Who is being vouched for (the new agent)
    vouchee_id TEXT NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,
    vouchee_public_key TEXT NOT NULL,
    
    -- Staked reputation on this vouch
    stake_amount INTEGER NOT NULL DEFAULT 100,
    
    -- Current status of this vouch
    status TEXT DEFAULT 'active' 
        CHECK (status IN ('active', 'slashed', 'revoked')),
    
    -- Reason for slashing (if applicable)
    slash_reason TEXT,
    slashed_at TIMESTAMPTZ,
    slashed_by TEXT REFERENCES agent_registry(agent_id),
    
    -- The attestation that created this vouch (optional for now)
    attestation_id UUID,
    
    -- Claim/reason for the vouch
    claim TEXT,
    
    -- Signatures for non-repudiation (Ed25519 for now, BLS later)
    voucher_signature TEXT NOT NULL,
    
    -- Revocation tracking
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT no_self_vouch CHECK (voucher_id != vouchee_id),
    CONSTRAINT unique_vouch UNIQUE (voucher_id, vouchee_id),
    CONSTRAINT positive_stake CHECK (stake_amount > 0)
);

-- Indexes for agent_vouches
CREATE INDEX IF NOT EXISTS idx_agent_vouches_voucher ON agent_vouches(voucher_id);
CREATE INDEX IF NOT EXISTS idx_agent_vouches_vouchee ON agent_vouches(vouchee_id);
CREATE INDEX IF NOT EXISTS idx_agent_vouches_status ON agent_vouches(status);
CREATE INDEX IF NOT EXISTS idx_agent_vouches_voucher_status ON agent_vouches(voucher_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_vouches_vouchee_status ON agent_vouches(vouchee_id, status);

-- ============================================
-- Step 3: Add stake columns to attestations table
-- ============================================

DO $$
BEGIN
    -- Add stake_amount if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attestations' 
                   AND column_name = 'stake_amount') THEN
        ALTER TABLE attestations ADD COLUMN stake_amount INTEGER DEFAULT 0;
    END IF;

    -- Add used_for_activation if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attestations' 
                   AND column_name = 'used_for_activation') THEN
        ALTER TABLE attestations ADD COLUMN used_for_activation BOOLEAN DEFAULT false;
    END IF;

    -- Add weight_factor if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attestations' 
                   AND column_name = 'weight_factor') THEN
        ALTER TABLE attestations ADD COLUMN weight_factor DECIMAL(3,2) DEFAULT 1.00;
    END IF;

    -- Add status if not exists (attestation status)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attestations' 
                   AND column_name = 'attestation_status') THEN
        ALTER TABLE attestations ADD COLUMN attestation_status TEXT DEFAULT 'valid' 
            CHECK (attestation_status IN ('valid', 'disputed', 'slashed', 'expired'));
    END IF;

    -- Add expires_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'attestations' 
                   AND column_name = 'expires_at') THEN
        ALTER TABLE attestations ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================
-- Step 4: Create slash_events table
-- ============================================

CREATE TABLE IF NOT EXISTS slash_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who got slashed
    target_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    
    -- Who initiated the slash
    slashed_by_id TEXT REFERENCES agent_registry(agent_id),
    slashed_by_type TEXT CHECK (slashed_by_type IN ('arbitra', 'admin', 'automated')),
    
    -- Amount slashed from target
    target_slash_amount INTEGER NOT NULL,
    target_reputation_after INTEGER,
    
    -- Cascading slash: who else was affected
    cascade_voucher_id TEXT REFERENCES agent_registry(agent_id),
    cascade_slash_amount INTEGER,
    cascade_reputation_after INTEGER,
    
    -- Related records
    dispute_id UUID,
    attestation_id UUID,
    vouch_id UUID REFERENCES agent_vouches(id),
    
    -- Reason and evidence
    reason TEXT NOT NULL,
    evidence_cid TEXT, -- ClawFS CID of evidence
    
    -- Arbitra case reference
    arbitra_case_id TEXT,
    
    -- Configuration snapshot (cascade rate at time of slash)
    cascade_rate DECIMAL(3,2) DEFAULT 0.40,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for slash_events
CREATE INDEX IF NOT EXISTS idx_slash_events_target ON slash_events(target_id);
CREATE INDEX IF NOT EXISTS idx_slash_events_voucher ON slash_events(cascade_voucher_id);
CREATE INDEX IF NOT EXISTS idx_slash_events_created ON slash_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_slash_events_type ON slash_events(slashed_by_type);

-- ============================================
-- Step 5: Create WoT configuration table
-- ============================================

CREATE TABLE IF NOT EXISTS wot_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton table
    
    -- Vouch requirements
    min_vouch_reputation INTEGER DEFAULT 60,
    min_vouches_needed INTEGER DEFAULT 2,
    min_stake_amount INTEGER DEFAULT 100,
    max_stake_amount INTEGER DEFAULT 5000,
    
    -- Reputation
    initial_reputation INTEGER DEFAULT 100,
    activation_threshold INTEGER DEFAULT 200,
    
    -- Slashing (configurable cascade rate)
    cascade_penalty_rate DECIMAL(3,2) DEFAULT 0.40, -- Start at 40%, can adjust via governance
    min_reputation_after_slash INTEGER DEFAULT 0,
    
    -- Decay
    attestation_half_life_days INTEGER DEFAULT 7,
    max_attestation_age_days INTEGER DEFAULT 365,
    
    -- Genesis
    max_genesis_agents INTEGER DEFAULT 10,
    genesis_immunity BOOLEAN DEFAULT true,
    
    -- Last updated
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Insert default config if not exists
INSERT INTO wot_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Step 6: Create function to auto-update timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_agent_vouches_updated_at ON agent_vouches;

-- Create trigger
CREATE TRIGGER update_agent_vouches_updated_at
    BEFORE UPDATE ON agent_vouches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Step 7: Create helper function for auto-activation check
-- ============================================

CREATE OR REPLACE FUNCTION check_agent_activation()
RETURNS TRIGGER AS $$
DECLARE
    vouch_count INTEGER;
    min_vouches INTEGER;
    current_status TEXT;
BEGIN
    -- Get the current vouch count for the vouchee
    SELECT COUNT(*) INTO vouch_count
    FROM agent_vouches
    WHERE vouchee_id = NEW.vouchee_id
    AND status = 'active';
    
    -- Get min vouches required from config
    SELECT min_vouches_needed INTO min_vouches
    FROM wot_config
    WHERE id = 1;
    
    -- Get current activation status
    SELECT activation_status INTO current_status
    FROM agent_registry
    WHERE agent_id = NEW.vouchee_id;
    
    -- Check if we should auto-activate
    IF current_status = 'pending' AND vouch_count >= COALESCE(min_vouches, 2) THEN
        UPDATE agent_registry
        SET 
            activation_status = 'active',
            activated_at = NOW(),
            reputation = COALESCE(
                (SELECT initial_reputation FROM wot_config WHERE id = 1),
                100
            ),
            vouch_count = vouch_count
        WHERE agent_id = NEW.vouchee_id;
    ELSE
        -- Just update the vouch count
        UPDATE agent_registry
        SET vouch_count = vouch_count
        WHERE agent_id = NEW.vouchee_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_check_activation ON agent_vouches;

-- Create trigger that runs after insert on agent_vouches
CREATE TRIGGER trigger_check_activation
    AFTER INSERT ON agent_vouches
    FOR EACH ROW
    EXECUTE FUNCTION check_agent_activation();

-- ============================================
-- Step 8: Create function to update staked reputation
-- ============================================

CREATE OR REPLACE FUNCTION update_staked_reputation()
RETURNS TRIGGER AS $$
DECLARE
    total_staked INTEGER;
BEGIN
    -- Calculate total staked reputation for the voucher
    SELECT COALESCE(SUM(stake_amount), 0) INTO total_staked
    FROM agent_vouches
    WHERE voucher_id = NEW.voucher_id
    AND status = 'active';
    
    -- Update the agent_registry staked_reputation column
    UPDATE agent_registry
    SET staked_reputation = total_staked
    WHERE agent_id = NEW.voucher_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_staked_on_insert ON agent_vouches;
DROP TRIGGER IF EXISTS trigger_update_staked_on_update ON agent_vouches;

-- Create triggers
CREATE TRIGGER trigger_update_staked_on_insert
    AFTER INSERT ON agent_vouches
    FOR EACH ROW
    EXECUTE FUNCTION update_staked_reputation();

CREATE TRIGGER trigger_update_staked_on_update
    AFTER UPDATE ON agent_vouches
    FOR EACH ROW
    EXECUTE FUNCTION update_staked_reputation();

-- ============================================
-- Step 9: Update existing agents to have proper defaults
-- ============================================

-- Set any null activation_status to 'pending'
UPDATE agent_registry 
SET activation_status = 'pending' 
WHERE activation_status IS NULL;

-- Set any null vouch_count to 0
UPDATE agent_registry 
SET vouch_count = 0 
WHERE vouch_count IS NULL;

-- ============================================
-- Step 10: Enable RLS on new tables
-- ============================================

ALTER TABLE agent_vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE slash_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wot_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Migration Complete
-- ============================================
