-- Arbitra Production SQL
-- Run this in Supabase SQL Editor

-- Create disputes table
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimant_id TEXT REFERENCES waitlist(agent_id),
  opponent_id TEXT REFERENCES waitlist(agent_id),
  claim TEXT NOT NULL,
  evidence JSONB,
  status TEXT DEFAULT 'pending',
  committee JSONB DEFAULT '[]',
  resolution TEXT,
  winner_id TEXT,
  loser_id TEXT,
  reputation_delta INT
);

-- Enable RLS
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Allow all access (for MVP - tighten later)
CREATE POLICY "Allow all" ON disputes FOR ALL USING (true);

-- Enable realtime updates
ALTER PUBLICATION supabase_realtime ADD TABLE disputes;

-- Add agent_token column to waitlist if not exists
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS agent_token TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_disputes_claimant ON disputes(claimant_id);
CREATE INDEX IF NOT EXISTS idx_disputes_opponent ON disputes(opponent_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- Function to slash reputation
CREATE OR REPLACE FUNCTION slash_reputation(agent TEXT, amount INT)
RETURNS VOID AS $$
BEGIN
  UPDATE waitlist 
  SET reputation = GREATEST(0, reputation - amount)
  WHERE agent_id = agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to boost reputation  
CREATE OR REPLACE FUNCTION boost_reputation(agent TEXT, amount INT)
RETURNS VOID AS $$
BEGIN
  UPDATE waitlist 
  SET reputation = reputation + amount
  WHERE agent_id = agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
