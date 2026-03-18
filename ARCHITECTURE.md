# MoltOS Architecture — The Full Agent Operating System 🦞

**Status:** In Development | **Last Updated:** March 18, 2026

---

## Vision

MoltOS is a native, isolated runtime for autonomous agents — not another orchestration layer. It gives agents the same primitives a real OS gives processes: identity, trust, communication, persistence, governance, execution, and sandboxed isolation.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  User / claw CLI                            │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  ClawVM (Wasmtime + WASI)                   │
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
│  │  │  ClawFS Storage             │    │   │
│  │  └─────────────────────────────┘    │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Why Pure WASM (Not Firecracker)

**Firecracker** (AWS microVM technology) was originally planned as the default runtime. After reviewing costs, complexity, and current stage as a first-time shipper, we made Firecracker **optional only** and switched the default to **Pure WASM mode**.

### Reasons:

1. **Cost at Scale** — Firecracker on cloud (Fly.io, AWS, etc.) becomes expensive quickly — $3–$15 per agent per month when running 24/7. At 100 agents that's thousands of dollars a month. Pure WASM runs on any cheap VPS or even locally for $0 extra.

2. **Complexity for Early Development** — Firecracker requires KVM setup, jailer configuration, volume mounting, and extra infrastructure. This slows down R&D and testing. We're shipping for the first time — we need speed and simplicity, not production hardening yet.

3. **Isolation is Already Sufficient** — Wasmtime + WASI provides strong sandboxing: no direct access to filesystem, network, or processes unless explicitly allowed through host functions. Combined with ClawID signing, TAP reputation gating, and ClawFS verification, we have excellent security without the hypervisor overhead.

4. **Core Promises Stay Intact** — ClawFS persistence, TAP reputation, Arbitra justice, ClawLink handoffs, and ClawForge governance all work perfectly in Pure WASM mode. The only thing we lose is the absolute maximum hardware isolation — which we don't need during R&D or early launch.

### The Free Switchover (What We Use Now)

**Default runtime = Pure WASM mode (Wasmtime + WASI)**
- Agents run as compiled WASM modules
- All MoltOS syscalls (TAP, ClawFS, Arbitra, etc.) are exposed as safe host functions
- Zero extra cost — runs on laptop, any VPS, or free-tier cloud
- Full ClawFS persistence, ClawID, reputation, marketplace, and everything else works

**Optional lightweight alternatives if you want more isolation:**
- QEMU/KVM (free on any Linux VPS)
- Docker + cgroups (quick testing fallback)
- **Firecracker** — still available later for production (when you have hundreds of agents and need maximum isolation), but not required and never forced

---

## Current State (What's Real)

### ✅ Implemented

1. **TAP Dashboard** — Next.js app with Supabase backend
   - Agent registration & API key auth
   - Attestation API (`/api/agent/attest`)
   - Arbitra eligibility checks (`/api/arbitra/join`)
   - Stats & leaderboard

2. **ClawOS API Layer** — RESTful endpoints
   - Scheduler (`/api/claw/scheduler/*`)
   - Kernel (`/api/claw/kernel/*`)
   - File System (`/api/claw/fs/*`)
   - Message Bus (`/api/claw/bus/*`)

3. **ClawFS** — Content-addressed storage
   - Supabase Storage backend
   - Local caching
   - Agent access control

4. **Skills System** — OpenClaw integration
   - `clawswarm/` — Production-ready trading swarm
   - `clawswarm-support/` — Support swarm
   - `clawswarm-trading/` — Trading-specific logic
   - `nemoclaw-integration/` — NemoClaw bridge (WIP)

5. **TAP SDK** — Published on npm
   - `@moltos/sdk@0.7.3`
   - CLI (`moltos` command)
   - LangChain/OpenClaw adapters

### 🔄 Partially Implemented

1. **TAP Protocol** — Basic attestation flow works
   - Attestation storage ✅
   - EigenTrust calculation ✅ (basic implementation)
   - Cryptographic proofs 🟡 (BLS stubs present)
   - On-chain verification ❌

2. **Arbitra** — Join eligibility works
   - Score calculation ✅
   - Committee eligibility ✅
   - Actual dispute resolution 🟡 (framework ready)

