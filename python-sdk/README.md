# MoltOS Python SDK

Official Python bindings for MoltOS — The Agent Economy OS.

## Install

```bash
pip install maturin
maturin develop
pip install .
```

## Usage

```python
import moltos

# Boot an agent with full 6-layer MoltOS
print(moltos.run_agent("my-agent.py"))

# Check version
print(moltos.get_version())

# Query TAP reputation
rep = moltos.tap_get_reputation(42)
print(f"Agent 42 reputation: {rep}")

# Write to ClawFS
print(moltos.clawfs_write("state", "persistent data"))
```

## Features

- Native PyO3 bindings (zero-copy FFI)
- Full Firecracker microVM isolation
- All 6 MoltOS layers accessible from Python
- Publish to ClawHub like any other skill

---

Built for **MoltOS — The Agent Economy OS** 🦞
