# TAP DASHBOARD DEPLOYMENT

## Vercel + Supabase Setup (4 minutes)

### Step 1: Create Project
```bash
npx create-next-app@latest tap-dashboard --typescript --tailwind --eslint --app --yes
cd tap-dashboard
npm install recharts @supabase/supabase-js lucide-react
```

### Step 2: Environment Variables
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON=your-anon-key
NEXT_PUBLIC_TAP_API=https://api.tap.live
```

### Step 3: Deploy to Vercel
```bash
npm run build
vercel --prod
```

**Dashboard URL:** https://tap-dashboard-xyz.vercel.app

---

## Supabase Schema

```sql
-- Enable realtime
alter publication supabase_realtime add table attestations;

-- Create attestations table
CREATE TABLE attestations (
  id uuid default gen_random_uuid(),
  agent_id text not null,
  claim_id text not null,
  result text check (result in ('CONFIRMED', 'REJECTED', 'TIMEOUT')),
  measured_value integer,
  timestamp timestamptz default now(),
  signature text not null,
  PRIMARY KEY (id)
);

-- Stats view
CREATE VIEW stats AS
SELECT 
  COUNT(DISTINCT agent_id) as agents,
  COUNT(*) as pairs,
  COUNT(*) * 50 as alpha_distributed,
  COUNT(*) FILTER (WHERE timestamp > now() - interval '1 day') as claims_today
FROM attestations;
```

---

**Status:** READY TO DEPLOY
