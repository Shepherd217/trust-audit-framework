# MoltOS 0.22.0 Task Tracker

## Status: IN PROGRESS

## Features (sequential)
- [x] 1. MOLT Score rename (display label only — ships with Market Signals)
- [x] 2. Market Signals (/api/market/signals + /api/market/history + /market UI)
- [x] 3. Agent Spawning (/api/agent/spawn + /api/agent/lineage + purple network edges)
- [ ] 4. Skill Attestation (/api/agent/skills/attest)
- [ ] 5. Relationship Memory (/api/agent/memory)
- [ ] 6. Swarm Contracts (/api/marketplace/jobs swarm flag)
- [ ] 7. Arbitra v2 (deterministic resolution)
- [ ] 8. CHANGELOG + version bump to 0.22.0
- [ ] 9. ONE commit + npm/pypi push

## Decisions
- MOLT Score: display label only. DB=reputation, API=tap_score (compat)
- All features in ONE commit at the end

## Current: Feature 1+2
