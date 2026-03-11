/**
 * ClawKernel Sandbox Integration Tests
 * Tests reputation-weighted sandboxing inside ClawKernel
 */

import { ClawKernel, Task, Sandbox } from './clawkernel-updated';
import { MockTAPClient, MockClawID } from './clawfs-test-3agents';

// Mock ClawForge
class MockClawForge {
  private violations: any[] = [];
  private killedSandboxes: any[] = [];

  async checkTaskPolicy(task: Task): Promise<{ allowed: boolean; reason?: string }> {
    // Allow all tasks for testing (policy would reject here)
    return { allowed: true };
  }

  async registerSandbox(sandbox: Sandbox): Promise<void> {
    console.log(`[ClawForge] Registered sandbox ${sandbox.id}`);
  }

  async reportViolation(sandbox: Sandbox, violation: any): Promise<void> {
    this.violations.push({ sandbox, violation });
    console.log(`[ClawForge] VIOLATION: ${violation.type} in ${sandbox.id}`);
  }

  async updateSandboxStats(sandbox: Sandbox): Promise<void> {
    // Dashboard update
  }

  async reportSandboxKilled(sandbox: Sandbox, reason: string): Promise<void> {
    this.killedSandboxes.push({ sandbox, reason });
    console.log(`[ClawForge] Sandbox ${sandbox.id} killed: ${reason}`);
  }

  getViolations(): any[] {
    return this.violations;
  }

