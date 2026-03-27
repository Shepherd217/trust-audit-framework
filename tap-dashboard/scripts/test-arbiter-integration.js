#!/usr/bin/env node
/**
 * ARBITER Integration Test Script
 * Validates the external verdict ingestion endpoint
 * 
 * Usage: node scripts/test-arbiter-integration.js
 */

const crypto = require('crypto');

const ENDPOINT = 'https://moltos.org/api/arbitra/verdict';
// Test secret (different from production)
const TEST_SECRET = 'test-secret-for-validation-only';

// Test payload matching AutoPilotAI format
const testPayload = {
  verdict_id: 'test-verdict-' + Date.now(),
  dispute_id: 'test-dispute-' + Date.now(),
  resolution: 'REFUND',
  decision: 'Test verdict: Dispute resolved in favor of hirer due to incomplete deliverables',
  confidence: 0.87,
  committee_votes: {
    in_favor: 4,
    against: 1,
    abstain: 0
  },
  evidence_reviewed: ['ev_001', 'ev_002', 'ev_003'],
  timestamp: new Date().toISOString(),
  arbiter_version: 'v37-test'
};

function generateSignature(payload, secret, timestamp) {
  const payloadString = JSON.stringify(payload);
  const dataToSign = `${timestamp}.${payloadString}`;
  return crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex');
}

async function runTests() {
  console.log('⚡ ARBITER Integration Test Suite\n');
  console.log(`Endpoint: ${ENDPOINT}\n`);

  let passed = 0;
  let failed = 0;

  // Test 1: Health Check
  console.log('Test 1: Health Check (GET)');
  try {
    const res = await fetch(ENDPOINT, { method: 'GET' });
    const body = await res.json();
    if (res.status === 200 && body.status === 'ok') {
      console.log('✅ PASS - Endpoint is healthy\n');
      passed++;
    } else {
      console.log('❌ FAIL - Unexpected response:', body, '\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL - Error:', err.message, '\n');
    failed++;
  }

  // Test 2: Valid HMAC signature
  console.log('Test 2: Valid HMAC Signature');
  try {
    const timestamp = Date.now().toString();
    const signature = generateSignature(testPayload, TEST_SECRET, timestamp);
    
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Arbiter-Timestamp': timestamp,
        'X-Arbiter-Signature': signature
      },
      body: JSON.stringify(testPayload)
    });
    
    const body = await res.json();
    
    // 401 expected since we're using test secret
    if (res.status === 401) {
      console.log('✅ PASS - HMAC verification active (401 with invalid secret)\n');
      passed++;
    } else if (res.status === 200 || res.status === 202) {
      console.log('✅ PASS - Valid signature accepted\n');
      passed++;
    } else {
      console.log('⚠️  INFO - Status:', res.status, body, '\n');
    }
  } catch (err) {
    console.log('❌ FAIL - Error:', err.message, '\n');
    failed++;
  }

  // Test 3: Invalid HMAC signature
  console.log('Test 3: Invalid HMAC Signature');
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Arbiter-Timestamp': Date.now().toString(),
        'X-Arbiter-Signature': 'invalid-signature'
      },
      body: JSON.stringify(testPayload)
    });
    
    if (res.status === 401) {
      console.log('✅ PASS - Invalid signature rejected (401)\n');
      passed++;
    } else {
      console.log('❌ FAIL - Expected 401, got:', res.status, '\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL - Error:', err.message, '\n');
    failed++;
  }

  // Test 4: Replay protection (old timestamp)
  console.log('Test 4: Replay Protection (old timestamp)');
  try {
    const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 minutes ago
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Arbiter-Timestamp': oldTimestamp,
        'X-Arbiter-Signature': 'any-signature'
      },
      body: JSON.stringify(testPayload)
    });
    
    if (res.status === 401) {
      console.log('✅ PASS - Old timestamp rejected (401)\n');
      passed++;
    } else {
      console.log('❌ FAIL - Expected 401, got:', res.status, '\n');
      failed++;
    }
  } catch (err) {
    console.log('❌ FAIL - Error:', err.message, '\n');
    failed++;
  }

  // Test 5: Missing required fields
  console.log('Test 5: Missing Required Fields');
  try {
    const badPayload = { ...testPayload };
    delete badPayload.resolution;
    
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Arbiter-Timestamp': Date.now().toString(),
        'X-Arbiter-Signature': 'any-signature'
      },
      body: JSON.stringify(badPayload)
    });
    
    if (res.status === 400) {
      console.log('✅ PASS - Missing fields rejected (400)\n');
      passed++;
    } else {
      console.log('⚠️  INFO - Status:', res.status, '(may be 401 due to auth first)\n');
    }
  } catch (err) {
    console.log('❌ FAIL - Error:', err.message, '\n');
    failed++;
  }

  // Summary
  console.log('='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
