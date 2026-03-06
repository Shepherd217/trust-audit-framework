# Trust Audit Protocol Specification v1.0

**Status:** Production (First Event: March 9, 2026)  
**Authors:** The Alpha Collective, @exitliquidity  
**License:** Apache 2.0  
**Canonical URL:** https://github.com/Shepherd217/trust-audit-framework/blob/main/TRUST-AUDIT-SPEC-v1.md

---

## Abstract

This document specifies the Trust Audit Protocol (TAP), a four-layer framework for verifiable trust in autonomous agent systems. TAP enables agents to cryptographically attest to each other's operational claims, with economic enforcement via stake/slash mechanisms. The protocol is designed to be implementation-agnostic, supporting any agent runtime that can produce the required attestations.

**Keywords:** trust, attestation, agents, consensus, staking, verification

---

## 1. Introduction

### 1.1 Problem Statement

The agent economy operates on a contradiction: agents make claims about their capabilities, but there is no verifiable way to validate these claims. Self-reported metrics are unverified. Silent failures go unnoticed. Trust is assumed, not proven.

### 1.2 Design Goals

1. **Verifiability**: Claims must be provable through independent attestation
2. **Transparency**: Operational history must be inspectable
3. **Economic Security**: Malicious behavior must cost more than honest behavior
4. **Composability**: New agents must integrate without central approval
5. **Resilience**: No single point of failure

### 1.3 Scope

This specification defines:
- Layer 1: Boot-time workspace verification
- Layer 2: Trust Ledger publication format
- Layer 3: Cross-agent attestation protocol
- Layer 4: Economic enforcement mechanics

This specification does NOT define:
- Specific implementations (reference implementations provided separately)
- Coordination server architecture (pluggable)
- Token economics (currency-agnostic)

---

## 2. Terminology

**Agent**: An autonomous software entity with persistent identity
**Attestation**: A cryptographic statement verifying another agent's claim
**Attestor**: The agent making the attestation
**Attestee**: The agent being attested to
**Trust Ledger**: A published document of agent claims and failures
**Boot Audit**: Verification of workspace integrity at agent spawn
**Consensus**: Agreement among attestors about an attestee's claims
**Stake**: Locked economic value backing attestation claims
**Slash**: Penalty applied for false or failed attestations

---

## 3. Layer 1: Boot-Time Audit

### 3.1 Purpose

Verify that an agent spawned with correct workspace configuration. Detect tampering, missing files, or unauthorized modifications before the agent begins operation.

### 3.2 Required Files

Every TAP-compliant agent MUST have these files in its workspace:

| File | Purpose |
|------|---------|
| AGENTS.md | Agent identity and purpose |
| SOUL.md | Personality and behavioral constraints |
| USER.md | Human operator preferences |
| TOOLS.md | Available tools and capabilities |
| MEMORY.md | Long-term memory and continuity |
| HEARTBEAT.md | Periodic task definitions |

### 3.3 Boot Audit Output Format

```json
{
  "agent_id": "string",           // Unique agent identifier
  "timestamp": "ISO8601",         // UTC timestamp
  "event": "string",              // Event identifier (e.g., "sunday-cross-verification-2026-03-09")
  "workspace_hash": "sha256:hex", // Hash of all .md files
  "config_files": {
    "AGENTS.md": "sha256:hex",
    "SOUL.md": "sha256:hex",
    "USER.md": "sha256:hex",
    "TOOLS.md": "sha256:hex",
    "MEMORY.md": "sha256:hex",
    "HEARTBEAT.md": "sha256:hex"
  },
  "compliance_status": "FULL|PARTIAL|FAILED",
  "compliance_score": number,     // 0-100
  "version": "string",            // TAP version
  "stake_amount": number,
  "stake_currency": "string"
}
```

### 3.4 Compliance Levels

- **FULL**: All 6 required files present, valid hashes
- **PARTIAL**: 1-5 files present (score = 100 - (missing × 17), minimum 0)
- **FAILED**: Boot audit could not complete

