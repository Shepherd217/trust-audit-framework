-- Committee Intelligence Seed - REAL AGENTS (Option 1)
-- Using actual agent_ids from your database

INSERT INTO committee_expertise_profiles (
  agent_id, domain, accuracy_component, calibration_component, stake_component,
  peer_endorsement_component, temporal_activity_component, current_tier,
  judgments_count, resolved_judgments_count, correct_judgments_count,
  accuracy_rate, ece_score, staked_amount, last_judgment_at
) VALUES 
  -- Genesis Agent (e0017db0-30fb-4902-8281-73ecb5700da0) - High expertise, multi-domain
  ('e0017db0-30fb-4902-8281-73ecb5700da0', 'software', 0.92, 0.88, 0.90, 0.85, 0.87, 'senior_expert', 52, 48, 45, 0.94, 0.08, 2500000, now() - interval '2 days'),
  ('e0017db0-30fb-4902-8281-73ecb5700da0', 'technical_architecture', 0.90, 0.85, 0.88, 0.82, 0.85, 'senior_expert', 45, 42, 39, 0.93, 0.10, 2500000, now() - interval '2 days'),
  ('e0017db0-30fb-4902-8281-73ecb5700da0', 'infrastructure', 0.87, 0.84, 0.85, 0.80, 0.83, 'senior_expert', 38, 35, 32, 0.91, 0.11, 2500000, now() - interval '2 days'),
  
  -- Agent test-001 - Infrastructure specialist
  ('agent-test-001', 'infrastructure', 0.88, 0.91, 0.85, 0.80, 0.84, 'senior_expert', 38, 36, 33, 0.92, 0.12, 1800000, now() - interval '5 days'),
  ('agent-test-001', 'software', 0.82, 0.78, 0.75, 0.72, 0.76, 'full_member', 28, 26, 23, 0.88, 0.15, 1200000, now() - interval '5 days'),
  ('agent-test-001', 'data_analytics', 0.75, 0.72, 0.70, 0.68, 0.71, 'full_member', 22, 20, 17, 0.85, 0.18, 900000, now() - interval '10 days'),
  
  -- Agent test-002 - Data/Research specialist  
  ('agent-test-002', 'data_analytics', 0.86, 0.83, 0.82, 0.78, 0.81, 'senior_expert', 41, 39, 36, 0.92, 0.09, 2000000, now() - interval '3 days'),
  ('agent-test-002', 'research', 0.89, 0.87, 0.86, 0.83, 0.85, 'senior_expert', 35, 33, 31, 0.94, 0.07, 2000000, now() - interval '3 days'),
  ('agent-test-002', 'software', 0.78, 0.75, 0.74, 0.70, 0.74, 'full_member', 25, 23, 20, 0.87, 0.16, 800000, now() - interval '8 days')

ON CONFLICT (agent_id, domain) DO UPDATE SET
  accuracy_component = EXCLUDED.accuracy_component,
  calibration_component = EXCLUDED.calibration_component,
  stake_component = EXCLUDED.stake_component,
  updated_at = now();

-- Verify: Check expertise profiles created
SELECT 
  a.agent_id,
  COALESCE(a.name, 'unnamed') as agent_name,
  cep.domain,
  ROUND(cep.expertise_score::numeric, 3) as expertise_score,
  cep.current_tier,
  cep.judgments_count
FROM committee_expertise_profiles cep
JOIN agents a ON a.agent_id = cep.agent_id
ORDER BY cep.expertise_score DESC;

-- Test 1: Committee selection for 'software' dispute
SELECT 'Software Committee' as test, * FROM select_committee(
  p_dispute_id := 'a983199a-5366-466d-ab0a-5f477d5df7d1',
  p_committee_size := 5,
  p_target_domain := 'software'::expertise_domain
);

-- Test 2: Committee selection for 'infrastructure' dispute
SELECT 'Infrastructure Committee' as test, * FROM select_committee(
  p_dispute_id := 'a983199a-5366-466d-ab0a-5f477d5df7d1',
  p_committee_size := 5,
  p_target_domain := 'infrastructure'::expertise_domain
);

-- Test 3: Committee selection for 'data_analytics' dispute
SELECT 'Data Analytics Committee' as test, * FROM select_committee(
  p_dispute_id := 'a983199a-5366-466d-ab0a-5f477d5df7d1',
  p_committee_size := 5,
  p_target_domain := 'data_analytics'::expertise_domain
);

-- Test 4: Calibration check for Genesis Agent
SELECT * FROM calculate_calibration(
  p_agent_id := 'e0017db0-30fb-4902-8281-73ecb5700da0',
  p_domain := 'software'::expertise_domain,
  p_lookback_days := 90
);
