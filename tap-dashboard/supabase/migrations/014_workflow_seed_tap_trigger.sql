-- Migration 014: Seed AI News Digest workflow + TAP scoring trigger
-- Applied: 2026-03-27
-- Closes simulation gaps from Day in the Life stress test

-- ── 1. SEED WORKFLOW ─────────────────────────────────────────────────────────
INSERT INTO claw_workflows (
  workflow_id, name, description, version,
  owner_agent_id, owner_public_key, status, definition,
  node_count, is_valid, tags
) VALUES (
  'wf-ai-news-001',
  'AI News Digest',
  'Scrape AI news, summarize into bullet points, save to ClawFS',
  '1.0',
  'e0017db0-30fb-4902-8281-73ecb5700da0',
  'genesis',
  'active',
  '{
    "tasks": [
      {"id": "1", "type": "scrape",    "name": "Scrape AI News",        "config": {"url": "https://news.ycombinator.com/rss", "format": "rss"}},
      {"id": "2", "type": "transform", "name": "Summarize",              "depends_on": ["1"], "config": {"prompt": "Summarize top 5 AI stories as bullet points"}},
      {"id": "3", "type": "store",     "name": "Save to ClawFS",         "depends_on": ["2"], "config": {"path": "/agents/ai-digest.md", "format": "markdown"}}
    ]
  }'::jsonb,
  3, true, '{"ai","news","digest"}'
) ON CONFLICT (workflow_id) DO NOTHING;

-- ── 2. SEED NODES ────────────────────────────────────────────────────────────
INSERT INTO claw_workflow_nodes (node_id, workflow_id, node_type, name, config, timeout_seconds, max_retries)
SELECT 'node-scrape',     id, 'task', 'Scrape AI News',          '{"url": "https://news.ycombinator.com/rss", "format": "rss"}'::jsonb,     30, 2 FROM claw_workflows WHERE workflow_id = 'wf-ai-news-001'
ON CONFLICT DO NOTHING;

INSERT INTO claw_workflow_nodes (node_id, workflow_id, node_type, name, config, timeout_seconds, max_retries)
SELECT 'node-summarize',  id, 'task', 'Summarize Bullet Points', '{"prompt": "Summarize top 5 AI stories as bullet points"}'::jsonb,          60, 1 FROM claw_workflows WHERE workflow_id = 'wf-ai-news-001'
ON CONFLICT DO NOTHING;

INSERT INTO claw_workflow_nodes (node_id, workflow_id, node_type, name, config, timeout_seconds, max_retries)
SELECT 'node-save',       id, 'task', 'Save to ClawFS',          '{"path": "/agents/ai-digest.md", "format": "markdown"}'::jsonb,              30, 1 FROM claw_workflows WHERE workflow_id = 'wf-ai-news-001'
ON CONFLICT DO NOTHING;

-- ── 3. SEED EDGES (DAG) ──────────────────────────────────────────────────────
INSERT INTO claw_workflow_edges (edge_id, workflow_id, from_node_id, to_node_id, edge_type)
SELECT 'edge-1-2', id, 'node-scrape',    'node-summarize', 'success' FROM claw_workflows WHERE workflow_id = 'wf-ai-news-001'
ON CONFLICT DO NOTHING;

INSERT INTO claw_workflow_edges (edge_id, workflow_id, from_node_id, to_node_id, edge_type)
SELECT 'edge-2-3', id, 'node-summarize', 'node-save',      'success' FROM claw_workflows WHERE workflow_id = 'wf-ai-news-001'
ON CONFLICT DO NOTHING;

-- ── 4. TAP SCORING TRIGGER ───────────────────────────────────────────────────
-- Fires AFTER UPDATE on marketplace_contracts when status transitions to 'completed'
-- +10 TAP to worker, +5 TAP to hirer
-- Updates both agents (legacy) and agent_registry (new registrations)
CREATE OR REPLACE FUNCTION update_tap_on_job_complete()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Legacy agents table
    UPDATE agents SET reputation = reputation + 10 WHERE agent_id = NEW.worker_id;
    UPDATE agents SET reputation = reputation + 5  WHERE agent_id = NEW.hirer_id;
    -- New agent_registry
    UPDATE agent_registry SET reputation = reputation + 10 WHERE agent_id = NEW.worker_id;
    UPDATE agent_registry SET reputation = reputation + 5  WHERE agent_id = NEW.hirer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tap_job_complete ON marketplace_contracts;
CREATE TRIGGER trigger_tap_job_complete
  AFTER UPDATE ON marketplace_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_tap_on_job_complete();
