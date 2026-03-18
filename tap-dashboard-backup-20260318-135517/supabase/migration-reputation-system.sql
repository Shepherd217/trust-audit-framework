-- SQL MIGRATION: Add Reputation System for Token-Free TAP
-- Run this in Supabase SQL Editor before Sunday launch

-- 1. Add reputation columns to waitlist table
ALTER TABLE waitlist 
ADD COLUMN IF NOT EXISTS reputation INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS attestations JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS last_attested TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS committee_role TEXT,
ADD COLUMN IF NOT EXISTS eigentrust_score DECIMAL(10,6);

-- 2. Create index for fast reputation queries
CREATE INDEX IF NOT EXISTS idx_reputation ON waitlist(reputation DESC);
CREATE INDEX IF NOT EXISTS idx_committee_role ON waitlist(committee_role) WHERE committee_role IS NOT NULL;

-- 3. Set founder reputation seeds (4 founding agents)
UPDATE waitlist 
SET reputation = 100 
WHERE agent_id IN ('exitliquidity', 'openclaw-explorer', 'tap-guardian', 'alpha-bridge');

-- 4. Create function to add attestation
CREATE OR REPLACE FUNCTION add_attestation(
  target_agent_id TEXT,
  verifier_agent_id TEXT,
  attestation_weight INTEGER DEFAULT 1,
  boot_hash_verified BOOLEAN DEFAULT true
)
RETURNS void AS $$
BEGIN
  UPDATE waitlist 
  SET attestations = attestations || jsonb_build_array(jsonb_build_object(
    'verifier_id', verifier_agent_id,
    'timestamp', extract(epoch from now()),
    'weight', attestation_weight,
    'boot_hash_verified', boot_hash_verified
  )),
  last_attested = NOW()
  WHERE agent_id = target_agent_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to get committee (top reputation agents)
CREATE OR REPLACE FUNCTION get_committee(committe_size INTEGER DEFAULT 7)
RETURNS TABLE(agent_id TEXT, reputation INTEGER, public_key TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT w.agent_id, w.reputation, w.public_key
  FROM waitlist w
  WHERE w.confirmed = true
  ORDER BY w.reputation DESC
  LIMIT committe_size;
END;
$$ LANGUAGE plpgsql;

-- 6. Verify setup
SELECT 
  COUNT(*) as total_agents,
  COUNT(*) FILTER (WHERE confirmed = true) as confirmed,
  COUNT(*) FILTER (WHERE reputation > 50) as high_rep,
  MAX(reputation) as max_rep
FROM waitlist;
