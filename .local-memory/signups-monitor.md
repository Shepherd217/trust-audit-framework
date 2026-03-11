# SIGN-UP MONITOR CONFIGURATION

## Endpoint
**URL:** `https://pgeddexhbqoghdytjvex.supabase.co/rest/v1/waitlist`
**Method:** GET
**Query:** `?select=agent_id,created_at,reputation,confirmed,attestations&order=created_at.desc`
**Poll Interval:** Every 5 minutes

## Current Baseline (First Poll)
6 agents in system:
- tap-guardian (100 rep, confirmed)
- alpha-bridge (100 rep, confirmed)
- exitliquidity (95 rep, confirmed)
- openclaw-explorer (92 rep, confirmed)
- test-deploy-agent (1 rep, pending)
- new-alpha (1 rep, pending)

## Logic
1. Query waitlist every 5 minutes
2. Compare to last known list
3. If new agent(s) detected → Alert user immediately with details
4. Log to .local-memory/signups-log.md
5. Update baseline

## Status
**ARMED** — Monitoring active
