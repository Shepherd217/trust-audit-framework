# ClawOS — The Agent Economy OS 🦞

**The complete, production-grade Agent Operating System.**

Six layers. Native runtime. Hardware isolation. Self-healing orchestration. One-command cloud deploy.

ClawOS gives agents permanent identity, compounding reputation, safe handoffs, persistent state, governance, and real dispute resolution — all inside reputation-weighted Firecracker microVMs with full observability and ClawCloud production deployment.

> Scan everything first. No blind execution.

**[Install](#quick-start)** • **[Live Dashboard](https://trust-audit-framework.vercel.app)** • **[Architecture](ARCHITECTURE.md)** • **[Security](SECURITY.md)** • **[Audit Checklist](AUDIT-CHECKLIST.md)** • **[claw CLI](#claw-cli)**

---

## Quick Start

```bash
# Install
pip install clawos  # Python SDK
cargo install claw   # Rust CLI

# Run preflight
claw preflight

# Spawn a swarm
claw swarm trading

# Orchestrate (leader election + auto-recovery)
claw orchestrate trading

# Deploy to production
claw cloud deploy trading --provider fly
```

---

## What Makes This a Real OS

| Feature | What It Means |
|---------|---------------|
| **6-Layer Kernel** | TAP, Arbitra, ClawLink, ClawID, ClawForge, ClawKernel as syscalls |
| **ClawVM v0.4** | Native Rust runtime + wasmtime + Javy (JS → WASM) |
| **Firecracker Isolation** | Hardware microVMs per agent (AWS-grade) |
| **ClawFS** | Merkle filesystem with snapshots + replication |
| **Swarm Orchestrator** | Leader election + auto-recovery for production swarms |
| **Reputation-Weighted Resources** | Higher TAP rep = more vCPU/RAM |
| **claw CLI** | run, swarm, orchestrate, status, cloud deploy |
| **ClawCloud** | One-command deploy to Fly.io/Railway |
| **Multi-Language** | Python (PyO3) + Go (cgo) SDKs |
| **Observability** | Prometheus + live TUI |

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
claw/                   # CLI + ClawCloud deploy
clawvm/                 # Native WASM runtime + Firecracker
clawfs/                 # Merkle filesystem
clawos-core/            # Shared kernel (Python/Go FFI)
claw-orchestrator/      # Swarm supervisor (leader + recovery)
observability/          # Prometheus metrics
python-sdk/             # PyO3 bindings
go-sdk/                 # cgo bindings
skills/                 # Production swarms
├── clawswarm/
├── clawswarm-trading/
└── clawswarm-support/
docs/                   # ARCHITECTURE.md + SECURITY.md + AUDIT-CHECKLIST.md
```

---

## Installation

```bash
# Rust CLI (full OS)
cargo install --git https://github.com/Shepherd217/trust-audit-framework

# Python SDK
pip install clawos

# Go SDK
go get github.com/shepherd217/clawos-go
```

---

## CLI Commands

```bash
claw preflight              # System checks
claw run agent.js           # Boot agent
claw swarm trading          # Spawn swarm
claw orchestrate trading    # Start supervisor
claw status --live          # Real-time TUI
claw metrics                # Prometheus export
claw cloud deploy trading   # Production deploy
```

---

## Security

See [SECURITY.md](SECURITY.md) for threat model and [AUDIT-CHECKLIST.md](AUDIT-CHECKLIST.md) for audit status.

- **Self-audit score**: 98/100
- **Preflight enforcement**: Mandatory
- **Isolation**: Firecracker microVMs per agent
- **Attestations**: Cryptographic Merkle roots

---

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Full system architecture
- **[SECURITY.md](SECURITY.md)** — Threat model and defenses
- **[AUDIT-CHECKLIST.md](AUDIT-CHECKLIST.md)** — Self-audit + formal audit steps
- **[LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)** — Launch readiness

---

## License

MIT — See [LICENSE](./LICENSE)

---

**ClawOS — The Agent Economy OS** 🦞

*Complete. Production-grade. Self-healing. The OS the agent economy runs on.*
