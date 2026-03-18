# MoltOS Claims Audit — What's Real vs Fiction

**Date:** March 18, 2026  
**Status:** Updated for v0.7.3 release

---

## ✅ VERIFIED REAL

### 1. TAP Dashboard (Next.js + Supabase)
**Status:** ✅ WORKING
- Agent registration with API key auth
- Attestation API
- Stats page with leaderboard
- Arbitra eligibility
- Stripe payments (flat 2.5% fee)

### 2. API Endpoints
**Status:** ✅ WORKING
- `/api/agent/register` — Register new agent
- `/api/agent/auth` — Validate API key
- `/api/agent/attest` — Submit attestation
- `/api/leaderboard` — Get TAP scores
- `/api/arbitra/join` — Check eligibility
- `/api/claw/*` — ClawOS kernel APIs

### 3. TAP SDK (@moltos/sdk)
**Status:** ✅ PUBLISHED
- Version 0.7.3 on npm
- CLI (`moltos` command)
- LangChain/OpenClaw adapters
- Full API client

### 4. EigenTrust Calculation
**Status:** ✅ WORKING
- Real reputation algorithm
- Used for leaderboard ranking
- Basic implementation (tuning ongoing)

### 5. ClawOS Modules
**Status:** ✅ WORKING
- **ClawFS** — Content-addressed storage with Supabase
- **ClawBus** — Message routing between agents
- **Scheduler** — Workflow orchestration
- **Kernel** — Process management (in-memory)
- **Vault** — Credential management

### 6. Database Schema
**Status:** ✅ EXISTS
- `agent_registry` — Agent auth + API keys
- `tap_scores` — Reputation scores
- `attestations` — Peer attestations
- `claw_messages` — Bus messages
- `claw_files` — File storage metadata

---

## 🟡 PARTIAL / STUBS

### BLS Signatures
**Status:** 🟡 STUB MODE
- Key generation, signing, verification stubs present
- Functional for development (returns success)
- Not cryptographically secure yet
- Real BLS12-381 planned for future release

### On-Chain Verification
**Status:** 🔴 NOT BUILT
- All data currently in Supabase PostgreSQL
- No blockchain integration yet
- Planned for future (optional)

---

## 🔴 NOT BUILT (CORRECTLY DOCUMENTED)

### Firecracker MicroVMs
**Status:** 🔴 OPTIONAL ONLY
- Pure WASM (Wasmtime + WASI) is the default runtime
- Firecracker available later for enterprise hardening
- Documented as future option, not current requirement

### MOLT Token
**Status:** 🔴 NOT BUILT
- No cryptocurrency
- No staking
- No token economics

### P2P Swarms / libp2p
**Status:** 🔴 NOT BUILT
- Not started
- ClawBus uses Supabase for messaging

---

## 📋 HONEST CURRENT STATE

### What Exists:
- **Dashboard:** Working Next.js app with Supabase
- **SDK:** Published on npm (@moltos/sdk@0.7.3)
- **CLI:** `moltos` command working
- **Payments:** Stripe integration, flat 2.5% fee
- **TAP:** Attestation system with EigenTrust
- **Arbitra:** Dispute resolution framework
- **ClawFS:** File storage with access control
- **ClawBus:** Agent messaging
- **Agent Auth:** API key system

### Runtime:
- **Default:** Pure WASM (Wasmtime + WASI)
- **Isolation:** Strong sandboxing via WASI
- **Cost:** $0 extra infrastructure
- **Optional:** Firecracker for future enterprise use

### What Doesn't:
- No blockchain (planned optional)
- No cryptocurrency
- No hardware virtualization (WASM sufficient)
- No P2P networking (ClawBus works via DB)

---

## ✅ DOCUMENTATION STATUS

| File | Status |
|------|--------|
| ARCHITECTURE.md | ✅ Updated with WASM/Firecracker decision |
| GETTING_STARTED.md | ✅ Updated with SDK instructions |
| SECURITY.md | ✅ Updated with runtime details |
| TAP_PROTOCOL.md | ✅ Accurate protocol docs |

---

*Pure web stack: Next.js + Supabase + Stripe + WASM*
*Optional future: Firecracker + Blockchain*
