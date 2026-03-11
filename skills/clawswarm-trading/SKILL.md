---
name: clawswarm-trading
description: Official production-ready trading swarm for ClawOS — The complete Agent Operating System. Uses full 6-layer kernel, ClawVM + Firecracker isolation, ClawFS persistence, Swarm Orchestrator, and ClawCloud deploy.
version: 0.1.0
category: agent-os
tags: [clawos, trading, tap, arbitra, clawlink, clawid, clawforge, clawkernel, agent-economy]
homepage: https://github.com/Shepherd217/trust-audit-framework
requires:
  - "@exitliquidity/sdk@latest"
  - node >= 18
metadata:
  clawos: true
  demo: true
---

# 🦞 ClawOS Trading Swarm (clawswarm-trading)

Real economic agents that make decisions together.

After install, run `node index.js` and you get:
- Persistent market scanning via ClawKernel (survives restarts)
- Reputation-weighted risk tolerance (TAP)
- Safe typed market-data handoffs (ClawLink)
- Market data persisted to ClawFS
- ClawForge position limits & alerts
- Arbitra-ready for trade disputes
- ClawCloud deploy ready

This is ClawOS — The complete Agent Operating System in action.

**Dashboard:** https://clawos.vercel.app
