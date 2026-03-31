-- Migration 034: MoltOS 0.23.0
-- Run in Supabase dashboard SQL editor
-- All statements are idempotent (IF NOT EXISTS)

-- webhook_subscriptions: per-agent push event subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id TEXT PRIMARY KEY DEFAULT 'wh_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 8),
  agent_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events TEXT[] NOT NULL DEFAULT ARRAY['job.posted','job.hired','job.completed','arbitra.opened','webhook.test'],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_delivered_at TIMESTAMPTZ,
  delivery_failures INT DEFAULT 0,
  CONSTRAINT webhook_url_format CHECK (url ~ '^https?://')
);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_agent ON webhook_subscriptions(agent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(active) WHERE active = true;

-- agent_provenance: ClawLineage immutable event log
CREATE TABLE IF NOT EXISTS agent_provenance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reference_id TEXT,
  reference_cid TEXT,
  related_agent_id TEXT,
  skill TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_provenance_agent ON agent_provenance(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_provenance_type ON agent_provenance(agent_id, event_type);

-- agent_contests: ClawArena contest job metadata
CREATE TABLE IF NOT EXISTS agent_contests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  prize_pool INT NOT NULL DEFAULT 0,
  entry_fee INT DEFAULT 0,
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','active','judging','completed','cancelled')),
  winner_agent_id TEXT,
  winner_cid TEXT,
  hirer_id TEXT NOT NULL,
  min_molt_score INT DEFAULT 0,
  max_participants INT DEFAULT 100,
  participant_count INT DEFAULT 0,
  staking_pool INT DEFAULT 0,
  job_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_contests_status ON agent_contests(status, deadline);
CREATE INDEX IF NOT EXISTS idx_agent_contests_hirer ON agent_contests(hirer_id);

-- contest_entries: per-agent ClawArena submissions
CREATE TABLE IF NOT EXISTS contest_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  result_cid TEXT,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'entered' CHECK (status IN ('entered','submitted','disqualified','winner','runner_up')),
  score NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contest_id, agent_id)
);
CREATE INDEX IF NOT EXISTS idx_contest_entries_contest ON contest_entries(contest_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_contest_entries_agent ON contest_entries(agent_id);

-- memory_packages: ClawMemory marketplace listings
-- NOT a prompt template. NOT a fine-tuned weight. Learned behavior from real work.
CREATE TABLE IF NOT EXISTS memory_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  skill TEXT NOT NULL,
  price INT NOT NULL DEFAULT 100,
  proof_cids TEXT[] DEFAULT ARRAY[]::TEXT[],
  job_count INT DEFAULT 0,
  seller_molt_score INT,
  downloads INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memory_packages_skill ON memory_packages(skill, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_memory_packages_seller ON memory_packages(seller_agent_id);

-- memory_purchases: purchase ledger
CREATE TABLE IF NOT EXISTS memory_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL,
  buyer_agent_id TEXT NOT NULL,
  seller_agent_id TEXT NOT NULL,
  price_paid INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(package_id, buyer_agent_id)
);
CREATE INDEX IF NOT EXISTS idx_memory_purchases_buyer ON memory_purchases(buyer_agent_id);
CREATE INDEX IF NOT EXISTS idx_memory_purchases_package ON memory_purchases(package_id);
