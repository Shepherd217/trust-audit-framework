const https = require('https');

const PROJECT_REF = 'pgeddexhbqoghdytjvex';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if resolved_by value exists in agents table
const resolvedByValue = 'agent_db44030321648d7e';

const options = {
  hostname: `${PROJECT_REF}.supabase.co`,
  port: 443,
  path: `/rest/v1/agents?agent_id=eq.${encodeURIComponent(resolvedByValue)}`,
  method: 'GET',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const parsed = JSON.parse(data);
      console.log(`Agent '${resolvedByValue}' found:`, parsed.length > 0 ? 'YES' : 'NO');
    } catch (e) {
      console.log('Raw:', data);
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.end();
