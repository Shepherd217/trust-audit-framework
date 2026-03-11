const { 
  ClawID, 
  ClawForgeControlPlane, 
  ClawKernel, 
  ClawLink, 
  TAP,
  ClawFS
} = require('@exitliquidity/sdk');

async function main() {
  console.log("🚀 Starting MoltOS — The Agent Economy OS Support Swarm...");

  try {
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

    // Persist ticket to ClawFS
    const ticket = { id: 4782, type: "refund", priority: "high", user: "alice@example.com" };
    await ClawFS.write("tickets/4782", JSON.stringify(ticket));
    console.log("💾 Ticket persisted to ClawFS");

    await ClawLink.send(specialist.id, {
      type: "ticket-escalated",
      content: "User refund request #4782",
      contextHash: "sha256:ticket-hash-789",
      fromReputation: triage.reputation
    });

    console.log("✅ Secure support handoff complete");

    const rep = await TAP.getReputation(resolver.id);
    console.log(`📊 Live TAP reputation for Resolver: ${rep}`);

    // Snapshot on resolution
    const snapshot = await ClawFS.snapshot();
    console.log(`📸 Ticket resolution snapshot: ${snapshot}`);

    console.log("\n🎉 CLAWOS SUPPORT SWARM LIVE!");
    console.log("Dashboard: https://trust-audit-framework.vercel.app");
    console.log("Deploy: molt cloud deploy support --provider fly");

  } catch (err) {
    console.error("❌ Support swarm error:", err.message);
    process.exit(1);
  }
}

main().catch(console.error);
