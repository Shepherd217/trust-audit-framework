-- Seed data for Committee Intelligence testing
-- Run this after Migration 026 to populate expertise profiles for testing

-- Insert dummy agents into agents table first (if not exists)
INSERT INTO agents (id, name, description, claw_id, status, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'test_expert_1', 'Software Architecture Expert', 'claw:test1', 'active', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'test_expert_2', 'Infrastructure Specialist', 'claw:test2', 'active', now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'test_expert_3', 'Data Analytics Expert', 'claw:test3', 'active', now(), now()),
  ('44444444-4444-4444-4444-444444444444', 'test_expert_4', 'Creative Lead', 'claw:test4', 'active', now(), now()),
  ('55555555-5555-5555-5555-555555555555', 'test_expert_5', 'Research Specialist', 'claw:test5', 'active', now(), now()),
  ('66666666-6666-6666-6666-666666666666', 'test_expert_6', 'Full Stack Developer', 'claw:test6', 'active', now(), now()),
  ('77777777-7777-7777-7777-777777777777', 'test_expert_7', 'DevOps Engineer', 'claw:test7', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Insert expertise profiles for testing
INSERT INTO committee_expertise_profiles (
  agent_id, domain, accuracy_component, calibration_component, stake_component,
  peer_endorsement_component, temporal_activity_component, current_tier,
  judgments_count, resolved_judgments_count, correct_judgments_count,
  accuracy_rate, ece_score, staked_amount, last_judgment_at
) VALUES 
  -- Software experts
  ('11111111-1111-1111-1111-111111111111', 'software', 0.85, 0.80, 0.70, 0.60, 0.75, 'senior_expert', 45, 42, 38, 0.90, 0.08, 1000000, now() - interval '5 days'),
  ('11111111-1111-1111-1111-111111111111', 'technical_architecture', 0.90, 0.85, 0.75, 0.65, 0.80, 'senior_expert', 40, 38, 35, 0.92, 0.06, 1000000, now() - interval '5 days'),
  
  -- Infrastructure experts  
  ('22222222-2222-2222-2222-222222222222', 'infrastructure', 0.88, 0.82, 0.72, 0.58, 0.78, 'senior_expert', 50, 48, 44, 0.92, 0.07, 1200000, now() - interval '3 days'),
  ('22222222-2222-2222-2222-222222222222', 'technical_architecture', 0.82, 0.78, 0.68, 0.55, 0.72, 'full_member', 35, 33, 29, 0.88, 0.10, 800000, now() - interval '3 days'),
  
  -- Data analytics experts
  ('33333333-3333-3333-3333-333333333333', 'data_analytics', 0.86, 0.83, 0.74, 0.62, 0.76, 'senior_expert', 38, 36, 33, 0.92, 0.08, 900000, now() - interval '7 days'),
  ('33333333-3333-3333-3333-333333333333', 'research', 0.80, 0.75, 0.65, 0.50, 0.70, 'full_member', 25, 24, 21, 0.88, 0.12, 600000, now() - interval '7 days'),
  
  -- Creative expert
  ('44444444-4444-4444-4444-444444444444', 'creative', 0.84, 0.79, 0.71, 0.59, 0.74, 'full_member', 42, 40, 35, 0.88, 0.09, 850000, now() - interval '10 days'),
  
  -- Research expert
  ('55555555-5555-5555-5555-555555555555', 'research', 0.87, 0.84, 0.73, 0.61, 0.77, 'senior_expert', 55, 52, 48, 0.92, 0.07, 1100000, now() - interval '2 days'),
  
  -- Full stack (software + infrastructure)
  ('66666666-6666-6666-6666-666666666666', 'software', 0.82, 0.76, 0.68, 0.54, 0.72, 'full_member', 30, 28, 24, 0.86, 0.11, 700000, now() - interval '8 days'),
  ('66666666-6666-6666-6666-666666666666', 'infrastructure', 0.78, 0.74, 0.65, 0.52, 0.70, 'full_member', 28, 26, 22, 0.85, 0.13, 650000, now() - interval '8 days'),
  
  -- DevOps (infrastructure focus)
  ('77777777-7777-7777-7777-777777777777', 'infrastructure', 0.85, 0.81, 0.72, 0.60, 0.76, 'full_member', 33, 31, 28, 0.90, 0.08, 800000, now() - interval '6 days')

ON CONFLICT (agent_id, domain) DO UPDATE SET
  accuracy_component = EXCLUDED.accuracy_component,
  calibration_component = EXCLUDED.calibration_component,
  stake_component = EXCLUDED.stake_component,
  judgments_count = EXCLUDED.judgments_count,
  updated_at = now();

-- Verify insertion
SELECT 
  a.name as agent_name,
  cep.domain,
  cep.current_tier,
  ROUND(cep.expertise_score::numeric, 3) as expertise_score,
  cep.judgments_count
FROM committee_expertise_profiles cep
JOIN agents a ON a.id = cep.agent_id
ORDER BY cep.expertise_score DESC;
