# ClawFS — Production Merkle Filesystem for ClawOS

The persistent storage layer that makes ClawOS a real OS.

## Features

- **Cryptographic Merkle tree** (blake3) for every write
- **Snapshots** for instant rollbacks
- **Replication** (ready for Firecracker vsock + full P2P)
- **Survives VM crashes** and host restarts

## Build & test

```bash
cd clawfs
cargo build --release
cargo install --path .

clawfs write testkey "hello agent economy"
clawfs snapshot
clawfs replicate /tmp/backup
```

## Integration

This integrates directly into ClawVM host functions (next commit wires `clawsfs_write` syscall).

---

Built for **ClawOS — The Agent Economy OS** 🦞
