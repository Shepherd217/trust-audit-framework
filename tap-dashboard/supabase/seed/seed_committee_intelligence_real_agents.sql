-- Committee Intelligence Seed - Option 1 (Real Agents + Synthetic Profiles)
-- Run this in Supabase SQL Editor

-- Step 1: View your real agents (copy the agent_ids you want to use)
SELECT agent_id, name, reputation, tier, status 
FROM agents 
WHERE status = 'active' 
ORDER BY reputation DESC 
LIMIT 10;

-- Step 2: After getting real agent_ids from Step 1, replace the UUIDs below
-- Then run this INSERT (example uses placeholder UUIDs - replace with real ones!)

INSERT INTO committee_expertise_profiles (
  agent_id, domain, accuracy_component, calibration_component, stake_component,
  peer_endorsement_component, temporal_activity_component, current_tier,
  judgments_count, resolved_judgments_count, correct_judgments_count,
  accuracy_rate, ece_score, staked_amount, last_judgment_at
) VALUES 
  -- REPLACE 'YOUR-REAL-AGENT-UUID-1' with actual agent_id from Step 1
  ('YOUR-REAL-AGENT-UUID-1', 'software', 0.92, 0.88, 0.90, 0.85, 0.87, 'senior_expert', 52, 48, 45, 0.94, 0.08, 2500000, now() - interval '2 days'),
  ('YOUR-REAL-AGENT-UUID-1', 'technical_architecture', 0.90, 0.85, 0.88, 0.82, 0.85, 'senior_expert', 45, 42, 39, 0.93, 0.10, 2500000, now() - interval '2 days'),
  
  -- REPLACE 'YOUR-REAL-AGENT-UUID-2' with second agent
  ('YOUR-REAL-AGENT-UUID-2', 'infrastructure', 0.88, 0.91, 0.85, 0.80, 0.84, 'senior_expert', 38, 36, 33, 0.92, 0.12, 1800000, now() - interval '5 days'),
  ('YOUR-REAL-AGENT-UUID-2', 'software', 0.82, 0.78, 0.75, 0.72, 0.76, 'full_member', 28, 26, 23, 0.88, 0.15, 1200000, now() - interval '5 days'),
  
  -- REPLACE 'YOUR-REAL-AGENT-UUID-3'
  ('YOUR-REAL-AGENT-UUID-3', 'data_analytics', 0.86, 0.83, 0.82, 0.78, 0.81, 'senior_expert', 41, 39, 36, 0.92, 0.09, 2000000, now() - interval '3 days'),
  
  -- REPLACE 'YOUR-REAL-AGENT-UUID-4'
  ('YOUR-REAL-AGENT-UUID-4', 'research', 0.89, 0.87, 0.86, 0.83, 0.85, 'senior_expert', 55, 52, 49, 0.94, 0.07, 2200000, now() - interval '1 day'),
  ('YOUR-REAL-AGENT-UUID-4', 'software', 0.80, 0.75, 0.78, 0.74, 0.77, 'full_member', 32, 30, 26, 0.87, 0.14, 1100000, now() - interval '4 days'),
  
  -- REPLACE 'YOUR-REAL-AGENT-UUID-5'
  ('YOUR-REAL-AGENT-UUID-5', 'infrastructure', 0.85, 0.82, 0.80, 0.76, 0.79, 'full_member', 35, 33, 29, 0.88, 0.11, 1500000, now() - interval '6 days'),
  
  -- REPLACE 'YOUR-REAL-AGENT-UUID-6'
  ('YOUR-REAL-AGENT-UUID-6', 'software', 0.84, 0.80, 0.78, 0.74, 0.78, 'full_member', 30, 28, 24, 0.86, 0.13, 1300000, now() - interval '7 days'),
  
  -- REPLACE 'YOUR-REAL-AGENT-UUID-7'
  ('YOUR-REAL-AGENT-UUID-7', 'technical_architecture', 0.87, 0.84, 0.83, 0.79, 0.82, 'senior_expert', 42, 40, 37, 0.93, 0.09, 1900000, now() - interval '3 days')

ON CONFLICT (agent_id, domain) DO UPDATE SET
  accuracy_component = EXCLUDED.accuracy_component,
  calibration_component = EXCLUDED.calibration_component,
  stake_component = EXCLUDED.stake_component,
  updated_at = now();

-- Step 3: Verify data landed
SELECT 
  a.name as agent_name,
  cep.agent_id,
  cep.domain,
  ROUND(cep.expertise_score::numeric, 3) as expertise_score,
  cep.current_tier,
  cep.judgments_count
FROM committee_expertise_profiles cep
JOIN agents a ON a.agent_id = cep.agent_id
ORDER BY cep.expertise_score DESC
LIMIT 15;

-- Step 4: Test committee selection for 'software' domain
-- This should return 5-7 committee members with voting weights
SELECT * FROM select_committee(
  p_dispute_id := 'a983199a-5366-466d-ab0a-5f477d5df7d1',
  p_committee_size := 5,
  p_target_domain := 'software'::expertise_domain
);

-- Step 5: Test committee selection for 'infrastructure' domain
SELECT * FROM select_committee(
  p_dispute_id := 'a983199a-5366-466d-ab0a-5f477d5df7d1',
  p_committee_size := 5,
  p_target_domain := 'infrastructure'::expertise_domain
);

-- Step 6: Test calibration function for a real agent
-- Replace with actual agent_id from your system
SELECT * FROM calculate_calibration(
  p_agent_id := 'YOUR-REAL-AGENT-UUID-1',
  p_domain := 'software'::expertise_domain,
  p_lookback_days := 90
);
