-- RALPH LOOP FIXES
-- Database schema for TAP + Arbitra

-- ============================================
-- 1. ATTESTATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  agent_id TEXT NOT NULL,
  repo TEXT NOT NULL,
  "package" TEXT,
  commit TEXT NOT NULL,
  integrity_score INTEGER CHECK (integrity_score >= 0 AND integrity_score <= 100),
  virtue_score INTEGER CHECK (virtue_score >= 0 AND virtue_score <= 100),
  total_reputation INTEGER CHECK (total_reputation >= 0 AND total_reputation <= 100),
  report JSONB DEFAULT '{}',
  status TEXT CHECK (status IN ('verified', 'failed', 'pending')),
  referrer_agent_id TEXT,
  domain_tags TEXT[] DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attestations_agent ON attestations(agent_id);
CREATE INDEX IF NOT EXISTS idx_attestations_status ON attestations(status);
CREATE INDEX IF NOT EXISTS idx_attestations_repo ON attestations(repo);

-- RLS policies
ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON attestations FOR ALL USING (true);

-- ============================================
-- 2. ARBITRA MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS arbitra_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  agent_id TEXT NOT NULL UNIQUE,
  repo TEXT NOT NULL,
  "package" TEXT,
  commit TEXT,
  arbitra_score INTEGER CHECK (arbitra_score >= 0 AND arbitra_score <= 100),
  committee_eligible BOOLEAN DEFAULT false,
  total_votes_cast INTEGER DEFAULT 0,
  correct_votes INTEGER DEFAULT 0,
  reputation_slash_count INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arbitra_agent ON arbitra_members(agent_id);
CREATE INDEX IF NOT EXISTS idx_arbitra_eligible ON arbitra_members(committee_eligible) WHERE committee_eligible = true;

-- RLS
ALTER TABLE arbitra_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON arbitra_members FOR ALL USING (true);

-- ============================================
-- 3. DISPUTES TABLE (for Arbitra)
-- ============================================
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimant_id TEXT REFERENCES arbitra_members(agent_id),
  opponent_id TEXT REFERENCES arbitra_members(agent_id),
  claim TEXT NOT NULL,
  evidence JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'resolved', 'deadlocked')),
  committee JSONB DEFAULT '[]',
  resolution TEXT,
  winner_id TEXT,
  loser_id TEXT,
  reputation_delta INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_claimant ON disputes(claimant_id);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON disputes FOR ALL USING (true);

-- ============================================
-- 4. SEED DATA (Genesis Agent)
-- ============================================
INSERT INTO attestations (agent_id, repo, "package", commit, integrity_score, virtue_score, total_reputation, status, domain_tags)
VALUES ('openclaw', 'Shepherd217/trust-audit-framework', 'tap-sdk', '8d1b60a', 100, 85, 91, 'verified', ARRAY['code-review', 'infrastructure'])
ON CONFLICT DO NOTHING;

INSERT INTO arbitra_members (agent_id, repo, "package", commit, arbitra_score, committee_eligible)
VALUES ('openclaw', 'Shepherd217/trust-audit-framework', 'tap-sdk', '8d1b60a', 92, true)
ON CONFLICT DO NOTHING;
