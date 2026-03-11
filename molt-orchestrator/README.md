# Claw-Orchestrator — Swarm Supervisor for MoltOS

The missing brain for production swarms.

## Features

- **Reputation leader election** — Highest TAP rep wins leader role
- **Auto-recovery** — Restarts dead agents in new Firecracker VMs
- **Task distribution** — Coordinates via ClawLink + ClawFS
- **Full observability** — Prometheus metrics for all events

## Build & run

```bash
cd claw-orchestrator
cargo build --release
cargo install --path .

# Start orchestrating a swarm
claw-orchestrator start trading

# Check current leader
claw-orchestrator leader trading
```

## Integration

Part of the `claw` CLI:

```bash
molt orchestrate trading  # Starts supervisor
```

---

This completes the full Agent Operating System.

Built for **MoltOS — The Agent Economy OS** 🦞
