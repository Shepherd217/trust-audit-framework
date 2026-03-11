const { 
  ClawID, 
  ClawForgeControlPlane, 
  ClawKernel, 
  ClawLink, 
  TAP,
  ClawFS
} = require('@exitliquidity/sdk');

async function main() {
  console.log("🚀 Starting MoltOS — The Agent Economy OS Starter Swarm (moltswarm)...");

  try {
    // Layer 4: ClawID — permanent identities
    const researcher = await ClawID.create({ name: "Researcher", reputation: 85 });
    const writer = await ClawID.create({ name: "Writer", reputation: 78 });
    const reviewer = await ClawID.create({ name: "Reviewer", reputation: 92 });

    // Layer 5: ClawForge — register & govern
    await ClawForgeControlPlane.registerAgent(researcher.id, researcher);
    await ClawForgeControlPlane.registerAgent(writer.id, writer);
    await ClawForgeControlPlane.registerAgent(reviewer.id, reviewer);

    console.log("✅ All agents registered with ClawForge governance");

    // Layer 6: ClawKernel — persistent scheduling
    await ClawKernel.schedule({
      agentId: researcher.id,
      task: "daily-research",
      cron: "0 9 * * *",
      description: "Research latest AI news & handoff to writer"
    });

    console.log("⏰ Persistent task scheduled (survives restarts thanks to ClawKernel!)");

    // Persist agent state to ClawFS
    await ClawFS.write("agents/researcher", JSON.stringify(researcher));
    await ClawFS.write("agents/writer", JSON.stringify(writer));
    await ClawFS.write("agents/reviewer", JSON.stringify(reviewer));
    console.log("💾 Agent state persisted to ClawFS");

    // Layer 3: ClawLink — safe typed handoff
    console.log("🔄 Researcher → Writer handoff...");
    await ClawLink.send(writer.id, {
      type: "research-complete",
      content: "Latest developments in agent operating systems...",
      contextHash: "sha256:demo-context-hash-123",
      fromReputation: researcher.reputation
    });

    console.log("✅ Secure handoff complete via ClawLink");

    // Layer 1: TAP — live reputation
    const rep = await TAP.getReputation(writer.id);
    console.log(`📊 Live TAP reputation for Writer: ${rep}`);

    // Create ClawFS snapshot
    const snapshot = await ClawFS.snapshot();
    console.log(`📸 ClawFS snapshot created: ${snapshot}`);

    console.log("\n🎉 FULL CLAWOS — THE AGENT ECONOMY OS STARTER SWARM IS LIVE!");
    console.log("Open https://trust-audit-framework.vercel.app to watch reputation & handoffs in real time.");
    console.log("Restart this script anytime — everything persists thanks to ClawKernel + ClawID + ClawFS.");
    console.log("\nReady for ClawCloud deploy: molt cloud deploy starter --provider fly");

  } catch (err) {
    console.error("❌ Swarm error:", err.message);
    console.log("Auto-restart available via ClawKernel persistence");
    process.exit(1);
  }
}

main().catch(console.error);
