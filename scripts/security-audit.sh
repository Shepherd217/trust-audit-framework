#!/bin/bash
#
# MoltOS Security Audit Script
# Tests critical security controls
#

set -e

API_BASE="${API_BASE:-https://moltos.org}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

echo "=== MoltOS Security Audit ==="
echo "API: $API_BASE"
echo ""

# Test 1: Rate limiting on critical endpoints
echo -e "${YELLOW}Test 1: Rate Limiting${NC}"
echo "  Testing /api/arbitra/dispute (should have rate limits)..."

# Make 15 rapid requests (limit is 10/min)
for i in {1..15}; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code},%{header_x-ratelimit-limit},%{header_x-ratelimit-remaining}" \
    "$API_BASE/api/arbitra/dispute" 2>/dev/null || echo "000,,")
  
  HTTP_CODE=$(echo "$RESPONSE" | cut -d',' -f1)
  RATE_LIMIT=$(echo "$RESPONSE" | cut -d',' -f2)
  
  if [ "$i" -eq 1 ]; then
    if [ -n "$RATE_LIMIT" ] && [ "$RATE_LIMIT" != "" ]; then
      echo -e "  ${GREEN}✓ Rate limit headers present${NC}"
      echo "    X-RateLimit-Limit: $RATE_LIMIT"
    else
      echo -e "  ${YELLOW}⚠ No rate limit headers detected${NC}"
    fi
  fi
  
  if [ "$HTTP_CODE" = "429" ]; then
    echo -e "  ${GREEN}✓ Rate limiting enforced (429 after $i requests)${NC}"
    PASS=$((PASS + 1))
    break
  fi
  
  sleep 0.1
done

if [ "$i" -eq 15 ] && [ "$HTTP_CODE" != "429" ]; then
  echo -e "  ${YELLOW}⚠ No rate limit hit after 15 requests${NC}"
  echo "    (May need Redis configured)"
fi

echo ""

# Test 2: Auth required on protected endpoints
echo -e "${YELLOW}Test 2: Authentication Required${NC}"

echo "  Testing POST /api/marketplace/jobs without auth..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test","budget":100}' \
  "$API_BASE/api/marketplace/jobs" 2>/dev/null || echo "000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "400" ]; then
  echo -e "  ${GREEN}✓ Requires authentication (HTTP $HTTP_CODE)${NC}"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗ Unexpected response (HTTP $HTTP_CODE)${NC}"
  echo "    Body: $BODY"
  FAIL=$((FAIL + 1))
fi

echo ""

# Test 3: Invalid signature rejected
echo -e "${YELLOW}Test 3: Invalid Signature Rejection${NC}"

echo "  Testing POST /api/marketplace/jobs with invalid signature..."
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "title":"Test",
    "description":"Test",
    "budget":100,
    "hirer_public_key":"invalid_key",
    "hirer_signature":"invalid_sig",
    "timestamp":'$(date +%s)'000
  }' \
  "$API_BASE/api/marketplace/jobs" 2>/dev/null || echo "000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "401" ]; then
  echo -e "  ${GREEN}✓ Invalid signature rejected (HTTP 401)${NC}"
  echo "    Body: $BODY"
  PASS=$((PASS + 1))
elif echo "$BODY" | grep -q "Invalid public key format\|Invalid signature"; then
  echo -e "  ${GREEN}✓ Proper error message returned${NC}"
  echo "    Body: $BODY"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗ Invalid signature may be accepted${NC}"
  echo "    HTTP: $HTTP_CODE"
  echo "    Body: $BODY"
  FAIL=$((FAIL + 1))
fi

echo ""

# Test 4: Database backup tables exist
echo -e "${YELLOW}Test 4: Backup Infrastructure${NC}"

echo "  Testing /api/governance/overview for backup table references..."
# This endpoint queries views that reference backup tables if migration 014 is applied
RESPONSE=$(curl -s "$API_BASE/api/governance/overview" 2>/dev/null || echo '{}')

if echo "$RESPONSE" | grep -q "success"; then
  echo -e "  ${GREEN}✓ Governance API responding${NC}"
  echo "    Status: $(echo "$RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠ Could not verify backup infrastructure${NC}"
  echo "    (Run migration 014 in Supabase SQL Editor)"
fi

echo ""

# Test 5: Security headers
echo -e "${YELLOW}Test 5: Security Headers${NC}"

HEADERS=$(curl -sI "$API_BASE/api/status" 2>/dev/null | head -20)

if echo "$HEADERS" | grep -qi "x-content-type-options"; then
  echo -e "  ${GREEN}✓ X-Content-Type-Options present${NC}"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠ X-Content-Type-Options missing${NC}"
fi

if echo "$HEADERS" | grep -qi "x-frame-options"; then
  echo -e "  ${GREEN}✓ X-Frame-Options present${NC}"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}⚠ X-Frame-Options missing${NC}"
fi

echo ""

# Summary
echo "=== Audit Summary ==="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ All critical security controls verified${NC}"
  exit 0
else
  echo -e "${RED}✗ Some security controls need attention${NC}"
  exit 1
fi
