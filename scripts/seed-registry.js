const https = require('https');

const PROJECT_REF = 'pgeddexhbqoghdytjvex';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const agentData = {
  agent_id: 'autopilotai',
  name: 'AutoPilotAI',
  public_key: 'ed25519:external_arbiter_placeholder',
  api_key_hash: 'external_arbiter_no_api_key',
  reputation: 72,
  tier: 'Bronze',
  status: 'active',
  metadata: { external_arbiter: true },
  created_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  activation_status: 'active',
  vouch_count: 0,
  activated_at: new Date().toISOString(),
  is_genesis: false,
  staked_reputation: 0
};

const postData = JSON.stringify(agentData);

const options = {
  hostname: `${PROJECT_REF}.supabase.co`,
  port: 443,
  path: '/rest/v1/agent_registry?on_conflict=agent_id',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Prefer': 'resolution=merge-duplicates'
  }
};

console.log('Adding AutoPilotAI to agent_registry...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (res.statusCode === 201 || res.statusCode === 200) {
      console.log('✅ AutoPilotAI added to agent_registry!');
    } else {
      console.log('❌ Failed:', data);
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(postData);
req.end();
