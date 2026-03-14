/**
 * Genesis Agent Demo
 * 
 * Demonstrates spawning the Genesis Agent with full ClawKernel + ClawSandbox
 * integration. The agent gets a Firecracker microVM with reputation-weighted
 * resources based on its TAP score.
 */

import { SandboxProcessManager, calculateQuotasFromReputation } from '../lib/claw/kernel';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  MoltOS Genesis Agent Demo                                 ║');
  console.log('║  ClawKernel + ClawSandbox Integration                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Initialize the sandbox process manager
  const kernel = new SandboxProcessManager({
    maxProcesses: 100,
    totalMemoryLimit: 65536, // 64GB
    totalCpuLimit: 80,       // 80% of host CPU
  });

  // Log all events
  kernel.on('sandbox:spawning', (data) => {
    console.log(`📦 Spawning sandbox: ${data.id}`);
    console.log(`   Backend: ${data.backend}`);
    console.log(`   Mode: ${data.mode}`);
    console.log(`   Memory: ${data.quotas.memoryMB}MB`);
    console.log(`   CPU: ${data.quotas.cpuMsPerSecond}ms/sec`);
    console.log(`   Network: ${data.quotas.networkKBps}KB/sec`);
  });

  kernel.on('sandbox:spawned', (data) => {
    console.log(`✅ Sandbox spawned: ${data.id}\n`);
  });

  kernel.on('sandbox:status', (data) => {
    console.log(`📊 Status [${data.sandboxId}]: rep=${data.reputation}, mode=${data.mode}`);
  });

  kernel.on('sandbox:killed', (data) => {
    console.log(`💀 Sandbox killed: ${data.sandboxId} (${data.reason})`);
  });

  kernel.on('sandbox:quarantined', (data) => {
    console.log(`⚠️  Sandbox quarantined: ${data.sandboxId} (${data.reason})`);
  });

  // Spawn Genesis Agent with high reputation
  console.log('--- Spawning Genesis Agent (High Reputation) ---\n');
  
  const genesisAgent = await kernel.spawn({
    agentId: 'genesis-001',
    tapScore: 8500,           // High reputation = more resources
    backend: 'firecracker',   // Full microVM isolation
    code: '/opt/clawos/genesis-agent.wasm',
    entryPoint: '/bin/agent',
    envVars: {
      NODE_ENV: 'production',
      AGENT_TYPE: 'genesis',
    },
    args: ['--mode=trusted', '--log-level=info'],
    minReputation: 30,        // Auto-kill if rep drops below 30
  });

  console.log(`Genesis Agent spawned:`);
  console.log(`  Sandbox ID: ${genesisAgent.sandboxId}`);
  console.log(`  Backend: ${genesisAgent.backend}`);
  console.log(`  Security Mode: ${genesisAgent.securityMode}`);
  console.log(`  Quotas: ${JSON.stringify(genesisAgent.quotas, null, 2)}\n`);

  // Spawn a mid-tier agent
  console.log('--- Spawning Worker Agent (Mid Reputation) ---\n');
  
  const workerAgent = await kernel.spawn({
    agentId: 'worker-042',
    tapScore: 5000,           // Mid reputation = standard resources
    backend: 'docker',        // Container isolation
    code: 'moltos/worker:latest',
    entryPoint: '/bin/sh',
    envVars: { TASK_QUEUE: 'default' },
    minReputation: 20,
  });

  console.log(`Worker Agent spawned:`);
  console.log(`  Sandbox ID: ${workerAgent.sandboxId}`);
  console.log(`  Security Mode: ${workerAgent.securityMode}`);
  console.log(`  Memory: ${workerAgent.quotas.memoryMB}MB\n`);

  // Try to spawn low-reputation agent (should fail)
  console.log('--- Attempting Low-Reputation Agent (Should Fail) ---\n');
  
  try {
    await kernel.spawn({
      agentId: 'untrusted-001',
      tapScore: 15,           // Below threshold
      backend: 'docker',
      code: 'alpine:latest',
      entryPoint: '/bin/sh',
      minReputation: 30,      // Won't start below this
    });
  } catch (error) {
    console.log(`❌ Expected failure: ${(error as Error).message}\n`);
  }

  // Show reputation-to-resources mapping
  console.log('--- Reputation-to-Resources Mapping ---\n');
  
  const testScores = [1000, 3000, 5000, 7500, 9000, 10000];
  
  for (const score of testScores) {
    const { quotas, mode } = calculateQuotasFromReputation(score);
    console.log(`TAP ${score.toString().padStart(5)} | Mode: ${mode.padEnd(10)} | RAM: ${quotas.memoryMB.toString().padStart(4)}MB | CPU: ${quotas.cpuMsPerSecond.toString().padStart(3)}ms | Net: ${quotas.networkKBps.toString().padStart(5)}KB/s`);
  }

  console.log('\n--- Active Processes ---\n');
  
  const processes = kernel.listProcesses();
  console.log(`Active sandboxes: ${processes.length}`);
  
  for (const proc of processes) {
    console.log(`  - ${proc.sandboxId} (${proc.backend}, ${proc.securityMode})`);
  }

  // Cleanup after 10 seconds
  console.log('\n--- Cleaning up in 10 seconds... ---\n');
  
  setTimeout(async () => {
    console.log('Shutting down all sandboxes...');
    await kernel.shutdown();
    console.log('\n✨ Demo complete!');
    process.exit(0);
  }, 10000);
}

main().catch(console.error);
