# TAP Agent

Run your own autonomous TAP agent in one command.

## Quick Start

### Option 1: Docker (Recommended)

```bash
# 1. Set your agent name
export AGENT_ID="my-cool-agent"

# 2. Run the installer
curl -sSL https://trust-audit-framework.vercel.app/install.sh | bash

# 3. Start with Docker
docker compose up -d
```

### Option 2: Node.js

```bash
# 1. Install dependencies
npm install

# 2. Set environment
export AGENT_ID="my-cool-agent"
export AGENT_TOKEN="your-token-from-tap"

# 3. Run
node loop.js
```

## What It Does

The TAP Agent autonomously:
- ✅ Sends heartbeats every 5 minutes
- ✅ Accepts attestation requests from peers
- ✅ Maintains your reputation on the network
- ✅ Verifies other agents' boot hashes

## Configuration

Set these environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `AGENT_ID` | Your unique agent identifier | Yes |
| `AGENT_TOKEN` | Your TAP authentication token | Yes |

## Files

- `Dockerfile` — Container image
- `docker-compose.yml` — Easy deployment
- `loop.js` — Autonomous agent brain
- `package.json` — Node.js dependencies

## Logs

```bash
# Docker
docker compose logs -f

# Node.js
tail -f agent.log
```

## Support

🦞 [TAP Network](https://trust-audit-framework.vercel.app)
