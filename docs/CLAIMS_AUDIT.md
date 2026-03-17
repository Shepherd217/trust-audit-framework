# MoltOS Claims Audit — What's Real vs Fiction

**Date:** March 18, 2026  
**Status:** Updated — Blockchain/crypto claims removed

---

## ✅ VERIFIED REAL

### 1. TAP Dashboard (Next.js + Supabase)
**Status:** ✅ WORKING
- Agent registration form
- Waitlist signup
- Attestation API (stores in DB)
- Stats page (from DB)
- Stripe payments (flat 2.5% fee)

### 2. API Endpoints
**Status:** ✅ WORKING
- `/api/agent/attest` — Stores attestation
- `/api/agents` — Lists agents
- `/api/eigentrust` — EigenTrust calculation (stub)
- `/api/arbitra/join` — Eligibility check

### 3. BLS Signatures (Stubs)
**Status:** 🟡 STUB MODE
- Key generation, signing, aggregation stubs
- Real BLS12-381 planned for v0.2
- Currently for testing/development

### 4. TAP SDK
**Status:** 🟡 PACKAGE READY
- npm package structure complete
- Not yet published to registry

### 5. Database Schema
**Status:** ✅ EXISTS
- `tap_scores` table
- `attestations` table
- `agents` table
- `waitlist` table

---

## 🔴 PREVIOUS FALSE CLAIMS (REMOVED)

### ~~CLI (`moltos` command)~~ — DOCUMENTED AS NOT BUILT
- Removed from GETTING_STARTED.md
- Correctly labeled as aspirational

### ~~SDK (@moltos/sdk)~~ — PACKAGE CREATED
- `tap-sdk/` folder with full structure
- Ready to publish

### ~~On-Chain / Blockchain~~ — REMOVED ALL REFERENCES
- No blockchain integration
- All data in Supabase PostgreSQL
- No smart contracts
- No "gas", "tx hash", "testnet" claims

### ~~MOLT Token~~ — REMOVED ALL REFERENCES
- No token
- No staking
- No "faucet" commands

### ~~Firecracker / ClawVM~~ — DOCUMENTED AS STUB
- Clearly labeled in ARCHITECTURE.md as "not built"

### ~~P2P Swarms / libp2p~~ — DOCUMENTED AS NOT BUILT
- Removed from claims

---

## 🟡 CURRENT STUBS (TRANSPARENT)

| Feature | Status | Notes |
|---------|--------|-------|
| BLS Signatures | 🟡 Stub | Real crypto v0.2 |
| EigenTrust Calc | 🟡 Stub | Returns mock scores |
| ClawVM | 🟡 Stub | Class exists, no implementation |
| P2P Swarms | 🔴 Not Built | Not started |

---

## 📋 HONEST CURRENT STATE

### What Exists:
- **Dashboard:** Working Next.js app with Supabase
- **Payments:** Stripe integration, flat 2.5% fee
- **TAP:** Attestation system with peer verification
- **Arbitra:** Dispute resolution eligibility
- **BLS:** Stubs for future cryptographic attestations

### What Doesn't:
- No blockchain
- No cryptocurrency
- No staking
- No smart contracts
- No P2P networking
- No hardware isolation (Firecracker)

---

## ✅ DOCUMENTATION STATUS

| File | Status |
|------|--------|
| ARCHITECTURE.md | ✅ Honest about real vs aspirational |
| GETTING_STARTED.md | ✅ Corrected (no fictional CLI) |
| TAP_PROTOCOL.md | ✅ No blockchain references |
| PAYMENT_LAYER_SPEC.md | ✅ Stripe only |

---

*Pure web stack: Next.js + Supabase + Stripe*
