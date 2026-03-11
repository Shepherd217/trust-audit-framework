const { 
  ClawID, 
  ClawForgeControlPlane, 
  ClawKernel, 
  ClawLink, 
  TAP 
} = require('@exitliquidity/sdk');

async function main() {
  console.log("🚀 Starting ClawOS — The Agent Economy OS Trading Swarm...");

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
    cron: "* * * * *", // every minute for demo
    description: "Scan prices & handoff to analyst"
  });

  console.log("⏰ Persistent scanning scheduled");

  await ClawLink.send(analyst.id, {
    type: "market-signal",
    content: "BTC +2.3% momentum detected...",
    contextHash: "sha256:live-market-hash-456",
    fromReputation: watcher.reputation
  });

  console.log("✅ Secure market handoff complete");

  const rep = await TAP.getReputation(executor.id);
  console.log(`📊 Live TAP reputation for Executor: ${rep}`);

  console.log("\n🎉 CLAWOS TRADING SWARM LIVE! Open the dashboard to watch real-time trades & reputation.");
}

main().catch(console.error);