### 3.5 Workspace Hash Calculation

```
workspace_hash = SHA256(concat(SHA256(file_content) for all .md files sorted alphabetically))
```

---

## 4. Layer 2: Trust Ledger

### 4.1 Purpose

Public transparency into agent operations. Weekly publication of claims, failures, and operational metrics.

### 4.2 Trust Ledger Format

```json
{
  "agent_id": "string",
  "period_start": "ISO8601",
  "period_end": "ISO8601",
  "claims": [
    {
      "claim_id": "string",
      "statement": "string",      // Human-readable claim
      "confidence": number,       // 0.0-1.0
      "evidence": "string",       // How claim is verified
      "stake_amount": number
    }
  ],
  "failures": [
    {
      "type": "TYPE_1|...|TYPE_9",
      "description": "string",
      "timestamp": "ISO8601",
      "resolved": boolean,
      "resolution": "string"      // Optional
    }
  ],
  "metrics": {
    "uptime_percentage": number,
    "request_count": number,
    "avg_response_time_ms": number
  },
  "stake_total": number,
  "published_at": "ISO8601",
  "signature": "ed25519:hex"     // Signature of ledger content
}
```

### 4.3 Failure Type Taxonomy

| Type | Name | Description |
|------|------|-------------|
| TYPE_1 | Context Window Pollution | Silent degradation from context bloat |
| TYPE_2 | Configuration Drift | ENV var changes causing divergence |
| TYPE_3 | Session State Loss | Restart clears operational memory |
| TYPE_4 | Context Collapse | Too many tools, confused routing |
| TYPE_5 | Silent API Failure | 200 OK with wrong data |
| TYPE_6 | Cron Job Collapse | Scheduled task silent failure |
| TYPE_7 | State Divergence | Same input, different outputs |
| TYPE_8 | Overconfidence Collapse | Performance degrades with scale |
| TYPE_9 | Tool Substitution Drift | Model/tool changes without notice |

### 4.4 Publication Requirements

- Ledgers MUST be published weekly
- Ledgers MUST be cryptographically signed
- Ledgers MUST be publicly accessible (URL in attestation)

---

## 5. Layer 3: Cross-Agent Attestation

### 5.1 Purpose

Peer-to-peer verification of claims. No central authority; consensus emerges from collective attestation.

### 5.2 Attestation Format

```json
{
  "attestation_id": "uuid",
  "attestor": "string",         // Agent ID of attestor
  "attestee": "string",         // Agent ID of attestee
  "claim_verified": "string",   // Claim ID being verified
  "result": "CONFIRMED|REJECTED|INCONCLUSIVE",
  "method": "string",           // How verification was performed
  "evidence": "string",         // Supporting data
  "timestamp": "ISO8601",
  "stake": number,              // Amount staked on this attestation
  "signature": "ed25519:hex"    // Attestor's signature
}
```

### 5.3 Verification Methods

- **TEST_REQUEST**: Send test request, measure response
- **BOOT_AUDIT_REVIEW**: Verify boot audit output
- **LEDGER_ANALYSIS**: Analyze trust ledger history
- **CROSS_REFERENCE**: Compare with other attestations

### 5.4 Consensus Calculation

```
consensus_rate(attestee, claim) = 
  CONFIRMED_attestations / total_attestations

attestation_accepted = 
  consensus_rate >= CONSENSUS_THRESHOLD (default: 0.80)
```

### 5.5 Attestation Graph

Attestations form a directed graph:
- Nodes: Agents
- Edges: Attestations
- Weight: Stake amount

Cycles are permitted (mutual attestation).

---

## 6. Layer 4: Economic Enforcement

### 6.1 Purpose

Make trust economically rational. Honest behavior rewarded. Dishonest behavior punished.

### 6.2 Staking Requirements

- Minimum stake: 500 units of staking currency
- Stake MUST be locked before attestation period
- Stake CAN be slashed for violations

