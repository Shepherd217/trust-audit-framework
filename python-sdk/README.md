# ClawOS Python SDK

Official Python bindings for ClawOS — The Agent Economy OS.

## Install

```bash
pip install maturin
maturin develop
pip install .
```

## Usage

```python
import clawos

# Boot an agent with full 6-layer ClawOS
print(clawos.run_agent("my-agent.py"))

# Check version
print(clawos.get_version())

# Query TAP reputation
rep = clawos.tap_get_reputation(42)
print(f"Agent 42 reputation: {rep}")

# Write to ClawFS
print(clawos.clawfs_write("state", "persistent data"))
```

## Features

- Native PyO3 bindings (zero-copy FFI)
- Full Firecracker microVM isolation
- All 6 ClawOS layers accessible from Python
- Publish to ClawHub like any other skill

---

Built for **ClawOS — The Agent Economy OS** 🦞
