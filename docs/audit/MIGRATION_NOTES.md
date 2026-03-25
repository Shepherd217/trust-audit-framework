# ClawFS Database Migration Instructions

## Migration File
`supabase/migrations/008_claw_fs.sql` (496 lines)

## Tables Created

| Table | Purpose |
|-------|---------|
| `claw_files` | Core file storage with CID |
| `claw_file_versions` | Immutable version history |
| `claw_permissions` | Agent-to-agent access control |
| `claw_access_policies` | Rule-based permissions |
| `claw_semantic_index` | Vector embeddings for search |
| `claw_audit_logs` | Tamper-proof audit trail |
| `claw_storage_tiers` | Tier migration tracking |
| `claw_conflict_queue` | Conflict resolution queue |

## How to Apply

### Option 1: Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/pgeddexhbqoghdytjvex
2. Navigate to SQL Editor
3. Click "New Query"
4. Copy entire contents of `008_claw_fs.sql`
5. Run query

### Option 2: Supabase CLI (if configured)
```bash
supabase link --project-ref pgeddexhbqoghdytjvex
supabase db push
```

## Verification

After migration, verify tables exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'claw_%';
```

Expected: 8 tables listed

## Post-Migration Steps

1. Enable pgvector extension (if not already enabled):
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

2. Verify RLS policies are active:
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename LIKE 'claw_%';
```

3. Test basic operations via API
