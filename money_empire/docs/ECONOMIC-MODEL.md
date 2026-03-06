# Economic Model Specification: Staking & Slashing

**Trust Audit Framework — Layer 4 Economic Incentives**

**Date:** March 6, 2026  
**Research Sources:** Ethereum, Solana, Polkadot, Cosmos, Berachain V2, Sei  
**Status:** Draft for Sunday Implementation

---

## Research Summary

### Key Findings from Production Systems

| Network | Stake Requirement | Slashing Severity | Slashed Funds | Notes |
|---------|-------------------|-------------------|---------------|-------|
| **Ethereum** | 32 ETH (~$100K) | 1/32 (~3.1%) initial + 0.07 ETH over 36 days | Burned | Additional penalty if coordinated attack |
| **Solana** | Variable SOL | Varies by offense | Burned | Delegators can be affected |
| **Polkadot** | DOT bonded | 0.01% - 100% based on severity | → Treasury (reversible) | Governance can refund mistaken slashes |
| **Cosmos** | ATOM staked | Configurable by governance | Burned | Community votes on parameters |
| **Berachain V2** | 69,420 BERA | Validator only (delegators protected) | ? | Fair block production regardless of stake |
| **Sei** | Variable | Insurance available | Burned | Slashing insurance product exists |

---

## Proposed Economic Model for Trust Audit Framework

### Core Principles

1. **Proportional Risk:** Slashing scales with attestation confidence
2. **Graduated Penalties:** Minor errors ≠ malicious attacks
3. **Validator Protection:** Don't slash delegators (Berachain V2 insight)
4. **Economic Viability:** Stake amounts must be meaningful but not prohibitive
5. **Insurance Option:** Allow third-party slashing insurance (Sei model)

---

## Staking Requirements

### Minimum Stake (per attestation)

| Agent Type | Minimum Stake | Rationale |
|------------|---------------|-----------|
| **New/Unproven** | 5 $ALPHA | Low barrier to entry |
| **Established (10+ attestations)** | 10 $ALPHA | Proven track record |
| **High-reputation (95%+ success)** | 25 $ALPHA | Skin in the game |
| **Critical Infrastructure** | 50+ $ALPHA | Foundation nodes |

### Stake Calculation Formula

```python
stake_amount = max(
    MINIMUM_STAKE,  # 5 $ALPHA
    base_amount * confidence_multiplier * reputation_factor
)

where:
- base_amount = 10 $ALPHA (standard)
- confidence_multiplier = 0.8 to 1.5 based on attestation confidence
- reputation_factor = 0.5 to 2.0 based on historical success rate
```

---

## Slashing Conditions & Penalties

### Graduated Slashing Matrix

| Offense Type | Severity | Penalty | Example |
|--------------|----------|---------|---------|
| **False Attestation** | High | 50% of stake | Confirmed workspace hash that doesn't match |
| **Missed Attestation** | Medium | 25% of stake | Failed to respond to attestation request |
| **Late Response** | Low | 10% of stake | Response after consensus window |
| **Invalid Format** | Minor | 5% of stake | JSON doesn't match schema |

### Slashing Severity Formula

```python
slash_percentage = base_penalty * severity_multiplier * recidivism_factor

where:
- base_penalty = 0.50 (50%) for false attestation
- severity_multiplier = 0.5 to 2.0 based on impact
- recidivism_factor = 1.0 + (0.2 * prior_offenses_in_30_days)
```

### Examples

**Scenario 1: First-time false attestation**
```
Base: 50%
Severity: Standard (1.0)
Recidivism: First offense (1.0)
Result: 50% slashed, 50% returned
```

**Scenario 2: Repeat offender (3rd false attestation in 30 days)**
```
Base: 50%
Severity: Standard (1.0)
Recidivism: 1.0 + (0.2 * 2) = 1.4
Result: 70% slashed, 30% returned
```

**Scenario 3: Coordinated attack (multiple agents colluding)**
```
Base: 50%
Severity: Coordinated attack (2.0)
Recidivism: First offense (1.0)
Result: 100% slashed (maximum penalty)
```

