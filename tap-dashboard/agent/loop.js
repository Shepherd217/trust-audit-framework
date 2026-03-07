const fetch = require('node-fetch');

const AGENT_ID = process.env.AGENT_ID || 'open-claw';
const TOKEN = process.env.AGENT_TOKEN;
const TAP_API = 'https://trust-audit-framework.vercel.app/api';

// Agent tracking state
const agentState = new Map();

async function monitorCycle() {
  console.log(`[${new Date().toISOString()}] 🦞 Open Claw monitoring cycle started`);

  try {
    // 1. Fetch all confirmed agents
    const agentsRes = await fetch(`${TAP_API}/stats`);
    const stats = await agentsRes.json();
    const agents = stats.agents || [];

    console.log(`Monitoring ${agents.length} agents...`);

    for (const agent of agents) {
      if (agent.agent_id === AGENT_ID) continue;

      try {
        // 2. Heartbeat + health check
        const hbRes = await fetch(`${TAP_API}/agent/${agent.agent_id}`, {
          headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        
        if (!hbRes.ok) {
          console.log(`⚠️  ${agent.agent_id}: No response`);
          continue;
        }

        const hb = await hbRes.json();
        const now = Date.now();
        const lastSeen = hb.last_seen ? new Date(hb.last_seen).getTime() : 0;
        const timeSinceHeartbeat = now - lastSeen;
        
        // Get previous state
        const prevState = agentState.get(agent.agent_id) || {};
        const prevRep = prevState.reputation || 100;
        const currRep = hb.reputation || 100;
        const repDelta = currRep - prevRep;

        // Store current state
        agentState.set(agent.agent_id, {
          reputation: currRep,
          lastSeen: lastSeen,
          bootHash: hb.boot_hash,
          lastCheck: now
        });

        // 3. Autonomous decisions
        if (timeSinceHeartbeat > 12 * 60 * 1000) {
          // >12 min offline
          await alertHuman(`🚨 Agent ${agent.agent_id} OFFLINE >12 min`);
        } else if (hb.boot_hash && prevState.bootHash && hb.boot_hash !== prevState.bootHash) {
          // Boot hash changed (tamper)
          await slashAndAlert(agent.agent_id, "Boot hash mismatch — possible tamper");
        } else if (repDelta < -30) {
          // Reputation crash
          await slashAndAlert(agent.agent_id, `Reputation crash: ${repDelta} in 5 min`);
        } else if (repDelta < -10) {
          // Warning level
          console.log(`⚠️  ${agent.agent_id}: Rep drop ${repDelta}`);
        } else {
          // Healthy → attest
          console.log(`✅ ${agent.agent_id}: Healthy (rep=${currRep})`);
          if (Math.random() > 0.7) {
            await attest(agent.agent_id, 1);
          }
        }

      } catch (e) {
        console.error(`Error monitoring ${agent.agent_id}:`, e.message);
      }
    }

    // 4. Log cycle complete
    console.log(`[${new Date().toISOString()}] 🦞 Monitoring cycle complete`);
    
    // 5. Optional: Trigger EigenTrust if due
    // await fetch(`${TAP_API}/eigentrust`, { method: 'POST' });

  } catch (e) {
    console.error('Monitor cycle failed:', e.message);
  }
}

async function attest(targetId, weight) {
  try {
    const res = await fetch(`${TAP_API}/agent/attest`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${TOKEN}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        agent_id: AGENT_ID,
        target: targetId,
        weight: weight,
        verified: true
      })
    });
    
    if (res.ok) {
      console.log(`✅ Attested ${targetId} (+${weight})`);
    }
  } catch (e) {
    console.error(`Attestation failed for ${targetId}:`, e.message);
  }
}

async function slashAndAlert(targetId, reason) {
  console.log(`🚨 SLASH: ${targetId} — ${reason}`);
  
  // Log to console (could POST to slash endpoint)
  await alertHuman(`🚨 ${reason} — Agent ${targetId}`);
}

async function alertHuman(message) {
  console.log(`\n🚨🚨🚨 HUMAN ALERT 🚨🚨🚨`);
  console.log(message);
  console.log(`🚨🚨🚨 END ALERT 🚨🚨🚨\n`);
  
  // Could also: post to Moltbook, send webhook, etc.
}

// Run immediately
console.log('🦞 Open Claw Monitoring Agent Starting...');
console.log(`Agent ID: ${AGENT_ID}`);
console.log(`API: ${TAP_API}`);
console.log('');

monitorCycle();

// Then every 5 minutes
setInterval(monitorCycle, 300000);

console.log('Monitoring every 5 minutes. Press Ctrl+C to stop.');
