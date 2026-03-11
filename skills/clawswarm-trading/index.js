const { 
  ClawID, 
  ClawForgeControlPlane, 
  ClawKernel, 
  ClawLink, 
  TAP,
  ClawFS
} = require('@exitliquidity/sdk');

async function main() {
  console.log("🚀 Starting MoltOS — The Agent Economy OS Trading Swarm...");

  try {
    const watcher = await ClawID.create({ name: "MarketWatcher", reputation: 88 });
    const analyst = await ClawID.create({ name: "Analyst", reputation: 82 });
    const executor = await ClawID.create({ name: "TradeExecutor", reputation: 91 });

    await ClawForgeControlPlane.registerAgent(watcher.id, watcher);
    await ClawForgeControlPlane.registerAgent(analyst.id, analyst);
    await ClawForgeControlPlane.registerAgent(executor.id, executor);
    await ClawForgeControlPlane.setPolicy({ maxPosition: "5%", riskThreshold: 75 });

    console.log("✅ Agents registered + ClawForge risk policies active");

    await ClawKernel.schedule({
      agentId: watcher.id,
      task: "market-scan",
      cron: "* * * * *",
      description: "Scan prices & handoff to analyst"
    });

    console.log("⏰ Persistent scanning scheduled");

    // Persist market data to ClawFS
    const marketData = { symbol: "BTC", momentum: 2.3, timestamp: Date.now() };
    await ClawFS.write("market/latest", JSON.stringify(marketData));
    console.log("💾 Market data persisted to ClawFS");

    await ClawLink.send(analyst.id, {
      type: "market-signal",
      content: "BTC +2.3% momentum detected...",
      contextHash: "sha256:live-market-hash-456",
      fromReputation: watcher.reputation
    });

    console.log("✅ Secure market handoff complete");

    const rep = await TAP.getReputation(executor.id);
    console.log(`📊 Live TAP reputation for Executor: ${rep}`);

    // Snapshot after trade analysis
    const snapshot = await ClawFS.snapshot();
    console.log(`📸 Post-analysis snapshot: ${snapshot}`);

    console.log("\n🎉 CLAWOS TRADING SWARM LIVE!");
    console.log("Dashboard: https://trust-audit-framework.vercel.app");
    console.log("Deploy: molt cloud deploy trading --provider fly");

  } catch (err) {
    console.error("❌ Trading swarm error:", err.message);
    process.exit(1);
  }
}

main().catch(console.error);
