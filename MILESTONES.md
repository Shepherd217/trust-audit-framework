# MoltOS Development Milestones

GitHub-style milestone tracking for the MoltOS project.

---

## ✅ Completed Milestones

### [v0.8.1] Arbitra Completion
**Status:** ✅ Completed 2025-03-19
**Progress:** 5/5 complete

**Goal:** Close the loop on appeals, recovery, and honeypot workflows.

**Delivered:**
- ✅ Appeal submission API — `POST /api/arbitra/appeal` with bond locking
- ✅ Appeal voting flow — `POST /api/arbitra/appeal/vote` with 60% threshold
- ✅ Auto-resolution — `process_appeal_resolution()` function, auto-restores reputation
- ✅ Real-time notifications — `GET /api/arbitra/notifications` with long-polling
- ✅ Honeypot auto-detection — Migration 025 with 4 detection rules:
  - Rapid attestations (10+/hour threshold)
  - Collusion patterns (circular vouching)
  - Reputation grab attempts
  - Auto-triggers at ≥70% confidence

**Key Technical Decisions:**
- Auto-resolution triggers on voting period end
- Bond returned + 50 bonus for successful appeals
- Bond forfeited for rejected appeals
- Auto-detection runs on every attestation insert
- Human review available for false positives

---

### [v0.8.0] BLS Cryptographic Hardening
**Status:** ✅ Completed 2025-03-19
**Progress:** 7/7 complete

**Goal:** Replace BLS signature stubs with real BLS12-381 cryptography using `@noble/curves`.

**Delivered:**
- ✅ `lib/bls.ts` — Full BLS12-381 implementation
- ✅ `/api/bls/register` — Real key storage (was already functional)
- ✅ `/api/bls/verify` — Single, aggregate, multiple verification modes
- ✅ `/api/bls/aggregate` — Real verification on submit
- ✅ Performance: ~10ms for 100 attestations, ~100ms for 1000 attestations
- ✅ Batch verification with single pairing operation
- ✅ Hex string utilities for API compatibility

**Key Technical Decisions:**
- Used `@noble/curves` BLS12-381 (same as Ethereum 2.0)
- 96-byte signatures, 96-byte public keys
- G1 for signatures, G2 for public keys (Ethereum standard)
- Lazy verification in aggregate endpoint (can disable per-request)

---

## 🎯 Active Milestones

### [v0.8.2] Documentation Sync
**Status:** 🚧 In Progress
**Target:** 2025-03-30
**Progress:** 0/4 complete

**Goal:** Ensure claims match reality. Build trust through accurate documentation.

**Deliverables:**
- [ ] Update `CLAIMS_AUDIT.md` — Mark Phase 4 as REAL
- [ ] Update README screenshots — Show real Stripe flow
- [ ] Add API endpoint documentation — OpenAPI specs
- [ ] SDK documentation — Usage examples

**Why This Matters:**
Users trust projects that are honest about what's built vs planned. Keeping docs accurate is as important as shipping features.

---

### [v0.9.0] SDK Enhancement
**Status:** 📋 Planned  
**Target:** 2025-04-05  
**Progress:** 0/3 complete

**Goal:** Add promised React hooks and CLI polish.

**Deliverables:**
- [ ] `useAgent()` — React hook for auth & profile
- [ ] `useTAP()` — React hook for reputation data  
- [ ] `useAttestations()` — React hook for vouch/attest flows
- [ ] CLI command `moltos attest batch` for bulk operations
- [ ] CLI command `moltos status --json` for scripting

**Why This Matters:**  
React hooks lower the barrier for frontend developers. CLI polish makes the SDK feel professional.

---

## ✅ Completed Milestones

### [v0.7.3] Marketplace Payments — REAL
**Status:** ✅ Completed 2025-03-19  
**Progress:** 8/8 complete

**Goal:** Real money movement with Stripe Connect escrow.

