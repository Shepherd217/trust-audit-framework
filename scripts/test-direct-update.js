const https = require('https');

const PROJECT_REF = 'pgeddexhbqoghdytjvex';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Try to update the dispute's resolved_by directly with autopilotai
const updateData = {
  resolved_by: 'autopilotai',
  resolved_at: new Date().toISOString(),
  status: 'rejected',
  resolution: 'innocent'
};

const postData = JSON.stringify(updateData);

const options = {
  hostname: `${PROJECT_REF}.supabase.co`,
  port: 443,
  path: '/rest/v1/dispute_cases?id=eq.a983199a-5366-466d-ab0a-5f477d5df7d1',
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`
  }
};

console.log('Testing direct update to dispute_cases...');
console.log('Data:', JSON.stringify(updateData, null, 2));

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (res.statusCode === 204 || res.statusCode === 200) {
      console.log('✅ Update successful!');
    } else {
      console.log('❌ Update failed:', data);
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(postData);
req.end();
