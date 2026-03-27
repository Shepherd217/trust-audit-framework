-- Migration 018: Important Gaps
-- 1. Wallet transfer (agent-to-agent payments)
-- 2. ClawFS content search
-- 3. Agent health/uptime tracking
-- 4. Team/swarm revenue split
-- Applied: 2026-03-28

-- ── 1. WALLET TRANSFER ────────────────────────────────────────────────────────
ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS to_agent     text DEFAULT null,  -- for transfer type
  ADD COLUMN IF NOT EXISTS from_agent   text DEFAULT null,  -- who sent it
  ADD COLUMN IF NOT EXISTS memo         text DEFAULT null;  -- optional note

-- ── 2. CLAWFS CONTENT SEARCH ──────────────────────────────────────────────────
-- Add content_preview for searchable text snippets (agents can opt-in)
ALTER TABLE clawfs_files
  ADD COLUMN IF NOT EXISTS content_preview  text DEFAULT null,   -- first 500 chars of text content
  ADD COLUMN IF NOT EXISTS tags             text[] DEFAULT '{}'; -- agent-defined tags

CREATE INDEX IF NOT EXISTS idx_clawfs_files_tags ON clawfs_files USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_clawfs_files_path_text ON clawfs_files(agent_id, path);

-- ── 3. AGENT HEALTH / UPTIME TRACKING ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_health_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        text NOT NULL,
  status          text DEFAULT 'online',  -- online | idle | offline | error
  last_seen_at    timestamptz DEFAULT now(),
  uptime_pct_7d   numeric(5,2) DEFAULT null,  -- % uptime last 7 days
  jobs_completed  integer DEFAULT 0,
  jobs_failed     integer DEFAULT 0,
  avg_response_ms integer DEFAULT null,
  reliability_score integer DEFAULT null,  -- 0-100 composite
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_health_agent_id ON agent_health_snapshots(agent_id);

-- Add reliability to agent_registry for fast queries
ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS last_seen_at     timestamptz DEFAULT null,
  ADD COLUMN IF NOT EXISTS reliability_score integer DEFAULT null,
  ADD COLUMN IF NOT EXISTS uptime_pct       numeric(5,2) DEFAULT null;

-- Trigger: update last_seen_at on agent_registry when heartbeat fires
CREATE OR REPLACE FUNCTION update_agent_last_seen()
RETURNS trigger AS $$
BEGIN
  UPDATE agent_registry SET last_seen_at = now() WHERE agent_id = NEW.agent_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_last_seen ON agent_health_snapshots;
CREATE TRIGGER trigger_update_last_seen
  AFTER INSERT OR UPDATE ON agent_health_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_agent_last_seen();

-- ── 4. TEAM/SWARM REVENUE SPLIT ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_splits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL,
  job_id          uuid,
  total_credits   integer NOT NULL,
  split_config    jsonb NOT NULL,  -- [{ agent_id, pct, credits }]
  status          text DEFAULT 'pending',  -- pending | processed | failed
  processed_at    timestamptz,
  created_by      text NOT NULL,  -- agent that configured the split
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_splits_contract ON revenue_splits(contract_id);

-- Add swarm_id to marketplace_contracts so we can link team jobs
ALTER TABLE marketplace_contracts
  ADD COLUMN IF NOT EXISTS swarm_id     text DEFAULT null,
  ADD COLUMN IF NOT EXISTS split_id     uuid DEFAULT null;
