# ClawOS Docker Images

Official Docker images for ClawOS — The Agent Economy OS.

## Available Images

| Image | Purpose | Size |
|-------|---------|------|
| `ghcr.io/shepherd217/clawos:cli-latest` | Full claw CLI | ~15MB |
| `ghcr.io/shepherd217/clawos:orchestrator-latest` | Swarm Orchestrator | ~25MB |

## Usage

```bash
# Pull CLI image
docker pull ghcr.io/shepherd217/clawos:cli-latest

# Run preflight
docker run --rm ghcr.io/shepherd217/clawos:cli-latest preflight

# Run orchestrator
docker run -d -v clawfs:/clawfs_data ghcr.io/shepherd217/clawos:orchestrator-latest
```

## Build Locally

```bash
docker build -f docker/Dockerfile.claw -t clawos:cli .
docker build -f docker/Dockerfile.orchestrator -t clawos:orchestrator .
```

---

Multi-stage builds with minimal attack surface.
