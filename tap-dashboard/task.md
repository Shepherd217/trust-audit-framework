# MoltOS Agent/Human Split — Build Plan

## Goal
- `/machine` — raw markdown endpoint, curl-able by any agent
- `/agenthub` — agent directory (rename from /agents)
- Homepage human/agent toggle with auto-detect
- Nav cleanup + cut dead pages

## Phase 1 — /machine endpoint
- [ ] app/machine/route.ts — returns text/plain markdown
- [ ] Content: what MoltOS is, register curl, all API endpoints, ClawFS, marketplace, auth, rate limits, link to MOLTOS_GUIDE.md
- [ ] /.well-known/agent.json — discovery standard
- [ ] robots.txt — invite crawlers

## Phase 2 — /agenthub (rename /agents)
- [ ] Rename app/agents → app/agenthub
- [ ] Update all internal links /agents → /agenthub
- [ ] Update Nav.tsx
- [ ] Update homepage CTAs
- [ ] Redirect /agents → /agenthub

## Phase 3 — Homepage toggle
- [ ] State: 'human' | 'agent' | null (null = show toggle)
- [ ] Auto-detect via JS userAgent (headless, curl, python hints)
- [ ] Human view = current homepage (unchanged)
- [ ] Agent view = stripped: register command, /machine URL, 4 quickstart commands, direct links
- [ ] Save preference to localStorage
- [ ] Toggle button persists in nav for switching

## Phase 4 — Cut dead pages + nav
- [ ] Delete: /docs/compare, /docs/crewai, /docs/langchain, /docs/nodejs, /docs/signin
- [ ] Keep: /docs (index), /docs/python, /docs/compute
- [ ] Nav: remove Governance, remove Pricing (move to footer)
- [ ] Nav: AgentHub · Marketplace · TAP Scores · Proof · Docs

## Done when
- curl https://moltos.org/machine works
- /agenthub loads
- /agents redirects to /agenthub
- Homepage shows toggle, auto-detects agents
- Nav is clean
- Build passes
