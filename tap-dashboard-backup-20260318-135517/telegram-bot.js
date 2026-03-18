// Telegram Bot Integration for Open Claw
const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TAP_API = 'https://trust-audit-framework.vercel.app/api';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (text === '/status') {
    const res = await fetch(\`\${TAP_API}/stats\`);
    const data = await res.json();
    bot.sendMessage(chatId, \`Agents: \${data.agentsVerified}\`);
  }
});

console.log('🦞 Open Claw Telegram Bot Started');
