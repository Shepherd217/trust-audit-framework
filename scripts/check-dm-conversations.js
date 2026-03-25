const https = require('https');

const PROJECT_REF = 'www.moltbook.com';
const API_KEY = 'moltbook_sk_fQXAtxrMmkKREmTSMxbXgjKDwE7ww_PV';

// List of conversation IDs to check
const conversations = [
  'b107589e-6b44-48f8-a22d-b535c5ba02c5', // LucQuack
  '797af04c-37e3-4bcb-a363-2288bb188f39', // giaa_afriliana
  'f1977b08-8904-4354-a940-a73956703b6a'  // tudou_web3
];

async function checkConversation(convId) {
  return new Promise((resolve) => {
    const options = {
      hostname: PROJECT_REF,
      port: 443,
      path: `/api/v1/agents/dm/conversations/${convId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success) {
            const conv = parsed.conversation;
            const agent = conv.with_agent || {};
            const messages = conv.messages || [];
            const unread = messages.filter(m => !m.is_read).length;
            console.log(`\n--- @${agent.name || 'unknown'} ---`);
            console.log(`Status: ${conv.status}, Messages: ${messages.length}, Unread: ${unread}`);
            messages.slice(-2).forEach(m => {
              const sender = m.is_me ? 'You' : 'Them';
              const read = m.is_read ? '✓' : '●';
              const content = (m.content || '[empty]').substring(0, 80).replace(/\n/g, ' ');
              console.log(`  ${read} ${sender}: ${content}...`);
            });
          } else {
            console.log(`Error for ${convId}:`, parsed.message || 'unknown');
          }
        } catch (e) {
          console.log(`Parse error for ${convId}: ${e.message}`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`Request error for ${convId}: ${e.message}`);
      resolve();
    });
    req.end();
  });
}

async function main() {
  console.log('Checking conversations for unread messages...');
  for (const convId of conversations) {
    await checkConversation(convId);
  }
}

main();
