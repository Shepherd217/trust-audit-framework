#!/bin/bash
#
# MoltOS Database Backup Script
# Usage: ./backup.sh [manual|pre_migration|pre_deploy]
#

set -e

BACKUP_TYPE="${1:-automated}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== MoltOS Database Backup ===${NC}"
echo "Type: $BACKUP_TYPE"
echo "Timestamp: $TIMESTAMP"

# Check environment variables
if [ -z "$SUPABASE_PROJECT_ID" ]; then
    echo -e "${RED}Error: SUPABASE_PROJECT_ID not set${NC}"
    echo "Set it with: export SUPABASE_PROJECT_ID=your-project-ref"
    exit 1
fi

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo -e "${RED}Error: SUPABASE_ACCESS_TOKEN not set${NC}"
    exit 1
fi

# Check for supabase CLI
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}Supabase CLI not found. Installing...${NC}"
    npm install -g supabase
fi

BACKUP_FILE="$BACKUP_DIR/moltos_backup_${BACKUP_TYPE}_${TIMESTAMP}.sql"

echo ""
echo -e "${YELLOW}Starting backup...${NC}"
echo "Output: $BACKUP_FILE"

# Record backup start in database (if we can connect)
echo ""
echo "Recording backup start in audit log..."
psql "$DATABASE_URL" -c "
    INSERT INTO backup_audit_log (backup_type, status, triggered_by)
    VALUES ('$BACKUP_TYPE', 'running', '$(whoami)')
    RETURNING id;
" 2>/dev/null || echo "Warning: Could not record backup start (DB may not be accessible)"

# Perform the backup using supabase CLI
echo ""
echo "Dumping database..."
supabase db dump --project-ref "$SUPABASE_PROJECT_ID" --file "$BACKUP_FILE"

# Compress the backup
echo "Compressing backup..."
gzip "$BACKUP_FILE"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

# Get file size
FILE_SIZE=$(stat -f%z "$COMPRESSED_FILE" 2>/dev/null || stat -c%s "$COMPRESSED_FILE" 2>/dev/null || echo "0")
FILE_SIZE_MB=$((FILE_SIZE / 1024 / 1024))

echo ""
echo -e "${GREEN}Backup completed successfully!${NC}"
echo "File: $COMPRESSED_FILE"
echo "Size: ${FILE_SIZE_MB}MB"

# Verify checksum
echo ""
echo "Calculating checksum..."
CHECKSUM=$(shasum -a 256 "$COMPRESSED_FILE" | cut -d' ' -f1)
echo "SHA256: $CHECKSUM"

# Save checksum
echo "$CHECKSUM  $(basename "$COMPRESSED_FILE")" > "${COMPRESSED_FILE}.sha256"

# Update backup audit log
echo ""
echo "Recording backup completion..."
psql "$DATABASE_URL" -c "
    UPDATE backup_audit_log 
    SET status = 'completed',
        completed_at = NOW(),
        file_size_bytes = $FILE_SIZE,
        storage_location = '$COMPRESSED_FILE'
    WHERE backup_type = '$BACKUP_TYPE' 
    AND status = 'running'
    ORDER BY started_at DESC
    LIMIT 1;
" 2>/dev/null || echo "Warning: Could not update audit log"

# Snapshot table sizes
echo ""
echo "Snapshotting table sizes..."
psql "$DATABASE_URL" -c "SELECT snapshot_table_sizes();" 2>/dev/null || echo "Warning: Could not snapshot table sizes"

# Clean up old backups (keep 30 days)
echo ""
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "moltos_backup_*.gz" -mtime +30 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "moltos_backup_*.sha256" -mtime +30 -delete 2>/dev/null || true

# List recent backups
echo ""
echo -e "${YELLOW}Recent backups:${NC}"
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tail -5 || echo "No backups found"

echo ""
echo -e "${GREEN}=== Backup Complete ===${NC}"
echo "To restore: gunzip $COMPRESSED_FILE | psql \"\$DATABASE_URL\""
