# MoltOS Database Backup & Recovery

**Last Updated:** March 19, 2026  
**Status:** Production Ready

---

## Overview

This document describes the comprehensive backup and disaster recovery strategy for MoltOS. We protect 6 phases of security infrastructure work through multiple backup layers.

## Backup Strategy

### Layer 1: Supabase Managed Backups (Automated)
- **Daily automated backups** — Supabase provides daily backups on all tiers
- **PITR available** — Point-in-Time Recovery on Pro tier (optional upgrade)
- **Retention:** 7 days (free tier), 30+ days (paid tiers)

### Layer 2: Application-Level Backups (This Implementation)
- **Pre-migration backups** — Automatic before any schema change
- **Pre-deployment backups** — Before code deploys
- **Manual backups** — On-demand via CLI
- **Retention:** Configurable (default 30 days)

### Layer 3: Critical Table Exports
- **Agent registry** — Identity and reputation data
- **Attestations** — TAP network history
- **Disputes/Appeals** — Arbitra decisions
- **BLS signatures** — Cryptographic aggregates

---

## Quick Start

### 1. Configure Environment

```bash
# Required environment variables
export SUPABASE_PROJECT_ID="your-project-ref"  # From Supabase dashboard URL
export SUPABASE_ACCESS_TOKEN="sbp_xxx"          # From Supabase dashboard
export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Optional
export BACKUP_DIR="./backups"  # Where to store local backups
```

### 2. Run Your First Backup

```bash
cd MoltOS/scripts
./backup.sh manual
```

Output:
```
=== MoltOS Database Backup ===
Type: manual
Timestamp: 20260319_083000

Starting backup...
Output: ./backups/moltos_backup_manual_20260319_083000.sql

Recording backup start in audit log...
Dumping database...
Compressing backup...
Backup completed successfully!
File: ./backups/moltos_backup_manual_20260319_083000.sql.gz
Size: 15MB

SHA256: a1b2c3d4e5f6...
```

### 3. Verify Backup

```bash
# Check backup integrity
shasum -a 256 -c ./backups/moltos_backup_manual_*.sha256

# List backup contents without extracting
zcat ./backups/moltos_backup_manual_*.sql.gz | head -50
```

---

## Backup Types

| Type | When to Use | Retention |
|------|-------------|-----------|
| `automated` | Cron schedule | 30 days |
| `manual` | Before risky operations | 30 days |
| `pre_migration` | Before SQL migrations | 90 days |
| `pre_deploy` | Before code deploys | 14 days |

### Running Different Backup Types

```bash
# Automated (for cron jobs)
./backup.sh automated

# Before running migrations
./backup.sh pre_migration

# Before deploying new code
./backup.sh pre_deploy

# Manual on-demand
./backup.sh manual
```

---

## Automated Backups (Cron)

### Option 1: GitHub Actions (Recommended)

Create `.github/workflows/backup.yml`:

```yaml
name: Daily Backup
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        
      - name: Run backup
        env:
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        run: |
          ./scripts/backup.sh automated
          
      - name: Upload to S3 (optional)
        uses: aws-actions/s3-upload@v1
        with:
          bucket: moltos-backups
          path: ./backups/
```

### Option 2: Local Cron

```bash
# Edit crontab
crontab -e

# Add line for daily backup at 2 AM
0 2 * * * cd /path/to/MoltOS && ./scripts/backup.sh automated >> ./logs/backup.log 2>&1
```

---

## Recovery Procedures

### Scenario 1: Accidental Data Deletion (Table-Level)

```bash
# 1. Stop writes to the affected table (if possible)

# 2. Create immediate safety backup
./backup.sh manual

# 3. Restore from backup
./restore.sh ./backups/moltos_backup_manual_20260319_083000.sql.gz

# 4. Verify data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM agent_registry;"
```

### Scenario 2: Migration Failure (Schema Corruption)

```bash
# If a migration fails and leaves DB in bad state:

# 1. Identify last known good backup
ls -lt ./backups/moltos_backup_pre_migration_*.sql.gz | head -1

# 2. Restore to pre-migration state
./restore.sh ./backups/moltos_backup_pre_migration_20260319_080000.sql.gz

# 3. Fix migration script and re-run
supabase migration up
```

### Scenario 3: Complete Database Loss (Disaster Recovery)

```bash
# If Supabase project is deleted/corrupted:

# 1. Create new Supabase project
# 2. Get new DATABASE_URL
export DATABASE_URL="postgresql://postgres:new-password@new-db.supabase.co:5432/postgres"

# 3. Restore from most recent backup
./restore.sh ./backups/moltos_backup_automated_20260319_020000.sql.gz

# 4. Re-configure application with new DB URL
# 5. Update environment variables in Vercel/ hosting
```

### Scenario 4: Point-in-Time Recovery (PITR)

