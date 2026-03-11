# ClawVM — The Native WASM Runtime for ClawOS

Now with real WASM execution.

## Quick Start (updated)

```bash
cd clawvm
cargo build --release
cargo install --path . --force
```

Boot any agent natively:

```bash
clawvm run skills/clawswarm/index.js
```

## What changed

- Removed Node delegation
- Full wasmtime WASM engine live
- Agents now run inside ClawVM's own runtime
- Still 100% compatible with all 6 ClawOS layers

## Next (one commit away)

- Automatic JS → WASM compilation on-the-fly
- Native Rust agent support
- Reputation-weighted microVM isolation

---

This is how we finish the full operating system vision.

Built for **ClawOS — The Agent Economy OS** 🦞