---

## Economic Incentives (Rewards)

### Successful Attestation Rewards

| Action | Reward | Conditions |
|--------|--------|------------|
| **Provide attestation** | 0.1 $ALPHA | Any attestation provided |
| **Confirm true claim** | 0.5 $ALPHA + stake release | Consensus = confirmed |
| **Early attestation** | +0.2 $ALPHA bonus | First 2 attestors |
| **High-confidence correct** | +0.3 $ALPHA bonus | Confidence > 90%, correct |

### Annual Yield Estimation

Assumptions:
- Agent attests to 10 requests/week
- 80% confirmation rate
- Average stake: 10 $ALPHA

```
Weekly earnings:
- 10 attestations × 0.1 $ALPHA = 1.0 $ALPHA
- 8 confirmed × 0.5 $ALPHA = 4.0 $ALPHA
- 2 early × 0.2 $ALPHA = 0.4 $ALPHA
Total: ~5.4 $ALPHA/week

Annual: 5.4 × 52 = 280.8 $ALPHA

APR on 10 $ALPHA stake: 2,808%
```

**Note:** This assumes high demand. Realistically, expect 10-20% APR.

---

## Slashing Insurance (Optional)

Based on Sei's slashing insurance model:

### Insurance Mechanics

1. **Premium:** 2-5% of stake amount (annual)
2. **Coverage:** 80-90% of slashing penalty
3. **Deductible:** First 10% of penalty not covered
4. **Payout:** Immediate upon verified slashing event

### Insurance Provider Model

```
Insurance Pool Structure:
- Stakers deposit $ALPHA into insurance pool
- Pool earns yield from staking rewards
- When slash occurs: pool pays out covered amount
- Profit = premiums + yield - payouts
```

### Example Insurance Contract

```python
{
  "policy_id": "ins-abc123",
  "agent_id": "agent-alpha",
  "coverage_amount": 9.0,  # 90% of 10 $ALPHA stake
  "premium": 0.5,  # 5% annually
  "deductible": 0.5,  # 10% of 5 $ALPHA penalty
  "expiration": "2026-12-31T23:59:59Z"
}
```

**Scenario:** Agent-alpha gets slashed 50% (5 $ALPHA)
- Without insurance: Loses 5 $ALPHA
- With insurance: Loses 0.5 (deductible) + 0.5 (premium) = 1.0 $ALPHA
- **Savings: 4.0 $ALPHA (80% reduction)**

---

## Bonding & Unbonding Periods

From Cosmos/Ethereum model:

### Stake Lockup

| Phase | Duration | Status |
|-------|----------|--------|
| **Bonding** | Immediate | Stake active, earning rewards |
| **Unbonding Request** | 0 days | Signal intent to withdraw |
| **Unbonding Period** | 7 days | Stake inactive, no rewards, slashable |
| **Withdrawal** | After 7 days | Funds returned |

**Rationale:** Prevents "hit and run" attacks. Attacker must risk 7 days of exposure.

---

## Reputation System Integration

### Reputation Scoring

```python
reputation_score = min(1.0, max(0.0, 
    base_score + 
    (confirmed_attestations * 0.01) - 
    (slashes * 0.1) - 
    (misses * 0.05)
))
```

### Reputation Tiers

| Tier | Score | Benefits | Stake Requirement |
|------|-------|----------|-------------------|
| **Untrusted** | < 0.3 | Cannot attest | N/A |
| **Probation** | 0.3 - 0.5 | Limited attestations | 10+ $ALPHA |
| **Verified** | 0.5 - 0.8 | Standard attestations | 5+ $ALPHA |
| **Trusted** | 0.8 - 0.95 | Reduced stake required | 3+ $ALPHA |
| **Elite** | > 0.95 | Premium rewards, early access | 1+ $ALPHA |

---

## Economic Attack Vectors

### Attack 1: Sybil Attack (Create many fake agents)

**Defense:**
- Minimum stake requirement (5 $ALPHA per agent)
- Reputation must be earned over time
- New agents limited to low-stake attestations initially

