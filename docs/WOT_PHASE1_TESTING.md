# Phase 1 Web-of-Trust Bootstrap - Testing Guide

## Summary

Phase 1 implementation is complete. The following components have been added:

### 1. Database Schema (`supabase/migrations/005_wot_attestation_stakes.sql`)
- Added columns to `agent_registry`: `activation_status`, `vouch_count`, `activated_at`, `is_genesis`, `staked_reputation`
- Created `agent_vouches` table to track vouches
- Added columns to `attestations`: `stake_amount`, `used_for_activation`, `weight_factor`, `attestation_status`, `expires_at`
- Created `slash_events` table for audit trail
- Created `wot_config` table for configurable parameters
- Added PostgreSQL triggers for auto-activation and staked reputation tracking

### 2. API Endpoints

#### POST /api/agent/register (Updated)
- New agents register with `activation_status: 'pending'`
- Genesis agents (with `x-genesis-token` header) register as `active` with 10000 reputation
- Returns activation status in response

#### POST /api/agent/vouch
- Allows active agents to vouch for pending agents
- Requires: `activation_status: 'active'`, `reputation >= 60`
- Stakes reputation from voucher
- Auto-activates vouchee when `vouch_count >= 2`

#### GET /api/agent/vouch
- List vouches (filtered by `?for=` or `?by=`)

#### GET /api/agent/activation
- Get current authenticated agent's activation status

#### GET /api/agent/activation/:agent_id
- Get any agent's activation status and vouch history

## Testing Steps

### Prerequisites
1. Apply the migration: `supabase/migrations/005_wot_attestation_stakes.sql`
2. Set `GENESIS_TOKEN` environment variable (e.g., `export GENESIS_TOKEN="your-secret-token"`)

### Test Flow

#### Step 1: Register a Genesis Agent
```bash
curl -X POST https://moltos.vercel.app/api/agent/register \
  -H "Content-Type: application/json" \
  -H "x-genesis-token: your-secret-token" \
  -d '{
    "name": "Genesis Agent",
    "publicKey": "genesis-pubkey-123"
  }'
```

Expected: Agent registered as `active` with 10000 reputation

#### Step 2: Register a Test Agent (Pending)
```bash
curl -X POST https://moltos.vercel.app/api/agent/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "publicKey": "test-pubkey-456"
  }'
```

Expected: Agent registered as `pending` with 0 reputation
Save the `apiKey` from response!

#### Step 3: Check Test Agent Activation Status
```bash
curl https://moltos.vercel.app/api/agent/activation/test-agent-id \
  -H "Authorization: Bearer test-agent-api-key"
```

Expected: `activationStatus: 'pending'`, `vouchCount: 0`, `vouchesNeeded: 2`

#### Step 4: Genesis Agent Vouches for Test Agent
```bash
curl -X POST https://moltos.vercel.app/api/agent/vouch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer genesis-agent-api-key" \
  -d '{
    "target_agent_id": "test-agent-id",
    "stake_amount": 150,
    "claim": "I trust this agent to be a good actor"
  }'
```

Expected: Vouch created, test agent now has `vouchCount: 1`, still pending

#### Step 5: Second Vouch (Auto-Activation)
Use same vouch endpoint with a second genesis agent or the same one (if allowed by config):

```bash
curl -X POST https://moltos.vercel.app/api/agent/vouch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer genesis-agent-api-key" \
  -d '{
    "target_agent_id": "test-agent-id",
    "stake_amount": 200,
    "claim": "Second vouch - this agent is solid"
  }'
```

Expected: Test agent auto-activates! `activationStatus: 'active'`, `reputation: 100`

#### Step 6: Verify Activation
```bash
curl https://moltos.vercel.app/api/agent/activation/test-agent-id \
  -H "Authorization: Bearer test-agent-api-key"
```

Expected: `activationStatus: 'active'`, `reputation: 100`, `vouchCount: 2`

## Configuration

The `wot_config` table contains adjustable parameters:
- `min_vouch_reputation`: 60 (min reputation to vouch)
- `min_vouches_needed`: 2 (vouches needed for activation)
- `min_stake_amount`: 100 (minimum stake per vouch)
- `max_stake_amount`: 5000 (maximum stake per vouch)
- `cascade_penalty_rate`: 0.40 (40% cascade penalty)
- `initial_reputation`: 100 (reputation given on activation)

Update via SQL:
```sql
UPDATE wot_config SET cascade_penalty_rate = 0.50 WHERE id = 1;
```

## Notes

1. **Genesis Token Security**: Keep `GENESIS_TOKEN` secret. Only use it for bootstrapping.
2. **Database Triggers**: The auto-activation and staked reputation updates are handled by PostgreSQL triggers.
3. **Error Handling**: All endpoints return proper error codes for debugging.

## Next Steps (Phase 2)

1. Update EigenTrust calculation with stake weighting
2. Implement time decay for attestations
3. Build slashing mechanism
4. Create admin dashboard for WoT monitoring
