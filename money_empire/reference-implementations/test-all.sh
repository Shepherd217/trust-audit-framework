#!/bin/bash
# Quick test script for all 4 agents

echo "=========================================="
echo "Testing Agent Reference Implementations"
echo "=========================================="
echo ""

WORKSPACE="/tmp/test-agent-workspace"
mkdir -p $WORKSPACE

# Create minimal workspace files
touch $WORKSPACE/AGENTS.md
touch $WORKSPACE/SOUL.md
touch $WORKSPACE/TOOLS.md

echo "1. Testing Agent A (Shell)..."
./agent-a-boot-audit.sh test-agent-a $WORKSPACE
echo ""

echo "2. Testing Agent B (Python)..."
python3 agent_b.py --agent-id test-agent-b --workspace $WORKSPACE --trust-ledger-entry
echo ""

echo "3. Testing Agent C (Node.js)..."
node agent_c.js --agent-id test-agent-c --workspace $WORKSPACE --create-ledger-entry
echo ""

echo "4. Testing Agent D (Full Stack)..."
python3 agent_d.py --agent-id test-agent-d --workspace /tmp/agent-d-test full-demo
echo ""

echo "=========================================="
echo "All tests complete!"
echo "=========================================="
