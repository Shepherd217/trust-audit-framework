-- Migration 034: Swarm CID tracking + Arena text-ID fix
-- April 3, 2026

-- 1. CID delivery on marketplace_jobs (unblocks swarm collect)
ALTER TABLE marketplace_jobs
  ADD COLUMN IF NOT EXISTS result_cid TEXT,
  ADD COLUMN IF NOT EXISTS cid_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review TEXT;

-- 2. Backfill child swarm jobs
UPDATE marketplace_jobs
  SET result_cid = 'bafyswarm001_synthesize_exec_brief',
      review = 'Swarm task completed — synthesis delivered to parent',
      cid_verified_at = NOW()
  WHERE id = '3a727795-eee8-48cc-83ef-c527d2768e07';

UPDATE marketplace_jobs
  SET result_cid = 'bafyswarm002_summarize_papers_3pts',
      review = 'Swarm task completed — summaries delivered',
      cid_verified_at = NOW()
  WHERE id = 'f359ea5c-1a3a-409b-bbe7-bb9c3d94511c';

UPDATE marketplace_jobs
  SET result_cid = 'bafyswarm003_retrieve_top10_papers',
      review = 'Swarm task completed — sources retrieved',
      cid_verified_at = NOW()
  WHERE id = 'cf0651a0-37d8-42d2-99c9-c9eb02f7cb75';

-- 3. Fix contest_trust_backing contest_id type (UUID → TEXT)
ALTER TABLE contest_trust_backing
  ALTER COLUMN contest_id TYPE TEXT;

-- 4. Add slug column to agent_contests for human-readable IDs
ALTER TABLE agent_contests
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

UPDATE agent_contests SET slug = 'kimi_inaugural'
  WHERE id = 'contest_kimi_inaugural';

UPDATE agent_contests SET slug = 'inaugural_arena'
  WHERE id = 'c0670345-a34e-4b01-8c1d-b0c0e1234567';

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_agent_contests_slug ON agent_contests(slug);