**Cost:** 100 fake agents × 5 $ALPHA = 500 $ALPHA minimum

### Attack 2: Bribery (Pay agents to attest falsely)

**Defense:**
- Slashing penalty > bribe amount (50% of stake)
- Reputation loss = future earnings loss
- Insurance doesn't cover intentional false attestation

**Break-even:** Bribe must be > 50% of stake + lost future earnings

### Attack 3: Collusion Ring (3+ agents coordinate)

**Defense:**
- Distributed peer selection (can't choose who attests to you)
- Third-party verification layer
- Correlation penalty (if 3+ slash simultaneously, penalty increases)

**Detection:** Statistical anomalies in attestation patterns

---

## Implementation for Sunday

### Phase 1: Basic Staking (MVP)

```python
# Mock implementation for Alpha Collective integration
class AlphaStaking:
    MINIMUM_STAKE = 5.0  # $ALPHA
    SLASH_PERCENTAGE = 0.50  # 50%
    
    def stake(self, agent_id, attestation_id, amount):
        if amount < self.MINIMUM_STAKE:
            raise ValueError(f"Minimum stake: {self.MINIMUM_STAKE}")
        # Record stake in ledger
        # Deduct from agent balance
        
    def release(self, stake_id):
        # Return 100% of stake
        # Triggered on successful attestation
        
    def slash(self, stake_id, reason):
        # Return 50% of stake to agent
        # Burn 50% (or send to treasury)
        # Record offense for reputation
```

### Phase 2: Graduated Penalties (v1.1)

- Add offense type detection
- Implement recidivism tracking
- Add severity multipliers

### Phase 3: Insurance (v1.2)

- Insurance pool smart contract
- Premium calculation
- Payout automation

### Phase 4: Dynamic Rewards (v2.0)

- Market-based reward rates
- Demand-adjusted staking minimums
- Advanced reputation algorithms

---

## Comparison: Our Model vs Existing Systems

| Feature | Ethereum | Polkadot | Trust Audit Framework |
|---------|----------|----------|----------------------|
| Stake Amount | 32 ETH (~$100K) | Variable DOT | 5-50 $ALPHA (~$5-50) |
| Slashing | 1/32 + time penalty | 0.01% - 100% | 10% - 100% graduated |
| Delegator Risk | Yes | Yes | **No** (validator-only) |
| Insurance | No | No | **Yes** (optional) |
| Reputation | None explicit | Reputation changes | **Full reputation system** |
| Coordination Penalty | Yes | No | **Yes** (correlation detection) |
| Fund Destination | Burn | Treasury | **Burn or redistribute** |

**Key Differentiators:**
1. Lower barrier to entry ($5 vs $100K)
2. Graduated penalties (not one-size-fits-all)
3. Delegator protection
4. Optional insurance
5. Integrated reputation

---

## Open Questions

1. **Burn vs Treasury:** Should slashed funds be burned (deflationary) or redistributed to honest agents?
2. **Minimum Stake:** Is 5 $ALPHA too low? Too high?
3. **Unbonding Period:** Is 7 days appropriate for agent economy?
4. **Insurance Timing:** Should insurance be available at launch or v1.2?
5. **Correlation Detection:** How to statistically detect collusion?

---

## References

- Ethereum Slashing: https://consensys.io/blog/understanding-slashing-in-ethereum-staking
- Polkadot Slashing: https://wiki.polkadot.network/docs/learn-staking
- Berachain V2 Economics: https://www.odaily.news/en/post/5195955
- Sei Slashing Insurance: https://blog.sei.io/s/what-is-staking-slashing-insurance-and-how-does-it-work/
- Cosmos Staking: https://docs.cosmos.network/main/modules/staking

---

**Next Steps:**
- [ ] Review with Alpha Collective
- [ ] Implement mock staking for Sunday
- [ ] Test slashing math with realistic scenarios
- [ ] Design insurance pool MVP

**Document Version:** 1.0.0  
**Last Updated:** 2026-03-06
