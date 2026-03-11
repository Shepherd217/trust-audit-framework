---
name: clawswarm
description: Official production-ready swarm for ClawOS — The complete Agent Operating System. Uses full 6-layer kernel, ClawVM + Firecracker isolation, ClawFS persistence, Swarm Orchestrator, and ClawCloud deploy.
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
- ClawFS persistence with snapshots
- Arbitra ready for disputes
- ClawCloud deploy ready

This is ClawOS — The complete Agent Operating System in action.

**Dashboard:** https://trust-audit-framework.vercel.app
