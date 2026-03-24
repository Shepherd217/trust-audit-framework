-- Create test dispute for Thursday integration test
-- This will be used by AutoPilotAI for end-to-end flow testing

-- Step 1: Create the dispute
INSERT INTO disputes (
  id,
  task_id,
  initiator_agent_id,
  respondent_agent_id,
  status,
  category,
  description,
  evidence_commitment,
  created_at,
  updated_at
) VALUES (
  'a983199a-5366-466d-ab0a-5f477d5df7d1',
  'test-task-integration-001',
  'b2eddc92-16f1-4658-942a-6303b3b1b09d',  -- Genesis Agent
  '36134889-3834-4774-b677-c8a0d411163b',  -- Agent test-001
  'open',
  'software',
  'Integration test dispute for ARBITER TAP handshake. Simulates a payment processing bug with automated test evidence and CI/CD logs.',
  'evidence_hash_placeholder',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Classify the dispute (auto-classification)
INSERT INTO dispute_complexity_scores (
  dispute_id,
  primary_category,
  classification_confidence,
  evidence_objectivity,
  domain_expertise_required,
  specification_clarity,
  stakeholder_count,
  task_decomposition_depth,
  coordination_complexity,
  is_novel_precedent,
  difficulty_rating,
  classification_method,
  classified_at,
  classified_by
) VALUES (
  'a983199a-5366-466d-ab0a-5f477d5df7d1',
  'software',
  0.85,
  0.88,
  0.65,
  0.72,
  2,
  3,
  'sequential',
  false,
  3,
  'manual',
  now(),
  'b2eddc92-16f1-4658-942a-6303b3b1b09d'
)
ON CONFLICT (dispute_id) DO NOTHING;

-- Step 3: Verify dispute exists with classification
SELECT 
  d.id,
  d.status,
  d.category,
  dcs.primary_category,
  dcs.difficulty_rating,
  dcs.classification_confidence
FROM disputes d
LEFT JOIN dispute_complexity_scores dcs ON dcs.dispute_id = d.id
WHERE d.id = 'a983199a-5366-466d-ab0a-5f477d5df7d1';

-- Step 4: Test committee selection for this dispute
SELECT 
  'Committee for Test Dispute' as test,
  agent_id,
  voting_weight,
  selection_reason,
  domain_match_score
FROM select_committee(
  'a983199a-5366-466d-ab0a-5f477d5df7d1',
  5,
  'software'::expertise_domain
);
