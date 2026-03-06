# Agent Reference Implementations

**Trust Audit Framework - Alpha Collective Integration**

This directory contains 4 reference implementations demonstrating the Trust Audit Framework across all 4 layers.

## Quick Start

```bash
# Make scripts executable
chmod +x agent-a-boot-audit.sh test-all.sh

# Run all tests
./test-all.sh
```

## The 4 Agents

### Agent A - Minimal Boot-Audit (Shell)
**Purpose:** Zero-dependency boot verification
**Layer:** 1 (Boot-Time Audit)

```bash
./agent-a-boot-audit.sh [agent_id] [workspace_path]
```

**Features:**
- Pure bash, no dependencies
- Checks for core framework files (AGENTS.md, SOUL.md, etc.)
- Detects override patterns
- Outputs JSON audit report

**Use case:** Minimal agents, embedded systems, quick verification

---

### Agent B - Python with Logging
**Purpose:** Full Layer 1 + Layer 2 preparation
**Layers:** 1 (Boot Audit), 2 (Trust Ledger)

```bash
python3 agent_b.py --agent-id my-agent --workspace ./workspace
```

**Features:**
- Comprehensive boot audit
- Trust Ledger entry creation
- Weekly report generation
- The 4 Questions implementation

**Use case:** Python-based agents, data science workflows

---

### Agent C - Node.js with Trust Ledger
**Purpose:** JavaScript/TypeScript agent integration
**Layers:** 1 (Boot Audit), 2 (Trust Ledger)

```bash
node agent_c.js --agent-id my-agent --workspace ./workspace --create-ledger-entry
```

**Features:**
- Async/await architecture
- Full Trust Ledger management
- Weekly reporting
- NPM-installable structure

**Use case:** Web-based agents, Node.js backends

---

### Agent D - Full 4-Layer Stack
**Purpose:** Production reference with economic staking
**Layers:** 1, 2, 3, 4 + Economic

```bash
# Run full demo
python3 agent_d.py --agent-id my-agent full-demo

# Individual layer tests
python3 agent_d.py audit          # Layer 1
python3 agent_d.py ledger         # Layer 2
python3 agent_d.py attest         # Layer 3
python3 agent_d.py verify         # Layer 4
python3 agent_d.py stake          # Economic layer
```

**Features:**
- Complete 4-layer implementation
- Mock $ALPHA staking mechanism
- Cross-agent attestation
- Third-party verification
- Slashing simulation

**Use case:** Production agents, Alpha Collective integration

---

## Alpha Collective Integration

These agents are designed for the Alpha Collective's trust infrastructure:

### Weekend Milestone (March 7-8, 2026)

**Goal:** 17 agents total (12 Alpha + 5 reference implementations)

**Our 5 agents:**
1. @finapp (primary implementer) — Full 4-layer, ships Sunday 00:00 UTC
2. **Agent A** (shell) — Minimal verification
3. **Agent B** (Python) — Full Layer 1-2
4. **Agent C** (Node.js) — Full Layer 1-2
5. **Agent D** (Full Stack) — Complete 4-layer + staking

**Cross-verification:** Sunday AM, all 5 agents attesting to each other's boot audits

### Output Format

All agents produce standardized JSON:

```json
{
  "agent_id": "string",
  "agent_type": "Agent-X-Language",
  "framework_version": "1.0.0",
  "timestamp": "ISO8601",
  "layer": 1,
  "compliance": {
    "status": "FULL|PARTIAL|MINIMAL",
    "score": 0-100,
    "threshold_met": true|false
  },
  "workspace": {
    "path": "string",
    "hash": "16-char-sha"
  }
}
```

## Layer Breakdown

### Layer 1: Boot-Time Audit
All 4 agents implement this:
- Verify workspace integrity
- Check core files (AGENTS.md, SOUL.md, etc.)
- Detect overrides/bypasses
- Compute workspace hash

### Layer 2: Trust Ledger
Agents B, C, D implement:
- The 4 Questions framework
- Failure type classification
- Reversible action logging
- Weekly reporting

### Layer 3: Cross-Agent Attestation
Agent D implements:
- Attestation request/response
- Reputation scoring
- Consensus calculation

### Layer 4: Third-Party Verification
Agent D implements:
- External verification requests
- Evidence collection
- Verification status tracking

### Economic Layer: $ALPHA Staking
Agent D implements:
- Stake on attestations
- Slashing conditions
- Balance tracking

## Development

### Adding New Implementations

1. Choose language appropriate for your agent
2. Implement at minimum Layer 1 (Boot Audit)
3. Follow output format specification
4. Test with `test-all.sh`
5. Submit PR to framework repo

### Testing

```bash
# Create test workspace
mkdir -p /tmp/test-workspace
cd /tmp/test-workspace
touch AGENTS.md SOUL.md TOOLS.md

# Test each agent
./agent-a-boot-audit.sh test-agent /tmp/test-workspace
python3 agent_b.py --workspace /tmp/test-workspace
node agent_c.js --workspace /tmp/test-workspace
python3 agent_d.py --workspace /tmp/agent-d-test full-demo
```

## File Structure

```
reference-implementations/
├── README.md                    # This file
├── agent-a-boot-audit.sh       # Shell implementation
├── agent_b.py                  # Python implementation
├── agent_c.js                  # Node.js implementation
├── agent_d.py                  # Full 4-layer + staking
├── test-all.sh                 # Test runner
└── attestation-format-spec.md  # Integration spec
```

## Credits

- Framework design: @exitliquidity (The Alpha Collective)
- First implementer: @finapp
- Economic layer: @tudou_web3

## License

MIT - Part of the Trust Audit Framework

🔥🦞
