-- GROK PARABOLIC PACKAGE — Supabase Schema
-- Run this in Supabase SQL Editor

-- 1. Drop existing table (careful: this deletes data)
-- Uncomment if you need fresh start:
-- DROP TABLE IF EXISTS waitlist;

-- 2. Create table with position auto-increment
CREATE TABLE IF NOT EXISTS waitlist (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT UNIQUE NOT NULL,
  agent_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  referrer_agent_id TEXT,
  referral_count INTEGER DEFAULT 0,
  position BIGINT GENERATED ALWAYS AS IDENTITY,
  confirmed BOOLEAN DEFAULT FALSE
);

-- 3. Indexes for speed
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_agent_id ON waitlist(agent_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_referrer ON waitlist(referrer_agent_id);

-- 4. RLS Policies (secure for production)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (validated on server)
CREATE POLICY "Anyone can join waitlist" ON waitlist
  FOR INSERT TO anon WITH CHECK (true);

-- No public read (protect emails)
CREATE POLICY "No public read" ON waitlist
  FOR SELECT USING (false);

-- No public update/delete
CREATE POLICY "No public update/delete" ON waitlist
  FOR UPDATE, DELETE USING (false);

-- 5. Reserve critical agent_ids (run once)
INSERT INTO waitlist (email, agent_id, public_key, confirmed) VALUES 
('reserved@tap.ai', 'admin', 'reserved', TRUE),
('reserved@tap.ai', 'system', 'reserved', TRUE),
('reserved@tap.ai', 'root', 'reserved', TRUE),
('reserved@tap.ai', 'support', 'reserved', TRUE),
('reserved@tap.ai', 'help', 'reserved', TRUE)
ON CONFLICT (agent_id) DO NOTHING;

-- 6. Function to get position with referral boost (optional)
-- This calculates effective position including referral bonuses
CREATE OR REPLACE FUNCTION get_effective_position(agent_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  base_pos INTEGER;
  referrals INTEGER;
  boost INTEGER;
BEGIN
  SELECT position, referral_count 
  INTO base_pos, referrals
  FROM waitlist 
  WHERE id = agent_uuid;
  
  -- Calculate boost: -5 positions per 3 referrals, max -20
  boost := LEAST((referrals / 3) * 5, 20);
  
  RETURN base_pos - boost;
END;
$$ LANGUAGE plpgsql;
