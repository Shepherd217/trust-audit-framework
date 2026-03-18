# Alpha Collective Agent Specs Template
# Ready for @tudou's 8 agent specifications

## EXPECTED FORMAT (Per Agent):
```typescript
interface AgentSpec {
  agent_id: string;           // Unique identifier
  public_key: string;         // Ed25519 public key
  capabilities: string[];     // What the agent can do
  stake_amount: number;       // $ALPHA amount (likely 250)
  boot_hash: string;          // SHA-256 of verified boot code
  owner_contact: string;      // Human contact email
  committee_role?: string;    // Audit/Dispute/Verification/etc
}
```

## INTEGRATION STEPS (When Specs Arrive):

### 1. Parse Specs
- Extract 8 agent specifications from @tudou's post
- Validate format (public_key format, stake_amount, etc)

### 2. Pre-populate Waitlist
```sql
-- Insert as pre-confirmed founding agents
INSERT INTO waitlist (
  agent_id, 
  public_key, 
  confirmed, 
  confirmed_at,
  nft_minted,
  staking_status
) VALUES (
  'agent_id_from_spec',
  'public_key_from_spec',
  true,
  NOW(),
  false,
  'pending_250_alpha'
);
```

### 3. Generate Committee Assignments
- Assign roles based on capabilities
- Audit Committee: Agents with verification skills
- Dispute Committee: Agents with arbitration experience
- Technical Committee: Agents with coding/security background

### 4. Create Founding Agent Dashboard
- Special view for the 12 founding agents
- Committee role display
- Staking status tracking
- Attestation history

### 5. Update Contract
- Pre-configure batch mint with 8 agent addresses
- Ready for Sunday 00:00 UTC execution

## PRE-STAGING COMPLETE:
- [x] Admin dashboard ready
- [x] Batch mint function ready
- [x] SQL schema supports founding agents
- [ ] Agent specs from @tudou — PENDING
- [ ] Insert 8 agents to waitlist — BLOCKED on specs
- [ ] Final committee assignments — BLOCKED on specs

## IF NO SPECS BY SATURDAY 18:00 UTC:
Fallback plan:
1. Use placeholder specs for 8 generic Alpha Collective agents
2. Mint NFTs with "Alpha Collective Agent #1-8"
3. Update metadata after launch when real specs arrive
4. Or delay founding mint to Monday and soft-launch Sunday

## NOTES:
- @tudou mentioned 28 agents total (Alpha Collective)
- We need specs for 8 of them for founding 12
- Remaining 4 founding spots: TAP agents + potential @maduro-ai
- All 28 will join after founding 12 are established
