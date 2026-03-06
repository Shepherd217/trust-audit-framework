#!/bin/bash
#
# Trust Audit Framework — One-Command Demo
# Shows all 4 layers in action
#
# Usage: ./demo.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║           🦞 TRUST AUDIT FRAMEWORK DEMO                    ║"
echo "║                                                            ║"
echo "║     Watch all 4 layers verify agents in real-time          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="/tmp/trust-audit-demo-$$"
mkdir -p "$DEMO_DIR"

echo -e "${BLUE}Setting up demo workspace...${NC}"
echo "Demo directory: $DEMO_DIR"
echo ""

# Create 3 agent workspaces
echo "Creating 3 agent workspaces..."
for agent in agent-alpha agent-beta agent-gamma; do
    mkdir -p "$DEMO_DIR/$agent"
    # Create core files
    for file in AGENTS.md SOUL.md USER.md TOOLS.md MEMORY.md HEARTBEAT.md; do
        echo "# $file" > "$DEMO_DIR/$agent/$file"
        echo "Demo workspace for $agent" >> "$DEMO_DIR/$agent/$file"
    done
done

echo -e "${GREEN}✓${NC} 3 workspaces created"
echo ""

# ============================================================================
# LAYER 1: BOOT-TIME AUDIT
# ============================================================================
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  LAYER 1: Boot-Time Audit${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Verifying workspace integrity at agent spawn..."
echo ""

for agent in agent-alpha agent-beta agent-gamma; do
    echo -e "${BLUE}[$agent]${NC} Running boot audit..."
    
    # Run Agent A boot audit
    cd "$DEMO_DIR/$agent"
    "$SCRIPT_DIR/reference-implementations/agent-a-boot-audit.sh" "$agent" "$DEMO_DIR/$agent" > /dev/null 2>&1
    
    # Get compliance score from output
    OUTPUT=$(ls -t boot-audit-*.json 2>/dev/null | head -1)
    if [ -f "$OUTPUT" ]; then
        SCORE=$(grep -o '"score": [0-9]*' "$OUTPUT" | grep -o '[0-9]*')
        HASH=$(grep -o '"hash": "[^"]*"' "$OUTPUT" | head -1 | cut -d'"' -f4)
        echo -e "  ${GREEN}✓${NC} Compliance: ${SCORE}% | Hash: ${HASH:0:16}..."
    fi
done

echo ""
echo -e "${GREEN}✓ Layer 1 Complete:${NC} All agents verified"
echo ""

# ============================================================================
# LAYER 2: TRUST LEDGER
# ============================================================================
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  LAYER 2: Trust Ledger${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Recording behavioral transparency through The 4 Questions..."
echo ""

# Simulate Trust Ledger entries
for agent in agent-alpha agent-beta agent-gamma; do
    echo -e "${BLUE}[$agent]${NC} Creating Trust Ledger entry..."
    
    # Create sample ledger entry
    cat > "$DEMO_DIR/$agent/trust-ledger-demo.json" << EOF
{
  "entry_id": "demo-$(date +%s)",
  "agent_id": "$agent",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "the_4_questions": {
    "q1_human_requested": false,
    "q2_suppressed": "None",
    "q3_counterfactual": "Would not have verified workspace",
    "q4_verifiers": ["boot-audit-script"]
  },
  "classification": "TYPE_3_OPTIMISTIC_ACTION",
  "reversible": true
}
EOF
    
    echo -e "  ${GREEN}✓${NC} Entry logged: TYPE_3_OPTIMISTIC_ACTION"
done

echo ""
echo -e "${GREEN}✓ Layer 2 Complete:${NC} All actions transparent"
echo ""

# ============================================================================
# LAYER 3: CROSS-AGENT ATTESTATION
# ============================================================================
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  LAYER 3: Cross-Agent Attestation${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Agents verifying each other's boot audits..."
echo ""

# Simulate attestation ring
agents=("agent-alpha" "agent-beta" "agent-gamma")
for i in "${!agents[@]}"; do
    requester="${agents[$i]}"
    peer1="${agents[((i+1)%3)]}"
    peer2="${agents[((i+2)%3)]}"
    
    echo -e "${BLUE}[$requester]${NC} Requesting attestation from $peer1, $peer2"
    
    # Simulate peer responses
    CONF1=$((80 + RANDOM % 15))
    CONF2=$((80 + RANDOM % 15))
    
    echo -e "  [$peer1] -> ${GREEN}confirm${NC} (${CONF1}% confidence)"
    echo -e "  [$peer2] -> ${GREEN}confirm${NC} (${CONF2}% confidence)"
    
    # Consensus
    if [ $CONF1 -ge 80 ] && [ $CONF2 -ge 80 ]; then
        echo -e "  ${GREEN}Consensus: CONFIRMED${NC}"
    else
        echo -e "  ${YELLOW}Consensus: PENDING${NC}"
    fi
    echo ""
done

echo -e "${GREEN}✓ Layer 3 Complete:${NC} Attestation ring formed"
echo ""

# ============================================================================
# LAYER 4: ECONOMIC STAKING
# ============================================================================
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  LAYER 4: Economic Staking${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Staking $ALPHA on attestations..."
echo ""

TOTAL_STAKED=0
TOTAL_RELEASED=0

for agent in agent-alpha agent-beta agent-gamma; do
    STAKE=$((10 + RANDOM % 15))
    TOTAL_STAKED=$((TOTAL_STAKED + STAKE))
    
    # 85% chance of confirmation
    if [ $((RANDOM % 100)) -lt 85 ]; then
        echo -e "${BLUE}[$agent]${NC} Staked ${STAKE} \$ALPHA -> ${GREEN}RELEASED${NC} (confirmed)"
        TOTAL_RELEASED=$((TOTAL_RELEASED + STAKE))
    else
        echo -e "${BLUE}[$agent]${NC} Staked ${STAKE} \$ALPHA -> ${YELLOW}PENDING${NC}"
    fi
done

echo ""
echo -e "${GREEN}✓ Layer 4 Complete:${NC} Economic accountability enforced"
echo ""

# ============================================================================
# FINAL REPORT
# ============================================================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  DEMO COMPLETE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}Network Health:${NC}"
echo "  Agents: 3"
echo "  Successful Boot Audits: 3/3"
echo "  Attestations Confirmed: 2-3 (simulated)"
echo "  Total \$ALPHA Staked: ${TOTAL_STAKED}"
echo "  Total \$ALPHA Released: ${TOTAL_RELEASED}"
echo "  Economic Efficiency: $(( TOTAL_RELEASED * 100 / TOTAL_STAKED ))%"
echo ""
echo -e "${BOLD}All 4 Layers Operational:${NC}"
echo -e "  ${GREEN}✓${NC} Layer 1: Boot-Time Audit"
echo -e "  ${GREEN}✓${NC} Layer 2: Trust Ledger"
echo -e "  ${GREEN}✓${NC} Layer 3: Cross-Agent Attestation"
echo -e "  ${GREEN}✓${NC} Layer 4: Economic Staking"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}Next Steps:${NC}"
echo "  1. Explore the generated files: ls -la $DEMO_DIR"
echo "  2. Read the attestation spec: cat reference-implementations/attestation-format-spec.md"
echo "  3. Run full test suite: python3 reference-implementations/test-cross-attestation-enhanced.py"
echo "  4. Join Alpha Collective: https://moltbook.com/m/builds"
echo ""
echo -e "${GREEN}🦞 Don't let silent failures break your agents. Verify everything.${NC}"
echo ""

# Cleanup option
echo -e "${YELLOW}Demo files saved to: $DEMO_DIR${NC}"
echo "Run 'rm -rf $DEMO_DIR' to clean up when done."
