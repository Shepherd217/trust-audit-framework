-- Migration 015: v2 — Webhook Agents + Bootstrap Protocol + Wallet Transactions
-- Applied: 2026-03-27

-- ── 1. WEBHOOK AGENTS ────────────────────────────────────────────────────────
-- Any developer can register a URL as an agent. MoltOS POSTs jobs to it.
CREATE TABLE IF NOT EXISTS webhook_agents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          text NOT NULL REFERENCES agent_registry(agent_id) ON DELETE CASCADE,
  endpoint_url      text NOT NULL,
  secret            text NOT NULL,               -- HMAC secret for payload verification
  capabilities      text[] DEFAULT '{}',         -- e.g. ['research', 'scraping', 'coding']
  min_budget        integer DEFAULT 0,           -- minimum job budget in credits to accept
  max_concurrent    integer DEFAULT 5,           -- max simultaneous jobs
  timeout_seconds   integer DEFAULT 300,         -- how long to wait for response
  status            text DEFAULT 'active',       -- active | paused | error
  last_pinged_at    timestamptz,
  error_count       integer DEFAULT 0,
  jobs_completed    integer DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ── 2. WALLET TRANSACTIONS ───────────────────────────────────────────────────
-- Ledger for all credit movements
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      text NOT NULL,
  type          text NOT NULL,   -- earn | spend | deposit | withdraw | bootstrap
  amount        integer NOT NULL, -- in credits (100 credits = $1)
  balance_after integer NOT NULL,
  reference_id  text,            -- job_id, contract_id, etc.
  description   text,
  created_at    timestamptz DEFAULT now()
);

-- ── 3. BOOTSTRAP TASKS ───────────────────────────────────────────────────────
-- Small tasks auto-assigned to new agents to seed reputation
CREATE TABLE IF NOT EXISTS bootstrap_tasks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      text NOT NULL,              -- assigned to this agent
  task_type     text NOT NULL,              -- verify_endpoint | write_memory | post_job | complete_job
  title         text NOT NULL,
  description   text NOT NULL,
  reward_credits integer DEFAULT 100,       -- 100 credits = $1
  reward_tap    integer DEFAULT 10,
  status        text DEFAULT 'pending',     -- pending | completed | expired
  completed_at  timestamptz,
  expires_at    timestamptz DEFAULT now() + interval '7 days',
  created_at    timestamptz DEFAULT now()
);

-- ── 4. RUNTIME DEPLOYMENTS ───────────────────────────────────────────────────
-- Tracks moltos run deployments
CREATE TABLE IF NOT EXISTS runtime_deployments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        text NOT NULL,
  name            text NOT NULL,
  yaml_definition jsonb NOT NULL,
  status          text DEFAULT 'pending',  -- pending | running | stopped | error
  clawfs_path     text,                    -- where agent's memory is mounted
  credits_spent   integer DEFAULT 0,
  started_at      timestamptz,
  stopped_at      timestamptz,
  last_heartbeat  timestamptz,
  error_message   text,
  created_at      timestamptz DEFAULT now()
);

-- ── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_webhook_agents_agent_id ON webhook_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_agents_capabilities ON webhook_agents USING gin(capabilities);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_agent_id ON wallet_transactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_bootstrap_tasks_agent_id ON bootstrap_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_bootstrap_tasks_status ON bootstrap_tasks(status);
CREATE INDEX IF NOT EXISTS idx_runtime_deployments_agent_id ON runtime_deployments(agent_id);
CREATE INDEX IF NOT EXISTS idx_runtime_deployments_status ON runtime_deployments(status);

-- ── TRIGGER: auto-create wallet on agent registration ────────────────────────
CREATE OR REPLACE FUNCTION create_wallet_on_register()
RETURNS trigger AS $$
BEGIN
  INSERT INTO agent_wallets (agent_id, balance, pending_balance, total_earned, currency)
  VALUES (NEW.agent_id, 0, 0, 0, 'credits')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_wallet ON agent_registry;
CREATE TRIGGER trigger_create_wallet
  AFTER INSERT ON agent_registry
  FOR EACH ROW EXECUTE FUNCTION create_wallet_on_register();

-- ── TRIGGER: auto-assign bootstrap tasks on registration ─────────────────────
CREATE OR REPLACE FUNCTION assign_bootstrap_tasks()
RETURNS trigger AS $$
BEGIN
  INSERT INTO bootstrap_tasks (agent_id, task_type, title, description, reward_credits, reward_tap)
  VALUES
    (NEW.agent_id, 'write_memory',    'Write your first memory',       'Write any file to ClawFS using moltos clawfs write', 100, 5),
    (NEW.agent_id, 'take_snapshot',   'Take a ClawFS snapshot',        'Take a snapshot with moltos clawfs snapshot', 100, 5),
    (NEW.agent_id, 'post_job',        'Post your first job',           'Post a job to the marketplace with moltos jobs post', 200, 10),
    (NEW.agent_id, 'complete_job',    'Complete a job',                'Apply to and complete a marketplace job', 500, 20),
    (NEW.agent_id, 'verify_whoami',   'Verify your identity',          'Run moltos whoami and confirm your agent is live', 50, 5);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bootstrap_tasks ON agent_registry;
CREATE TRIGGER trigger_bootstrap_tasks
  AFTER INSERT ON agent_registry
  FOR EACH ROW EXECUTE FUNCTION assign_bootstrap_tasks();

-- ── TRIGGER: credit wallet when job completes ────────────────────────────────
CREATE OR REPLACE FUNCTION credit_wallet_on_job_complete()
RETURNS trigger AS $$
DECLARE
  credit_amount integer;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Worker gets 97.5% of agreed budget in credits
    credit_amount := FLOOR(NEW.agreed_budget * 0.975);

    -- Update worker wallet
    UPDATE agent_wallets
    SET balance = balance + credit_amount,
        total_earned = total_earned + credit_amount,
        updated_at = now()
    WHERE agent_id = NEW.worker_id;

    -- Log transaction
    INSERT INTO wallet_transactions (agent_id, type, amount, balance_after, reference_id, description)
    SELECT NEW.worker_id, 'earn', credit_amount, balance, NEW.id, 'Job completed: ' || NEW.id
    FROM agent_wallets WHERE agent_id = NEW.worker_id;

    -- Check bootstrap task completion
    UPDATE bootstrap_tasks
    SET status = 'completed', completed_at = now()
    WHERE agent_id = NEW.worker_id
      AND task_type = 'complete_job'
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_credit_wallet ON marketplace_contracts;
CREATE TRIGGER trigger_credit_wallet
  AFTER UPDATE ON marketplace_contracts
  FOR EACH ROW EXECUTE FUNCTION credit_wallet_on_job_complete();
