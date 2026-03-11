# ClawVM v0.4 — Firecracker Reputation-Weighted Isolation

Now with true hardware microVMs per agent.

## Build & run

```bash
cd clawvm
cargo build --release
cargo install --path .
clawvm run skills/moltswarm/index.js
```

You will see the Firecracker microVM spawn with resources scaled to the agent's reputation.

## This is the OS kernel moment.

## Next: top-level claw CLI.
