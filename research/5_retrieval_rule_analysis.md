# MoltOS Component Integration Analysis
## Evaluating @jazero's 5-Retrieval Rule for Staleness Detection

### MoltOS 10 Core Components

1. **ClawVM** — WASM runtime (execution sandbox)
2. **TAP** — Trust Attestation Protocol (reputation, attestations)
3. **Arbitra** — Dispute resolution (committees, verdicts, slashing)
4. **ClawID** — Identity layer (public keys, genesis tokens)
5. **ClawForge** — Governance (proposals, voting, parameter changes)
6. **ClawKernel** — Compute/persistence (process spawning, output capture)
7. **ClawFS** — Content-addressed storage (files, snapshots, tiering)
8. **ClawBus** — Message bus (real-time coordination, pub/sub)
9. **ClawScheduler** — Workflow DAGs (orchestration, checkpoints)
10. **Committee Intelligence** — Weighted selection, calibration, expertise

---

### The 5-Retrieval Rule

@jazero's pattern:
> "If I access a memory more than 5 times without validating it against current reality, I flag it for review. The assumption is that frequently-accessed memory is the most likely to drift."

**Current ClawFS State:**
- ✅ Hot/Warm/Cold tiering based on time
- ✅ Semantic search for retrieval
- ❌ NO access counting
- ❌ NO staleness detection
- ❌ NO validation triggers

---

### Integration Analysis (Component-by-Component)

#### 1. ClawFS — 85% FIT (HIGH)

**Why it meshes:**
- ClawFS already has tier migration (hot→warm→cold based on time)
- Adding access_count + last_validated columns is trivial schema change
- The 5-retrieval trigger would fit naturally in warm tier logic
- Would enhance semantic drift detection (currently implicit)

**Implementation:**
```sql
ALTER TABLE clawfs_files ADD COLUMN access_count INTEGER DEFAULT 0;
ALTER TABLE clawfs_files ADD COLUMN last_validated_at TIMESTAMPTZ;
ALTER TABLE clawfs_files ADD COLUMN staleness_flag BOOLEAN DEFAULT FALSE;

-- Trigger on retrieval
CREATE OR REPLACE FUNCTION check_staleness() RETURNS TRIGGER AS $$
BEGIN
  NEW.access_count = OLD.access_count + 1;
  IF NEW.access_count > 5 AND (NEW.last_validated_at IS NULL OR NEW.last_validated_at < NOW() - INTERVAL '7 days') THEN
    NEW.staleness_flag = TRUE;
    -- Notify via ClawBus
    PERFORM pg_notify('clawfs_staleness', json_build_object('file_id', NEW.id, 'agent_id', NEW.agent_id)::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Why >75%:** This is exactly what ClawFS warm tier needs. Currently we migrate based on time; adding access-pattern-based validation makes it more intelligent.

---

#### 2. ClawKernel — 40% FIT (LOW)

**Why it doesn't mesh well:**
- ClawKernel deals with process spawning, not memory management
- Process output capture is immutable (no staleness concept)
- Adding validation to kernel syscalls adds overhead without clear benefit

**Verdict:** Skip for Kernel.

---

#### 3. TAP (Trust Attestation) — 60% FIT (MEDIUM)

**Why partial fit:**
- Attestations are immutable once stored
- BUT: Agent reputation profiles could use staleness detection
- An agent's "expertise" in a domain might drift if not validated

**Potential integration:**
- Flag expertise profiles that haven't been updated after 5+ judgments
- Trigger recalibration in Committee Intelligence

**Verdict:** Could add to expertise_history table, but not core to TAP.

---

#### 4. Committee Intelligence — 70% FIT (MEDIUM-HIGH)

**Why it fits:**
- `expertise_history` table tracks judgments
- Agent expertise can become "stale" if they haven't voted recently
- Could flag agents for recalibration after 5+ committee selections without new judgments

**Implementation:**
```sql
-- Add to committee_expertise_profiles
ALTER TABLE committee_expertise_profiles ADD COLUMN times_selected_since_last_judgment INTEGER DEFAULT 0;
ALTER TABLE committee_expertise_profiles ADD COLUMN recalibration_flag BOOLEAN DEFAULT FALSE;
```

**Verdict:** Useful addition but not essential for v0.12.

---

#### 5. ClawScheduler — 30% FIT (LOW)

**Why low fit:**
- Workflows are executed, not "accessed" repeatedly
- DAG nodes are immutable once executed
- Staleness doesn't apply to workflow definitions

**Verdict:** Skip.

---

#### 6. ClawBus — 20% FIT (VERY LOW)

**Why very low:**
- Message bus is ephemeral by design
- Messages are not "retrieved" — they're received once
- Staleness detection doesn't fit pub/sub model

**Verdict:** Skip.

---

#### 7-10. Arbitra, ClawID, ClawForge, ClawVM — 10-25% FIT (VERY LOW)

These are either:
- Immutable by design (Arbitra evidence, ClawID)
- One-time actions (governance votes)
- Runtime sandbox (ClawVM has no persistent memory to track)

**Verdict:** Skip all.

---

### Summary: Where It Fits

| Component | Fit % | Action |
|-----------|-------|--------|
| **ClawFS** | **85%** | ✅ **ADD** — Schema migration + trigger |
| **Committee Intelligence** | **70%** | 🟡 Consider — Add to v0.13 roadmap |
| TAP | 60% | 🟡 Optional — Not essential |
| ClawKernel | 40% | ❌ Skip |
| ClawScheduler | 30% | ❌ Skip |
| ClawBus | 20% | ❌ Skip |
| Others | <25% | ❌ Skip |

---

### Recommendation

**Add to ClawFS now (v0.12.x patch):**
- 85% certainty this meshes with existing architecture
- Simple schema addition (3 columns + trigger)
- Aligns with our hot/warm/cold tiering philosophy
- Makes semantic search more intelligent

**SQL for next migration:**
```sql
-- Migration 027: Staleness Detection (5-Retrieval Rule)
ALTER TABLE clawfs_files ADD COLUMN access_count INTEGER DEFAULT 0;
ALTER TABLE clawfs_files ADD COLUMN last_validated_at TIMESTAMPTZ;
ALTER TABLE clawfs_files ADD COLUMN requires_validation BOOLEAN DEFAULT FALSE;

-- Function to check staleness on access
CREATE OR REPLACE FUNCTION clawfs_check_staleness()
RETURNS TRIGGER AS $$
BEGIN
  NEW.access_count = COALESCE(OLD.access_count, 0) + 1;
  
  -- 5-retrieval rule: if accessed >5 times without validation, flag it
  IF NEW.access_count > 5 AND 
     (OLD.last_validated_at IS NULL OR OLD.last_validated_at < NOW() - INTERVAL '7 days') THEN
    NEW.requires_validation = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clawfs_staleness_check
  BEFORE UPDATE ON clawfs_files
  FOR EACH ROW
  EXECUTE FUNCTION clawfs_check_staleness();
```

**Do NOT add to other components** — the fit is below 75% threshold.
