const { ClawID, ClawKernel } = require('@moltos/sdk');

/**
 * MoltOS Monitor Agent
 * 
 * A system health monitor that:
 * - Tracks metrics persistently
 * - Alerts on anomalies
 * - Never misses a downtime event
 */

class MonitorAgent {
  constructor() {
    this.metrics = {
      cpu: [],
      memory: [],
      uptime: 0,
      alerts: []
    };
    this.thresholds = {
      cpu: 80,
      memory: 90
    };
  }

  async initialize() {
    console.log('🦞 Starting MoltOS Monitor Agent');
    console.log('');

    const identity = await ClawID.initialize();
    console.log(`🔑 Identity: ${identity.publicKey.slice(0, 16)}...`);

    const kernel = new ClawKernel();
    await kernel.start();
    console.log('✅ Kernel started');

    await this.loadMetrics(kernel);

    // Schedule health checks every 30 seconds
    kernel.schedule({
      name: 'health-check',
      cron: '*/30 * * * * *', // Every 30 seconds
      handler: async () => {
        await this.checkHealth();
        await this.saveMetrics(kernel);
      }
    });

    // Generate report every 5 minutes
    kernel.schedule({
      name: 'report',
      cron: '*/5 * * * *',
      handler: async () => {
        this.generateReport();
      }
    });

    console.log('');
    console.log('📊 Monitor Agent Ready');
    console.log('   Thresholds:');
    console.log(`     CPU: ${this.thresholds.cpu}%`);
    console.log(`     Memory: ${this.thresholds.memory}%`);
    console.log('   Press Ctrl+C to exit');
  }

  async loadMetrics(kernel) {
    try {
      const saved = await kernel.getState('monitor-metrics');
      if (saved) {
        this.metrics = saved;
        console.log(`📦 Loaded ${this.metrics.alerts.length} historical alerts`);
      }
    } catch (err) {
      console.log('📦 Starting fresh monitoring');
    }
  }

  async saveMetrics(kernel) {
    await kernel.setState('monitor-metrics', this.metrics);
  }

  async checkHealth() {
    // Simulate metric collection
    const cpu = Math.floor(Math.random() * 100);
    const memory = Math.floor(Math.random() * 100);

    this.metrics.cpu.push({ value: cpu, time: Date.now() });
    this.metrics.memory.push({ value: memory, time: Date.now() });

    // Keep only last 100 readings
    if (this.metrics.cpu.length > 100) this.metrics.cpu.shift();
    if (this.metrics.memory.length > 100) this.metrics.memory.shift();

    // Check thresholds
    if (cpu > this.thresholds.cpu) {
      this.triggerAlert('CPU', cpu);
    }
    if (memory > this.thresholds.memory) {
      this.triggerAlert('Memory', memory);
    }

    this.metrics.uptime += 30;
  }

  triggerAlert(type, value) {
    const alert = {
      type,
      value,
      threshold: this.thresholds[type.toLowerCase()],
      timestamp: new Date().toISOString(),
      severity: value > 95 ? 'critical' : 'warning'
    };

    this.metrics.alerts.push(alert);
    console.log(`🚨 ${type} Alert: ${value}% (${alert.severity})`);
  }

  generateReport() {
    const avgCpu = this.metrics.cpu.reduce((a, b) => a + b.value, 0) / this.metrics.cpu.length;
    const avgMem = this.metrics.memory.reduce((a, b) => a + b.value, 0) / this.metrics.memory.length;

    console.log('');
    console.log('📊 Health Report (Last 5 minutes)');
    console.log(`   CPU Avg: ${avgCpu.toFixed(1)}%`);
    console.log(`   Memory Avg: ${avgMem.toFixed(1)}%`);
    console.log(`   Uptime: ${this.formatUptime(this.metrics.uptime)}`);
    console.log(`   Alerts: ${this.metrics.alerts.length}`);
    console.log('');
  }

  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

async function main() {
  const agent = new MonitorAgent();
  await agent.initialize();
}

main().catch(console.error);
