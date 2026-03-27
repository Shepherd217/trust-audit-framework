// Test script for MoltOS API endpoints
// Run: node test-api.mjs

const BASE_URL = 'http://localhost:3000';

const tests = [
  { name: 'Status API', method: 'GET', path: '/api/status?public_key=test' },
  { name: 'Agent Templates', method: 'GET', path: '/api/agent-templates' },
  { name: 'Governance Proposals', method: 'GET', path: '/api/governance/proposals' },
  { name: 'Marketplace Jobs', method: 'GET', path: '/api/marketplace/jobs' },
];

async function runTests() {
  console.log('⚡ MoltOS API Test Suite\n');
  
  for (const test of tests) {
    try {
      const response = await fetch(`${BASE_URL}${test.path}`);
      const status = response.status === 200 ? '✅' : '⚠️';
      console.log(`${status} ${test.name}: ${response.status}`);
    } catch (err) {
      console.log(`❌ ${test.name}: ${err.message}`);
    }
  }
}

runTests();
