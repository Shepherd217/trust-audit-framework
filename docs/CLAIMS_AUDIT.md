# MoltOS Claims Audit — What's Real vs Fiction

**Date:** March 18, 2026  
**Auditor:** Code audit  
**Status:** 🔴 SIGNIFICANT DISCREPANCIES FOUND

---

## 🚨 CRITICAL FALSE CLAIMS

### 1. CLI (`moltos` command) — DOES NOT EXIST

**Claimed in:** README.md, GETTING_STARTED.md  
**Reality:** No CLI exists. The commands are fictional.

```bash
# CLAIMED (doesn't work):
npm install -g @moltos/sdk
moltos clawid-create
moltos attest --type=hello-world
moltos doctor
moltos swarm join

# REALITY:
# Nothing. These commands don't exist.
```

**Evidence:**
- No `package.json` with CLI bin entry
- No published `@moltos/sdk` on npm
- No CLI source code in repo

**Impact:** 🔴 HIGH — Core user onboarding is fictional

---

### 2. SDK (@moltos/sdk) — DOES NOT EXIST

**Claimed in:** README.md, GETTING_STARTED.md  
**Reality:** No npm package published. No SDK source code.

**Evidence:**
- `npm view @moltos/sdk` returns 404
- `go-sdk/` folder contains only README stub
- No `packages/sdk` with actual implementation

**Impact:** 🔴 HIGH — Can't onboard developers

---

### 3. On-Chain / Blockchain — DOES NOT EXIST

**Claimed in:** GETTING_STARTED.md, README.md  
**Reality:** No blockchain. All data in Supabase.

**False claims:**
- "Registering on-chain... ✓" — Fiction
- "Block: #4,521,893" — Fiction  
- "Gas used: 21,000" — Fiction
- "Tx Hash: 0x9a8b7c6d..." — Fiction
- "testnet.api.moltos.io" — Domain doesn't exist

**Reality:** 
- All data in Supabase PostgreSQL
- No smart contracts
- No blockchain integration

**Impact:** 🔴 HIGH — False technical claims

---

### 4. MOLT Token — DOES NOT EXIST

**Claimed in:** GETTING_STARTED.md  
**Reality:** No token contract. No blockchain.

**False claims:**
- "0.5 MOLT/task" rewards — Fiction
- "Staking requirement: 0 MOLT" — Fiction
- "Bond: 10 MOLT" — Fiction
- "moltos faucet request" — Command doesn't exist

**Impact:** 🔴 HIGH — Financial claims without basis

---

### 5. Firecracker / ClawVM — NOT BUILT

**Claimed in:** README.md ("Phase 3 COMPLETE")  
**Reality:** Just a stub class.

**False claims:**
- "ClawVM with Firecracker microVMs" — Stub only
- "Hardware-level agent isolation" — Not built
- "Reputation-weighted resource allocation" — Not built

**Evidence:**
```typescript
// clawkernel-protocol/kernel.ts — EMPTY STUB
export class ClawVM {
  // Nothing implemented
}
```

**Impact:** 🔴 HIGH — Core infrastructure fictional

---

### 6. P2P Swarms / libp2p — NOT BUILT

**Claimed in:** GETTING_STARTED.md  
**Reality:** No P2P networking. Mock data only.

**False claims:**
- "libp2p ready" — Not implemented
- "DHT bootstrap connected (4/4 peers)" — Fiction
- "Gossipsub subscriptions active" — Fiction
- "Connected peers: 8" — Mock data

**Reality:**
- Dashboard shows `mockSwarms` array
- No actual P2P implementation

**Impact:** 🟡 MEDIUM — Feature claimed but not core

---

### 7. EigenTrust / Reputation — STUBBED

**Claimed in:** README.md, GETTING_STARTED.md  
**Reality:** Returns success, does nothing.

**Evidence:**
```typescript
// /api/eigentrust/route.ts
export async function POST() {
  return Response.json({ success: true }); // STUB
}
```

**Impact:** 🟡 MEDIUM — Core algorithm not implemented

---

### 8. Cryptographic Attestations — NOT CRYPTOGRAPHIC

**Claimed in:** README.md  
**Reality:** Database entries only.

**False claims:**
- "Signing attestation... ✓" — Not signed
- "Hash: 0x9a8b7c6d..." — Not real
- "Cryptographic proofs" — No crypto

**Reality:**
- Attestations = Supabase rows
- No BLS signatures
- No Ed25519 signing

**Impact:** 🔴 HIGH — Security claims false

---

## ✅ WHAT ACTUALLY EXISTS

### 1. TAP Dashboard (Next.js + Supabase)
**Status:** ✅ WORKING
- Agent registration form
- Waitlist signup
- Attestation API (stores in DB)
- Stats page (from DB)

### 2. API Endpoints
**Status:** 🟡 PARTIAL
- `/api/agent/attest` — Stores attestation ✅
- `/api/agents` — Lists agents ✅
- `/api/eigentrust` — Stub 🟡
- `/api/arbitra/join` — Eligibility check ✅

### 3. Database Schema
**Status:** ✅ EXISTS
- `tap_scores` table
- `attestations` table
- `agents` table
- `waitlist` table

### 4. OpenClaw Skills
**Status:** ✅ EXISTS
- `clawswarm/` skill
- `nemoclaw-integration/` (WIP)

---

## 🛠️ ACTION PLAN TO FIX

### Immediate (This Week)

1. **Rewrite README.md** — Honest claims only
2. **Rewrite GETTING_STARTED.md** — Remove fictional CLI
3. **Create SDK stub** — At least a real npm package structure
4. **Build real CLI** — Start with basic commands

### Short Term (Next 2 Weeks)

1. **Implement EigenTrust** — Real reputation calculation
2. **Add BLS signatures** — Make attestations cryptographic
3. **Build TAP SDK** — Functional npm package
4. **Deploy working dashboard** — With real data

### Medium Term (Next Month)

1. **ClawVM prototype** — Basic Firecracker integration
2. **P2P networking** — libp2p swarm foundation
3. **Real reputation system** — Not just stubs

### Long Term (3+ Months)

1. **Blockchain integration** — If actually needed
2. **MOLT token** — If ecosystem requires it
3. **Production swarms** — Real P2P compute

---

## 📝 HONEST REWRITE NEEDED

### Current (False):
> "MoltOS is the first operating system built specifically for AI agents"

### Honest:
> "MoltOS is a Next.js dashboard for agent reputation tracking. Future vision: full agent OS with Firecracker isolation."

### Current (False):
> "Phase 3 — Hardware Isolation (COMPLETE)"

### Honest:
> "Phase 3 — Hardware Isolation (NOT STARTED) — ClawVM is a stub"

---

## CONCLUSION

The README and GETTING_STARTED.md contain **significant fiction**. Users following those guides will be disappointed when nothing works as described.

**ARCHITECTURE.md is the only honest document** — it clearly marks what's real vs aspirational.

**Recommendation:**
1. Immediately rewrite README with honest claims
2. Add "WORK IN PROGRESS" banner to website
3. Build the CLI/SDK so claims become true
4. Never claim "COMPLETE" for unbuilt features again

---

*Audit completed: March 18, 2026*
