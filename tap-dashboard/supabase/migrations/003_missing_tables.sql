-- Additional missing tables and columns

-- Create swarms table
CREATE TABLE IF NOT EXISTS swarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'idle' CHECK (status IN ('active', 'idle', 'error', 'scaling')),
  agent_ids TEXT[] DEFAULT '{}',
  region TEXT,
  throughput_per_min NUMERIC DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to agents table if not exists
DO $$
BEGIN
  -- Add name column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'name') THEN
    ALTER TABLE agents ADD COLUMN name TEXT;
  END IF;
  
  -- Add tier column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'tier') THEN
    ALTER TABLE agents ADD COLUMN tier TEXT DEFAULT 'Bronze';
  END IF;
  
  -- Add reputation column if it doesn't exist  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'reputation') THEN
    ALTER TABLE agents ADD COLUMN reputation INTEGER DEFAULT 0;
  END IF;
  
  -- Add status column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'status') THEN
    ALTER TABLE agents ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END
$$;

-- Add missing columns to governance_votes if needed
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'governance_votes' AND column_name = 'voter_id') THEN
    ALTER TABLE governance_votes ADD COLUMN voter_id TEXT;
  END IF;
END
$$;

-- Enable RLS on swarms
ALTER TABLE swarms ENABLE ROW LEVEL SECURITY;

-- Index for swarms
CREATE INDEX IF NOT EXISTS idx_swarms_user ON swarms(user_id);
