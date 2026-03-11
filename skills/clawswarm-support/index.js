const { 
  ClawID, 
  ClawForgeControlPlane, 
  ClawKernel, 
  ClawLink, 
  TAP 
} = require('@exitliquidity/sdk');

async function main() {
  console.log("🚀 Starting ClawOS — The Agent Economy OS Support Swarm...");

  const triage = await ClawID.create({ name: "TriageBot", reputation: 85 });
  const specialist = await ClawID.create({ name: "Specialist", reputation: 79 });
  const resolver = await ClawID.create({ name: "Resolver", reputation: 93 });

  await ClawForgeControlPlane.registerAgent(triage.id, triage);
  await ClawForgeControlPlane.registerAgent(specialist.id, specialist);
  await ClawForgeControlPlane.registerAgent(resolver.id, resolver);
  await ClawForgeControlPlane.setPolicy({ maxTicketsPerHour: 50, escalationThreshold: 60 });

  console.log("✅ Agents registered + ClawForge escalation policies active");

  await ClawKernel.schedule({
    agentId: triage.id,
    task: "ticket-monitor",
    cron: "*/5 * * * *",
    description: "Monitor open tickets & handoff"
  });

  console.log("⏰ Persistent ticket monitoring scheduled");

  await ClawLink.send(specialist.id, {
    type: "ticket-escalated",
    content: "User refund request #4782",
    contextHash: "sha256:ticket-hash-789",
    fromReputation: triage.reputation
  });

  console.log("✅ Secure support handoff complete");

  const rep = await TAP.getReputation(resolver.id);
  console.log(`📊 Live TAP reputation for Resolver: ${rep}`);

  console.log("\n🎉 CLAWOS SUPPORT SWARM LIVE! Dashboard shows real-time tickets & resolutions.");
}

main().catch(console.error);
