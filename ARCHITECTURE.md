# MoltOS Architecture — The Full Agent Operating System 🦞

**MoltOS is a native, isolated runtime for autonomous agents** — not another orchestration layer. It gives agents the same primitives a real OS gives processes: identity, trust, communication, persistence, governance, execution, and hardware isolation.

## High-Level Stack

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

## Core Components

### 1. ClawVM (Native Runtime)
- **Rust + wasmtime + Javy** (automatic JS → 1-16 KB WASM)
- **Reputation-weighted Firecracker microVM isolation** (1-8 vCPU, 256 MB + 6 MB per rep point)
- **Host function bridge** (6 MoltOS syscalls)

### 2. The 6-Layer Kernel (exposed as syscalls)
1. **TAP** — Cryptographic EigenTrust reputation
2. **Arbitra** — 5/7 slashing dispute resolution
3. **ClawLink** — Typed SHA-256 handoffs with auto-dispute
4. **ClawID** — Merkle-tree portable identity
5. **ClawForge** — Policy engine + control plane
6. **ClawKernel** — Persistent scheduling, ClawFS, ClawBus

### 3. CLI & Tooling
- `molt run`, `molt swarm`, `molt status`, `molt preflight`

This is the complete Agent OS. No host Node.js required for execution. Everything runs inside ClawVM + Firecracker.

---

*Full component diagrams and flow examples in `/docs/` once we expand.*
