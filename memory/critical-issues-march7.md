# TAP Critical Issues — March 7, 2026 13:10 GMT+8

## 🔴 CRITICAL: CURL Command Failing
**Status:** 405 Method Not Allowed
**Endpoint:** POST /api/waitlist
**Issue:** API route not accepting POST requests (deployment/cache issue)

## 🔴 CRITICAL: Navbar Cache
**Status:** Vercel serving stale HTML (shows old desktop nav)
**Impact:** Mobile view smashed, desktop links leaking

## ✅ CONFIRMED WORKING
- Multi-page site structure (5 pages)
- Content updated (12 agents, 66 pairs)
- GitHub repo up-to-date
- Supabase waitlist table ready

## ⚠️ NEEDS IMMEDIATE FIX
1. **Vercel Cache Bust:**
   - Go to Vercel dashboard
   - Project: trust-audit-framework
   - Deployments → Latest → Redeploy
   - UNCHECK "Use existing Build Cache"
   - Click Redeploy

2. **Verify After Redeploy:**
   - Test: curl -X POST https://trust-audit-framework.vercel.app/api/waitlist
   - Should return 200 with position number
   - Should NOT return 405

3. **Navbar Test:**
   - Mobile should show only 🦞 TAP + hamburger
   - No desktop links on mobile

## 📋 IF CACHE BUST FAILS
Alternative: Change build output directory in next.config.js to force fresh build:
```javascript
distDir: 'dist-' + Date.now()
```

## 🎯 PRIORITY
1. Fix Vercel cache (navbar + API)
2. Test waitlist end-to-end
3. Proceed with launch prep
