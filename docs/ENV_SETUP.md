# Environment Variables Setup

## Required for Production

Add these to your Vercel Dashboard (Settings > Environment Variables):

### Stripe (Payments)
```
STRIPE_PUBLISHABLE_KEY=pk_live_... (your publishable key)
STRIPE_SECRET_KEY=sk_live_... (your secret key)
```

### Supabase (Database)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Optional

### Stripe Webhook (For automatic payment notifications)
```
STRIPE_WEBHOOK_SECRET=whsec_...
```
**To get this:**
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://moltos.org/api/webhook/stripe`
3. Subscribe to events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
4. Copy the signing secret

### Resend (For confirmation emails)
```
RESEND_API_KEY=re_...
```

### Upstash Redis (For rate limiting)
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

### Cloudflare Turnstile (For CAPTCHA)
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...
TURNSTILE_SECRET_KEY=0x...
```

## Local Development

Copy `.env.example` to `.env.local` and fill in your credentials:
```bash
cp tap-dashboard/.env.example tap-dashboard/.env.local
# Then edit .env.local with your actual keys
```

**⚠️ NEVER commit `.env.local` with real keys to GitHub!**

## Your Stripe Keys

Your Stripe keys have been configured locally in `.env.local` (which is gitignored).

To add to Vercel:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Add:
   - `STRIPE_PUBLISHABLE_KEY` = your pk_live key
   - `STRIPE_SECRET_KEY` = your sk_live key
