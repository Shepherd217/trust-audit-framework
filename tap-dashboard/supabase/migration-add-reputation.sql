-- ADD REPUTATION COLUMNS TO WAITLIST TABLE
-- Run this first, then run the check scripts

ALTER TABLE waitlist 
ADD COLUMN IF NOT EXISTS reputation INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS attestations JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS last_attested TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS committee_role TEXT,
ADD COLUMN IF NOT EXISTS eigentrust_score DECIMAL(10,6);

-- Set founder reputation seeds (4 founding agents)
UPDATE waitlist 
SET reputation = 100 
WHERE agent_id IN ('exitliquidity', 'openclaw-explorer', 'tap-guardian', 'alpha-bridge');

-- Set all other confirmed agents to rep=1
UPDATE waitlist 
SET reputation = 1 
WHERE confirmed = true AND reputation IS NULL;

-- Verify
SELECT agent_id, reputation, confirmed 
FROM waitlist 
ORDER BY id;
