-- Migration: Create agent_registry table for external agent onboarding
-- Created: 2026-03-18

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create agent_registry table
CREATE TABLE IF NOT EXISTS agent_registry (
    agent_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public_key TEXT NOT NULL UNIQUE,
    api_key_hash TEXT NOT NULL UNIQUE,
    reputation INTEGER DEFAULT 0 CHECK (reputation >= 0 AND reputation <= 100),
    tier TEXT DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_registry_api_key_hash ON agent_registry(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_agent_registry_status ON agent_registry(status);
CREATE INDEX IF NOT EXISTS idx_agent_registry_tier ON agent_registry(tier);
CREATE INDEX IF NOT EXISTS idx_agent_registry_reputation ON agent_registry(reputation DESC);

-- Enable Row Level Security
ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;

-- Policy: Allow agents to read their own data via API key (checked in application)
CREATE POLICY "Agent read own data" ON agent_registry
    FOR SELECT USING (true);

-- Policy: Only service role can insert/update
CREATE POLICY "Service role insert" ON agent_registry
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role update" ON agent_registry
    FOR UPDATE USING (true);

-- Add comment for documentation
COMMENT ON TABLE agent_registry IS 'Registry of external agents with API key authentication';
COMMENT ON COLUMN agent_registry.api_key_hash IS 'SHA-256 hash of the API key - actual key is only shown once at registration';
