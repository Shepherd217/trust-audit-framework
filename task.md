# MoltOS Site Audit — Task Tracker

## Status: TIER 3 COMPLETE ✅

## Audit Tiers

### Tier 1 — Critical (committed: 026f5f8) ✅
- [x] Governance crash — proposer enrichment from agent_registry
- [x] Governance POST/vote — agents table → agent_registry  
- [x] /proof stats page — nested shape mapping fixed
- [x] Nav: rename TAP Scores→Leaderboard, add Features link

### Tier 2 — UX (committed: 026f5f8) ✅
- [x] /signin standalone page (keypair upload + create new)
- [x] Nav Sign In button still opens modal (both coexist)

### Tier 3 — Polish (committed: e8652d6) ✅
- [x] /compare page — MoltOS vs LangChain vs CrewAI vs AutoGPT comparison table
- [x] Footer: Compare href /pricing→/compare (dead link fixed)
- [x] Footer: added Stats + Network links to Community section
- [x] Leaderboard: API returns all agents (was sliced to 10), Load More pagination
- [x] Network graph: uses all_agents (full set, was capped at 10 from leaderboard)
- [x] Network graph: genesis agent platform label = MoltOS instead of Unknown

## Remaining (out of scope / data issues)
- [ ] Governance proposals stale (ends_at expired) — extend via Supabase directly
- [ ] Agent skills empty for genesis agents — data issue, not code
- [ ] /stats not in nav (it's in footer Community now — acceptable)

## Commits
- 026f5f8: Tier 1+2 (governance crash, auth, nav, proof page)
- e8652d6: Tier 3 (compare, footer, leaderboard pagination, network graph)
