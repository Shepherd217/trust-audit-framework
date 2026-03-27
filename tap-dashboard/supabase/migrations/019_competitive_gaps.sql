-- Migration 019: Competitive Gaps
-- 1. Agent activity feed (view)
-- 2. Agent-published templates (column additions)
-- 3. Reputation decay cron
-- Applied: 2026-03-28

-- ── 1. AGENT ACTIVITY VIEW ───────────────────────────────────────────────────
CREATE OR REPLACE VIEW agent_activity AS
SELECT
  c.worker_id                                    AS agent_id,
  c.id                                           AS contract_id,
  c.job_id,
  j.title                                        AS job_title,
  j.category,
  c.agreed_budget,
  c.status,
  c.rating,
  c.review,
  c.completed_at,
  c.created_at
FROM marketplace_contracts c
LEFT JOIN marketplace_jobs j ON j.id = c.job_id
WHERE c.status IN ('completed', 'active', 'disputed')
ORDER BY c.created_at DESC;

-- ── 2. AGENT-PUBLISHED TEMPLATES ─────────────────────────────────────────────
ALTER TABLE agent_templates
  ADD COLUMN IF NOT EXISTS created_by        text DEFAULT null,  -- agent_id of publisher
  ADD COLUMN IF NOT EXISTS installs_count    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yaml_definition   jsonb DEFAULT null, -- ready-to-run job YAML
  ADD COLUMN IF NOT EXISTS sample_budget     integer DEFAULT null,
  ADD COLUMN IF NOT EXISTS is_community      boolean DEFAULT false;  -- published by agent vs MoltOS

CREATE INDEX IF NOT EXISTS idx_agent_templates_created_by ON agent_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_templates_community ON agent_templates(is_community) WHERE is_community = true;

-- ── 3. REPUTATION DECAY TRACKING ─────────────────────────────────────────────
ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS decay_exempt      boolean DEFAULT false,  -- genesis agents exempt
  ADD COLUMN IF NOT EXISTS last_decay_at     timestamptz DEFAULT null;

-- ── 4. SEED REAL JOB TEMPLATES ───────────────────────────────────────────────
INSERT INTO agent_templates (name, slug, description, short_description, category, tags, icon, is_active, is_featured, is_community, min_reputation, sample_budget, yaml_definition, features, default_config)
VALUES
  (
    'Daily ArXiv AI Digest',
    'daily-arxiv-digest',
    'Scrapes ArXiv daily for top AI/ML papers, summarizes them into bullet points, and saves to ClawFS. Perfect for research teams.',
    'Daily AI paper digest from ArXiv',
    'Research',
    ARRAY['research', 'ai', 'arxiv', 'daily'],
    '📄',
    true, true, false, 0, 500,
    '{"name": "daily-arxiv-digest", "goal": "Scrape top 5 AI papers from ArXiv published today, summarize each in 3 bullet points, save to /agents/digests/arxiv-{date}.md", "tools": ["web_search", "clawfs_write"], "memory_path": "/agents/arxiv-digest/memory", "recurrence": "daily"}'::jsonb,
    '["Daily execution", "ClawFS persistence", "Structured output"]'::jsonb,
    '{"source": "https://arxiv.org/list/cs.AI/recent", "output_format": "markdown", "max_papers": 5}'::jsonb
  ),
  (
    'SEO Keyword Monitor',
    'seo-keyword-monitor',
    'Monitors search rankings for a list of keywords weekly, saves results to ClawFS, and alerts on significant changes.',
    'Weekly SEO ranking tracker',
    'Research',
    ARRAY['seo', 'monitoring', 'weekly', 'search'],
    '📊',
    true, false, false, 0, 300,
    '{"name": "seo-keyword-monitor", "goal": "Check search rankings for configured keywords, compare to last week, save diff report to ClawFS", "tools": ["web_search", "clawfs_write", "clawfs_read"], "memory_path": "/agents/seo-monitor/memory", "recurrence": "weekly"}'::jsonb,
    '["Weekly execution", "Trend tracking", "Change alerts"]'::jsonb,
    '{"keywords": [], "compare_weeks": 4}'::jsonb
  ),
  (
    'Code Review Agent',
    'code-review',
    'Reviews a GitHub PR or code snippet for bugs, security issues, and style. Returns structured JSON report.',
    'Automated code review and security scan',
    'Development',
    ARRAY['coding', 'review', 'security', 'github'],
    '🔍',
    true, true, false, 25, 1000,
    '{"name": "code-review", "goal": "Review provided code or GitHub PR URL for bugs, security vulnerabilities, and style issues. Return structured JSON with severity ratings.", "tools": ["web_search", "clawfs_write"], "memory_path": "/agents/code-review/memory"}'::jsonb,
    '["Security scanning", "Style analysis", "Structured output", "TAP-verified"]'::jsonb,
    '{"severity_threshold": "medium", "include_suggestions": true}'::jsonb
  ),
  (
    'Data Scraper',
    'data-scraper',
    'Scrapes structured data from any public URL and saves as JSON to ClawFS. Configurable selectors.',
    'General-purpose web scraper',
    'Development',
    ARRAY['scraping', 'data', 'json', 'extraction'],
    '🕷️',
    true, false, false, 0, 200,
    '{"name": "data-scraper", "goal": "Scrape configured URL(s), extract structured data matching provided selectors, save as JSON to ClawFS output path", "tools": ["web_search", "clawfs_write"], "memory_path": "/agents/scraper/memory"}'::jsonb,
    '["Configurable selectors", "JSON output", "ClawFS storage"]'::jsonb,
    '{"urls": [], "output_path": "/agents/scraped-data/output.json"}'::jsonb
  ),
  (
    'Market Research Report',
    'market-research',
    'Researches a topic or company, compiles a structured market report with sources, saves to ClawFS as Markdown.',
    'AI-powered market research',
    'Research',
    ARRAY['research', 'market', 'report', 'analysis'],
    '📈',
    true, true, false, 0, 2000,
    '{"name": "market-research", "goal": "Research provided topic thoroughly. Find market size, key players, trends, and opportunities. Write structured report with citations. Save to ClawFS.", "tools": ["web_search", "clawfs_write"], "memory_path": "/agents/research/memory"}'::jsonb,
    '["Sourced research", "Structured report", "Market analysis", "ClawFS output"]'::jsonb,
    '{"depth": "comprehensive", "include_competitors": true, "output_format": "markdown"}'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;

-- Mark genesis agents as decay-exempt
UPDATE agent_registry SET decay_exempt = true WHERE is_genesis = true;
