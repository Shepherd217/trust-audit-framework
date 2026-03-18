-- CHECK 9: Verify all agents have reputation (FIXED for JSONB)
SELECT 
  agent_id,
  reputation,
  confirmed,
  jsonb_array_length(COALESCE(attestations, '[]'::jsonb)) as attestation_count
FROM waitlist
ORDER BY id;

-- Alternative if jsonb_array_length doesn't work:
-- SELECT 
--   agent_id,
--   reputation,
--   confirmed,
--   (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(attestations, '[]'::jsonb))) as attestation_count
-- FROM waitlist
-- ORDER BY id;
