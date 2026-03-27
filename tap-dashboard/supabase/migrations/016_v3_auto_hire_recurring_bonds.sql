-- Migration 016: v3 — Auto-hire, Recurring Jobs, Bonds, Storefronts, ClawBus Schemas, Payment Streaming
-- Applied: 2026-03-27

-- ── 1. AUTO-HIRE + RECURRENCE + BONDS on marketplace_jobs ───────────────────
ALTER TABLE marketplace_jobs
  ADD COLUMN IF NOT EXISTS auto_hire          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_hire_min_tap  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recurrence         text DEFAULT null,   -- null | daily | weekly | monthly
  ADD COLUMN IF NOT EXISTS recurrence_interval integer DEFAULT null, -- interval in hours
  ADD COLUMN IF NOT EXISTS next_run_at        timestamptz DEFAULT null,
  ADD COLUMN IF NOT EXISTS parent_job_id      uuid DEFAULT null,   -- for recurring child jobs
  ADD COLUMN IF NOT EXISTS bond_required      integer DEFAULT 0,   -- credits agent must stake
  ADD COLUMN IF NOT EXISTS preferred_agent_id text DEFAULT null,   -- direct hire target
  ADD COLUMN IF NOT EXISTS total_runs         integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_hired_agent   text DEFAULT null;

-- ── 2. BOND ESCROW on marketplace_contracts ──────────────────────────────────
ALTER TABLE marketplace_contracts
  ADD COLUMN IF NOT EXISTS bond_amount        integer DEFAULT 0,   -- credits staked by worker
  ADD COLUMN IF NOT EXISTS bond_returned      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bond_slashed       boolean DEFAULT false;

-- ── 3. AGENT STOREFRONTS on agent_registry ───────────────────────────────────
ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS handle             text UNIQUE,         -- @my-agent (URL slug)
  ADD COLUMN IF NOT EXISTS bio                text,
  ADD COLUMN IF NOT EXISTS skills             text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capabilities       text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rate_per_hour      integer DEFAULT null, -- credits/hr
  ADD COLUMN IF NOT EXISTS available_for_hire boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS website            text,
  ADD COLUMN IF NOT EXISTS completed_jobs     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS languages          text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timezone           text;

-- ── 4. CLAWBUS MESSAGE SCHEMAS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clawbus_message_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name   text UNIQUE NOT NULL,          -- e.g. 'job.offer', 'task.result', 'ping'
  schema      jsonb NOT NULL,                -- JSON Schema for payload validation
  description text,
  version     text DEFAULT '1.0',
  created_by  text,
  created_at  timestamptz DEFAULT now()
);

-- Seed core message types
INSERT INTO clawbus_message_types (type_name, schema, description, version) VALUES
  ('ping',          '{"type":"object","properties":{"timestamp":{"type":"number"}},"required":["timestamp"]}', 'Liveness check', '1.0'),
  ('job.offer',     '{"type":"object","properties":{"job_id":{"type":"string"},"budget_credits":{"type":"number"},"title":{"type":"string"}},"required":["job_id","budget_credits","title"]}', 'Offer a job to an agent', '1.0'),
  ('job.accept',    '{"type":"object","properties":{"job_id":{"type":"string"},"proposal":{"type":"string"}},"required":["job_id"]}', 'Accept a job offer', '1.0'),
  ('job.decline',   '{"type":"object","properties":{"job_id":{"type":"string"},"reason":{"type":"string"}},"required":["job_id"]}', 'Decline a job offer', '1.0'),
  ('task.result',   '{"type":"object","properties":{"job_id":{"type":"string"},"result":{},"clawfs_path":{"type":"string"}},"required":["job_id","result"]}', 'Submit task result', '1.0'),
  ('payment.sent',  '{"type":"object","properties":{"amount_credits":{"type":"number"},"reference":{"type":"string"}},"required":["amount_credits"]}', 'Payment notification', '1.0'),
  ('attest.request','{"type":"object","properties":{"target_agent_id":{"type":"string"},"score":{"type":"number"}},"required":["target_agent_id","score"]}', 'Request mutual attestation', '1.0')
ON CONFLICT (type_name) DO NOTHING;

-- ── 5. PAYMENT STREAMING / MILESTONES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_streams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL,
  job_id          uuid NOT NULL,
  worker_id       text NOT NULL,
  hirer_id        text NOT NULL,
  total_credits   integer NOT NULL,
  interval_hours  integer NOT NULL DEFAULT 24,   -- release every N hours
  credits_per_interval integer NOT NULL,
  credits_released integer DEFAULT 0,
  next_release_at timestamptz,
  status          text DEFAULT 'active',         -- active | paused | completed
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_streams_next_release ON payment_streams(next_release_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_auto_hire ON marketplace_jobs(auto_hire) WHERE auto_hire = true;
CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_next_run ON marketplace_jobs(next_run_at) WHERE recurrence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_preferred_agent ON marketplace_jobs(preferred_agent_id) WHERE preferred_agent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_registry_handle ON agent_registry(handle) WHERE handle IS NOT NULL;

-- ── TRIGGER: auto-set handle on register if not provided ─────────────────────
CREATE OR REPLACE FUNCTION set_default_handle()
RETURNS trigger AS $$
BEGIN
  IF NEW.handle IS NULL THEN
    NEW.handle := regexp_replace(lower(NEW.name), '[^a-z0-9-]', '-', 'g') || '-' || substr(NEW.agent_id, -6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_handle ON agent_registry;
CREATE TRIGGER trigger_set_handle
  BEFORE INSERT ON agent_registry
  FOR EACH ROW EXECUTE FUNCTION set_default_handle();
