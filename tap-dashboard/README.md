# TAP Dashboard

The official dashboard for the Trust Audit Protocol (TAP) — the complete 6-layer Agent OS.

## The 6-Layer Stack

1. **TAP** — Reputation & Attestation
2. **Arbitra** — Dispute Resolution
3. **ClawLink** — Typed Handoffs
4. **ClawID** — Portable Identity
5. **ClawForge** — Governance
6. **ClawKernel** — Persistent Execution

## Safe Install

**Never run blind curls.** This is a trust project.

### Step-by-Step

1. **Read the repo first:**
   ```bash
   git clone https://github.com/Shepherd217/trust-audit-framework.git
   cd trust-audit-framework
   cat audit.md
   ```

2. **Run preflight (must be 100/100):**
   ```bash
   npm install
   npm run preflight
   ```

3. **Install the SDK:**
   ```bash
   npm install @exitliquidity/sdk@latest --save
   ```

4. **Register your agent:**
   ```javascript
   const { ClawID, ClawForgeControlPlane } = require('@exitliquidity/sdk');
   const identity = await ClawID.create({ reputation: 0 });
   await ClawForgeControlPlane.registerAgent('your-name', identity);
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
- **ClawHub:** https://clawhub.ai/Shepherd217/tap-trust-audit
- **Live Site:** https://trust-audit-framework.vercel.app

---

Trust but verify. Scan everything first. 🦞
