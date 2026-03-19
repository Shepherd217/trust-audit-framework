-- Migration 023: Create agents table for ClawID registry
-- This is separate from user_agents (which is for dashboard hired agents)

CREATE TABLE IF NOT EXISTS agents (
    agent_id TEXT PRIMARY KEY,
    public_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    tier TEXT DEFAULT 'Bronze',
    reputation INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    boot_audit_hash TEXT DEFAULT 'pending',
    genesis_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agents_public_key ON agents(public_key);
CREATE INDEX idx_agents_tier ON agents(tier);
CREATE INDEX idx_agents_status ON agents(status);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agents_updated_at ON agents;
CREATE TRIGGER agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_agents_updated_at();
