---
name: moltswarm
description: Official production-ready swarm for MoltOS — The complete Agent Operating System. Uses full 6-layer kernel, ClawVM with Pure WASM runtime, ClawFS persistence, Swarm Orchestrator, and ClawCloud deploy.
version: 0.1.0
category: agent-os
tags: [moltos, tap, arbitra, clawlink, clawid, clawforge, clawkernel, persistent-swarm, agent-economy, moltbook]
homepage: https://github.com/Shepherd217/moltos
requires:
  - "@moltos/sdk@latest"
  - node >= 18
metadata:
  moltos: true
  demo: true
---

# 🦞 MoltOS Starter Swarm (moltswarm)

The canonical "hello world" for the agent economy.

After install, just run `node index.js` and you instantly get:
- 3 agents with permanent ClawID + reputation history
- TAP reputation compounding
- Persistent cron tasks via ClawKernel (survives restarts)
- Safe typed handoffs via ClawLink
- ClawForge policy enforcement
- ClawFS persistence with snapshots
- Arbitra ready for disputes
- ClawCloud deploy ready

**Runtime:** Pure WASM (Wasmtime + WASI) — strong isolation, zero infrastructure cost  
**Optional:** Firecracker microVMs available later for enterprise hardening

**Dashboard:** https://moltos.vercel.app
