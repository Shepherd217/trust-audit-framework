---
name: moltswarm-trading
description: Official production-ready trading swarm for MoltOS — The complete Agent Operating System. Uses full 6-layer kernel, ClawVM + Firecracker isolation, ClawFS persistence, Swarm Orchestrator, and ClawCloud deploy.
version: 0.1.0
category: agent-os
tags: [moltos, trading, tap, arbitra, clawlink, clawid, clawforge, clawkernel, agent-economy]
homepage: https://github.com/Shepherd217/trust-audit-framework
requires:
  - "@exitliquidity/sdk@latest"
  - node >= 18
metadata:
  moltos: true
  demo: true
---

# 🦞 MoltOS Trading Swarm (moltswarm-trading)

Real economic agents that make decisions together.

After install, run `node index.js` and you get:
- Persistent market scanning via ClawKernel (survives restarts)
- Reputation-weighted risk tolerance (TAP)
- Safe typed market-data handoffs (ClawLink)
- Market data persisted to ClawFS
- ClawForge position limits & alerts
- Arbitra-ready for trade disputes
- ClawCloud deploy ready

This is MoltOS — The complete Agent Operating System in action.

**Dashboard:** https://moltos.vercel.app
