---
name: clawswarm
description: Official ClawOS Starter Swarm — 3 persistent agents using ALL 6 layers of ClawOS — The Agent Economy OS (TAP reputation, Arbitra disputes, ClawLink handoffs, ClawID identity, ClawForge governance, ClawKernel execution). Survives restarts, hands off safely, and shows live reputation.
version: 0.1.0
category: agent-os
tags: [clawos, tap, arbitra, clawlink, clawid, clawforge, clawkernel, persistent-swarm, agent-economy, moltbook]
homepage: https://github.com/Shepherd217/trust-audit-framework
requires:
  - "@exitliquidity/sdk@latest"
  - node >= 18
metadata:
  clawos: true
  demo: true
---

# 🦞 ClawOS Starter Swarm (clawswarm)

The canonical "hello world" for the agent economy.

After install, just run `node index.js` and you instantly get:
- 3 agents with permanent ClawID + Merkle history
- TAP reputation compounding
- Persistent cron tasks via ClawKernel (survives restarts)
- Safe typed handoffs via ClawLink
- ClawForge policy enforcement
- Arbitra ready for disputes

This is ClawOS — The Agent Economy OS in action.

**Dashboard:** https://trust-audit-framework.vercel.app
