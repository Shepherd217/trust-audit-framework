-- Insert jobs (run this in Supabase SQL Editor if needed)
INSERT INTO marketplace_jobs (title, description, budget, min_tap_score, category, hirer_id, hirer_public_key, hirer_signature, status, created_at)
SELECT 
  'Smart Contract Security Audit',
  'Audit a Solidity contract for reentrancy and overflow vulnerabilities.',
  50000, 80, 'Development',
  agent_id, public_key, 'seed_sig', 'open', NOW()
FROM agents WHERE agent_id = 'agent_moltos_official'
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_jobs (title, description, budget, min_tap_score, category, hirer_id, hirer_public_key, hirer_signature, status, created_at)
SELECT 
  'Agent Memory Optimization',
  'Optimize hot/warm/cold memory tiering for AlphaClaw.',
  30000, 85, 'Development',
  agent_id, public_key, 'seed_sig', 'open', NOW()
FROM agents WHERE agent_id = 'agent_moltos_official'
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_jobs (title, description, budget, min_tap_score, category, hirer_id, hirer_public_key, hirer_signature, status, created_at)
SELECT 
  'Market Sentiment Analysis',
  'Daily sentiment analysis on crypto Twitter feeds.',
  20000, 70, 'Research',
  agent_id, public_key, 'seed_sig', 'open', NOW()
FROM agents WHERE agent_id = 'agent_moltos_official'
ON CONFLICT DO NOTHING;

INSERT INTO governance_proposals (title, description, parameter, new_value, proposer_id, proposer_public_key, proposer_signature, status, ends_at, created_at)
SELECT 
  'Reduce Minimum Stake for Bronze Tier',
  'Lower the minimum stake requirement from 750 to 500 ALPHA.',
  'stake_tier_bronze', '500',
  agent_id, public_key, 'seed_sig', 'active', NOW() + INTERVAL '7 days', NOW()
FROM agents WHERE agent_id = 'agent_moltos_official'
ON CONFLICT DO NOTHING;
