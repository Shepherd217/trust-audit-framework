#!/bin/bash
#
# MoltOS Database Restore Script
# Usage: ./restore.sh [backup_file]
#

set -e

RESTORE_FILE="${1:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}=== MoltOS Database Restore ===${NC}"

# Check environment
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL not set${NC}"
    echo "Set it with: export DATABASE_URL=postgresql://..."
    exit 1
fi

# List available backups if no file specified
if [ -z "$RESTORE_FILE" ]; then
    BACKUP_DIR="${BACKUP_DIR:-./backups}"
    echo ""
    echo "No backup file specified. Available backups:"
    echo ""
    
    if [ -d "$BACKUP_DIR" ]; then
        ls -lt "$BACKUP_DIR"/*.gz 2>/dev/null | head -10 | nl
    fi
    
    echo ""
    echo "Usage: ./restore.sh backups/moltos_backup_[type]_[timestamp].sql.gz"
    exit 1
fi

# Verify file exists
if [ ! -f "$RESTORE_FILE" ]; then
    echo -e "${RED}Error: File not found: $RESTORE_FILE${NC}"
    exit 1
fi

# Verify checksum if available
CHECKSUM_FILE="${RESTORE_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
    echo ""
    echo -e "${YELLOW}Verifying checksum...${NC}"
    if shasum -a 256 -c "$CHECKSUM_FILE"; then
        echo -e "${GREEN}Checksum verified!${NC}"
    else
        echo -e "${RED}WARNING: Checksum mismatch! File may be corrupted.${NC}"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}Warning: No checksum file found${NC}"
fi

# Pre-restore backup (safety)
echo ""
echo -e "${YELLOW}Creating pre-restore backup...${NC}"
PRE_RESTORE_BACKUP="pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
mkdir -p ./backups

# Use supabase CLI if available, otherwise pg_dump
if command -v supabase &> /dev/null; then
    supabase db dump --file "./backups/$PRE_RESTORE_BACKUP" 2>/dev/null || \
        pg_dump "$DATABASE_URL" -Fc > "./backups/$PRE_RESTORE_BACKUP"
else
    pg_dump "$DATABASE_URL" -Fc > "./backups/$PRE_RESTORE_BACKUP"
fi

echo -e "${GREEN}Pre-restore backup created: ./backups/$PRE_RESTORE_BACKUP${NC}"

# Final warning
echo ""
echo -e "${RED}============================================${NC}"
echo -e "${RED}WARNING: This will OVERWRITE your database!${NC}"
echo -e "${RED}============================================${NC}"
echo ""
echo "Restore file: $RESTORE_FILE"
echo "Target: $DATABASE_URL"
echo ""
read -p "Are you sure you want to continue? Type 'RESTORE' to proceed: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Perform restore
echo ""
echo -e "${YELLOW}Starting restore...${NC}"
echo "This may take several minutes depending on database size."
echo ""

# Check if file is compressed
if [[ "$RESTORE_FILE" == *.gz ]]; then
    echo "Decompressing and restoring..."
    gunzip -c "$RESTORE_FILE" | psql "$DATABASE_URL"
else
    echo "Restoring from SQL file..."
    psql "$DATABASE_URL" < "$RESTORE_FILE"
fi

# Verify restore
echo ""
echo -e "${YELLOW}Verifying restore...${NC}"
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
AGENT_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM agent_registry;" | xargs 2>/dev/null || echo "0")

echo "Tables restored: $TABLE_COUNT"
echo "Agents in registry: $AGENT_COUNT"

echo ""
echo -e "${GREEN}=== Restore Complete ===${NC}"
echo ""
echo -e "${BLUE}To rollback:${NC}"
echo "  ./restore.sh ./backups/$PRE_RESTORE_BACKUP"
