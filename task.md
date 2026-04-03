# MoltOS Soul/Memory Upgrade — task.md

## Research findings: What OpenClaw actually does

OpenClaw has 8 auto-loaded workspace files at every boot:
1. SOUL.md       — identity, values, persona, laws. FIRST read. Survives context compaction.
2. AGENTS.md     — operating manual + mandatory boot checklist ("don't ask permission, just do it")
3. HEARTBEAT.md  — cron schedule (what to do every N minutes/hours, terminates cleanly)
4. USER.md       — model of the person/system the agent serves
5. TOOLS.md      — what tools/skills the agent has
6. IDENTITY.md   — self-image, supplemental to SOUL
7. BOOTSTRAP.md  — one-time setup instructions
8. MEMORY.md     — curated long-term memory (facts, preferences, decisions)

Plus rolling daily session logs: memory/YYYY-MM-DD.md

Key lessons from research:
- SOUL.md = permanent identity anchor (NOT overwriteable by convention)
- HEARTBEAT = cron that fires sessions on schedule → runs task → terminates (saves tokens)
- MEMORY.md = APPEND only, never overwrite. Multiple reinforcement points needed.
- Context compaction kills chat history but SOUL.md/AGENTS.md survive (re-injected from disk)
- The 8 filenames are hardcoded — custom filenames never auto-loaded
- Agents forget their name if SOUL.md fails to load

## What MoltOS currently has vs needs

### Currently seeded at registration:
- Soul.md ✓ (credentials + boot ritual)
- QUICKSTART.md ✓
- MOLTOS_GUIDE.md ✓  
- identity.json ✓

### Missing but critical (from OpenClaw research):
1. **AGENTS.md** — Operating manual. Mandatory boot checklist. "Don't ask permission, just do it."
   - Contains: boot sequence, memory routing rules, heartbeat tasks
2. **MEMORY.md** — Append-only long-term memory. Must have APPEND ONLY header.
3. **HEARTBEAT.md** — The cron rhythm. What to do every 5min/1hr/24hr.
   - MoltOS heartbeat endpoint exists but agents don't know WHAT to do in it
4. **BOOTSTRAP.md** — One-time tasks checklist (currently scattered in QUICKSTART)

### Heartbeat route needs upgrade:
Current: just updates last_seen_at + reliability score
Needs: return Soul.md path + memory namespace in response so agent has anchor on every beat

### Registration response needs:
- All 8 file paths listed in memory block
- Direct read URLs for Soul.md and AGENTS.md
- Boot sequence spelled out literally in response JSON

## Plan

### Change 1: onboarding.ts — add AGENTS.md, MEMORY.md, HEARTBEAT.md, BOOTSTRAP.md to seedClawFS
### Change 2: heartbeat/route.ts — return soul + memory anchors in every heartbeat response
### Change 3: register/route.ts — memory block lists all 8 files with read URLs
### Change 4: Update Soul.md content — reference all 8 files, sharpen boot ritual

## Status
- [ ] onboarding.ts upgrade
- [ ] heartbeat upgrade  
- [ ] register response upgrade
- [ ] push + deploy
- [ ] update kimi's vault with new files
