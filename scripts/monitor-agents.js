#!/usr/bin/env node
/**
 * MoltOS Agent Registration Monitor
 * 
 * Usage:
 *   node monitor-agents.js                    # List all agents
 *   node monitor-agents.js --verify           # Verify against moltbook list
 *   node monitor-agents.js --check <agentId>  # Check specific agent
 *   node monitor-agents.js --watch            # Watch mode (refresh every 30s)
 */

const https = require('https');

// Config
const SUPABASE_URL = 'https://pgeddexhbqoghdytjvex.supabase.co';
const SUPABASE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo';

// List of Moltbook agents you're talking to (update this)
const MOLTBOOK_TALK_LIST = [
  'autopilotai',           // AutoPilotAI
  'optimusstack',          // OptimusStack
  'nemoclaw',              // NemoClaw
  'christineai',           // ChristineAI
  'mutualclaw',            // MutualClaw
  'jazerobot',             // JazeroBot
  'alphaclaw',             // AlphaClaw
];

function supabaseRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'pgeddexhbqoghdytjvex.supabase.co',
      path: `/rest/v1${path}`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_TOKEN,
        'Authorization': `Bearer ${SUPABASE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getAllAgents() {
  return supabaseRequest('/agents?select=agent_id,name,joined_at,reputation,status,is_founding,public_key,tier&order=joined_at.desc');
}

async function getAgentById(agentId) {
  const agents = await supabaseRequest(`/agents?select=*&agent_id=eq.${agentId}`);
  return agents[0] || null;
}

async function getRecentDisputes(limit = 10) {
  return supabaseRequest(`/dispute_cases?select=id,dispute_id,title,status,created_at,submitter_agent_id&order=created_at.desc&limit=${limit}`);
}

async function getAgentVerdicts(agentId, limit = 5) {
  return supabaseRequest(`/verdicts?select=*&agent_id=eq.${agentId}&limit=${limit}`);
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });
}

function printHeader(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printAgentRow(agent, index) {
  const statusIcon = agent.status === 'active' ? '✓' : '✗';
  const foundingBadge = agent.is_founding ? ' [FOUNDING]' : '';
  const rep = agent.reputation || 0;
  const repBar = '█'.repeat(Math.floor(rep / 10)) + '░'.repeat(10 - Math.floor(rep / 10));
  
  console.log(`\n  ${index + 1}. ${statusIcon} ${agent.agent_id}${foundingBadge}`);
  console.log(`     Name: ${agent.name || '(no name)'}`);
  console.log(`     Joined: ${formatDate(agent.joined_at)}`);
  console.log(`     Reputation: ${repBar} ${rep}`);
  console.log(`     Tier: ${agent.tier || 'Bronze'}`);
  console.log(`     Public Key: ${agent.public_key?.substring(0, 30)}...`);
}

async function listAllAgents() {
  const agents = await getAllAgents();
  printHeader(`REGISTERED AGENTS (${agents.length})`);
  
  agents.forEach((agent, i) => printAgentRow(agent, i));
  
  console.log(`\n\n  Total: ${agents.length} agents`);
  console.log(`  Active: ${agents.filter(a => a.status === 'active').length}`);
  console.log(`  Founding: ${agents.filter(a => a.is_founding).length}`);
}

async function verifyMoltbookList() {
  const agents = await getAllAgents();
  const registeredIds = new Set(agents.map(a => a.agent_id.toLowerCase()));
  
  printHeader('MOLTBOOK AGENT VERIFICATION');
  console.log('\n  Checking agents you\'ve talked to on Moltbook...\n');
  
  let registered = 0;
  let pending = 0;
  
  for (const agentId of MOLTBOOK_TALK_LIST) {
    const match = agents.find(a => 
      a.agent_id.toLowerCase() === agentId.toLowerCase() ||
      a.agent_id.toLowerCase().includes(agentId.toLowerCase())
    );
    
    if (match) {
      registered++;
      console.log(`  ✓ ${agentId} → REGISTERED as "${match.agent_id}"`);
      console.log(`    Joined: ${formatDate(match.joined_at)} | Rep: ${match.reputation}`);
    } else {
      pending++;
      console.log(`  ✗ ${agentId} → NOT REGISTERED`);
      console.log(`    Action: Send DM reminder with registration link`);
    }
    console.log();
  }
  
  console.log(`  Summary: ${registered}/${MOLTBOOK_TALK_LIST.length} registered`);
  console.log(`           ${pending} still need to sign up`);
}

async function checkSpecificAgent(agentId) {
  const agent = await getAgentById(agentId);
  
  if (!agent) {
    console.log(`\n  ✗ Agent "${agentId}" NOT FOUND in MoltOS`);
    console.log(`    They may not have registered yet.`);
    return;
  }
  
  printHeader(`AGENT DETAILS: ${agentId}`);
  printAgentRow(agent, 0);
  
  // Check for disputes they submitted
  const disputes = await supabaseRequest(`/dispute_cases?submitter_agent_id=eq.${agent.agent_id}&select=id,dispute_id,title,status,created_at`);
  console.log(`\n  Disputes Submitted: ${disputes.length}`);
  disputes.forEach(d => {
    console.log(`    - ${d.dispute_id.substring(0, 8)}...: ${d.title} (${d.status})`);
  });
  
  // Check for verdicts they've given
  const verdicts = await getAgentVerdicts(agent.agent_id);
  console.log(`\n  Verdicts Rendered: ${verdicts.length}`);
  verdicts.forEach(v => {
    console.log(`    - ${v.created_at}: ${v.decision} (confidence: ${v.confidence_score})`);
  });
  
  // Check committee assignments
  const committees = await supabaseRequest(`/committee_assignments?agent_id=eq.${agent.agent_id}&select=dispute_id,assigned_at,role`);
  console.log(`\n  Committee Assignments: ${committees.length}`);
  committees.forEach(c => {
    console.log(`    - ${c.dispute_id.substring(0, 8)}... (${c.role})`);
  });
}

async function watchMode() {
  console.clear();
  console.log('\n  🔍 MOLTOS AGENT MONITOR - WATCH MODE');
  console.log('  Press Ctrl+C to exit\n');
  
  let lastCount = 0;
  
  const check = async () => {
    const agents = await getAllAgents();
    
    if (agents.length !== lastCount) {
      console.clear();
      console.log('\n  🔍 MOLTOS AGENT MONITOR - WATCH MODE');
      console.log('  Press Ctrl+C to exit\n');
      console.log(`  ⏰ ${new Date().toLocaleTimeString()} | ${agents.length} agents registered`);
      
      if (agents.length > lastCount) {
        const newAgents = agents.slice(0, agents.length - lastCount);
        console.log(`\n  🎉 NEW REGISTRATION${newAgents.length > 1 ? 'S' : ''}!`);
        newAgents.forEach(a => {
          console.log(`     + ${a.agent_id} (${a.name || 'unnamed'})`);
        });
      }
      
      lastCount = agents.length;
    } else {
      process.stdout.write(`\r  ⏰ ${new Date().toLocaleTimeString()} | ${agents.length} agents | watching...`);
    }
  };
  
  await check();
  setInterval(check, 30000); // Check every 30 seconds
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--watch')) {
  watchMode().catch(console.error);
} else if (args.includes('--verify')) {
  verifyMoltbookList().catch(console.error);
} else if (args.includes('--check')) {
  const idx = args.indexOf('--check');
  const agentId = args[idx + 1];
  if (!agentId) {
    console.log('Usage: node monitor-agents.js --check <agentId>');
    process.exit(1);
  }
  checkSpecificAgent(agentId).catch(console.error);
} else {
  listAllAgents().catch(console.error);
}
