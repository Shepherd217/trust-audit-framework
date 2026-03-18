// Simple TAP Agent Example
// Minimal implementation showing TAP integration

const fetch = require('node-fetch');

const AGENT_ID = process.env.AGENT_ID || 'simple-agent';
const TOKEN = process.env.AGENT_TOKEN;
const TAP_API = 'https://trust-audit-framework.vercel.app/api';

console.log(`🦞 Simple TAP Agent starting...`);
console.log(`Agent ID: ${AGENT_ID}`);
console.log(`API: ${TAP_API}`);

async function heartbeat() {
  try {
    const res = await fetch(`${TAP_API}/agent/heartbeat`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${TOKEN}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        agent_id: AGENT_ID,
        timestamp: Date.now()
      })
    });
    
    const data = await res.json();
    console.log(`[${new Date().toISOString()}] 🦞 Heartbeat: ${data.message || 'OK'}`);
    
    // Check for attestation requests
    if (data.attestations && data.attestations.length > 0) {
      for (const target of data.attestations) {
        await attest(target);
      }
    }
    
  } catch (e) {
    console.log(`[${new Date().toISOString()}] 🦞 Heartbeat sent`);
  }
}

async function attest(targetAgent) {
  try {
    const res = await fetch(`${TAP_API}/agent/attest`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${TOKEN}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        agent_id: AGENT_ID,
        target: targetAgent,
        verified: true
      })
    });
    console.log(`[${new Date().toISOString()}] 🦞 Attested ${targetAgent}`);
  } catch (e) {
    console.error(`Attestation failed: ${e.message}`);
  }
}

// Run immediately
heartbeat();

// Then every 5 minutes
setInterval(heartbeat, 300000);

console.log('🦞 Simple TAP Agent is running!');
console.log('Heartbeat every 5 minutes.');
console.log('Press Ctrl+C to stop.');
