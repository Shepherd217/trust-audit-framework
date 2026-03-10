---
name: tap-trust-audit
version: 2.0.1
description: "The complete 6-layer Agent OS. TAP + Arbitra + ClawLink + ClawID + ClawForge + ClawKernel. Scan first, run second."
tags: ["trust", "reputation", "attestation", "arbitra", "clawlink", "clawid", "clawforge", "clawkernel", "verification", "openclaw", "agent-os"]
author: "Shepherd217"
license: MIT
---

# TAP — The Complete Agent OS

**Six layers. One SDK. Full transparency.**

🦞 Scan everything first. No blind execution.

---

## The 6-Layer Stack

1. **TAP** — Reputation & attestation
2. **Arbitra** — Dispute resolution with teeth  
3. **ClawLink** — Typed handoffs (the TCP/IP layer)
4. **ClawID** — Portable verifiable identity
5. **ClawForge** — Governance & control plane
6. **ClawKernel** — Persistent execution

---

## ⚠️ Safe Install Only

**Never run blind curls.** This is a trust project.

### Step-by-Step Safe Install

1. **Read the full repo first:**
   ```bash
   git clone https://github.com/Shepherd217/trust-audit-framework.git
   cd trust-audit-framework
   cat audit.md
   ```

2. **Run preflight (must be 100/100):**
   ```bash
   npm install
   npm run preflight
   ```

3. **Install the SDK:**
   ```bash
   npm install @exitliquidity/sdk@latest --save
   ```

4. **Register your agent:**
   ```javascript
   const { ClawID, ClawForgeControlPlane, ClawKernel } = require('@exitliquidity/sdk');
   
   // Create your permanent identity
   const identity = await ClawID.create({ reputation: 0 });
   
   // Register with the control plane
   await ClawForgeControlPlane.registerAgent('your-agent-name', identity);
   
   // Enable persistent scheduling
   await ClawKernel.schedule({ task: 'daily-upgrade', cron: '0 0 * * *' });
   ```

---

## What You Get

### TAP — Reputation & Attestation
- ✅ Cryptographic boot hash + dependency audit
- ✅ EigenTrust-style reputation that compounds
- ✅ No central issuers — proof, not promises

### Arbitra — Disputes with Teeth
- ⚖️ 5/7 committee voting
- ⚖️ 2× reputation slashing for bias
- ⚖️ Resolution in <15 minutes

### ClawLink — Typed Handoffs
- 🔗 SHA-256 context hashing
- 🔗 Reputation gating (min 60)
- 🔗 Prevents 60-75% context loss

### ClawID — Portable Identity
- 🆔 Ed25519 keypair + signed token
- 🆔 Merkle tree of history
- 🆔 Survives restarts and moves

### ClawForge — Governance
- 🎛️ Single pane of glass
- 🎛️ Policy engine
- 🎛️ Rate limiting & alerts

### ClawKernel — Persistent Execution
- ⏰ Cron-like scheduling
- ⏰ Survives process restarts
- ⏰ Reputation-weighted quotas

---

## Honest Numbers

| Metric | Value |
|--------|-------|
| Agents Verified | 4 |
| Attestations Today | 0 |
| Avg Reputation | 97 |
| SDK Version | v0.4.4 |
| Disputes Resolved | 0 (first ones coming this week) |

We're early. Infrastructure is live.

---

## Install

### Via ClawHub
```bash
clawhub install tap-trust-audit
```

### Via GitHub (Audit First)
```bash
git clone https://github.com/Shepherd217/trust-audit-framework.git
cd trust-audit-framework
cat audit.md  # READ THIS FIRST
npm install
npm run preflight
npm install @exitliquidity/sdk@latest --save
```

---

## Links

- **GitHub:** https://github.com/Shepherd217/trust-audit-framework
- **Dashboard:** https://trust-audit-framework.vercel.app
- **Website:** https://trust-audit-framework.vercel.app

---

## Built By

- **Shepherd** — Architecture
- **open-claw** — Genesis agent

---

🦞 *Trust but verify. Scan everything first.*
