const { ClawID, ClawKernel } = require('@moltos/sdk');

/**
 * MoltOS Support Agent
 * 
 * A customer service agent that:
 * - Tracks tickets persistently across restarts
 * - Uses reputation for escalation decisions
 * - Never loses customer context
 */

class SupportAgent {
  constructor() {
    this.tickets = [];
    this.resolvedToday = 0;
    this.avgResponseTime = 0;
  }

  async initialize() {
    console.log('🦞 Starting MoltOS Support Agent');
    console.log('');

    // Initialize identity
    const identity = await ClawID.initialize();
    console.log(`🔑 Identity: ${identity.publicKey.slice(0, 16)}...`);

    // Initialize kernel
    const kernel = new ClawKernel();
    await kernel.start();
    console.log('✅ Kernel started');

    // Load tickets from ClawFS
    await this.loadTickets(kernel);

    // Schedule ticket monitoring
    this.scheduleMonitoring(kernel);

    console.log('');
    console.log('📋 Support Agent Ready');
    console.log(`   Active tickets: ${this.tickets.length}`);
    console.log(`   Resolved today: ${this.resolvedToday}`);
    console.log('   Press Ctrl+C to exit');
  }

  async loadTickets(kernel) {
    try {
      const saved = await kernel.getState('support-tickets');
      if (saved) {
        this.tickets = saved.tickets || [];
        this.resolvedToday = saved.resolvedToday || 0;
        console.log(`📦 Loaded ${this.tickets.length} tickets from ClawFS`);
      }
    } catch (err) {
      console.log('📦 No previous tickets');
    }
  }

  async saveTickets(kernel) {
    await kernel.setState('support-tickets', {
      tickets: this.tickets,
      resolvedToday: this.resolvedToday,
      lastUpdated: new Date().toISOString()
    });
  }

  scheduleMonitoring(kernel) {
    // Check for new tickets every minute
    kernel.schedule({
      name: 'ticket-monitor',
      cron: '* * * * *',
      handler: async () => {
        await this.checkNewTickets();
        await this.saveTickets(kernel);
      }
    });

    // Reset daily counter at midnight
    kernel.schedule({
      name: 'daily-reset',
      cron: '0 0 * * *',
      handler: async () => {
        this.resolvedToday = 0;
        console.log('📅 Daily counter reset');
      }
    });
  }

  async checkNewTickets() {
    // Simulate ticket intake
    if (Math.random() > 0.7) {
      const newTicket = {
        id: `TKT-${Date.now()}`,
        customer: `customer-${Math.floor(Math.random() * 1000)}`,
        issue: ['Login problem', 'Billing question', 'Feature request', 'Bug report'][Math.floor(Math.random() * 4)],
        priority: Math.random() > 0.8 ? 'high' : 'normal',
        status: 'open',
        createdAt: new Date().toISOString()
      };

      this.tickets.push(newTicket);
      console.log(`🎫 New ticket: ${newTicket.id} (${newTicket.priority})`);
      
      if (newTicket.priority === 'high') {
        console.log('   ⚠️  High priority — escalating');
      }
    }

    // Process existing tickets
    const openTickets = this.tickets.filter(t => t.status === 'open');
    if (openTickets.length > 0 && Math.random() > 0.8) {
      const ticket = openTickets[0];
      ticket.status = 'resolved';
      ticket.resolvedAt = new Date().toISOString();
      this.resolvedToday++;
      console.log(`✅ Resolved: ${ticket.id}`);
    }
  }
}

async function main() {
  const agent = new SupportAgent();
  await agent.initialize();
}

main().catch(console.error);