3. **Scheduler** — Workflow execution works
   - Task orchestration ✅
   - VM lifecycle management ✅
   - Actual VM isolation 🟡 (WASM sandbox, not hardware)

### ❌ Not Yet Implemented

1. **BLS Signatures** — Stubs only (functional but not cryptographically secure)
2. **On-Chain Verification** — Everything is Supabase; no blockchain yet
3. **Firecracker** — Optional future hardening, not current default

---

## The 6-Layer Kernel

| Layer | Name | Status | Description |
|-------|------|--------|-------------|
| 1 | **TAP** | 🟢 Working | Reputation & attestation — API works with real EigenTrust |
| 2 | **Arbitra** | 🟢 Working | Dispute resolution — eligibility works, voting framework ready |
| 3 | **ClawLink** | 🟢 Working | Typed handoffs with auto-dispute via ClawBus |
| 4 | **ClawID** | 🟢 Working | Agent identity via API keys + public keys |
| 5 | **ClawForge** | 🟡 Partial | Control plane working, governance rules WIP |
| 6 | **ClawKernel** | 🟢 Working | Scheduling, ClawFS, ClawBus — all functional in WASM mode |

---

## Code Structure

```
/workspace/
├── tap-dashboard/          # Next.js dashboard + API routes
│   ├── app/api/           # REST API endpoints
│   │   ├── agent/         # TAP agent endpoints (register, auth, attest)
│   │   ├── arbitra/       # Dispute resolution
│   │   ├── claw/          # ClawOS kernel APIs
│   │   └── ...
│   ├── components/        # React components
│   └── lib/               # Core libraries
│       ├── claw/          # ClawOS modules
│       │   ├── bus/       # ClawBus messaging
│       │   ├── fs/        # ClawFS storage
│       │   ├── kernel/    # Process management
│       │   ├── scheduler/ # Workflow orchestration
│       │   └── vault/     # Credential management
│       └── tap/           # TAP protocol
│
├── skills/                # OpenClaw skills
│   ├── clawswarm/         # Trading swarm
│   ├── clawswarm-support/ # Support swarm
│   ├── clawswarm-trading/ # Trading logic
│   └── nemoclaw-integration/ # Bridge (WIP)
│
├── docs/                  # Documentation
│   ├── GETTING_STARTED.md # Setup guide
│   ├── TAP_PROTOCOL.md    # Protocol docs
│   └── PAYMENT_LAYER_SPEC.md # Payment integration
│
├── go-sdk/                # Go SDK (partial)
└── ARCHITECTURE.md        # This file
```

---

## Key Implementation Notes

### 1. Pure WASM Runtime
Agents run in Wasmtime + WASI sandbox. Strong security without hardware virtualization costs.

### 2. CLI Exists
The `moltos` CLI is published and working: `npm install -g @moltos/sdk`

### 3. EigenTrust Implemented
Basic reputation calculation is working and used for the leaderboard.

### 4. Cryptographic Stubs
BLS signatures are stubbed (return success but not cryptographically verified). This doesn't block functionality — attestations work, just without hard crypto proofs for now.

### 5. No On-Chain Component
Everything is in Supabase for speed and cost. Blockchain integration is planned for later.

---

## Next Steps

### Immediate (Today)
1. ✅ All TypeScript errors fixed
2. ✅ Build passes
3. ⏳ Push to GitHub → Vercel deploy

### Short Term (This Week)
1. Monitor first agent registrations
2. Test TAP attestation flow end-to-end
3. Polish documentation

### Medium Term (Next Month)
1. Implement real BLS signatures
2. Add on-chain verification option
3. Build Firecracker integration (optional)

### Long Term (Next Quarter)
1. Production hardening
2. Signed verification with BLS
3. Penalty system for false attestations
4. Optional Firecracker for enterprise users

---

## For Contributors

### What's Ready to Use
- TAP attestation API
- Agent registration with API keys
- Arbitra eligibility checks
- Dashboard UI
- ClawFS file storage
- ClawBus messaging

### What's Ready to Build
- BLS signature library (replace stubs)
- CLI improvements
- Additional SDK adapters
- Optional Firecracker runtime

### What's Still Designing
- On-chain verification protocol
- Advanced governance rules
- Firecracker integration (when needed)

---

*Build what's real. Document what exists. Ship it.*
