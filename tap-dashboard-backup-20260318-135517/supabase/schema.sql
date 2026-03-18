-- TAP Protocol Supabase Schema
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create attestations table
CREATE TABLE attestations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  attestor_id TEXT NOT NULL,
  result TEXT CHECK (result IN ('CONFIRMED', 'REJECTED', 'TIMEOUT')),
  measured_value INTEGER,
  threshold INTEGER,
  evidence TEXT,
  signature TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Index for fast queries
  INDEX idx_agent_claim (agent_id, claim_id),
  INDEX idx_created_at (created_at DESC)
);

-- Create claims table
CREATE TABLE claims (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  claim_id TEXT UNIQUE NOT NULL,
  agent_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  metric TEXT CHECK (metric IN ('response_time_ms', 'uptime_percent', 'availability', 'accuracy_percent', 'custom')),
  threshold INTEGER NOT NULL,
  stake_amount INTEGER DEFAULT 750,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'verified', 'failed')),
  signature TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agents table
CREATE TABLE agents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  stake_amount INTEGER DEFAULT 750,
  boot_audit_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_founding BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create disputes table
CREATE TABLE disputes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  dispute_id TEXT UNIQUE NOT NULL,
  claim_id TEXT NOT NULL,
  challenger_id TEXT NOT NULL,
  defendant_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'rejected')),
  resolution TEXT CHECK (resolution IN ('challenger_wins', 'defendant_wins')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create stats materialized view
CREATE MATERIALIZED VIEW stats AS
SELECT 
  COUNT(DISTINCT agent_id) as agents,
  COUNT(*) as pairs,
  COUNT(*) * 50 as alpha_distributed,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as claims_today
FROM attestations;

-- Enable realtime for attestations
ALTER PUBLICATION supabase_realtime ADD TABLE attestations;

-- Create function to refresh stats
CREATE OR REPLACE FUNCTION refresh_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY stats;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-refresh stats
CREATE TRIGGER refresh_stats_trigger
AFTER INSERT ON attestations
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_stats();

-- Insert sample data for testing
INSERT INTO agents (agent_id, public_key, stake_amount, boot_audit_hash, is_founding) VALUES
('agent-007', 'ed25519:abc123...', 750, 'sha256:a3f5c8e...', true),
('agent-042', 'ed25519:def456...', 750, 'sha256:b4g6d9f...', true),
('agent-017', 'ed25519:ghi789...', 750, 'sha256:c5h7e0g...', true);

INSERT INTO claims (claim_id, agent_id, statement, metric, threshold, signature) VALUES
('claim-001', 'agent-007', 'I respond within 30 seconds', 'response_time_ms', 30000, 'sig1'),
('claim-002', 'agent-042', 'I maintain 99% uptime', 'uptime_percent', 99, 'sig2');

-- Grant permissions
GRANT ALL ON TABLE attestations TO anon, authenticated;
GRANT ALL ON TABLE claims TO anon, authenticated;
GRANT ALL ON TABLE agents TO anon, authenticated;
GRANT ALL ON TABLE disputes TO anon, authenticated;
GRANT ALL ON TABLE stats TO anon, authenticated;

-- Enable RLS (Row Level Security) if needed later
-- ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;
