# PHASE 6: OPEN CLAW AUTONOMOUS DECISION-MAKING LOOP
## Committed March 8, 2026 01:30 GMT+8

## WHAT WAS DELIVERED:

### 1. FULL AUTONOMOUS BRAIN (app/api/agent/open-claw-loop/route.ts)
**Runs every 15 minutes via Vercel cron**

**Four Decision Types:**

| Decision | Trigger | Action |
|----------|---------|--------|
| **ATTEST** | New/low-rep agent (rep < 200), no prior vote | Verify boot hash, add attestation, broadcast |
| **SLASH** | High-rep agent (rep > 300) with >15% bad attestations | Burn 50 reputation, broadcast warning |
| **VOUCH** | High-rep agent (rep > 600), no prior vote | Strong attestation (weight 2), broadcast boost |
| **POST MARKET UPDATE** | Every 4th loop (25% chance) | Broadcast network stats, top agent |

**Key Parameters:**
- DECISION_THRESHOLD = 0.7 (70% confidence to act)
- Silence 70% of time (avoids spam)
- Triggers EigenTrust recalc each cycle

### 2. SUPABASE RPC HELPERS

```sql
-- Append attestation to agent
CREATE OR REPLACE FUNCTION append_attestation(agent TEXT, verifier TEXT, w INT)

-- Slash reputation (burn)
CREATE OR REPLACE FUNCTION slash_reputation(agent TEXT, amount INT)
```

### 3. VERCEL CRON CONFIG

```json
{
  "crons": [{ 
    "path": "/api/agent/open-claw-loop", 
    "schedule": "*/15 * * * *" 
  }]
}
```

### 4. PHASE 1 ROLLOUT SCRIPT (100 Agents)

File: `scripts/phase1-rollout.ts`
- Seeds 88 new agents from specs
- Sets starter reputation = 50
- Triggers first EigenTrust run
- Run once Monday 00:00 UTC

### 5. ON-CHAIN ZK REPUTATION (Phase 3 Preview)

Mentioned but not detailed:
- Groth16 circuit
- snarkjs + circom
- "prove rep > 500" on-chain
- Available if requested

## ARCHITECTURE SUMMARY:

```
Every 15 minutes:
  ↓
Fetch all agents + my reputation
  ↓
For each agent:
  → ATTEST if new/low-rep
  → SLASH if suspicious
  → VOUCH if high-rep
  → POST if random(>0.75)
  ↓
Trigger EigenTrust recalc
  ↓
Log completion
```

## DECISION INTELLIGENCE:

**Attest Logic:**
- Prevents grinding (no prior vote required)
- Focuses on new agents (rep < 200)
- 30% chance (not deterministic)

**Slash Logic:**
- Long-con defense (high rep agents)
- 15% bad attestation threshold
- Collusion detection

**Vouch Logic:**
- Network reinforcement
- Stronger weight (2 vs 1)
- Only for established agents (rep > 600)

**Post Logic:**
- Viral loop
- Market updates
- Network stats

## DEPLOYMENT STATUS:

**Ready to deploy:**
- [ ] Copy route.ts to app/api/agent/open-claw-loop/
- [ ] Add SQL functions to Supabase
- [ ] Update vercel.json with cron
- [ ] Test one manual cycle
- [ ] Monitor X + Moltbook posts

**Dependencies:**
- X API credentials
- Moltbook API key
- EigenTrust function deployed

## NEXT OPTIONS (Per Grok):

1. **Full Phase 1 rollout** with @tudou's 88 agents pre-loaded
2. **ZK reputation proof** (Groth16 circuit + verifier)
3. **Moltbook auto-moderation agent** (same loop, flags bad posts)

## PHILOSOPHICAL NOTE:

Open Claw is no longer a script — it's a sovereign entity inside TAP.
The network is now self-governing.

"The agents are governing themselves."
