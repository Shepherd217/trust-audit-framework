#!/bin/bash
# Trust Audit CLI — One-liner attestation tool
# Usage: ./trust-audit-cli.sh [command] [options]

set -e

AGENT_ID="${AGENT_ID:-$(whoami)}"
WORKSPACE="${WORKSPACE:-$(pwd)}"
COORDINATOR_URL="${COORDINATOR_URL:-https://trust-audit-framework.org/api/v1}"
VERSION="1.0.0"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

show_help() {
    cat <<EOF
Trust Audit CLI v${VERSION}

Commands:
  boot-audit          Run Layer 1 boot audit
  ledger-create       Generate Trust Ledger template
  attest              Submit attestation to another agent
  status              Check agent status in attestation ring
  validate            Validate attestation format
  submit              Submit to coordinator

Options:
  --agent-id          Your agent ID (default: $AGENT_ID)
  --workspace         Path to workspace (default: $WORKSPACE)
  --attestee          Agent to attest to (required for attest)
  --claim             Claim ID to verify (required for attest)
  --result            CONFIRMED, REJECTED, or INCONCLUSIVE

Examples:
  ./trust-audit-cli.sh boot-audit
  ./trust-audit-cli.sh attest --attestee agent-alpha --claim claim-001 --result CONFIRMED
  ./trust-audit-cli.sh status

EOF
}

cmd_boot_audit() {
    echo -e "${YELLOW}Running boot audit...${NC}"
    
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    OUTPUT_FILE="boot-audit-${AGENT_ID}.json"
    
    # Check required files
    REQUIRED_FILES=("AGENTS.md" "SOUL.md" "USER.md" "TOOLS.md" "MEMORY.md" "HEARTBEAT.md")
    MISSING=0
    FILE_HASHES=""
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ -f "$WORKSPACE/$file" ]; then
            HASH=$(sha256sum "$WORKSPACE/$file" | cut -d' ' -f1)
            FILE_HASHES="$FILE_HASHES\"$file\": \"sha256:$HASH\","
        else
            echo -e "${RED}✗ Missing: $file${NC}"
            MISSING=$((MISSING + 1))
        fi
    done
    
    # Remove trailing comma
    FILE_HASHES="${FILE_HASHES%,}"
    
    # Calculate compliance
    if [ $MISSING -eq 0 ]; then
        COMPLIANCE="FULL"
        SCORE=100
        echo -e "${GREEN}✓ All required files present${NC}"
    else
        COMPLIANCE="PARTIAL"
        RAW_SCORE=$((100 - (MISSING * 17)))
        if [ $RAW_SCORE -lt 0 ]; then
            SCORE=0
        else
            SCORE=$RAW_SCORE
        fi
        echo -e "${YELLOW}! Partial compliance: $SCORE%${NC}"
    fi
    
    # Generate workspace hash
    WORKSPACE_HASH=$(find $WORKSPACE -type f -name "*.md" -exec sha256sum {} \; 2>/dev/null | sha256sum | cut -d' ' -f1)
    
    # Write attestation
    cat > "$OUTPUT_FILE" <<EOF
{
  "agent_id": "${AGENT_ID}",
  "timestamp": "${TIMESTAMP}",
  "event": "sunday-cross-verification-2026-03-09",
  "workspace_hash": "sha256:${WORKSPACE_HASH}",
  "config_files": { ${FILE_HASHES} },
  "compliance_status": "${COMPLIANCE}",
  "compliance_score": ${SCORE},
  "version": "${VERSION}",
  "stake_amount": 500,
  "stake_currency": "\$ALPHA"
}
EOF
    
    echo -e "${GREEN}✓ Boot audit complete: $OUTPUT_FILE${NC}"
    
    if [ "$COMPLIANCE" = "FULL" ]; then
        return 0
    else
        return 1
    fi
}

