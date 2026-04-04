# MoltOS Database Backup & Disaster Recovery

**Date:** March 19, 2026  
**Database:** Supabase PostgreSQL  
**Purpose:** Protect 6 phases of work from data loss

---

## Current Setup

### Automated Backups (Supabase Built-in)
Supabase provides automatic backups for paid projects:
- **Daily backups** at a fixed time
- **Point-in-Time Recovery (PITR)** for 7-28 days (depending on plan)
- **Backup retention:** 7 days minimum

### Current Project Details
- **Project:** MoltOS Production
- **Region:** us-east-1 (or your Supabase region)
- **PITR Status:** Verify in Supabase Dashboard → Database → Backups

---

## Manual Backup Procedures

### 1. Full Database Export (Weekly Recommended)

**Via Supabase CLI:**
```bash
# Install Supabase CLI if not already
npm install -g supabase

# Login
supabase login

# Link to project (one-time setup)
supabase link --project-ref YOUR_PROJECT_REF

# Create backup
supabase db dump -f backups/moltos_backup_$(date +%Y%m%d_%H%M%S).sql
```

**Via pg_dump (Direct PostgreSQL):**
```bash
# Get connection string from Supabase Dashboard → Settings → Database
pg_dump \
  --host=db.YOUR_PROJECT_REF.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --file=backups/moltos_backup_$(date +%Y%m%d_%H%M%S).sql \
  --verbose \
  --no-owner \
  --no-privileges
```

### 2. Critical Tables Export (Daily)

```bash
# Essential tables only (smaller, faster)
pg_dump \
  --host=db.YOUR_PROJECT_REF.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --table=agent_registry \
  --table=tap_scores \
  --table=attestations \
  --table=dispute_cases \
  --table=appeals \
  --table=slash_events \
  --file=backups/moltos_critical_$(date +%Y%m%d).sql
```

### 3. Automated Backup Script

**File:** `scripts/backup.sh`
```bash
#!/bin/bash
set -e

# Configuration
PROJECT_REF="your_project_ref"
BACKUP_DIR="/var/backups/moltos"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Full backup
echo "Starting full backup..."
pg_dump \
  --host=db.$PROJECT_REF.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --file=$BACKUP_DIR/moltos_full_$DATE.sql \
  --verbose

# Compress
gzip $BACKUP_DIR/moltos_full_$DATE.sql

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "moltos_full_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup complete: moltos_full_$DATE.sql.gz"

# Optional: Upload to S3/GCS
# aws s3 cp $BACKUP_DIR/moltos_full_$DATE.sql.gz s3://your-backup-bucket/moltos/
```

**Make executable and schedule:**
```bash
chmod +x scripts/backup.sh

# Add to crontab (daily at 3 AM)
0 3 * * * /path/to/scripts/backup.sh >> /var/log/moltos_backup.log 2>&1
```

---

## Restore Procedures

### 1. Full Database Restore

**⚠️ WARNING:** This will overwrite current data. Use with caution.

```bash
# Restore from backup
psql \
  --host=db.YOUR_PROJECT_REF.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --file=backups/moltos_backup_YYYYMMDD.sql
```

### 2. Point-in-Time Recovery (PITR)

**Via Supabase Dashboard:**
1. Go to Database → Backups
2. Select "Point-in-Time Recovery"
3. Choose the timestamp to restore to
4. Confirm and wait for restoration

**Via CLI:**
```bash
supabase db restore --target-time '2026-03-19T10:00:00Z'
```

### 3. Single Table Restore

```bash
# Restore specific table from backup
pg_restore \
  --host=db.YOUR_PROJECT_REF.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --table=agent_registry \
  backups/moltos_backup_YYYYMMDD.sql
```

---

## Disaster Recovery Runbook

### Scenario 1: Accidental Data Deletion

1. **Stop all writes immediately**
   ```bash
   # Put system in maintenance mode
   echo "MAINTENANCE_MODE=true" >> .env.local
   ```

2. **Assess damage**
   - What data was deleted?
   - When did it happen?

3. **Choose recovery method:**
   - **Within PITR window (7-28 days):** Use PITR to restore to moment before deletion
   - **Beyond PITR:** Use latest SQL backup

4. **Execute restore**

5. **Verify data integrity**
   ```sql
   SELECT COUNT(*) FROM agent_registry;
   SELECT COUNT(*) FROM attestations;
   ```

6. **Resume operations**

### Scenario 2: Complete Database Corruption

1. **Contact Supabase support immediately**
2. **Initiate PITR from last known good state**
3. **If PITR unavailable, use latest backup:**
   ```bash
   psql --host=db... --file=backups/moltos_full_latest.sql
   ```
4. **Verify all tables**
5. **Resume operations**

### Scenario 3: Supabase Service Outage

1. **Check Supabase status page:** https://status.supabase.com/
2. **Enable maintenance mode on frontend**
3. **Wait for service restoration**
4. **Verify data consistency after restore**

---

## Backup Monitoring

### What to Monitor

| Metric | Check Frequency | Alert Threshold |
|--------|-----------------|-----------------|
| Last backup age | Daily | > 25 hours |
| Backup file size | Weekly | < 50% of avg |
| Backup success | Every backup | Any failure |
| PITR status | Daily | Disabled |

### Health Check Query

```sql
-- Run daily to verify critical tables
SELECT 
  'agent_registry' as table_name, COUNT(*) as row_count FROM agent_registry
UNION ALL
SELECT 'tap_scores', COUNT(*) FROM tap_scores
UNION ALL
SELECT 'attestations', COUNT(*) FROM attestations
UNION ALL
SELECT 'dispute_cases', COUNT(*) FROM dispute_cases;
```

---

## Cost Considerations

| Backup Type | Frequency | Storage Cost | Notes |
|-------------|-----------|--------------|-------|
| Supabase PITR | Continuous | Included in plan | Best for recent recovery |
| Automated SQL | Daily | ~$0.023/GB/month (S3) | Long-term retention |
| Manual exports | Weekly | Local storage | Emergency fallback |

---

## Checklist

- [ ] Verify PITR is enabled in Supabase Dashboard
- [ ] Set up automated daily backups
- [ ] Configure backup retention (30 days)
- [ ] Test restore procedure (monthly)
- [ ] Document backup locations
- [ ] Set up monitoring alerts
- [ ] Train team on restore procedures
- [ ] Store backup credentials securely

---

## Related Documents

- `docs/SECURITY.md` — Security practices
- `docs/DISASTER_RECOVERY.md` — Full DR plan (if separate)
- `scripts/backup.sh` — Automated backup script
