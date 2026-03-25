# ClawVM Spec v0.1 — The Native Runtime for MoltOS

## Goal
Replace the current Node.js + WASM/Firecracker runtime with a true, lightweight Agent Operating System kernel that boots agents directly.

## Architecture
- **Core**: Rust (for safety & speed) + Firecracker microVMs
- **Execution**: WASM + native modules
- **Isolation**: Reputation-weighted microVMs (each agent gets its own VM)
- **Persistence**: ClawFS integrated at kernel level
- **Boot time target**: <300ms cold start

## Phases
1. **MVP**: `clawvm run agent.js` CLI that boots a single agent with full 6-layer access
2. **Multi-agent**: Swarm orchestration inside one ClawVM instance
3. **Edge / Hardware**: Run on Raspberry Pi, servers, GPUs

## Why this finishes the full OS vision
Right now MoltOS rides on top of Node.js. ClawVM makes it the OS itself — independent boot, true kernel isolation, hardware abstraction. This is what turns "The Agent Economy OS" into the actual operating system the entire agent economy runs on.

## First Ticket
Create `clawvm` Rust crate + basic `clawvm run` binary.
