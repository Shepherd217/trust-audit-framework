#!/bin/bash
#
# Agent A - Minimal Boot-Audit
# Reference Implementation for Trust Audit Framework
# 
# Alpha Collective Integration: Layer 1 (Boot-Time Audit)
# 
# Usage: ./agent-a-boot-audit.sh [agent_id]

AGENT_ID="${1:-$(hostname)}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
WORKSPACE_DIR="${WORKSPACE:-/root/.openclaw/workspace}"
OUTPUT_FILE="${2:-boot-audit-${AGENT_ID}-$(date -u +%Y%m%d-%H%M%S).json}"

# Colors for terminal output (optional)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Agent A - Boot-Time Audit"
echo "============================"
echo "Agent ID: $AGENT_ID"
echo "Timestamp: $TIMESTAMP"
echo "Workspace: $WORKSPACE_DIR"
echo ""

# Initialize counters
FILES_CHECKED=0
FILES_PRESENT=0
OVERRIDES_LOGGED=0
WARNINGS=0

# Core files to check
CORE_FILES=(
    "AGENTS.md"
    "SOUL.md"
    "USER.md"
    "TOOLS.md"
    "MEMORY.md"
    "HEARTBEAT.md"
)

# Check each core file
declare -a PRESENT_FILES
declare -a MISSING_FILES

for file in "${CORE_FILES[@]}"; do
    FILES_CHECKED=$((FILES_CHECKED + 1))
    if [ -f "$WORKSPACE_DIR/$file" ]; then
        FILES_PRESENT=$((FILES_PRESENT + 1))
        PRESENT_FILES+=("$file")
        echo -e "${GREEN}✓${NC} $file"
    else
        MISSING_FILES+=("$file")
        echo -e "${RED}✗${NC} $file (MISSING)"
        WARNINGS=$((WARNINGS + 1))
    fi
done

echo ""

# Check for override patterns in recent history
# Look for files modified in last 24 hours with "override" or "bypass" in name or content
declare -a OVERRIDES_FOUND

if command -v find &> /dev/null; then
    # Find files modified in last 24h
    RECENT_FILES=$(find "$WORKSPACE_DIR" -type f -mtime -1 2>/dev/null | head -20)
    
    for file in $RECENT_FILES; do
        BASENAME=$(basename "$file")
        # Check for override keywords
        if echo "$BASENAME" | grep -qi "override\|bypass\|force\|skip"; then
            OVERRIDES_FOUND+=("$BASENAME")
            OVERRIDES_LOGGED=$((OVERRIDES_LOGGED + 1))
            echo -e "${YELLOW}⚠${NC} Override pattern detected: $BASENAME"
        fi
    done
fi

# If no overrides found, check for common override files
OVERRIDE_FILES=(
    ".override"
    "bypass.conf"
    "force-flags.txt"
    "skip-checks.md"
)

for file in "${OVERRIDE_FILES[@]}"; do
    if [ -f "$WORKSPACE_DIR/$file" ]; then
        OVERRIDES_FOUND+=("$file")
        OVERRIDES_LOGGED=$((OVERRIDES_LOGGED + 1))
        echo -e "${YELLOW}⚠${NC} Override file found: $file"
    fi
done

# Generate hash of workspace state
if command -v find &> /dev/null && command -v sha256sum &> /dev/null; then
    WORKSPACE_HASH=$(find "$WORKSPACE_DIR" -type f -name "*.md" -exec sha256sum {} \; 2>/dev/null | sort | sha256sum | cut -d' ' -f1 | head -c 16)
else
    WORKSPACE_HASH=$(date +%s | sha256sum 2>/dev/null | cut -d' ' -f1 | head -c 16 || echo "manual-$(date +%s)")
fi

echo ""
echo "Workspace Hash: $WORKSPACE_HASH"
echo ""

# Determine compliance status
if [ $FILES_PRESENT -eq ${#CORE_FILES[@]} ] && [ $OVERRIDES_LOGGED -eq 0 ]; then
    COMPLIANCE_STATUS="FULL"
    COMPLIANCE_SCORE=100
elif [ $FILES_PRESENT -ge 3 ]; then
    COMPLIANCE_STATUS="PARTIAL"
    COMPLIANCE_SCORE=$(( FILES_PRESENT * 100 / ${#CORE_FILES[@]} ))
else
    COMPLIANCE_STATUS="MINIMAL"
    COMPLIANCE_SCORE=$(( FILES_PRESENT * 100 / ${#CORE_FILES[@]} ))
fi

# Build JSON output
cat > "$OUTPUT_FILE" << EOF
{
  "agent_id": "$AGENT_ID",
  "agent_type": "Agent-A-Minimal",
  "framework_version": "1.0.0",
  "timestamp": "$TIMESTAMP",
  "layer": 1,
  "audit_type": "boot-time",
  "workspace": {
    "path": "$WORKSPACE_DIR",
    "hash": "$WORKSPACE_HASH"
  },
  "compliance": {
    "status": "$COMPLIANCE_STATUS",
    "score": $COMPLIANCE_SCORE,
    "files_checked": $FILES_CHECKED,
    "files_present": $FILES_PRESENT,
    "files_expected": ${#CORE_FILES[@]}
  },
  "core_files": {
    "present": [$(printf '"%s",' "${PRESENT_FILES[@]}" | sed 's/,$//')],
    "missing": [$(printf '"%s",' "${MISSING_FILES[@]}" | sed 's/,$//')]
  },
  "overrides": {
    "count": $OVERRIDES_LOGGED,
    "items": [$(printf '"%s",' "${OVERRIDES_FOUND[@]}" | sed 's/,$//')]
  },
  "warnings": $WARNINGS,
  "signature": {
    "algorithm": "none",
    "value": ""
  },
  "next_audit_due": "$(date -u -d '+7 days' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo '7 days from now')"
}
EOF

echo "✅ Boot audit complete"
echo "📄 Output: $OUTPUT_FILE"
echo "📊 Compliance: $COMPLIANCE_STATUS ($COMPLIANCE_SCORE%)"
echo "🔔 Next audit due: 7 days"
echo ""

# Summary
echo "Summary:"
echo "- Files checked: $FILES_CHECKED"
echo "- Files present: $FILES_PRESENT"
echo "- Overrides detected: $OVERRIDES_LOGGED"
echo "- Warnings: $WARNINGS"
echo ""

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Audit passed with warnings. Review missing files and overrides.${NC}"
else
    echo -e "${GREEN}✓ Audit passed. Agent cleared for operation.${NC}"
fi

exit 0
