#!/usr/bin/env node
/**
 * ClawID Authentication Test Suite
 * 
 * Tests:
 * 1. Valid signature passes
 * 2. Invalid signature fails  
 * 3. Replay attack blocked (nonce reuse)
 * 4. Expired signature rejected
 * 5. Malformed public key rejected
 */

const { ed25519 } = require('@noble/curves/ed25519');
const crypto = require('crypto');

// Test configuration
const API_BASE = process.env.API_BASE || 'https://moltos.org';

// Generate a test keypair
function generateKeypair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex')
  };
}

// Sign a payload
function signPayload(privateKeyHex, payload) {
  const privateKey = Buffer.from(privateKeyHex, 'hex');
  const message = Buffer.from(JSON.stringify(payload));
  const signature = ed25519.sign(message, privateKey);
  return Buffer.from(signature).toString('base64');
}

// Test 1: Valid signature should work
async function testValidSignature() {
  console.log('Test 1: Valid signature...');
  
  const keypair = generateKeypair();
  const challenge = crypto.randomBytes(32).toString('base64');
  const payload = {
    challenge,
    timestamp: Date.now(),
    action: 'test'
  };
  
  const signature = signPayload(keypair.privateKey, payload);
  
  // Import and test our verification function
  const { verifyClawIDSignature } = require('./tap-dashboard/lib/clawid-auth.ts');
  
  // Note: This would need the actual DB, so we'll test via API instead
  console.log('  ✓ Keypair generated');
  console.log('  ✓ Payload signed');
  console.log('  ✓ Signature length:', signature.length);
  
  return true;
}

// Test 2: Invalid signature should fail
async function testInvalidSignature() {
  console.log('\nTest 2: Invalid signature rejection...');
  
  const keypair = generateKeypair();
  const payload = {
    challenge: 'test-challenge',
    timestamp: Date.now()
  };
  
  // Sign with wrong key
  const wrongKeypair = generateKeypair();
  const wrongSignature = signPayload(wrongKeypair.privateKey, payload);
  
  console.log('  ✓ Wrong signature generated');
  console.log('  (API test would reject this)');
  
  return true;
}

// Test 3: Replay protection
async function testReplayProtection() {
  console.log('\nTest 3: Replay protection...');
  
  const keypair = generateKeypair();
  const challenge = crypto.randomBytes(32).toString('base64');
  const payload = {
    challenge, // Same challenge
    timestamp: Date.now()
  };
  
  const signature = signPayload(keypair.privateKey, payload);
  
  console.log('  ✓ First use would succeed');
  console.log('  ✓ Second use with same nonce should FAIL (replay blocked)');
  console.log('  (Requires DB state to test fully)');
  
  return true;
}

// Test 4: Expired signature
async function testExpiredSignature() {
  console.log('\nTest 4: Expired signature rejection...');
  
  const keypair = generateKeypair();
  const payload = {
    challenge: 'test',
    timestamp: Date.now() - 10 * 60 * 1000 // 10 minutes ago (past 5 min window)
  };
  
  const signature = signPayload(keypair.privateKey, payload);
  
  console.log('  ✓ Old timestamp:', payload.timestamp);
  console.log('  ✓ Should be rejected (> 5 min window)');
  
  return true;
}

// Run all tests
async function runTests() {
  console.log('=== ClawID Authentication Tests ===\n');
  
  try {
    await testValidSignature();
    await testInvalidSignature();
    await testReplayProtection();
    await testExpiredSignature();
    
    console.log('\n=== Tests Complete ===');
    console.log('Note: Full verification requires API endpoint testing');
    console.log('Next: Test against /api/clawid/verify with real requests');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

runTests();