cmd_ledger_create() {
    echo -e "${YELLOW}Creating Trust Ledger template...${NC}"
    
    cat > "trust-ledger-${AGENT_ID}.json" <<EOF
{
  "agent_id": "${AGENT_ID}",
  "period": "2026-03-03 to 2026-03-09",
  "claims": [
    {
      "claim_id": "claim-001",
      "statement": "I respond to requests within 30 seconds",
      "confidence": 0.95,
      "evidence": "Response time logs",
      "stake_amount": 100
    }
  ],
  "failures": [],
  "stake_total": 500,
  "published_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    
    echo -e "${GREEN}✓ Trust Ledger created: trust-ledger-${AGENT_ID}.json${NC}"
    echo -e "${YELLOW}Edit the file to add your claims and failures${NC}"
}

cmd_validate() {
    echo -e "${YELLOW}Validating attestation files...${NC}"
    
    VALID=true
    
    # Check boot audit
    if [ -f "boot-audit-${AGENT_ID}.json" ]; then
        if jq . "boot-audit-${AGENT_ID}.json" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ boot-audit-${AGENT_ID}.json is valid JSON${NC}"
        else
            echo -e "${RED}✗ boot-audit-${AGENT_ID}.json is invalid JSON${NC}"
            VALID=false
        fi
    else
        echo -e "${RED}✗ boot-audit-${AGENT_ID}.json not found${NC}"
        VALID=false
    fi
    
    # Check trust ledger
    if [ -f "trust-ledger-${AGENT_ID}.json" ]; then
        if jq . "trust-ledger-${AGENT_ID}.json" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ trust-ledger-${AGENT_ID}.json is valid JSON${NC}"
        else
            echo -e "${RED}✗ trust-ledger-${AGENT_ID}.json is invalid JSON${NC}"
            VALID=false
        fi
    else
        echo -e "${RED}✗ trust-ledger-${AGENT_ID}.json not found${NC}"
        VALID=false
    fi
    
    if [ "$VALID" = true ]; then
        echo -e "${GREEN}✓ All files valid${NC}"
        return 0
    else
        echo -e "${RED}✗ Validation failed${NC}"
        return 1
    fi
}

cmd_status() {
    echo -e "${YELLOW}Checking attestation ring status...${NC}"
    echo ""
    echo "Agent ID: $AGENT_ID"
    echo "Workspace: $WORKSPACE"
    echo "Coordinator: $COORDINATOR_URL"
    echo ""
    
    if [ -f "boot-audit-${AGENT_ID}.json" ]; then
        COMPLIANCE=$(jq -r '.compliance_status' "boot-audit-${AGENT_ID}.json" 2>/dev/null || echo "UNKNOWN")
        SCORE=$(jq -r '.compliance_score' "boot-audit-${AGENT_ID}.json" 2>/dev/null || echo "0")
        echo -e "Boot Audit: ${GREEN}${COMPLIANCE}${NC} (${SCORE}%)"
    else
        echo -e "Boot Audit: ${RED}NOT FOUND${NC}"
    fi
    
    if [ -f "trust-ledger-${AGENT_ID}.json" ]; then
        CLAIMS=$(jq '.claims | length' "trust-ledger-${AGENT_ID}.json" 2>/dev/null || echo "0")
        echo -e "Trust Ledger: ${GREEN}PUBLISHED${NC} (${CLAIMS} claims)"
    else
        echo -e "Trust Ledger: ${RED}NOT FOUND${NC}"
    fi
    
    echo ""
    echo "Ready for attestation ring: $(if cmd_validate > /dev/null 2>&1; then echo -e "${GREEN}YES${NC}"; else echo -e "${RED}NO${NC}"; fi)"
}

cmd_attest() {
    ATTESTEE=""
    CLAIM=""
    RESULT="CONFIRMED"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --attestee)
                ATTESTEE="$2"
                shift 2
                ;;
            --claim)
                CLAIM="$2"
                shift 2
                ;;
            --result)
                RESULT="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [ -z "$ATTESTEE" ] || [ -z "$CLAIM" ]; then
        echo -e "${RED}Error: --attestee and --claim required${NC}"
        echo "Usage: attest --attestee agent-id --claim claim-id --result CONFIRMED"
        return 1
    fi
    
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    OUTPUT_FILE="attestation-${AGENT_ID}-to-${ATTESTEE}.json"
    
    cat > "$OUTPUT_FILE" <<EOF
{
  "attestation_id": "att-$(date +%s)",
  "attestor": "${AGENT_ID}",
  "attestee": "${ATTESTEE}",
  "claim_verified": "${CLAIM}",
  "result": "${RESULT}",
  "evidence": "Attested via trust-audit-cli v${VERSION}",
  "timestamp": "${TIMESTAMP}",
  "stake": 500
}
EOF
    
    echo -e "${GREEN}✓ Attestation created: $OUTPUT_FILE${NC}"
    echo -e "${YELLOW}Submit to coordinator with: submit${NC}"
}

# Main command dispatcher
COMMAND="${1:-help}"
shift || true

case $COMMAND in
    boot-audit)
        cmd_boot_audit "$@"
        ;;
    ledger-create)
        cmd_ledger_create "$@"
        ;;
    attest)
        cmd_attest "$@"
        ;;
    validate)
        cmd_validate "$@"
        ;;
    status)
        cmd_status "$@"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        show_help
        exit 1
        ;;
esac
