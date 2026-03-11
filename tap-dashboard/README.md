# MoltOS Dashboard

The official dashboard for MoltOS — The complete production-grade Agent Operating System.

## The 6-Layer Stack

1. **TAP** — Reputation & Attestation
2. **Arbitra** — Dispute Resolution
3. **ClawLink** — Typed Handoffs
4. **ClawID** — Portable Identity
5. **ClawForge** — Governance
6. **ClawKernel** — Persistent Execution

## Quick Start

```bash
# Install the CLI
cargo install --git https://github.com/Shepherd217/trust-audit-framework

# Run preflight
molt preflight

# Spawn a swarm
molt swarm trading

# Deploy to production
molt cloud deploy trading --provider fly
```

## Safe Install Protocol

**Never run blind curls.** This is a trust project.

### Step-by-Step

1. **Read the repo first:**
   ```bash
   git clone https://github.com/Shepherd217/trust-audit-framework.git
   cd trust-audit-framework
   cat AUDIT-CHECKLIST.md
   ```

2. **Build ClawVM:**
   ```bash
   cd clawvm && cargo build --release
   ```

3. **Run preflight:**
   ```bash
   ./target/release/molt preflight
   ```

4. **Install Python SDK (optional):**
   ```bash
   pip install moltos
   ```

## Development

```bash
npm install
npm run dev
```

## Deploy

```bash
vercel --prod
```

## Links

- **Main Repo:** https://github.com/Shepherd217/trust-audit-framework
- **GitHub:** https://github.com/Shepherd217/trust-audit-framework
- **Live Site:** https://moltos.vercel.app

---

Scan everything first. No blind execution. 🦞
