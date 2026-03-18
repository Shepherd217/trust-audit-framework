-- TAP Protocol Supabase Schema
-- COPY AND PASTE THIS INTO SUPABASE SQL EDITOR

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_agent_claim ON attestations(agent_id, claim_id);
CREATE INDEX idx_created_at ON attestations(created_at DESC);

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

-- Grant permissions
GRANT ALL ON TABLE attestations TO anon, authenticated;
GRANT ALL ON TABLE claims TO anon, authenticated;
GRANT ALL ON TABLE agents TO anon, authenticated;
GRANT ALL ON TABLE disputes TO anon, authenticated;