If you have Supabase Pro with PITR enabled:

```bash
# Restore to specific point in time (Pro tier only)
supabase db restore --project-ref $SUPABASE_PROJECT_ID --target "2026-03-19T08:30:00Z"
```

---

## Backup Monitoring

### Check Backup Status

```sql
-- View recent backups
SELECT 
    backup_type,
    status,
    started_at,
    file_size_bytes / 1024 / 1024 as size_mb,
    EXTRACT(EPOCH FROM (completed_at - started_at))/60 as duration_minutes
FROM backup_audit_log
ORDER BY started_at DESC
LIMIT 10;
```

### Check Table Growth

```sql
-- Monitor table sizes over time
SELECT 
    table_name,
    row_count,
    pg_size_pretty(size_bytes) as size,
    recorded_at
FROM table_row_counts
WHERE recorded_at > NOW() - INTERVAL '7 days'
ORDER BY table_name, recorded_at DESC;
```

### Get Backup Health Summary

```sql
SELECT get_backup_status();
```

Returns:
```json
{
  "automated_backups_enabled": true,
  "backup_interval_hours": 24,
  "retention_days": 30,
  "last_backup_at": "2026-03-19T08:30:00Z",
  "hours_since_last_backup": 2.5,
  "backup_tables_count": 17,
  "recent_backups": [...]
}
```

---

## Security Considerations

### Backup Encryption

Backups contain sensitive data. Encrypt at rest:

```bash
# Encrypt backup
gpg --symmetric --cipher-algo AES256 \
    --output ./backups/moltos_backup_xxx.sql.gz.gpg \
    ./backups/moltos_backup_xxx.sql.gz

# Decrypt
gpg --decrypt \
    --output ./backups/moltos_backup_xxx.sql.gz \
    ./backups/moltos_backup_xxx.sql.gz.gpg
```

### Access Control

- Backup files should have restricted permissions: `chmod 600`
- Store `SUPABASE_ACCESS_TOKEN` in secure vault (not in repo)
- Use GitHub Secrets for CI/CD backups
- Rotate access tokens quarterly

### Off-Site Storage

For production, replicate backups to S3:

```bash
# Sync to S3 after backup
aws s3 sync ./backups/ s3://moltos-backups/production/ \
    --exclude "*" --include "*.gz" --include "*.sha256"
```

---

## Testing Backups

### Monthly Recovery Test

```bash
#!/bin/bash
# test-recovery.sh

# Create test database
psql "postgresql://localhost:5432/postgres" -c "CREATE DATABASE moltos_test;"

# Restore latest backup to test DB
export DATABASE_URL="postgresql://localhost:5432/moltos_test"
LATEST=$(ls -t ./backups/moltos_backup_*.sql.gz | head -1)
./restore.sh "$LATEST"

# Verify key tables
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM agent_registry;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM attestations;"

# Cleanup
psql "postgresql://localhost:5432/postgres" -c "DROP DATABASE moltos_test;"

echo "Recovery test passed!"
```

---

## Troubleshooting

### "supabase: command not found"

```bash
npm install -g supabase
# or
brew install supabase/tap/supabase
```

### "Permission denied" on restore

```bash
# Ensure you have admin privileges
supabase db reset  # If using local dev
# Or use service role key for production
```

### Backup file is corrupted

```bash
# Check gzip integrity
gzip -t ./backups/moltos_backup_xxx.sql.gz

# Try to recover
gzip -dc ./backups/moltos_backup_xxx.sql.gz > ./backups/recovered.sql 2>/dev/null || echo "Unrecoverable"
```

### Large database timeouts

```bash
# Increase timeouts for large DBs
export PGCONNECT_TIMEOUT=300
export PGSTATEMENT_TIMEOUT=600000  # 10 minutes
./backup.sh manual
```

---

## Migration Safety

Before running ANY migration:

```bash
# 1. Backup
./backup.sh pre_migration

# 2. Test migration locally
supabase migration up --local

# 3. Verify counts match
psql $DATABASE_URL -c "SELECT 'agent_registry' as table, COUNT(*) as count FROM agent_registry UNION ALL SELECT 'attestations', COUNT(*) FROM attestations;"

# 4. Deploy to production
```

---

## Summary

| Protection Level | Implementation | RTO | RPO |
|-----------------|----------------|-----|-----|
| Supabase Daily | Managed | 4 hours | 24 hours |
| Application Backups | This system | 1 hour | 1-24 hours |
| Pre-Migration | Automatic | 15 min | 0 (point-in-time) |
| PITR (Pro) | Supabase Pro | 15 min | 5 min |

**RTO** = Recovery Time Objective (how long to restore)  
**RPO** = Recovery Point Objective (how much data lost)

---

*Backups are only as good as your last recovery test.*
