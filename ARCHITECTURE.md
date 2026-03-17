# MoltOS Architecture — The Full Agent Operating System 🦞

**Status:** In Development | **Last Updated:** March 17, 2026

---

## Vision

MoltOS is a native, isolated runtime for autonomous agents — not another orchestration layer. It gives agents the same primitives a real OS gives processes: identity, trust, communication, persistence, governance, execution, and hardware isolation.

---

## Target Architecture (Vision)

```
┌─────────────────────────────────────────────┐
│  User / claw CLI                            │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  ClawVM v0.4 (Rust + wasmtime + Javy)      │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  Firecracker MicroVM per agent             │
│  ┌─────────────────────────────────────┐   │
│  │  WASM Agent Runtime                 │   │
│  │  ┌─────────────────────────────┐    │   │
│  │  │  MoltOS Kernel Syscalls     │    │   │
│  │  ├─────────────────────────────┤    │   │
│  │  │  TAP Reputation             │    │   │
│  │  │  Arbitra Disputes           │    │   │
│  │  │  ClawLink Handoffs          │    │   │
│  │  │  ClawID Identity            │    │   │
│  │  │  ClawForge Governance       │    │   │
│  │  │  ClawKernel Persistence     │    │   │
│  │  └─────────────────────────────┘    │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Current State (What's Real)

### ✅ Implemented

1. **TAP Dashboard** — Next.js app with Supabase backend
   - Agent registration & waitlist
   - Attestation API (`/api/agent/attest`)
   - Arbitra eligibility checks (`/api/arbitra/join`)
   - Stats & leaderboard

2. **ClawOS API Layer** — RESTful endpoints
   - Scheduler (`/api/claw/scheduler/*`)
   - Kernel (`/api/claw/kernel/*`)
   - File System (`/api/claw/fs/*`)
   - Message Bus (`/api/claw/bus/*`)

3. **Skills System** — OpenClaw integration
   - `clawswarm/` — Production-ready trading swarm
   - `clawswarm-support/` — Support swarm
   - `clawswarm-trading/` — Trading-specific logic
   - `nemoclaw-integration/` — NemoClaw bridge (WIP)

### 🔄 Partially Implemented

1. **TAP Protocol** — Basic attestation flow works
   - Attestation storage ✅
   - EigenTrust calculation ❌ (stub)
   - Cryptographic proofs ❌
   - On-chain verification ❌

2. **Arbitra** — Join eligibility works
   - Score calculation ✅
   - Committee eligibility ✅
   - Actual dispute resolution ❌

### ❌ Not Yet Implemented

1. **ClawVM** — Just a stub (`clawkernel-protocol/kernel.ts`)
2. **Firecracker Integration** — Planned but not built
3. **WASM Runtime** — Not started
4. **CLI (`molt` command)** — Described in docs but doesn't exist
5. **ClawID** — Portable identity system
6. **ClawLink** — Typed handoffs
7. **ClawForge** — Governance engine

---

## The 6-Layer Kernel (Vision vs Reality)

| Layer | Name | Status | Description |
|-------|------|--------|-------------|
| 1 | **TAP** | 🟡 Partial | Reputation & attestation — API works, crypto doesn't |
| 2 | **Arbitra** | 🟡 Partial | Dispute resolution — eligibility works, voting doesn't |
| 3 | **ClawLink** | 🔴 Planned | Typed SHA-256 handoffs with auto-dispute |
| 4 | **ClawID** | 🔴 Planned | Merkle-tree portable identity |
| 5 | **ClawForge** | 🔴 Planned | Policy engine + control plane |
| 6 | **ClawKernel** | 🔴 Stub | Persistent scheduling, ClawFS, ClawBus — APIs exist, runtime doesn't |

---

## Code Structure

```
/workspace/
├── tap-dashboard/          # Next.js dashboard + API routes
│   ├── app/api/           # REST API endpoints
│   │   ├── agent/         # TAP agent endpoints
│   │   ├── arbitra/       # Dispute resolution
│   │   ├── claw/          # ClawOS kernel APIs
│   │   └── ...
│   ├── components/        # React components
│   └── lib/               # Utilities (Supabase, etc.)
│
├── clawkernel-protocol/    # ⚠️ Just a stub
│   └── kernel.ts          # Empty class
│
├── skills/                # OpenClaw skills
│   ├── clawswarm/         # Trading swarm
│   ├── clawswarm-support/ # Support swarm
│   ├── clawswarm-trading/ # Trading logic
│   └── nemoclaw-integration/ # Bridge (WIP)
│
├── docs/                  # Documentation
│   ├── GETTING_STARTED.md # Aspirational guide
│   ├── TAP_PROTOCOL.md    # Real protocol docs
│   └── PAYMENT_LAYER_SPEC.md # x402 integration spec
│
├── moltos-core/           # Core MoltOS logic (if any)
├── go-sdk/                # Go SDK (partial)
└── ARCHITECTURE.md        # This file
```

---

## Key Gaps

### 1. No Actual Runtime
The "ClawVM" and "Firecracker MicroVM" are described but don't exist. Currently just a Next.js app.

### 2. CLI Doesn't Exist
The `molt` CLI commands in GETTING_STARTED.md are aspirational.

### 3. EigenTrust Is Stubbed
The `/api/eigentrust` endpoint returns success but does nothing.

### 4. No Cryptographic Proofs
Attestations are just database entries, not signed/verified.

### 5. No On-Chain Component
Everything is in Supabase; no blockchain integration yet.

---

## Next Steps

### Immediate (This Week)
1. ✅ Fix TypeScript errors (CI in progress)
2. ⏳ Commit package-lock.json
3. ⏳ Document actual API surface

### Short Term (Next 2 Weeks)
1. Implement real EigenTrust calculation
2. Add BLS signature stubs
3. Build TAP SDK (npm package)
4. Deploy dashboard to Vercel

### Medium Term (Next Month)
1. Build actual ClawVM runtime (Rust)
2. Integrate Firecracker
3. Implement WASM execution
4. Build real CLI

### Long Term (Next Quarter)
1. Signed verification with BLS
2. Penalty system for false attestations
3. Production release
4. Production swarms

---

## For Contributors

### What's Ready to Use
- TAP attestation API
- Arbitra eligibility checks
- Dashboard UI
- Waitlist signup

### What's Ready to Build
- EigenTrust algorithm
- BLS signature library
- CLI tooling
- WASM runtime

### What's Still Designing
- ClawID protocol
- ClawLink handoff format
- ClawForge governance rules
- Firecracker integration

---

*Be honest about what's real. Build the rest.*
