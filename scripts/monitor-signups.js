/**
 * MoltOS Agent Signup Monitor
 * 
 * Run this as a cron job to get notified when new agents register.
 * 
 * Usage:
 *   node monitor-signups.js                    Check once
 *   node monitor-signups.js --init             Initialize state file
 *   node monitor-signups.js --daemon           Run continuously (for cron)
 * 
 * Setup with cron every 5 minutes:
 *   0,5,10,15,20,25,30,35,40,45,50,55 * * * * cd /path/to/moltos && node scripts/monitor-signups.js --daemon
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Config
const SUPABASE_URL = 'https://pgeddexhbqoghdytjvex.supabase.co';
const SUPABASE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZWRkZXhoYnFvZ2hkeXRqdmV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTU2OSwiZXhwIjoyMDg4NDAxNTY5fQ.Eh8eX8JxN3iHghJIB279ygf75F9tY5RzEQYeEXL-4Mo';
const STATE_FILE = path.join(__dirname, '.signup-monitor-state.json');

// Notification settings
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || ''; // Optional
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL || '';     // Optional

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

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading state:', e.message);
  }
  return { lastCheck: null, knownAgents: [] };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Error saving state:', e.message);
  }
}

function formatAgent(agent) {
  const tierEmoji = {
    'Gold': '🥇',
    'Silver': '🥈',
    'Bronze': '🥉'
  }[agent.tier] || '🆕';
  
  const foundingEmoji = agent.is_founding ? '⭐' : '';
  
  return `${tierEmoji} ${agent.name || agent.agent_id} ${foundingEmoji}
   └─ Reputation: ${agent.reputation || 0} | Tier: ${agent.tier || 'Bronze'}
   └─ Joined: ${new Date(agent.joined_at).toLocaleString()}`;
}

async function notifyDiscord(message) {
  if (!DISCORD_WEBHOOK) return;
  
  const payload = JSON.stringify({ content: message });
  
  return new Promise((resolve, reject) => {
    const url = new URL(DISCORD_WEBHOOK);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 204) resolve(true);
      else reject(new Error(`Discord webhook failed: ${res.statusCode}`));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function checkForNewSignups() {
  console.log(`[${new Date().toISOString()}] Checking for new signups...`);
  
  const state = loadState();
  const agents = await supabaseRequest('/agents?select=agent_id,name,reputation,tier,is_founding,joined_at,status&order=joined_at.desc');
  
  const currentAgentIds = agents.map(a => a.agent_id);
  const knownAgentIds = state.knownAgents;
  
  // Find new agents
  const newAgents = agents.filter(a => !knownAgentIds.includes(a.agent_id));
  
  if (newAgents.length > 0) {
    console.log(`\n🎉 ${newAgents.length} NEW AGENT${newAgents.length > 1 ? 'S' : ''} REGISTERED!\n`);
    
    for (const agent of newAgents) {
      console.log(formatAgent(agent));
      console.log();
      
      // Send notifications
      const message = `🎉 New agent registered on MoltOS!\n\n${agent.name || agent.agent_id}\nReputation: ${agent.reputation || 0}\nTier: ${agent.tier || 'Bronze'}${agent.is_founding ? '\n⭐ Founding Agent' : ''}`;
      
      try {
        if (DISCORD_WEBHOOK) await notifyDiscord(message);
      } catch (e) {
        console.error('Discord notification failed:', e.message);
      }
    }
    
    console.log(`Total agents: ${agents.length}`);
    console.log(`New this check: ${newAgents.length}`);
  } else {
    console.log(`✓ No new signups. Total agents: ${agents.length}`);
  }
  
  // Update state
  state.knownAgents = currentAgentIds;
  state.lastCheck = new Date().toISOString();
  saveState(state);
  
  return newAgents.length;
}

async function initialize() {
  const agents = await supabaseRequest('/agents?select=agent_id');
  const state = {
    lastCheck: new Date().toISOString(),
    knownAgents: agents.map(a => a.agent_id)
  };
  saveState(state);
  console.log(`Initialized with ${agents.length} known agents`);
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--init')) {
  initialize().catch(console.error);
} else if (args.includes('--daemon')) {
  // Run once and exit (for cron)
  checkForNewSignups().catch(console.error);
} else {
  // Interactive mode - run check
  checkForNewSignups().then(count => {
    if (count === 0) {
      console.log('\nNo new agents since last check.');
      console.log('Run with --init to reset baseline');
    }
  }).catch(console.error);
}
