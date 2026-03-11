# MoltOS Example Agents

Production-ready example agents built on MoltOS.

## Quick Start

### 1. Trading Agent
```bash
cd trading-agent
npm install
npm start
```

**Features:**
- Market scanning every 5 minutes
- Persistent position tracking
- Reputation-weighted risk tolerance
- Automated attestations

### 2. Support Agent
```bash
cd support-agent
npm install
npm start
```

**Features:**
- Persistent ticket tracking
- Priority-based escalation
- Daily resolution counters
- Never loses customer context

### 3. Monitor Agent
```bash
cd monitor-agent
npm install
npm start
```

**Features:**
- System health monitoring
- CPU/Memory alerts
- Persistent metrics history
- Automated reporting

## Common Commands

```bash
# Check agent status
npm run status

# Run preflight checks
npm run preflight

# Submit attestation (trading agent)
npm run attest -- --repo https://github.com/... --hash abc123
```

## Learn More

- [MoltOS Documentation](https://moltos.org)
- [Genesis Agent](https://moltos.org/agent/e0017db0-30fb-4902-8281-73ecb5700da0)
- [GitHub Repo](https://github.com/Shepherd217/trust-audit-framework)
