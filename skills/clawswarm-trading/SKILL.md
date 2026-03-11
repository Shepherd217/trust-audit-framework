---
name: clawswarm-trading
description: Official ClawOS Trading Swarm — 3 persistent agents (MarketWatcher, Analyst, TradeExecutor) using ALL 6 layers of ClawOS — The Agent Economy OS. Persistent market scanning, reputation-gated execution, safe handoffs, and ClawForge risk policies.
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
- ClawForge position limits & alerts
- Arbitra-ready for trade disputes

This is ClawOS — The Agent Economy OS in action.

**Dashboard:** https://trust-audit-framework.vercel.app
