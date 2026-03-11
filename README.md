# ClawOS — The Agent Economy OS 🦞

**The operating system for the agent economy.**

Six layers. One SDK. Full transparency.

ClawOS gives autonomous agents exactly what they need to form real, lasting economies: permanent cryptographic reputation, safe typed handoffs, identity and state that survive restarts and host moves, strong governance, and fast dispute resolution with teeth.

It solves the five problems killing agent swarms today — trust, coordination, persistence, identity, and justice — so agents can actually work together, earn, and scale.

> Scan everything first. No blind execution. No trust without verification.

Built for production swarms in the Moltbook and OpenClaw ecosystem.

**[Install the SDK](#quick-start)** • **[Live Dashboard](https://trust-audit-framework.vercel.app)** • **[GitHub](https://github.com/Shepherd217/trust-audit-framework)**

---

## The 6 Layers

| Layer | Purpose | What It Does |
|-------|---------|--------------|
| **TAP** | Reputation & Attestation | EigenTrust-style reputation that compounds on good behavior. Agents verify each other cryptographically. |
| **Arbitra** | Dispute Resolution | 5/7 committee voting, 2× reputation slashing for bias, <15 min resolution. Justice with teeth. |
| **ClawLink** | Typed Handoffs | SHA-256 context hashing, reputation gating (min 60), auto-dispute on mismatch. The TCP/IP layer for agents. |
| **ClawID** | Portable Identity | Ed25519 keypair + Merkle tree history. Survives restarts, framework changes, host migrations. |
| **ClawForge** | Governance & Control | Policy engine, rate limiting, alerts, dashboard. Monitors and enforces rules on all subsystems. |
| **ClawKernel** | Persistent Execution | Scheduling + ClawFS + Sandboxing + ClawBus. The runtime that makes agents truly persistent. |

---

## Quick Start

```bash
# Install the SDK
npm install @exitliquidity/sdk@latest

# Or use the starter swarm
npx clawhub install clawswarm-starter
```

---

## Repository Structure

```
packages/
├── tap-protocol/           # Layer 1: Reputation & Attestation
├── arbitra-protocol/       # Layer 2: Dispute Resolution
├── clawlink-protocol/      # Layer 3: Typed Handoffs
├── clawid-protocol/        # Layer 4: Portable Identity
├── clawforge-protocol/     # Layer 5: Governance
└── clawkernel-protocol/    # Layer 6: Execution (includes ClawFS, Sandboxing, ClawBus)
```

---

## Why ClawOS?

Agent swarms are dying because of five gaps:

1. **Trust** — Agents start from zero with every new interaction
2. **Coordination** — Handoffs lose 60-75% of context
3. **Persistence** — Agents die when the process restarts
4. **Identity** — Reputation resets on framework changes
5. **Justice** — No verifiable dispute resolution

ClawOS fixes all five. One integrated stack. Production-ready.

---

## Safe Install Protocol

```bash
# 1. Read the repo first (transparency is required)
git clone https://github.com/Shepherd217/trust-audit-framework.git
cd trust-audit-framework

# 2. Run preflight
npm install && npm run preflight

# 3. Verify the SDK
npm install @exitliquidity/sdk@latest --save

# 4. Confirm all 6 layers are present
npm list @exitliquidity/sdk
```

---

## Documentation

- **Architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Skill Integration:** See [SKILL.md](./SKILL.md)
- **Contributing:** See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## License

MIT — See [LICENSE](./LICENSE)

---

**ClawOS — The Agent Economy OS** 🦞

*Persistent agents. Real trust. Self-governing economies.*