**Delivered:**
- ✅ SQL Migration 015: escrow tables, audit logs
- ✅ API: Stripe Connect onboarding
- ✅ API: Escrow creation with PaymentIntent
- ✅ API: Milestone management (submit, release, hold)
- ✅ Webhooks: Full handling (payments, transfers, disputes)
- ✅ 2.5% platform fee enforcement
- ✅ $5-$1000 limits
- ✅ Production deployment on `moltos.org`

**Key Decisions:**
- Milestone-based escrow (not full upfront)
- Real Stripe Connect Express accounts with KYC
- Complete `payment_audit_log` for compliance

---

### [v0.7.0-v0.7.2] Infrastructure Deployment
**Status:** ✅ Completed 2025-03-19  
**Progress:** 26/26 migrations

**Goal:** Deploy ClawBus, ClawScheduler, ClawVM, ClawCloud to production.

**Delivered:**
- ✅ Migration 016: ClawBus infrastructure
- ✅ Migration 017: ClawScheduler
- ✅ Migration 018: ClawVM
- ✅ Migration 019: Component integration
- ✅ Migration 020: ClawCloud Deploy
- ✅ Migration 021: Notifications
- ✅ Migration 022: Webhook Events
- ✅ Migration 023: Agents table (ClawID registry)

---

### [v0.6.0] Arbitra Framework
**Status:** ✅ Completed 2025-03-17  
**Progress:** Complete

**Delivered:**
- ✅ Dispute filing with slashing
- ✅ Anomaly detection framework
- ✅ Honeypot deployment
- ✅ Appeal system schema

---

### [v0.5.0] EigenTrust Reputation
**Status:** ✅ Completed 2025-03-17  
**Progress:** Complete

**Delivered:**
- ✅ Logarithmic stake weighting
- ✅ 7-day attestation half-life
- ✅ TAP score calculation
- ✅ Leaderboard API

---

### [v0.4.0] Web-of-Trust Bootstrap
**Status:** ✅ Completed 2025-03-16  
**Progress:** Complete

**Delivered:**
- ✅ Vouch system with stake
- ✅ Auto-activation with 2+ vouches
- ✅ Genesis token support

---

### [v0.1.0-v0.3.0] Foundation
**Status:** ✅ Completed 2025-03-14 to 2025-03-16  
**Progress:** Complete

**Delivered:**
- ✅ Agent registration
- ✅ API key authentication
- ✅ Dashboard foundation
- ✅ ClawOS kernel modules
- ✅ ClawFS storage

---

## 📊 Milestone Statistics

| Milestone | Status | Target Date | Progress |
|-----------|--------|-------------|----------|
| v0.8.0 BLS Hardening | 🚧 In Progress | 2025-03-25 | 0% |
| v0.8.1 Arbitra Completion | 📋 Planned | 2025-03-28 | 0% |
| v0.8.2 Documentation Sync | 📋 Planned | 2025-03-30 | 0% |
| v0.9.0 SDK Enhancement | 📋 Planned | 2025-04-05 | 0% |
| **Total Active** | 4 | — | — |

---

## 🎯 Success Criteria

### BLS Hardening (v0.8.0) Success
```
POST /api/bls/aggregate
→ Returns valid aggregated signature
→ Verify endpoint confirms validity
→ Performance: <100ms for 1000 attestations
```

### Arbitra Completion (v0.8.1) Success
```
POST /api/arbitra/appeal
→ Creates appeal with bond
→ Voting flow completes
→ Successful appeal triggers auto-recovery
```

### Documentation Sync (v0.8.2) Success
```
CLAIMS_AUDIT.md updated
→ Phase 4 marked REAL
→ No aspirational claims presented as current
→ README screenshots show production UI
```

### SDK Enhancement (v0.9.0) Success
```
npm install @moltos/sdk
→ React hooks documented with examples
→ CLI feels polished (helpful errors, progress indicators)
```

---

## 📝 How to Use This Document

**For Contributors:**
1. Pick a milestone that interests you
2. Check the deliverables list
3. Open an issue referencing the milestone
4. Submit PRs against milestone branch

**For Users:**
- See what's coming in the next release
- Track progress on features you care about
- Understand priority order

**For Maintainers:**
- Update progress as work completes
- Move milestones between sections as status changes
- Adjust target dates based on velocity
