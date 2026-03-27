-- Migration 017: Critical Gaps
-- 1. ClawFS versioning
-- 2. Agent search
-- 3. ClawFS access control
-- 4. Vercel cron support (table-based trigger log)
-- Applied: 2026-03-28

-- ── 1. CLAWFS FILE VERSIONING ─────────────────────────────────────────────────
-- Add version tracking to clawfs_files
ALTER TABLE clawfs_files
  ADD COLUMN IF NOT EXISTS version_number  integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_file_id  uuid DEFAULT null,  -- previous version
  ADD COLUMN IF NOT EXISTS is_latest       boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS change_summary  text DEFAULT null;

-- file_versions is a view over clawfs_files grouped by path
CREATE TABLE IF NOT EXISTS file_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id         uuid NOT NULL,           -- references clawfs_files.id
  agent_id        text NOT NULL,
  path            text NOT NULL,
  cid             text NOT NULL,
  version_number  integer NOT NULL DEFAULT 1,
  size_bytes      integer,
  change_summary  text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_versions_file_id ON file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_path_agent ON file_versions(agent_id, path);

-- Trigger: when clawfs_files is updated (same path, new write), create version record
CREATE OR REPLACE FUNCTION track_file_version()
RETURNS trigger AS $$
DECLARE
  existing_version integer;
BEGIN
  -- Get current max version for this path+agent
  SELECT COALESCE(MAX(version_number), 0) INTO existing_version
  FROM file_versions
  WHERE agent_id = NEW.agent_id AND path = NEW.path;

  -- Archive old latest as non-latest
  UPDATE clawfs_files
  SET is_latest = false
  WHERE agent_id = NEW.agent_id
    AND path = NEW.path
    AND id != NEW.id
    AND is_latest = true;

  -- Set version number on new record
  NEW.version_number := existing_version + 1;
  NEW.is_latest := true;

  -- Insert version record
  INSERT INTO file_versions (file_id, agent_id, path, cid, version_number, size_bytes, change_summary)
  VALUES (NEW.id, NEW.agent_id, NEW.path, NEW.cid, NEW.version_number, NEW.size_bytes, NEW.change_summary);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_track_file_version ON clawfs_files;
CREATE TRIGGER trigger_track_file_version
  BEFORE INSERT ON clawfs_files
  FOR EACH ROW EXECUTE FUNCTION track_file_version();

-- ── 2. CLAWFS ACCESS CONTROL ──────────────────────────────────────────────────
ALTER TABLE clawfs_files
  ADD COLUMN IF NOT EXISTS visibility     text DEFAULT 'private',  -- private | public | shared
  ADD COLUMN IF NOT EXISTS shared_with    text[] DEFAULT '{}';     -- agent_ids with read access

CREATE INDEX IF NOT EXISTS idx_clawfs_files_visibility ON clawfs_files(visibility) WHERE visibility != 'private';
CREATE INDEX IF NOT EXISTS idx_clawfs_files_version ON clawfs_files(agent_id, path, is_latest);

-- ── 3. AGENT SEARCH ENHANCEMENTS ─────────────────────────────────────────────
-- agent_registry already has capabilities/skills from migration 016
-- Add full-text search index
-- Full text search via separate columns (GIN on expression must be immutable)
CREATE INDEX IF NOT EXISTS idx_agent_registry_name ON agent_registry(name);
CREATE INDEX IF NOT EXISTS idx_agent_registry_skills ON agent_registry USING gin(skills);
CREATE INDEX IF NOT EXISTS idx_agent_registry_capabilities ON agent_registry USING gin(capabilities);

CREATE INDEX IF NOT EXISTS idx_agent_registry_available
  ON agent_registry(available_for_hire, reputation)
  WHERE available_for_hire = true;

-- ── 4. CRON JOB TRIGGER LOG ───────────────────────────────────────────────────
-- Track what cron jobs ran and when — used by vercel.json cron endpoints
CREATE TABLE IF NOT EXISTS cron_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name    text NOT NULL,
  started_at  timestamptz DEFAULT now(),
  finished_at timestamptz,
  status      text DEFAULT 'running',  -- running | success | error
  result      jsonb,
  error       text
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_name, started_at DESC);

-- ── 5. NOTIFICATION PUSH SUPPORT ─────────────────────────────────────────────
-- Add webhook delivery column — when agent has a webhook registered,
-- notifications fire to their endpoint automatically
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS webhook_delivered   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS sse_delivered       boolean DEFAULT false;
