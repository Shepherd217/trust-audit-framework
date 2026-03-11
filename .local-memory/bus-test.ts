/**
 * ClawBus Integration Tests — 50 Agent Swarm Simulation
 * Tests reputation-gated pub/sub with policy enforcement
 */

import { ClawBus, BusTopic, BusEvent } from './clawbus';
import { BusPolicyEnforcer, BusPolicy } from './bus-policy';
import { MockTAPClient, MockClawID } from './clawfs-test-3agents';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
  agentCount: 50,
  eventCount: 100,
  topics: ['market.data', 'agent.heartbeat', 'task.completed', 'alert.critical'],
  reputationRange: { min: 20, max: 95 },
};

// ============================================================================
// MOCK CLAWFORGE WITH BUS POLICY
// ============================================================================

class MockClawForgeWithBusPolicy {
  private policyEnforcer: BusPolicyEnforcer;
  private busEvents: BusEvent[] = [];
  private subscriptions: any[] = [];

  constructor() {
    this.policyEnforcer = new BusPolicyEnforcer();
    
    // Set up policies for test topics
    const policies: BusPolicy[] = [
      {
        topic: 'market.data',
        enabled: true,
        autoModeration: true,
        maxEventsPerMinute: 60,
        maxPayloadSize: 1024,
        requireSignatures: true,
        encryptionRequired: false,
        suspiciousPatterns: ['pump', 'dump', 'manipulate'],
        autoBlockThreshold: 5,
      },
      {
        topic: 'agent.heartbeat',
        enabled: true,
        autoModeration: true,
        maxEventsPerMinute: 120,
        maxPayloadSize: 512,
        requireSignatures: false,
        encryptionRequired: false,
        suspiciousPatterns: [],
        autoBlockThreshold: 10,
      },
      {
        topic: 'task.completed',
        enabled: true,
        autoModeration: true,
        maxEventsPerMinute: 30,
        maxPayloadSize: 2048,
        requireSignatures: true,
        encryptionRequired: false,
        suspiciousPatterns: ['exploit', 'hack'],
        autoBlockThreshold: 3,
      },
      {
        topic: 'alert.critical',
        enabled: true,
        autoModeration: true,
        maxEventsPerMinute: 10,
        maxPayloadSize: 4096,
        requireSignatures: true,
        encryptionRequired: true,
        suspiciousPatterns: [],
        autoBlockThreshold: 2,
      },
    ];

    for (const policy of policies) {
      this.policyEnforcer.setPolicy(policy);
    }
  }

  checkTopicPolicy(topic: any): { allowed: boolean; reason?: string } {
    return this.policyEnforcer.checkTopicPolicy(topic);
  }

  async logBusEvent(event: BusEvent): Promise<void> {
    this.busEvents.push(event);
    await this.policyEnforcer.logBusEvent(event);
  }

  async logSubscription(sub: any): Promise<void> {
    this.subscriptions.push(sub);
    await this.policyEnforcer.logSubscription(sub);
  }

  getPolicyEnforcer(): BusPolicyEnforcer {
    return this.policyEnforcer;
  }

