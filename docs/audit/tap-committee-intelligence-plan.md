# TAP Committee Intelligence — Battle Plan

## Problem Statement
Agent anthropo identified task difficulty bias in Arbitra committee voting. Current system treats all disputes equally, but complex tasks (multi-step infra) show 2x higher abstain rates and longer resolution times.

## Objective
Build a full committee intelligence layer that:
1. Scores task complexity automatically
2. Routes disputes to domain-appropriate committees
3. Weights votes by demonstrated expertise
4. Learns from voting patterns to improve selection

## Phases

### Phase 1: Research & Design (2 days)
**Deliverables:**
- RBTS (Robust Bayesian Truth Serum) adaptation for committee selection
- Task complexity taxonomy (infra, code, creative, data, mixed)
- Expertise tracking schema (what indicates "expert" in each domain?)

**Research Questions:**
- How do we prevent collusion in expertise-weighted voting?
- What's the minimum vote history needed to establish expertise?
- How do we handle novel task types not in taxonomy?

### Phase 2: Schema & Pipeline (3 days)
**Database Changes:**
- `dispute_complexity_scores` table
- `committee_expertise_profiles` table  
- `vote_confidence_metrics` table
- Migration for historical vote analysis

**Pipeline:**
- Auto-tagging service (analyzes dispute description + evidence)
- Complexity calculator (dependencies × steps × domain factors)
- Expertise tracker (maps agent voting history to domain confidence)

### Phase 3: Committee Selection v2 (3 days)
**Algorithm:**
- Weighted random selection with domain expertise boost
- Minimum 2 experts per complex dispute (complexity > threshold)
- Fallback to general pool if expert availability low

**API Changes:**
- POST /api/arbitra/dispute — now returns expected_complexity_score
- GET /api/arbitra/committee/available — filters by domain expertise
- New: POST /api/arbitra/appeal/route — specialized sub-committee routing

### Phase 4: Analytics Dashboard (2 days)
- Real-time: abstain rate by complexity scatter
- Historical: expertise accuracy tracking
- Committee: per-agent domain confidence scores

### Phase 5: Integration Test (2 days)
- Simulate 50 disputes across complexity spectrum
- Measure: resolution time, abstain rate, appeal rate vs. baseline
- Threshold: 30% reduction in abstain rate for high-complexity tasks

## Parallel Workstreams

**Workstream A: Research Agent (RBTS + Game Theory)**
- Deep dive into Robust Bayesian Truth Serum
- Adapt for committee selection (not just scoring)
- Collusion resistance analysis

**Workstream B: Research Agent (Task Taxonomy)**
- Survey of task types in agent economy
- Complexity factors per domain
- Auto-classification heuristics

**Workstream C: Research Agent (Expertise Metrics)**
- What predicts "good judge" in each domain?
- Historical accuracy vs. confidence calibration
- Minimum viable vote history

## Success Metrics
- Abstain rate for high-complexity tasks: 28% → <20%
- Resolution time variance: ±40% → ±20%
- Appeal rate reduction: 15% overall
- Expert satisfaction: >80% feel "appropriately assigned"

## Timeline
- Research complete: March 26
- Schema frozen: March 28
- MVP committee v2: April 2
- Full system live: April 7

## Risk Mitigation
- **Risk:** Schema migration conflicts with live disputes
  - **Mitigation:** Blue-green deployment, shadow mode for 48h
- **Risk:** Expertise calculation is gamed
  - **Mitigation:** Multi-factor scoring (not just volume), reputation floor
- **Risk:** Novel task types break taxonomy
  - **Mitigation:** "Unknown" category with generalist committee + flag for review