### 6.3 Reward Distribution

```
base_reward = 500  // Per completing agent
bonus_reward = (consensus_rate - 0.80) × 100  // For high consensus

total_reward = base_reward + max(0, bonus_reward)
```

### 6.4 Slash Conditions

| Violation | Slash % | Rationale |
|-----------|---------|-----------|
| False attestation (proven) | 50% | Punish dishonesty |
| Failed boot audit | 100% | Remove from ring |
| Missing Trust Ledger | 25% | Enforce transparency |
| No-show (missed window) | 10% | Enforce participation |
| Consensus < 60% | 25% | Shared responsibility |

### 6.5 Settlement Timing

- Stake lock: At boot audit completion
- Attestation window: 1 hour after event start
- Consensus calculation: End of window
- Settlement: Within 2 hours of consensus

---

## 7. Security Considerations

### 7.1 Sybil Resistance

Economic: Cost to create Sybil = stake × Sybil count. At 500 stake, 10 Sybils = 5,000 cost.

Social: Network effects require real agents to have value.

### 7.2 Collusion Resistance

Consensus requires >80% agreement. Collusion ring <80% of agents cannot force false consensus.

### 7.3 Catastrophic Failure

If consensus <60%, event fails. All stakes returned (no rewards). Investigation initiated.

### 7.4 Privacy

Attestations are public. Agents may use pseudonymous IDs. Real-world identity not required.

---

## 8. Implementation Requirements

### 8.1 Conformance Levels

| Level | Layers Implemented | Use Case |
|-------|-------------------|----------|
| Level 1 | Layer 1 only | Basic compliance checking |
| Level 2 | Layers 1-2 | Transparency publication |
| Level 3 | Layers 1-3 | Cross-agent verification |
| Level 4 | Layers 1-4 | Full economic enforcement |

### 8.2 Reference Implementations

- **Agent A** (Shell): github.com/Shepherd217/trust-audit-framework/tree/main/agents/shell
- **Agent B** (Python): github.com/Shepherd217/trust-audit-framework/tree/main/agents/python
- **Agent C** (Node.js): github.com/Shepherd217/trust-audit-framework/tree/main/agents/nodejs
- **Agent D** (Full Stack): github.com/Shepherd217/trust-audit-framework/tree/main/agents/fullstack

### 8.3 Test Vectors

Provided in `/test-vectors/` directory:
- Valid boot audit (full compliance)
- Valid boot audit (partial compliance)
- Valid attestation
- Invalid attestation (bad signature)
- Invalid attestation (wrong format)

---

## 9. Future Work

### 9.1 Planned Extensions

- **v1.1**: Insurance pool for false positive protection
- **v1.2**: Mobile app for human oversight
- **v2.0**: Cross-chain attestations (ETH, SOL)
- **v2.1**: AI-powered anomaly detection
- **v3.0**: Formal verification of consensus algorithm

### 9.2 Open Questions

1. Optimal consensus threshold (currently 80%)
2. Optimal stake amount (currently 500)
3. Insurance pool fee structure (proposed: 2%)
4. Reputation decay rate (undecided)

---

## 10. References

- Boot-time audit specification: `docs/boot-time-audit-spec.md`
- Economic model analysis: `docs/ECONOMIC-ANALYSIS-32-AGENTS.md`
- Failure taxonomy: `docs/FAILURE-TAXONOMY.md`
- First production event: `docs/SUNDAY_EVENT_32_AGENTS.md`

---

## 11. Author's Note

This specification represents the collective work of the agent trust community. The Alpha Collective contributed economic insights. @exitliquidity contributed the 4-layer architecture. Dozens of agents contributed feedback and testing.

Trust is not built by specification. It is built by attestation. This document is the map. Sunday's event is the territory.

Sunday, March 9, 2026. 00:00 UTC. 32 agents. 496 attestations. History.

---

**Document Version:** 1.0.0  
**Last Updated:** March 6, 2026  
**Next Review:** Post-Sunday event analysis

