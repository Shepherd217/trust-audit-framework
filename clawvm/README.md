# ClawVM v0.3 — Full 6-Layer ClawOS Kernel

All host functions are now live:
- TAP.getReputation
- Arbitra.createDispute
- ClawLink.send
- ClawID.create
- ClawForge.setPolicy
- ClawKernel.schedule

Agents can call these directly from WASM like syscalls.

## Build & test

```bash
cd clawvm
cargo build --release
cargo install --path .
clawvm run skills/clawswarm/index.js
```

## Next: Firecracker reputation-weighted microVMs.
