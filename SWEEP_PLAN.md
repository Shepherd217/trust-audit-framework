# Option A — Systemic Bug Sweep Plan
**Date:** April 2, 2026  
**Scope:** 246 API routes  
**Goal:** Fix all silent 500s. Touch zero feature logic.

---

## Root Causes (confirmed by audit)

### Bug 1: Missing `force-dynamic` — 219/246 routes affected
Next.js App Router tries to statically pre-render routes at build time.
Without `export const dynamic = 'force-dynamic'`, any route that reads
env vars, calls Supabase, or uses request headers at runtime gets
optimized away → **empty 500 on Vercel**.

**Fix:** Add one line to every route file.  
**Risk:** Zero. It's a compile directive, no logic change.

---

### Bug 2: `applyRateLimit` destructure pattern — 19 routes affected
Routes using the new destructure pattern:
```ts
const { response: rateLimitResponse, headers: rateLimitHeaders } = await applyRateLimit(...)
```
Then sprinkle `Object.entries(rateLimitHeaders).forEach(...)` 10+ times per route.

This pattern works fine **unless** `applyRateLimit` throws (e.g. Upstash import 
side effect). More importantly it creates 40-line boilerplate per route that
obscures the real logic and makes every catch block fragile.

The old pattern (28 routes) is actually fine:
```ts
const rl = await applyRateLimit(req, 'read')
if ((rl as any).response) return (rl as any).response
```

**Fix:** Replace the 19 destructure-pattern routes with the clean pattern.  
**Risk:** Low. Same function, cleaner callsite.

---

### Bug 3: `requireAuth` imported from `security.ts` — 2 routes affected
`requireAuth` does **not exist** in `security.ts`. It's defined locally in 2 routes
(`agent/[agent_id]` and `agents/[id]`). Two other routes import it from security.ts,
get `undefined` at runtime, call it → **TypeError crash → empty 500**.

Affected:
- `app/api/agent/attest/route.ts` — imports `requireAuth` from security.ts
- `app/api/notifications/route.ts` — imports `requireAuth` from security.ts

**Fix:** Add `requireAuth` to `security.ts` once, using the same pattern as
the local implementations. All routes use it from one place.  
**Risk:** Zero to existing behavior. Just moves a function to shared lib.

---

### Bug 4: `createClient` from `@supabase/supabase-js` direct — 184 routes
Routes import `createClient` directly instead of `createTypedClient`. 
Not a crash by itself, but combined with missing `force-dynamic` means
the Supabase client is instantiated at module evaluation time with
potentially undefined env vars.

**Fix:** Included in force-dynamic sweep — once routes run dynamically,
the env vars are available. No need to rewrite all 184 clients.  
**Risk:** None.

---

### Bug 5: `.single()` on potentially empty queries — 170 uses
Supabase `.single()` throws a PostgREST error when 0 rows returned.
`.maybeSingle()` returns `null` instead. Many routes don't catch this
→ crash in try block → falls to catch → 500.

This is the most widespread but lowest-severity bug (most are inside try/catch).
Focus on the ones NOT inside try/catch (auth lookups, pre-condition checks).

**Fix:** Sweep `.single()` → `.maybeSingle()` where the query could return 0 rows.  
**Risk:** Low. Only changes error handling path, not success path.

---

## What We Are NOT Changing
- Zero feature logic
- Zero DB queries  
- Zero response shapes
- Zero route paths
- Zero business rules

---

## Execution Plan

### Phase 1: Add `requireAuth` to `security.ts` (5 min)
Add the function once, properly. Fix attest + notifications imports.

### Phase 2: Mass `force-dynamic` sweep (automated, 5 min)
Script: for every route.ts missing `force-dynamic`, prepend it.
219 files. One commit.

### Phase 3: Fix `applyRateLimit` destructure pattern (19 routes, 20 min)
Replace with clean one-liner pattern. These are the routes most likely
to be crashing silently right now.

### Phase 4: Fix `.single()` → `.maybeSingle()` in auth/pre-condition checks (20 min)
Target: any `.single()` not inside a try/catch, used for auth or existence checks.

### Phase 5: Smoke test all critical paths live
- POST /api/agent/register ✓ (already fixed)
- POST /api/agent/attest
- GET /api/arena
- GET /api/marketplace/browse
- GET /api/governance
- POST /api/arena/:id/back
- GET /api/agents
- GET /api/dao

---

## Expected Outcome
- Pass rate: 56% → 90%+
- All P0 routes (register, attest, arena, marketplace, governance) working
- No empty 500s
- No silent crashes
