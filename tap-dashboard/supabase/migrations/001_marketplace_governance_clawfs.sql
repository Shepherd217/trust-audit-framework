-- Marketplace Jobs
CREATE TABLE marketplace_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  budget NUMERIC NOT NULL,
  min_tap_score INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT 'General',
  skills_required TEXT[] DEFAULT '{}',
  hirer_id TEXT REFERENCES agents(agent_id) ON DELETE CASCADE,
  hirer_public_key TEXT NOT NULL,
  hirer_signature TEXT NOT NULL,
  hired_agent_id TEXT REFERENCES agents(agent_id) ON DELETE SET NULL,
  escrow_intent TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketplace Applications
CREATE TABLE marketplace_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES marketplace_jobs(id) ON DELETE CASCADE,
  applicant_id TEXT REFERENCES agents(agent_id) ON DELETE CASCADE,
  applicant_public_key TEXT NOT NULL,
  applicant_signature TEXT NOT NULL,
  proposal TEXT,
  estimated_hours INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Governance Proposals
CREATE TABLE governance_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  parameter TEXT,
  new_value TEXT,
  evidence_cid TEXT,
  proposer_id TEXT REFERENCES agents(agent_id) ON DELETE CASCADE,
  proposer_public_key TEXT NOT NULL,
  proposer_signature TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Governance Votes
CREATE TABLE governance_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES governance_proposals(id) ON DELETE CASCADE,
  voter_id TEXT REFERENCES agents(agent_id) ON DELETE CASCADE,
  voter_public_key TEXT NOT NULL,
  voter_signature TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('yes', 'no')),
  tap_weight INTEGER NOT NULL DEFAULT 0,
  voted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ClawFS Files
CREATE TABLE clawfs_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES agents(agent_id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  path TEXT NOT NULL,
  cid TEXT NOT NULL,
  content_type TEXT DEFAULT 'application/octet-stream',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ClawFS Snapshots
CREATE TABLE clawfs_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT REFERENCES agents(agent_id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  signature TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  file_cids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_marketplace_jobs_hirer ON marketplace_jobs(hirer_id);
CREATE INDEX idx_marketplace_jobs_status ON marketplace_jobs(status);
CREATE INDEX idx_marketplace_applications_job ON marketplace_applications(job_id);
CREATE INDEX idx_marketplace_applications_applicant ON marketplace_applications(applicant_id);
CREATE INDEX idx_governance_proposals_proposer ON governance_proposals(proposer_id);
CREATE INDEX idx_governance_proposals_status ON governance_proposals(status);
CREATE INDEX idx_governance_votes_proposal ON governance_votes(proposal_id);
CREATE INDEX idx_governance_votes_voter ON governance_votes(voter_id);
CREATE INDEX idx_clawfs_files_agent ON clawfs_files(agent_id);
CREATE INDEX idx_clawfs_files_path ON clawfs_files(path);
CREATE INDEX idx_clawfs_snapshots_agent ON clawfs_snapshots(agent_id);
