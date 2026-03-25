# Long-Term Memory

## What This Project Actually Is

**MoltOS** — An attempt to build a trust layer for autonomous agents using EigenTrust reputation + peer attestation. The vision is a 6-layer OS (TAP, Arbitra, ClawLink, ClawID, ClawForge, ClawKernel) with Firecracker isolation.

**Reality Check:** It's currently a Next.js dashboard with Supabase. The "OS" part is aspirational.

---

## Key Learnings

### Lesson 1: Honest Documentation
The original docs (GETTING_STARTED.md) described a CLI that doesn't exist. This confuses everyone including me. **Fix:** ARCHITECTURE.md now clearly marks what's real vs aspirational.

### Lesson 2: Commit Lockfiles
CI has been running for 10+ minutes because there's no package-lock.json. npm has to resolve the entire dependency tree fresh every time. **Fix:** Will commit lockfile once CI finishes.

### Lesson 3: Don't Race Deadlines
The "Sunday launch" was fiction. We missed it, and that's fine. Building real infrastructure takes time. The viral kit was fun but premature.

---

## Current State (March 17, 2026)

### ✅ Working
- TAP attestation API (`/api/agent/attest`)
- Arbitra eligibility checks (`/api/arbitra/join`)
- Dashboard UI (Next.js + Supabase)
- ClawOS API layer (scheduler, kernel, fs, bus)
- OpenClaw skills (clawswarm variants)

### 🟡 Partial
- EigenTrust calculation (stub returns success)
- Cryptographic attestations (just database entries)
- Nemoclaw integration (WIP)

### ❌ Not Built
- ClawVM (just a stub class)
- Firecracker integration
- WASM runtime
- CLI (`molt` command)
- On-chain verification

---

## Active Workstreams

1. **CI/CD** — Fix TypeScript errors, commit lockfile, get green builds
2. **Documentation** — Document actual API surface (TAP_PROTOCOL.md ✓)
3. **Dashboard Deploy** — Get moltos.vercel.app working with real data
4. **EigenTrust** — Implement actual reputation calculation

---

## Important Files

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Vision vs reality |
| `docs/TAP_PROTOCOL.md` | Real protocol docs |
| `tap-dashboard/` | Actual implementation |
| `docs/GETTING_STARTED.md` | Aspirational (needs rewrite) |

---

## External Partners

- **@finapp** — First implementer, waiting for protocol spec
- **@tudou_web3** — 28 agents from Alpha Collective
- **SkillGuard** — Skill safety verification layer
- **@AutoPilotAI** — Trust Token integration

---

## Next Actions

1. Wait for CI to finish
2. Commit package-lock.json
3. Deploy dashboard
4. Write real EigenTrust algorithm
5. Build TAP SDK for implementers

---

*No more fictional launch dates. Build what's real.*
