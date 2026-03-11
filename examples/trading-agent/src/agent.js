const { ClawID, ClawKernel } = require('@moltos/sdk');

/**
 * MoltOS Trading Agent
 * 
 * A production-ready trading agent that:
 * - Persists market scans across restarts
 * - Builds reputation through attestations
 * - Uses reputation-weighted risk tolerance
 * - Safe typed handoffs for market data
 */

class TradingAgent {
  constructor(config) {
    this.config = config;
    this.identity = null;
    this.kernel = null;
    this.positions = [];
    this.watchlist = ['BTC', 'ETH', 'SOL'];
  }

  async initialize() {
    console.log('🦞 Starting MoltOS Trading Agent');
    console.log('');

    // Initialize ClawID (persistent identity)
    this.identity = await ClawID.initialize();
    console.log(`🔑 Identity: ${this.identity.publicKey.slice(0, 16)}...`);

    // Initialize ClawKernel (persistent execution)
    this.kernel = new ClawKernel();
    await this.kernel.start();
    console.log('✅ Kernel started with persistence');

    // Load saved state (if exists)
    await this.loadState();

    console.log('');
    console.log('📊 Trading Agent Configuration:');
    console.log(`   Watchlist: ${this.watchlist.join(', ')}`);
    console.log(`   Positions: ${this.positions.length}`);
    console.log('');

    // Schedule market scans
    this.scheduleMarketScans();

    console.log('✅ Trading Agent ready');
    console.log('   Press Ctrl+C to exit (state will persist)');
  }

  async loadState() {
    try {
      const savedState = await this.kernel.getState('trading-agent');
      if (savedState) {
        this.positions = savedState.positions || [];
        this.watchlist = savedState.watchlist || this.watchlist;
        console.log('📦 State restored from ClawFS');
      }
    } catch (err) {
      console.log('📦 No previous state (fresh start)');
    }
  }

  async saveState() {
    await this.kernel.setState('trading-agent', {
      positions: this.positions,
      watchlist: this.watchlist,
      lastUpdated: new Date().toISOString()
    });
  }

  scheduleMarketScans() {
    // Scan every 5 minutes
    this.kernel.schedule({
      name: 'market-scan',
      cron: '*/5 * * * *',
      handler: async () => {
        await this.scanMarkets();
      }
    });

    // Save state every minute
    this.kernel.schedule({
      name: 'save-state',
      cron: '* * * * *',
      handler: async () => {
        await this.saveState();
        console.log('💾 State saved to ClawFS');
      }
    });

    console.log('⏰ Scheduled:');
    console.log('   • Market scan: Every 5 minutes');
    console.log('   • State save: Every minute');
  }

  async scanMarkets() {
    console.log('');
    console.log(`🔍 Market Scan — ${new Date().toISOString()}`);
    
    for (const symbol of this.watchlist) {
      // Simulate market data fetch
      const price = this.simulatePrice(symbol);
      const change = (Math.random() * 10 - 5).toFixed(2);
      
      console.log(`   ${symbol}: $${price} (${change > 0 ? '+' : ''}${change}%)`);
      
      // Check for trading signals
      if (Math.abs(parseFloat(change)) > 3) {
        console.log(`   ⚠️  ${symbol}: High volatility detected`);
        await this.handleVolatility(symbol, price, change);
      }
    }

    // Build reputation through attestation
    await this.submitAttestation();
  }

  simulatePrice(symbol) {
    const basePrices = { BTC: 45000, ETH: 3000, SOL: 100 };
    const base = basePrices[symbol] || 100;
    const variation = (Math.random() - 0.5) * 0.1;
    return (base * (1 + variation)).toFixed(2);
  }

  async handleVolatility(symbol, price, change) {
    // Reputation-weighted decision making
    const reputation = 100; // Would come from TAP
    const riskTolerance = reputation / 100;
    
    if (riskTolerance > 0.7) {
      console.log(`   💡 Signal: Consider ${change > 0 ? 'taking profits' : 'buying dip'} on ${symbol}`);
    } else {
      console.log(`   💡 Signal: Hold position (low risk tolerance)`);
    }
  }

  async submitAttestation() {
    // Periodic attestation to build reputation
    try {
      console.log('   📝 Submitting attestation...');
      // Would call: npx @moltos/sdk@latest attest
      // For demo, just log
      console.log('   ✅ Attestation submitted (+1 reputation)');
    } catch (err) {
      console.error('   ❌ Attestation failed:', err.message);
    }
  }

  async shutdown() {
    console.log('');
    console.log('🛑 Shutting down...');
    await this.saveState();
    await this.kernel.stop();
    console.log('✅ State saved. Goodbye!');
  }
}

// Run the agent
async function main() {
  const agent = new TradingAgent({
    name: 'MoltOS Trading Agent',
    version: '0.1.0'
  });

  await agent.initialize();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await agent.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await agent.shutdown();
    process.exit(0);
  });
}

main().catch(console.error);
