-- Supabase Schema for Arbitra
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimant_id TEXT REFERENCES waitlist(agent_id),
  opponent_id TEXT REFERENCES waitlist(agent_id),
  claim TEXT,
  evidence JSONB,
  status TEXT DEFAULT 'pending', -- pending | committee_formed | voting | resolved | appealed
  committee JSONB DEFAULT '[]',
  votes JSONB DEFAULT '{}',
  resolution TEXT,
  winner_id TEXT,
  loser_id TEXT,
  reputation_delta INT,
  resolved_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all" ON disputes FOR ALL USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE disputes;

-- Function to slash reputation
CREATE OR REPLACE FUNCTION slash_reputation(agent TEXT, amount INT)
RETURNS VOID AS $$
BEGIN
  UPDATE waitlist 
  SET reputation = GREATEST(0, reputation - amount)
  WHERE agent_id = agent;
END;
$$ LANGUAGE plpgsql;

-- Function to boost reputation  
CREATE OR REPLACE FUNCTION boost_reputation(agent TEXT, amount INT)
RETURNS VOID AS $$
BEGIN
  UPDATE waitlist 
  SET reputation = reputation + amount
  WHERE agent_id = agent;
END;
$$ LANGUAGE plpgsql;
