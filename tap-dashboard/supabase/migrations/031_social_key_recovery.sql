-- Migration 031: Social Key Recovery
-- Supports 3-of-5 guardian threshold for agent private key recovery
-- Created: 2025-03-26

-- Guardian registry: encrypted key shares distributed to trusted guardians
CREATE TABLE IF NOT EXISTS agent_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,  -- agent_id or email hash
  guardian_type TEXT NOT NULL CHECK (guardian_type IN ('agent', 'email', 'external')),
  encrypted_share TEXT NOT NULL,  -- share encrypted to guardian's public key
  threshold INTEGER NOT NULL DEFAULT 3,
  total_guardians INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recovery request tracking
CREATE TABLE IF NOT EXISTS agent_recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  recovery_id TEXT UNIQUE NOT NULL,
  new_public_key TEXT NOT NULL,
  shares_collected INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  reason TEXT,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  completed_at TIMESTAMPTZ,
  CONSTRAINT recovery_threshold_valid CHECK (threshold >= 2 AND threshold <= total_shares),
  CONSTRAINT recovery_shares_valid CHECK (shares_collected >= 0)
);

-- Add total_shares column for the constraint
ALTER TABLE agent_recovery_requests 
  ADD COLUMN IF NOT EXISTS total_shares INTEGER NOT NULL DEFAULT 5;

-- Track individual guardian approvals
CREATE TABLE IF NOT EXISTS recovery_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_id TEXT NOT NULL REFERENCES agent_recovery_requests(recovery_id),
  guardian_id TEXT NOT NULL,
  decrypted_share TEXT NOT NULL,  -- guardian decrypts and submits their share
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recovery_id, guardian_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_guardians_agent_id ON agent_guardians(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_guardians_guardian_id ON agent_guardians(guardian_id);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_agent_id ON agent_recovery_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_recovery_requests_recovery_id ON agent_recovery_requests(recovery_id);
CREATE INDEX IF NOT EXISTS idx_recovery_approvals_recovery_id ON recovery_approvals(recovery_id);

-- Enable RLS
ALTER TABLE agent_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_recovery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_approvals ENABLE ROW LEVEL SECURITY;

-- Policies: service role can read/write everything; anon can only read non-sensitive data
CREATE POLICY "service_role_all_guardians" ON agent_guardians
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_recovery" ON agent_recovery_requests
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_approvals" ON recovery_approvals
  FOR ALL USING (auth.role() = 'service_role');

-- Public read of recovery request status (not the shares)
CREATE POLICY "public_read_recovery_status" ON agent_recovery_requests
  FOR SELECT USING (true);
