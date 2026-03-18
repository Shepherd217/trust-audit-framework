-- Migration: Fix tap_scores table schema for WoT integration
-- Date: March 19, 2026
-- Description: Ensures tap_scores table has correct columns for EigenTrust

-- Check if tap_scores table exists, create if not
CREATE TABLE IF NOT EXISTS tap_scores (
    agent_id TEXT PRIMARY KEY REFERENCES agent_registry(agent_id) ON DELETE CASCADE,
    name TEXT,
    tap_score INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'Bronze',
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist
DO $$
BEGIN
    -- Add name if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tap_scores' 
                   AND column_name = 'name') THEN
        ALTER TABLE tap_scores ADD COLUMN name TEXT;
    END IF;

    -- Add tap_score if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tap_scores' 
                   AND column_name = 'tap_score') THEN
        ALTER TABLE tap_scores ADD COLUMN tap_score INTEGER DEFAULT 0;
    END IF;

    -- Add tier if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tap_scores' 
                   AND column_name = 'tier') THEN
        ALTER TABLE tap_scores ADD COLUMN tier TEXT DEFAULT 'Bronze';
    END IF;

    -- Add last_calculated_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tap_scores' 
                   AND column_name = 'last_calculated_at') THEN
        ALTER TABLE tap_scores ADD COLUMN last_calculated_at TIMESTAMPTZ;
    END IF;
END $$;

-- Drop old claw_id column if it exists (from old schema)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'tap_scores' 
               AND column_name = 'claw_id') THEN
        -- Migrate data if needed
        -- Then drop column
        ALTER TABLE tap_scores DROP COLUMN IF EXISTS claw_id;
    END IF;
END $$;

-- Create index on tap_score for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_tap_scores_score ON tap_scores(tap_score DESC);

-- Enable RLS
ALTER TABLE tap_scores ENABLE ROW LEVEL SECURITY;

-- Insert existing agents into tap_scores if not present
INSERT INTO tap_scores (agent_id, name, tap_score, tier)
SELECT 
    ar.agent_id,
    ar.name,
    COALESCE(ar.reputation, 0),
    CASE 
        WHEN ar.reputation >= 8000 THEN 'Diamond'
        WHEN ar.reputation >= 6000 THEN 'Platinum'
        WHEN ar.reputation >= 4000 THEN 'Gold'
        WHEN ar.reputation >= 2000 THEN 'Silver'
        ELSE 'Bronze'
    END
FROM agent_registry ar
LEFT JOIN tap_scores ts ON ar.agent_id = ts.agent_id
WHERE ts.agent_id IS NULL;

-- Migration complete
