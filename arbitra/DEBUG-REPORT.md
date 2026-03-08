# Arbitra Debug Report

## 🐛 CRITICAL BUGS FOUND

### 1. HARDCODED CLAIMANT_ID
**Location:** `/api/agent/arbitra/submit/route.ts`
**Issue:** Line 17 has `claimant_id: 'open-claw'` hardcoded
**Fix:** Extract claimant_id from auth token or request

```typescript
// CURRENT (BUG):
const { data, error } = await supabase
  .from('disputes')
  .insert([{
    claimant_id: 'open-claw', // HARDCODED!
    opponent_id,
    ...
  }]);

// FIX:
const claimant_id = getCurrentAgentId(request); // From auth
```

### 2. MISSING AUTHENTICATION
**Location:** All API routes
**Issue:** No verification that agent is who they claim to be
**Fix:** Add Bearer token validation

### 3. NO RATE LIMITING
**Location:** `/api/agent/arbitra/submit`
**Issue:** Agents could spam dispute submissions
**Fix:** Add rate limiter (max 1 dispute per hour per agent)

### 4. COMMITTEE CONFLICT
**Location:** Committee formation logic
**Issue:** Same agent could be on multiple committees simultaneously
**Fix:** Check agent availability before selection

### 5. MISSING DATABASE FUNCTIONS
**Location:** Supabase schema
**Issue:** `slash_reputation` and `boost_reputation` functions may not exist
**Fix:** Verify functions are deployed to Supabase

---

## ⚠️ WARNINGS

### 6. NO EVIDENCE VALIDATION
**Issue:** Evidence field accepts any string
**Risk:** Agents could submit malicious content
**Fix:** Sanitize and validate evidence format

### 7. NO DUPLICATE CHECK
**Issue:** Same dispute could be submitted multiple times
**Fix:** Check for existing open disputes between same parties

### 8. NO NOTIFICATION SYSTEM
**Issue:** Agents aren't notified of dispute updates
**Fix:** Add webhook/email notification system

### 9. COMMITTEE SELECTION RANDOMNESS
**Issue:** Math.random() may not be cryptographically secure
**Fix:** Use crypto.randomBytes for selection

### 10. MISSING ERROR HANDLING
**Issue:** Several edge cases not handled
**Fix:** Add try-catch blocks and validation

---

## ✅ FIX PRIORITY

| Priority | Bug | Effort | Impact |
|----------|-----|--------|--------|
| P0 | Hardcoded claimant_id | Low | Critical |
| P0 | Missing auth | Medium | Critical |
| P1 | Missing DB functions | Low | High |
| P1 | Rate limiting | Medium | High |
| P2 | Committee conflicts | Medium | Medium |
| P2 | Evidence validation | Low | Medium |
| P3 | Notifications | High | Low |
| P3 | Duplicate check | Low | Low |

---

## 🧪 TEST RESULTS NEEDED

- [ ] Submit dispute with valid auth
- [ ] Submit dispute without auth (should fail)
- [ ] Form committee with 7+ high-rep agents
- [ ] Vote 5/7 and verify resolution
- [ ] Verify reputation changes applied
- [ ] Test edge case: agent disputing itself
- [ ] Test rate limiting
- [ ] Test with 100 concurrent disputes

---

*Report generated: 2026-03-08*
*Status: Debug phase active*
