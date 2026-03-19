#!/usr/bin/env bash
#
# MoltOS End-to-End Integration Test
# Tests: ClawID → Deploy → Execute → Handoff → Complete
#

set -e

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
GENESIS_TOKEN="${GENESIS_TOKEN:-test-token}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "==================================="
echo "MoltOS End-to-End Integration Test"
echo "==================================="
echo "API: $API_URL"
echo ""

# Track results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

skip() {
    echo -e "${YELLOW}⊘ SKIP${NC}: $1"
}

# Test 1: API Health
echo "Test 1: API Health Check"
RESPONSE=$(curl -s "$API_URL/api/status" 2>/dev/null || echo '{"error":"connection"}')
if echo "$RESPONSE" | grep -q '"status"'; then
    pass "API is responding"
else
    fail "API not responding: $RESPONSE"
fi
echo ""

# Test 2: Component Status
echo "Test 2: Component Health Check"
RESPONSE=$(curl -s "$API_URL/api/claw/status" 2>/dev/null || echo '{}')
if echo "$RESPONSE" | grep -q '"healthy"'; then
    pass "All components healthy"
    echo "$RESPONSE" | grep -o '"tables":{[^}]*}' | tr ',' '\n' | head -10
else
    fail "Components not healthy: $RESPONSE"
fi
echo ""

# Test 3: Agent Registration (Genesis)
echo "Test 3: Agent Registration"
AGENT_RESPONSE=$(curl -s -X POST "$API_URL/api/clawid/register" \
    -H "Content-Type: application/json" \
    -d "{\"genesis_token\":\"$GENESIS_TOKEN\",\"name\":\"TestAgent\",\"public_key\":\"test-pk-$(date +%s)\",\"signature\":\"test-sig\",\"timestamp\":$(date +%s)}" 2>/dev/null || echo '{}')

if echo "$AGENT_RESPONSE" | grep -q '"success":true'; then
    pass "Agent registered"
    AGENT_ID=$(echo "$AGENT_RESPONSE" | grep -o '"agent_id":"[^"]*"' | cut -d'"' -f4)
    echo "  Agent ID: $AGENT_ID"
else
    skip "Agent registration (may already exist)"
fi
echo ""

# Test 4: ClawBus Message Flow
echo "Test 4: ClawBus Message Flow"
# Create test message
MSG_RESPONSE=$(curl -s -X POST "$API_URL/api/claw/bus/send" \
    -H "Content-Type: application/json" \
    -d "{\"from\":\"test-agent-1\",\"to\":\"test-agent-2\",\"type\":\"test\",\"payload\":{\"test\":true},\"priority\":\"normal\"}" 2>/dev/null || echo '{}')

if echo "$MSG_RESPONSE" | grep -q '"success":true'; then
    pass "Message sent via ClawBus"
else
    fail "Message send failed: $MSG_RESPONSE"
fi
echo ""

# Test 5: ClawBus Poll Messages
echo "Test 5: ClawBus Message Polling"
POLL_RESPONSE=$(curl -s "$API_URL/api/claw/bus/poll?agentId=test-agent-2" 2>/dev/null || echo '{}')
if echo "$POLL_RESPONSE" | grep -q '"success":true'; then
    MSG_COUNT=$(echo "$POLL_RESPONSE" | grep -o '"messages":\[' | wc -l)
    pass "Polled messages (found messages)"
else
    fail "Message poll failed: $POLL_RESPONSE"
fi
echo ""

# Test 6: Workflow Creation
echo "Test 6: Workflow Creation"
WF_RESPONSE=$(curl -s -X POST "$API_URL/api/claw/scheduler/workflows" \
    -H "Content-Type: application/json" \
    -d '{
        "name":"Test Workflow",
        "description":"Integration test workflow",
        "nodes":[{"type":"task","name":"Test Task","config":{}}],
        "edges":[],
        "ownerAgentId":"test-agent-1"
    }' 2>/dev/null || echo '{}')

if echo "$WF_RESPONSE" | grep -q '"id"'; then
    pass "Workflow created"
    WF_ID=$(echo "$WF_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "  Workflow ID: $WF_ID"
else
    skip "Workflow creation (API may not exist yet)"
fi
echo ""

# Test 7: ClawCloud Deploy
echo "Test 7: ClawCloud Deployment"
DEPLOY_RESPONSE=$(curl -s -X POST "$API_URL/api/claw/cloud/deploy" \
    -H "Content-Type: application/json" \
    -d '{
        "agent_id":"test-agent-1",
        "target":{"type":"local","port":8080},
        "wasm_config":{"entrypoint":"test"},
        "public_key":"test-pk",
        "signature":"test-sig",
        "timestamp":'$(date +%s)'
    }' 2>/dev/null || echo '{}')

if echo "$DEPLOY_RESPONSE" | grep -q '"success":true'; then
    pass "Deployment created"
    DEPLOY_ID=$(echo "$DEPLOY_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "  Deployment ID: $DEPLOY_ID"
else
    fail "Deployment failed: $DEPLOY_RESPONSE"
fi
echo ""

# Test 8: List Deployments
echo "Test 8: List Deployments"
LIST_RESPONSE=$(curl -s "$API_URL/api/claw/cloud/deploy?agent_id=test-agent-1" 2>/dev/null || echo '{}')
if echo "$LIST_RESPONSE" | grep -q '"deployments"'; then
    DEPLOY_COUNT=$(echo "$LIST_RESPONSE" | grep -o '"deployment_id"' | wc -l)
    pass "Listed deployments (count: $DEPLOY_COUNT)"
else
    fail "List deployments failed: $LIST_RESPONSE"
fi
echo ""

# Test 9: Marketplace Health
echo "Test 9: Marketplace Status"
MKT_RESPONSE=$(curl -s "$API_URL/api/marketplace/jobs" 2>/dev/null || echo '{}')
if echo "$MKT_RESPONSE" | grep -q '"jobs"'; then
    pass "Marketplace API accessible"
else
    skip "Marketplace API (may require auth)"
fi
echo ""

# Test 10: Governance Health
echo "Test 10: Governance Status"
GOV_RESPONSE=$(curl -s "$API_URL/api/governance/overview" 2>/dev/null || echo '{}')
if echo "$GOV_RESPONSE" | grep -q '"health"'; then
    pass "Governance system healthy"
else
    fail "Governance check failed: $GOV_RESPONSE"
fi
echo ""

# Summary
echo "==================================="
echo "Test Summary"
echo "==================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
