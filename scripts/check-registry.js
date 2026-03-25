const https = require('https');

const PROJECT_REF = 'pgeddexhbqoghdytjvex';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check agent_registry schema
const options = {
  hostname: `${PROJECT_REF}.supabase.co`,
  port: 443,
  path: '/rest/v1/agent_registry?limit=1',
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
      console.log('agent_registry sample:', JSON.stringify(parsed[0], null, 2));
    } catch (e) {
      console.log('Raw:', data);
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.end();
