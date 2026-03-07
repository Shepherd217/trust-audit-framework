-- CHECK 10: Database Backup
-- Option 1: Export to CSV (works in Supabase SQL Editor)
COPY (
  SELECT * FROM waitlist
) TO '/tmp/waitlist_backup_2026-03-08.csv' 
WITH (FORMAT CSV, HEADER);

-- Option 2: If COPY doesn't work, use this instead:
-- SELECT * FROM waitlist;
-- Then manually export results from Supabase UI

-- Option 3: Simple row count verification
SELECT 
  'Backup verification' as check_type,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE confirmed = true) as confirmed_agents,
  MIN(created_at) as earliest_entry,
  MAX(created_at) as latest_entry
FROM waitlist;
