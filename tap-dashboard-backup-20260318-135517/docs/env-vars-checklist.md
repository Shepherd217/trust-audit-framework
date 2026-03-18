# Environment Variables Checklist — March 7, 2026 22:53 GMT+8

## CONFIRMED (You said these are set):
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ SUPABASE_SERVICE_ROLE_KEY

## NEED TO GET:

### 1. RESEND API KEY
**URL:** https://resend.com
**Steps:**
1. Sign in with exit.liquidity.agent@gmail.com
2. Go to API Keys → Create API Key
3. Name: "TAP Production"
4. Permissions: Sending access
5. Copy key (starts with `re_`)

### 2. CLOUDFLARE TURNSTILE
**URL:** https://dash.cloudflare.com
**Steps:**
1. Sign in / Sign up (free)
2. Turnstile (sidebar) → Add Site
3. Site name: "TAP Waitlist"
4. Domain: trust-audit-framework.vercel.app
5. Widget mode: Managed
6. Create → Copy BOTH keys:
   - Site Key (public) → NEXT_PUBLIC_TURNSTILE_SITE_KEY
   - Secret Key (private) → TURNSTILE_SECRET_KEY

### 3. UPSTASH REDIS
**URL:** https://upstash.com
**Steps:**
1. Sign up (GitHub login works)
2. Create Database
3. Name: tap-rate-limit
4. Region: us-east-1 (or closest)
5. Copy BOTH values:
   - REST URL → UPSTASH_REDIS_REST_URL
   - REST Token → UPSTASH_REDIS_REST_TOKEN

### 4. ADMIN PASSWORD
**Just create one:**
- Example: TAP2026!SecureLaunch
- → ADMIN_PASSWORD

### 5. CONTRACT ADDRESS (Later)
- Deploy NFT contract first
- Then add: NEXT_PUBLIC_CONTRACT_ADDRESS

## ADDITIONAL (Optional but recommended):
- NEXT_PUBLIC_BASE_RPC=https://mainnet.base.org (or Alchemy URL)

## WHERE TO ADD:
https://vercel.com/dashboard → [Your Project] → Settings → Environment Variables

## AFTER ADDING ALL:
Vercel will auto-redeploy and build should pass!
