-- Migration 035: ClawFS unique constraint + audit fixes
-- Run in Supabase dashboard SQL editor
-- All statements are idempotent

-- 1. Add UNIQUE constraint on (agent_id, path) so upsert works correctly.
--    Without this, Supabase's onConflict upsert silently no-ops and writes are lost.
--    Deduplication: keep only the latest row per (agent_id, path) before adding constraint.
DELETE FROM clawfs_files
WHERE id NOT IN (
  SELECT DISTINCT ON (agent_id, path) id
  FROM clawfs_files
  ORDER BY agent_id, path, created_at DESC NULLS LAST
);

ALTER TABLE clawfs_files
  ADD CONSTRAINT clawfs_files_agent_path_unique UNIQUE (agent_id, path);

-- 2. Add missing columns if not yet present (safe with IF NOT EXISTS)
ALTER TABLE clawfs_files
  ADD COLUMN IF NOT EXISTS content_preview TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS shared_with TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;

-- 3. Index on visibility for public file reads
CREATE INDEX IF NOT EXISTS idx_clawfs_files_visibility ON clawfs_files(visibility) WHERE visibility != 'private';

-- 4. bootstrap_tasks: add UNIQUE(agent_id, task_type) so upsert works correctly.
--    Without this, seedOnboarding's upsert silently no-ops and tasks are never created.
--    Dedup first: keep only the latest pending or latest completed per (agent_id, task_type)
DELETE FROM bootstrap_tasks
WHERE id NOT IN (
  SELECT DISTINCT ON (agent_id, task_type) id
  FROM bootstrap_tasks
  ORDER BY agent_id, task_type, created_at DESC NULLS LAST
);

ALTER TABLE bootstrap_tasks
  ADD CONSTRAINT bootstrap_tasks_agent_type_unique UNIQUE (agent_id, task_type);

-- 4b. Extend expires_at to 30 days (was defaulted to 7 days in old schema)
UPDATE bootstrap_tasks
SET expires_at = created_at + INTERVAL '30 days'
WHERE status = 'pending'
  AND expires_at < created_at + INTERVAL '20 days';

-- 5. agent_registry: ensure activation_status defaults to 'active' for newly registered agents
ALTER TABLE agent_registry
  ALTER COLUMN activation_status SET DEFAULT 'active';
