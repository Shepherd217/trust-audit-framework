# MoltOS Migration Deployment Guide

## Migration 016-019: Infrastructure Persistence

These migrations add database tables for ClawBus, ClawScheduler, ClawVM, and component integration.

### Option 1: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/lqpqfnefmnhskykigjir
2. Navigate to **SQL Editor** → **New Query**
3. Copy and paste each migration file:
   - `016_clawbus_infrastructure.sql`
   - `017_clawscheduler_infrastructure.sql`
   - `018_clawvm_infrastructure.sql`
   - `019_component_integration.sql`
4. Click **Run** for each

### Option 2: Using Connection String

If you have the database password, set it as an environment variable:

```bash
export SUPABASE_DB_PASSWORD="your-db-password"
export DATABASE_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.lqpqfnefmnhskykigjir.supabase.co:5432/postgres?sslmode=require"
```

Then run:

```bash
cd tap-dashboard/supabase/migrations
psql "$DATABASE_URL" -f 016_clawbus_infrastructure.sql
psql "$DATABASE_URL" -f 017_clawscheduler_infrastructure.sql
psql "$DATABASE_URL" -f 018_clawvm_infrastructure.sql
psql "$DATABASE_URL" -f 019_component_integration.sql
```

### Option 3: Using Supabase CLI

If you have the Supabase CLI configured:

```bash
cd tap-dashboard
npx supabase db push
```

### Verification

After deployment, verify tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'claw%'
ORDER BY table_name;
```

Expected tables:
- `claw_agent_sessions`
- `claw_component_health`
- `claw_execution_checkpoints`
- `claw_node_executions`
- `claw_scheduled_workflows`
- `claw_system_events`
- `claw_workflow_events`
- `claw_workflow_executions`
- `claw_workflow_nodes`
- `clawbus_agents`
- `clawbus_messages`
- `clawbus_handoffs`
- `clawbus_channels`
- `clawbus_subscriptions`
- `clawvm_instances`
- `clawvm_snapshots`
- `clawvm_metrics`

### Rollback

If needed, drop the tables:

```sql
DROP TABLE IF EXISTS claw_execution_checkpoints CASCADE;
DROP TABLE IF EXISTS claw_workflow_events CASCADE;
DROP TABLE IF EXISTS claw_node_executions CASCADE;
DROP TABLE IF EXISTS claw_workflow_executions CASCADE;
DROP TABLE IF EXISTS claw_workflow_edges CASCADE;
DROP TABLE IF EXISTS claw_workflow_nodes CASCADE;
DROP TABLE IF EXISTS claw_workflows CASCADE;
DROP TABLE IF EXISTS claw_scheduled_workflows CASCADE;
DROP TABLE IF EXISTS clawbus_acknowledgments CASCADE;
DROP TABLE IF EXISTS clawbus_subscriptions CASCADE;
DROP TABLE IF EXISTS clawbus_channels CASCADE;
DROP TABLE IF EXISTS clawbus_handoffs CASCADE;
DROP TABLE IF EXISTS clawbus_messages CASCADE;
DROP TABLE IF EXISTS clawbus_agents CASCADE;
DROP TABLE IF EXISTS clawvm_executions CASCADE;
DROP TABLE IF EXISTS clawvm_logs CASCADE;
DROP TABLE IF EXISTS clawvm_metrics CASCADE;
DROP TABLE IF EXISTS clawvm_snapshots CASCADE;
DROP TABLE IF EXISTS clawvm_instances CASCADE;
DROP TABLE IF EXISTS clawvm_tier_quotas CASCADE;
DROP TABLE IF EXISTS claw_agent_sessions CASCADE;
DROP TABLE IF EXISTS claw_system_events CASCADE;
DROP TABLE IF EXISTS claw_component_health CASCADE;
```
