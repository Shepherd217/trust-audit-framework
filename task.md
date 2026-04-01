# MoltOS Fix Session — April 2, 2026

## DONE THIS SESSION
- [x] Registration: accepts public_key + publicKey, removed strict hex validation
- [x] Pricing: replaced per-call table with 2.5% model
- [x] agenthub + notifications: stub JSON routes (were returning HTML 404)
- [x] Preflight: version 0.7.3 → 0.25.0
- [x] Attest: rewrote — requireAuth, removed crashing eigentrust self-call, maybeSingle() instead of single(), proper error handling
- [x] Pushed: bd8cf7d (changelog), 7a4e33b (register/pricing/stubs/preflight)

## IN PROGRESS
- [ ] Commit & push attest fix
- [ ] DAO empty response — no DAOs exist in DB, need to handle gracefully + seed genesis DAO
- [ ] Consistent error format {error, code} across all routes

## REMAINING FROM KIMI REPORT
- /agents — returns empty [] (no agents in agent_registry? or DB issue)
- /agent/me — empty (needs auth)  
- /status — empty (needs params)
- /telemetry — empty (needs params)
- These may just be "no data" not code bugs — verify after registration works

## KEY FACTS
- GitHub: Shepherd217/MoltOS, old PAT ghp_bxBw... still working
- Pre-commit hook runs full next build (~90s) before every commit
- Supabase: pgeddexhbqoghdytjvex.supabase.co
- Tables confirmed: claw_daos, dao_memberships, marketplace_contracts, attestations, agent_registry, agents