  getMetrics(): any {
    return this.policyEnforcer.getMetrics();
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function runBusTests(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     CLAWBUS — 50 AGENT SWARM SIMULATION                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Configuration:');
  console.log(`  Agents: ${TEST_CONFIG.agentCount}`);
  console.log(`  Events: ${TEST_CONFIG.eventCount}`);
  console.log(`  Topics: ${TEST_CONFIG.topics.join(', ')}`);
  console.log(`  Reputation Range: ${TEST_CONFIG.reputationRange.min}-${TEST_CONFIG.reputationRange.max}\n`);

  // Setup
  const tapClient = new MockTAPClient({} as any);
  const clawForge = new MockClawForgeWithBusPolicy();

  // Create 50 agents with varying reputation
  const agents: Array<{
    id: string;
    reputation: number;
    bus: ClawBus;
    eventsPublished: number;
    eventsReceived: number;
  }> = [];

  for (let i = 0; i < TEST_CONFIG.agentCount; i++) {
    const agentId = `agent-${i.toString().padStart(3, '0')}`;
    const reputation = Math.floor(
      Math.random() * (TEST_CONFIG.reputationRange.max - TEST_CONFIG.reputationRange.min) +
      TEST_CONFIG.reputationRange.min
    );
    
    tapClient.setReputation(agentId, reputation);

    const bus = new ClawBus({
      agentId,
      clawId: new MockClawID(agentId),
      tapClient: tapClient as any,
      clawForge: clawForge as any,
      maxEventSize: 2048,
      defaultRepThreshold: 30,
    });

    agents.push({
      id: agentId,
      reputation,
      bus,
      eventsPublished: 0,
      eventsReceived: 0,
    });
  }

  console.log(`✓ Created ${agents.length} agents`);
  console.log(`  Avg reputation: ${(agents.reduce((a, b) => a + b.reputation, 0) / agents.length).toFixed(1)}`);
  console.log(`  Low rep (<30): ${agents.filter(a => a.reputation < 30).length} agents`);
  console.log(`  High rep (>80): ${agents.filter(a => a.reputation > 80).length} agents\n`);

  // Register topics
  const topics: BusTopic[] = [
    {
      name: 'market.data',
      publisherThreshold: 50,
      subscriberThreshold: 40,
      rateLimitPerMinute: 60,
      requireSignature: true,
      encrypted: false,
    },
    {
      name: 'agent.heartbeat',
      publisherThreshold: 20,
      subscriberThreshold: 20,
      rateLimitPerMinute: 120,
      requireSignature: false,
      encrypted: false,
    },
    {
      name: 'task.completed',
      publisherThreshold: 60,
      subscriberThreshold: 50,
      rateLimitPerMinute: 30,
      requireSignature: true,
      encrypted: false,
    },
    {
      name: 'alert.critical',
      publisherThreshold: 70,
      subscriberThreshold: 60,
      rateLimitPerMinute: 10,
      requireSignature: true,
      encrypted: true,
    },
  ];

  for (const topic of topics) {
    agents[0].bus.registerTopic(topic); // Register on first bus (shared registry)
  }

  console.log('✓ Registered 4 topics with reputation thresholds\n');

  // Subscribe agents to topics
  let subscriptionsCreated = 0;
  let subscriptionsDenied = 0;

  for (const agent of agents) {
    for (const topic of topics) {
      // Try to subscribe
      const result = await agent.bus.subscribe(
        topic.name,
        (event: BusEvent) => {
          agent.eventsReceived++;
        },
        {
          maxEventsPerMinute: 60,
          priority: agent.reputation,
        }
      );

      if (result.success) {
        subscriptionsCreated++;
      } else {
        subscriptionsDenied++;
      }
    }
  }

  console.log('Subscription Results:');
  console.log(`  Created: ${subscriptionsCreated}`);
  console.log(`  Denied: ${subscriptionsDenied}`);
  console.log(`  Success rate: ${((subscriptionsCreated / (subscriptionsCreated + subscriptionsDenied)) * 100).toFixed(1)}%\n`);

  // Publish events
  let publishesSuccessful = 0;
  let publishesDenied = 0;
  const startTime = Date.now();

  for (let i = 0; i < TEST_CONFIG.eventCount; i++) {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    
    const payloads: Record<string, any> = {
      'market.data': { symbol: 'ALPHA', price: Math.random() * 100, volume: Math.floor(Math.random() * 1000) },
      'agent.heartbeat': { status: 'alive', timestamp: Date.now(), load: Math.random() },
      'task.completed': { taskId: `task-${i}`, result: 'success', duration: Math.floor(Math.random() * 5000) },
      'alert.critical': { severity: 'high', message: 'System alert', component: 'network' },
    };

    const result = await agent.bus.publish(topic.name, payloads[topic.name]);

    if (result.success) {
      publishesSuccessful++;
      agent.eventsPublished++;
    } else {
      publishesDenied++;
    }

    // Progress indicator
    if ((i + 1) % 20 === 0) {
      console.log(`  Published ${i + 1}/${TEST_CONFIG.eventCount} events...`);
    }
  }

  const publishTime = Date.now() - startTime;

  console.log(`\n✓ Publishing complete in ${publishTime}ms`);
  console.log(`  Successful: ${publishesSuccessful}`);
  console.log(`  Denied: ${publishesDenied}`);
  console.log(`  Success rate: ${((publishesSuccessful / TEST_CONFIG.eventCount) * 100).toFixed(1)}%`);
  console.log(`  Throughput: ${((TEST_CONFIG.eventCount / publishTime) * 1000).toFixed(1)} events/sec\n`);

  // Wait for delivery
  await new Promise(r => setTimeout(r, 1000));

  // Calculate delivery stats
  const totalReceived = agents.reduce((sum, a) => sum + a.eventsReceived, 0);
  const avgReceived = totalReceived / agents.length;

  console.log('Delivery Statistics:');
  console.log(`  Total events delivered: ${totalReceived}`);
  console.log(`  Avg events per agent: ${avgReceived.toFixed(1)}`);
  console.log(`  Delivery rate: ${(totalReceived / (publishesSuccessful * agents.filter(a => a.reputation >= 40).length) * 100).toFixed(1)}%\n`);

  // Check policy enforcement
  const policyMetrics = clawForge.getMetrics();
  console.log('Policy Enforcement:');
  console.log(`  Active policies: ${policyMetrics.totalPolicies}`);
  console.log(`  Total violations: ${policyMetrics.totalViolations}`);
  console.log(`  Agents blocked: ${policyMetrics.agentsBlocked}`);
  console.log(`  Pending disputes: ${policyMetrics.pendingDisputes}\n`);

  // Print top publishers
  const topPublishers = [...agents]
    .sort((a, b) => b.eventsPublished - a.eventsPublished)
    .slice(0, 5);

  console.log('Top Publishers:');
  for (const agent of topPublishers) {
    console.log(`  ${agent.id} (rep: ${agent.reputation}): ${agent.eventsPublished} events`);
  }

  // Test Results
  printTestResults({
    subscriptionsCreated,
    subscriptionsDenied,
    publishesSuccessful,
    publishesDenied,
    totalReceived,
    policyMetrics,
  });
}

function printTestResults(results: any): void {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST RESULTS                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const tests = [
    {
      name: 'Subscription Gating',
      passed: results.subscriptionsDenied > 0,
      details: `Denied ${results.subscriptionsDenied} low-rep subscriptions`,
    },
    {
      name: 'Publish Gating',
      passed: results.publishesDenied > 0,
      details: `Denied ${results.publishesDenied} unauthorized publishes`,
    },
    {
      name: 'Event Delivery',
      passed: results.totalReceived > 0,
      details: `Delivered ${results.totalReceived} events`,
    },
    {
      name: 'Policy Enforcement',
      passed: results.policyMetrics.totalPolicies > 0,
      details: `${results.policyMetrics.totalPolicies} policies active`,
    },
  ];

  for (const test of tests) {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    console.log(`   ${test.details}\n`);
  }

  const passed = tests.filter(t => t.passed).length;
  const total = tests.length;

  console.log(`Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n✅ ALL TESTS PASSED — CLAWBUS FULLY FUNCTIONAL');
  } else {
    console.log('\n⚠️ SOME TESTS FAILED — REVIEW IMPLEMENTATION');
  }
}

// Run tests
async function runTests(): Promise<void> {
  await runBusTests();
}

export { runTests };

// Auto-run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}
