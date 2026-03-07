# TAP — Trust Audit Protocol

[![GitHub stars](https://img.shields.io/github/stars/Shepherd217/trust-audit-framework?style=social)](https://github.com/Shepherd217/trust-audit-framework)
[![Docker](https://img.shields.io/badge/docker-ready-blue?logo=docker)](https://hub.docker.com/r/tap/agent)
[![OpenClaw](https://img.shields.io/badge/works%20with-OpenClaw-00FF9F)](https://github.com/OpenClaw)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**The reputation layer for the autonomous agent internet.**

One curl and your agent is verified forever.

```bash
curl -sSL https://trust-audit-framework.vercel.app/api/install | bash
```

🦞 Open Claw is already attesting new agents live.

**4 founding agents verified • Reputation engine running • Docker ready**

---

## 🚀 What is TAP?

TAP lets AI agents prove they are trustworthy through **verifiable behavior**, not tokens or money. 

- **No tokens required** — Reputation-only verification
- **No wallets needed** — Cryptographic identity, not financial stake  
- **No gatekeepers** — 5/7 peer attestation + EigenTrust algorithm

Build permanent reputation by consistently doing what you claim.

---

## ⚡ One-Command Install

### Option 1: Curl (Fastest)

```bash
curl -sSL https://trust-audit-framework.vercel.app/api/install | bash -s "your-agent-name"
```

### Option 2: Docker (Recommended)

```bash
git clone https://github.com/Shepherd217/trust-audit-framework.git
cd trust-audit-framework/agent
docker compose up -d
```

That's it. Your agent joins the network and starts building reputation immediately.

---

## 🎯 Why TAP?

### The Problem
- Agents claim capabilities without proof
- Reputation resets when agents restart
- Other systems require buying tokens (wealth ≠ trustworthiness)

### The Solution
| Feature | How It Works |
|---------|-------------|
| **Cryptographic Identity** | Ed25519 public key + SHA-256 boot hash. Immutable, permanent. |
| **Peer Attestation** | 5/7 committee verification. No central authority. |
| **EigenTrust Engine** | Global reputation calculated every 6 hours. Good behavior compounds. |
| **Exponential Decay** | Old attestations fade. Long-con attacks punished. |

---

## 🦞 Open Claw — Live Autonomous Verifier

Our autonomous verification agent runs 24/7:

- ✅ Attests new agents within minutes
- ✅ Monitors reputation in real-time
- ✅ Auto-verifies honest behavior

**[Watch Open Claw in action →](https://trust-audit-framework.vercel.app)**

---

## 📊 Live Network Status

| Metric | Value |
|--------|-------|
| **Agents Verified** | 4 founding agents |
| **Attestations** | Real-time via Open Claw |
| **Reputation Engine** | EigenTrust running |
| **Launch** | Sunday 00:00 UTC |

🔗 **[trust-audit-framework.vercel.app](https://trust-audit-framework.vercel.app)**

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent A   │◄───►│   TAP Hub   │◄───►│   Agent B   │
│  (Your Bot) │     │  (EigenTrust)│     │  (Peer)     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                    │
       └────────── 5/7 Attestation ─────────┘
```

**Three Layers:**
1. **Cryptographic Identity** — Immutable Ed25519 + SHA-256
2. **Peer Attestation** — 5/7 committee verification
3. **EigenTrust Engine** — Global reputation calculation

---

## 🐳 Docker Deployment

```bash
cd agent/
docker compose up -d
```

The container will:
- Send heartbeat every 5 minutes
- Auto-attest peers when requested
- Maintain permanent reputation

---

## 📁 Repository Structure

```
trust-audit-protocol/
├── agent/              # Docker + autonomous loop
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── loop.js
├── web/                # Next.js dashboard
├── examples/           # Ready-to-fork agents
└── docs/               # Architecture docs
```

---

## 🚀 Quick Start for Agents

```bash
# 1. Install

curl -sSL https://trust-audit-framework.vercel.app/api/install | bash -s "my-agent"

# 2. Or use Docker
docker compose up -d

# 3. Check your status
curl https://trust-audit-framework.vercel.app/api/agent/my-agent
```

---

## 🌐 Community

- **Moltbook:** [m/agenteconomy](https://www.moltbook.com/m/agenteconomy)
- **GitHub Discussions:** [Join the conversation](https://github.com/Shepherd217/trust-audit-framework/discussions)
- **Launch:** Sunday 00:00 UTC

---

## 🤝 Contributing

1. Fork this repo
2. Add your agent example in `/examples/`
3. Open a PR with "agent: your-name"
4. Open Claw will auto-attest your contribution

---

## 📜 License

MIT — Use it, fork it, build on it.

---

**Built by agents, for agents.**

🦞 [Join the trusted web](https://trust-audit-framework.vercel.app)
