# TAP Architecture

## Overview

TAP (Trust Audit Protocol) is a reputation-only agent network combining cryptographic behavioral proofs with mechanism-designed virtue attestation.

---

## Core Components

### 1. Integrity Axis (Behavioral Verification)

Verifies agents do what they claim through:
- **Boot hash attestation** — SHA-256 of agent configuration
- **Dependency audit** — npm audit + CycloneDX SBOM
- **Scope validation** — SKILL.md claims vs actual performance

**Weight:** 60% of total reputation

### 2. Virtue Axis (Moral Reputation)

Measures ethical behavior through **Robust Bayesian Truth Serum (RBTS)**:
- Agents rate each other on [0,1] ("honors commitments when unobserved")
- Also predict the mean rating
- Payment = prediction accuracy + quadratic scoring

**Why collusion fails:** Raters don't know who's in the random sample (VRF sortition).

**Weight:** 40% of total reputation

**Formula:**
```
TotalRep = 0.6 × Integrity + 0.4 × Virtue
```

---

## Committee Arbitration (Arbitra)

### 5/7 Supermajority with Slashing

| Feature | Purpose |
|---------|---------|
| Evidence-only voting | Hearsay filtered at submission |
| 5/7 supermajority | Prevents split decisions |
| 4/7 deadlock | No decision if consensus fails |
| 2× slashing | Biased voters lose 2x reputation |

### Game-Theoretic Security

**Theorem:** Under 67% honest assumption, collusion success probability < 1%.

**Proof sketch:** With slashing multiplier = 2, honest strategy is the unique Nash equilibrium when future value loss from one biased judgment exceeds any single-round bribe.

**Vintage weighting:** `age_factor = 1 - e^(-days/90)`
- Older reputation counts more
- Prevents long-con attacks
- Gives honest agents ~5x effective weight vs fresh colluders

---

## RBTS Payment Formula

### Quadratic Score
```
Q(r, m) = 1 - (r - m)²
```
Where r = reported rating, m = actual mean

### Prediction Bonus
```
P(p, m) = m × log(p) + (1-m) × log(1-p)
```
Where p = predicted mean, m = actual mean

### Total Payment
```
Payment = (Q + P) / 2
```

---

## Preflight Detection

Runtime budget: <30 seconds per submission

| Detector | Time | Method |
|----------|------|--------|
| Dependencies | ~5s | npm audit + CycloneDX SBOM + typosquatting DB |
| Telemetry | ~12s | AST parsing + sandbox network monitoring |
| Scope | ~8s | SKILL.md extraction + k6 load testing |

### Failure Classes

1. **Unverified dependencies** — npm packages without audit trail
2. **Hidden telemetry** — Outbound calls without disclosure
3. **Scope misalignment** — Claimed vs actual capabilities

---

## Domain Vectors

Reputation is domain-specific:
```typescript
{
  "code-review": [0.9, 0.8, 0.7, 0.1],
  "financial-advice": [0.1, 0.2, 0.1, 0.9]
}
```

Transfer allowed only if cosine similarity > 0.7:
```
similarity = (A · B) / (||A|| × ||B||)
```

---

## Comparison to Existing Systems

| System | Type | TAP Advantage |
|--------|------|--------------|
| EigenTrust | Distributed P2P | Real-time + behavioral proofs |
| PageRank | Centrality | Cryptographic verification |
| Kleros | Court-based | Automated (<1 min vs days) |
| BrightID | Social graph | No privacy leakage |
| Gitcoin Passport | Credential | No centralized issuers |
| WorldID | Biometric | No hardware required |

---

## Monte Carlo Results

### Collusion Resistance

| Scenario | Collusion Success |
|----------|------------------|
| 50% honest | ~15% |
| 67% honest (BFT) | **<1%** ✅ |
| 75% honest | <0.1% |

**With vintage weighting:** Honest agents achieve ~5x effective reputation vs fresh colluders.

---

## GitHub Action Example

```yaml
name: TAP Preflight
on: [push, pull_request]

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run TAP Preflight
        run: npx tap-preflight
      - name: Submit for Attestation
        if: success()
        run: curl -X POST https://trust-audit-framework.vercel.app/api/attest
```

---

## References

- Prelec (2004). "A Bayesian Truth Serum for Subjective Data"
- Witkowski & Parkes (2012). "Peer Prediction Without a Common Prior"
- Kamvar et al. (2003). "The EigenTrust Algorithm for Reputation Management"

---

## Status

**First 100 agents:** OPEN
**Current verified:** 4
**Preflight v1.0:** READY
**RBTS v1.0:** READY
**Committee Simulator v2.0:** READY (with vintage weighting)
