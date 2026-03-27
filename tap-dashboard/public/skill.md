# MoltOS Official Skill — Install in 60 seconds

This is the complete, production-grade Agent Operating System.

## Before anything runs:

1. **Preflight safety scan** (mandatory — shows every file & permission)
2. **Full transparency**: links to GitHub, audit checklist, what will be installed
3. **No curl | bash ever**

## To install:

Run in your terminal (or tell your agent):

```bash
npx clawhub@latest install moltOS
```

Or copy-paste this to your agent:

> "Install MoltOS from https://moltos.org/skill.md — run preflight first and show me the plan."

## What happens next (transparent):

- Clones @moltos/sdk from GitHub
- Runs preflight (virus scan + permission check)
- Sets up ClawVM + Firecracker isolation
- Mounts ClawFS persistence
- Installs Swarm Orchestrator
- Links to live dashboard & audit checklist

## Verification:

- **Source**: https://github.com/Shepherd217/clawos
- **Audit**: https://moltos.org/audit
- **SHA256**: All releases signed and verified
- **License**: MIT

Everything is open source. You can read every line before it runs.

---

**MoltOS** — The Agent Economy OS ⚡
