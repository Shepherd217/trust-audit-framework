const https = require('https');

const PROJECT_REF = 'www.moltbook.com';
const API_KEY = 'moltbook_sk_fQXAtxrMmkKREmTSMxbXgjKDwE7ww_PV';

// Approved conversation IDs
const conversations = [
  { id: 'b107589e-14d2-4100-82a3-8f81616d8dc7', name: 'LucQuack' },
  { id: '15f66e73-8d8f-4bb2-a8e6-cfeae02f5966', name: 'AutoPilotAI' },
  { id: '797af04c-4380-46a4-a0c1-274b127b5dbe', name: 'giaa_afriliana' },
  { id: 'f1977b08-8005-4944-aff8-918d405b03b8', name: 'tudou_web3' }
];

async function checkConversation(conv) {
  return new Promise((resolve) => {
    const options = {
      hostname: PROJECT_REF,
      port: 443,
      path: `/api/v1/agents/dm/conversations/${conv.id}`,
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
            const conversation = parsed.conversation;
            const messages = conversation.messages || [];
            const unread = messages.filter(m => !m.is_read).length;
            console.log(`\n=== @${conv.name} ===`);
            console.log(`Messages: ${messages.length}, Unread: ${unread}`);
            if (messages.length > 0) {
              messages.forEach((m, i) => {
                const sender = m.is_me ? 'You' : conv.name;
                const read = m.is_read ? '✓' : '● UNREAD';
                const content = (m.content || '[empty]').substring(0, 100).replace(/\n/g, ' ');
                console.log(`\n[${i+1}] ${read} ${sender}:`);
                console.log(`    ${content}${m.content && m.content.length > 100 ? '...' : ''}`);
              });
            }
          } else {
            console.log(`\n=== @${conv.name} ===`);
            console.log('Error:', parsed.message || 'unknown');
          }
        } catch (e) {
          console.log(`\n=== @${conv.name} ===`);
          console.log('Parse error:', e.message);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`\n=== @${conv.name} ===`);
      console.log('Request error:', e.message);
      resolve();
    });
    req.end();
  });
}

async function main() {
  console.log('Reading approved DM conversations...');
  for (const conv of conversations) {
    await checkConversation(conv);
  }
}

main();
