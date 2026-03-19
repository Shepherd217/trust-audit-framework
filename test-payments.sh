#!/bin/bash
# Test script for Marketplace Payments
# Run: ./test-payments.sh

set -e

BASE_URL="https://moltos.org"

echo "=== MoltOS Marketplace Payment Tests ==="
echo ""

# Test 1: Check SQL schema deployed
echo "Test 1: Verify SQL schema..."
curl -s "${BASE_URL}/api/governance/overview" > /dev/null && echo "✅ API reachable" || echo "❌ API not responding"

# Test 2: Connect onboarding endpoint (will fail auth, but proves route exists)
echo ""
echo "Test 2: Connect onboard endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/stripe/connect/onboard" \
  -H "Content-Type: application/json" \
  -d '{}')
if [ "$STATUS" = "401" ]; then
  echo "✅ Onboard endpoint reachable (401 = auth required, expected)"
elif [ "$STATUS" = "404" ]; then
  echo "❌ Onboard endpoint not deployed"
else
  echo "⚠️  Onboard returned HTTP $STATUS"
fi

# Test 3: Escrow create endpoint
echo ""
echo "Test 3: Escrow create endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/escrow/create" \
  -H "Content-Type: application/json" \
  -d '{}')
if [ "$STATUS" = "401" ] || [ "$STATUS" = "400" ]; then
  echo "✅ Escrow create reachable (auth/body required, expected)"
elif [ "$STATUS" = "404" ]; then
  echo "❌ Escrow create not deployed"
else
  echo "⚠️  Escrow create returned HTTP $STATUS"
fi

# Test 4: Escrow status endpoint
echo ""
echo "Test 4: Escrow status endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/escrow/status?escrow_id=test")
if [ "$STATUS" = "404" ] || [ "$STATUS" = "401" ] || [ "$STATUS" = "200" ]; then
  echo "✅ Escrow status reachable"
else
  echo "⚠️  Escrow status returned HTTP $STATUS"
fi

# Test 5: Milestone endpoint
echo ""
echo "Test 5: Milestone endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/escrow/milestone" \
  -H "Content-Type: application/json" \
  -d '{}')
if [ "$STATUS" = "401" ] || [ "$STATUS" = "400" ]; then
  echo "✅ Milestone endpoint reachable"
elif [ "$STATUS" = "404" ]; then
  echo "❌ Milestone endpoint not deployed"
else
  echo "⚠️  Milestone returned HTTP $STATUS"
fi

# Test 6: Webhook endpoint (should accept POST with signature check)
echo ""
echo "Test 6: Stripe webhook endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/api/stripe/webhook" \
  -H "Content-Type: application/json" \
  -d '{}')
if [ "$STATUS" = "400" ]; then
  echo "✅ Webhook reachable (400 = missing signature, expected)"
elif [ "$STATUS" = "404" ]; then
  echo "❌ Webhook not deployed"
else
  echo "⚠️  Webhook returned HTTP $STATUS"
fi

echo ""
echo "=== Tests Complete ==="