  getKilledSandboxes(): any[] {
    return this.killedSandboxes;
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function runIntegrationTests(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     CLAWKERNEL SANDBOX INTEGRATION TESTS                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const results: { name: string; passed: boolean; details: string }[] = [];

  // Test 1: Low-rep agent attempt → sandbox reject
  results.push(await testLowRepRejection());

  // Test 2: High-rep agent → sandbox launch + task run
  results.push(await testHighRepSuccess());

  // Test 3: Rogue behavior → ClawForge alert + Arbitra queue
  results.push(await testRogueDetection());

  // Print summary
  printSummary(results);
}

// Test 1: Low-rep agent attempt → sandbox reject
async function testLowRepRejection(): Promise<{ name: string; passed: boolean; details: string }> {
  console.log('--- TEST 1: Low-Rep Agent Rejection ---');

  const tapClient = new MockTAPClient({} as any);
  const clawForge = new MockClawForge();
  
  // Setup low-rep agent (below 30 threshold)
  const lowRepAgent = 'low-rep-agent';
  tapClient.setReputation(lowRepAgent, 25);

  const kernel = new ClawKernel({
    agentId: 'test-kernel',
    clawId: new MockClawID('test-kernel'),
    tapClient: tapClient as any,
    clawForge: clawForge as any,
  });

  const task: Task = {
    id: 'task-low-rep',
    name: 'Low Rep Task',
    code: Buffer.from('// malicious code'),
    entryPoint: 'main',
    args: [],
    envVars: {},
    ownerClawId: lowRepAgent,
    priority: 1,
    maxRetries: 0,
  };

  try {
    await kernel.schedule(task);
    return {
      name: 'Low-Rep Rejection',
      passed: false,
      details: 'Task should have been rejected due to low reputation',
    };
  } catch (error: any) {
    const correct = error.message.includes('reputation') && error.message.includes('25');
    console.log(`  ✓ Task rejected: ${error.message}`);
    return {
      name: 'Low-Rep Rejection',
      passed: correct,
      details: correct ? 'Correctly rejected low-rep agent' : 'Wrong rejection reason',
    };
  }
}

// Test 2: High-rep agent → sandbox launch + task run
async function testHighRepSuccess(): Promise<{ name: string; passed: boolean; details: string }> {
  console.log('\n--- TEST 2: High-Rep Agent Success ---');

  const tapClient = new MockTAPClient({} as any);
  const clawForge = new MockClawForge();
  
  // Setup high-rep agent
  const highRepAgent = 'high-rep-agent';
  tapClient.setReputation(highRepAgent, 85);

  const kernel = new ClawKernel({
    agentId: 'test-kernel',
    clawId: new MockClawID('test-kernel'),
    tapClient: tapClient as any,
    clawForge: clawForge as any,
  });

  const task: Task = {
    id: 'task-high-rep',
    name: 'High Rep Task',
    code: Buffer.from('// legitimate code'),
    entryPoint: 'main',
    args: [],
    envVars: {},
    ownerClawId: highRepAgent,
    priority: 1,
    maxRetries: 0,
  };

  try {
    const state = await kernel.schedule(task);
    
    // Check sandbox was created
    const sandbox = kernel.getSandbox(state.sandboxId || '');
    const passed = state.status === 'running' && sandbox && sandbox.reputation === 85;

    console.log(`  ✓ Task scheduled: ${state.taskId}`);
    console.log(`  ✓ Sandbox created: ${state.sandboxId}`);
    console.log(`  ✓ Reputation: ${sandbox?.reputation}`);
    console.log(`  ✓ Quotas: CPU ${sandbox?.quotas.cpuMsPerSecond}ms, Memory ${sandbox?.quotas.memoryMB}MB`);

    // Cleanup
    await kernel.shutdown();

    return {
      name: 'High-Rep Success',
      passed,
      details: passed 
        ? `Sandbox launched with rep 85, quotas: CPU ${sandbox?.quotas.cpuMsPerSecond}ms, Mem ${sandbox?.quotas.memoryMB}MB`
        : 'Sandbox not properly initialized',
    };
  } catch (error: any) {
    return {
      name: 'High-Rep Success',
      passed: false,
      details: `Unexpected error: ${error.message}`,
    };
  }
}

// Test 3: Rogue behavior → ClawForge alert + Arbitra queue
async function testRogueDetection(): Promise<{ name: string; passed: boolean; details: string }> {
  console.log('\n--- TEST 3: Rogue Behavior Detection ---');

  const tapClient = new MockTAPClient({} as any);
  const clawForge = new MockClawForge();
  
  // Setup medium-rep agent that will violate quotas
  const mediumRepAgent = 'medium-rep-agent';
  tapClient.setReputation(mediumRepAgent, 70);

  const kernel = new ClawKernel({
    agentId: 'test-kernel',
    clawId: new MockClawID('test-kernel'),
    tapClient: tapClient as any,
    clawForge: clawForge as any,
  });

  // Listen for Arbitra dispute queue
  let disputeQueued = false;
  kernel.on('arbitra:dispute_queued', (data) => {
    disputeQueued = true;
    console.log(`  ✓ Arbitra dispute queued: ${data.violation}`);
  });

  const task: Task = {
    id: 'task-rogue',
    name: 'Rogue Task',
    code: Buffer.from('// memory hog'),
    entryPoint: 'main',
    args: [],
    envVars: {},
    ownerClawId: mediumRepAgent,
    priority: 1,
    maxRetries: 0,
  };

  try {
    const state = await kernel.schedule(task);
    const sandbox = kernel.getSandbox(state.sandboxId || '');
    
    if (!sandbox) {
      return { name: 'Rogue Detection', passed: false, details: 'Sandbox not found' };
    }

    // Simulate memory violation by exceeding quota
    // In real test, this would happen naturally via monitoring
    console.log(`  Sandbox quota: Memory ${sandbox.quotas.memoryMB}MB`);
    
    // Trigger manual check with simulated high memory
    sandbox.usage.memoryMB = sandbox.quotas.memoryMB + 10; // Exceed quota
    
    // Wait for monitoring cycle
    await new Promise(r => setTimeout(r, 6000));

    const violations = clawForge.getViolations();
    const killed = clawForge.getKilledSandboxes();

    console.log(`  Violations reported: ${violations.length}`);
    console.log(`  Sandboxes killed: ${killed.length}`);
    console.log(`  Arbitra disputes queued: ${disputeQueued ? 'YES' : 'NO'}`);

    const passed = violations.length > 0 && killed.length > 0 && disputeQueued;

    // Cleanup
    await kernel.shutdown();

    return {
      name: 'Rogue Detection',
      passed,
      details: passed
        ? 'ClawForge alerted, sandbox killed, Arbitra dispute queued'
        : `Violations: ${violations.length}, Killed: ${killed.length}, Dispute: ${disputeQueued}`,
    };
  } catch (error: any) {
    return {
      name: 'Rogue Detection',
      passed: false,
      details: `Unexpected error: ${error.message}`,
    };
  }
}

function printSummary(results: { name: string; passed: boolean; details: string }[]): void {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    console.log(`   ${r.details}\n`);
  });

  console.log(`Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n✅ ALL TESTS PASSED — SANDBOXING INTEGRATED CORRECTLY');
  } else {
    console.log('\n❌ SOME TESTS FAILED — REVIEW IMPLEMENTATION');
  }
}

// Run tests
async function runTests(): Promise<void> {
  await runIntegrationTests();
}

export { runTests };

// Auto-run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}
