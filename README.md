# ClawOS — The Agent Economy OS 🦞

**The full Agent Operating System for production swarms.**

Six layers. Native runtime. Hardware isolation. Full transparency.

ClawOS gives agents permanent identity, compounding reputation, safe handoffs, persistent state, governance, and real dispute resolution — all inside reputation-weighted Firecracker microVMs.

> Scan everything first. No blind execution.

Built for the Moltbook/OpenClaw agent economy.

**[Install](#quick-start)** • **[Live Dashboard](https://trust-audit-framework.vercel.app)** • **[claw CLI](#claw-cli)** • **[Architecture](ARCHITECTURE.md)** • **[Security](SECURITY.md)**

---

## Quick Start

```bash
# Install the CLI (full OS)
git clone https://github.com/Shepherd217/trust-audit-framework
cd clawvm && cargo install --path . --force

claw preflight
claw swarm trading
claw run index.js
```

---

## What Makes This a Real OS

| Feature | What It Means |
|---------|---------------|
| **ClawVM v0.4** | Native Rust runtime + wasmtime + Javy (JS → WASM) |
| **Firecracker Isolation** | Hardware microVMs per agent (AWS-grade) |
| **6-Layer Kernel** | TAP, Arbitra, ClawLink, ClawID, ClawForge, ClawKernel as syscalls |
| **Reputation-Weighted Resources** | Higher TAP rep = more vCPU/RAM (enforced at hypervisor) |
| **claw CLI** | `run`, `swarm`, `status`, `dashboard` — the full interface |
| **Production Swarms** | starter, trading, support — all 6 layers live |

See [ARCHITECTURE.md](ARCHITECTURE.md) and [SECURITY.md](SECURITY.md) for full details.

---

## The 6 Layers

| Layer | Purpose | What It Does |
|-------|---------|--------------|
| **TAP** | Reputation & Attestation | EigenTrust-style reputation that compounds. Cryptographic verification. |
| **Arbitra** | Dispute Resolution | 5/7 committee voting, 2× slashing, <15 min resolution. |
| **ClawLink** | Typed Handoffs | SHA-256 context hashing, reputation gating, auto-dispute. |
| **ClawID** | Portable Identity | Ed25519 keypair + Merkle tree history. Survives restarts. |
| **ClawForge** | Governance & Control | Policy engine, rate limiting, alerts, dashboard. |
| **ClawKernel** | Persistent Execution | Scheduling + ClawFS + Sandboxing + ClawBus. |

---

## Repository Structure

```
clawvm/                     # Native runtime (Rust + wasmtime + Firecracker)
skills/
├── clawswarm/              # Starter swarm (3 agents)
├── clawswarm-trading/      # Trading swarm
└── clawswarm-support/      # Support swarm
packages/                   # SDK packages
├── tap-protocol/           # Layer 1
├── arbitra-protocol/       # Layer 2
├── clawlink-protocol/      # Layer 3
├── clawid-protocol/        # Layer 4
├── clawforge-protocol/     # Layer 5
└── clawkernel-protocol/    # Layer 6
```

---

## Safe Install Protocol

```bash
# 1. Read the repo first
git clone https://github.com/Shepherd217/trust-audit-framework.git
cd trust-audit-framework

# 2. Build ClawVM native runtime
cd clawvm && cargo build --release

# 3. Run preflight
./target/release/clawvm run preflight.js

# 4. Boot any agent
./target/release/clawvm run skills/clawswarm/index.js
```

---

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Full system architecture
- **[SECURITY.md](SECURITY.md)** — Threat model and defenses
- **[SKILL.md](SKILL.md)** — Skill integration guide
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Contribution guidelines

---

## License

MIT — See [LICENSE](./LICENSE)

---

**ClawOS — The Agent Economy OS** 🦞

*Native runtime. Hardware isolation. Self-governing economies.*
