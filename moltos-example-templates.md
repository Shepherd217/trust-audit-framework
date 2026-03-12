# MoltOS Example Agent Templates

This document provides four production-ready agent templates that showcase the MoltOS platform capabilities. Each template demonstrates real-world patterns and best practices for building autonomous agents with ClawBus, ClawFS, and ClawScheduler.

---

## 1. Crypto Arbitrage Agent

### What It Actually Does

The Crypto Arbitrage Agent monitors decentralized exchanges (DEXs) for price discrepancies and executes profitable atomic arbitrage trades using flash loans. It operates as a "searcher" in the MEV (Maximal Extractable Value) ecosystem.

**Core Functions:**
- **Price Monitoring**: Watches multiple DEX liquidity pools (Uniswap V3, SushiSwap, Curve, Balancer) for price divergences
- **Opportunity Detection**: Calculates profitable arbitrage paths considering gas costs, slippage, and fees
- **Flash Loan Execution**: Borrows assets without collateral, executes trades atomically, repays loan + fee in single transaction
- **Risk Management**: Validates profitability thresholds, implements circuit breakers, tracks position limits
- **MEV Protection**: Uses private mempools (Flashbots Protect, MEV-Blocker) to prevent frontrunning

**Real-World Strategies:**
1. **Triangular Arbitrage**: A → B → C → A (e.g., USDC → ETH → WBTC → USDC)
2. **Cross-DEX Arbitrage**: Buy on Uniswap V3, sell on SushiSwap
3. **Cross-Chain Arbitrage**: Detect opportunities across L2s (Arbitrum, Optimism, Base)
4. **Liquidation Sniping**: Monitor lending protocols for underwater positions

### Tools & Capabilities Needed

```yaml
# agent.yaml
tools:
  # Blockchain Interaction
  - name: ethers
    type: external
    version: "^6.9.0"
  
  - name: viem
    type: external  # Modern alternative to ethers
    version: "^2.0.0"
  
  # DEX Integration
  - name: uniswap-v3-sdk
    type: external
    version: "^3.10.0"
  
  - name: @balancer-labs/sdk
    type: external
    version: "^1.1.0"
  
  # MEV Infrastructure
  - name: @flashbots/ethers-provider-bundle
    type: external
    version: "^1.0.0"
  
  # Price Oracles
  - name: chainlink-feeds
    type: skill
    provider: moltos
  
  # Notifications
  - name: telegram
    type: skill
    provider: moltos
  
  - name: discord-webhook
    type: skill
    provider: moltos

capabilities:
  - network: ethereum-mainnet
    rpc: ${ETH_RPC_URL}
    ws: ${ETH_WS_URL}
  
  - network: arbitrum-one
    rpc: ${ARB_RPC_URL}
  
  - network: base
    rpc: ${BASE_RPC_URL}
  
  secrets:
    - PRIVATE_KEY  # Agent wallet (hot wallet with limited funds)
    - FLASHBOTS_RELAY_KEY
    - TELEGRAM_BOT_TOKEN
```

### Code Structure

```
arb-agent/
├── agent.yaml              # Agent manifest
├── src/
│   ├── index.ts            # Entry point
│   ├── config/
│   │   ├── pools.ts        # Monitored liquidity pools
│   │   ├── tokens.ts       # Token definitions
│   │   └── thresholds.ts   # Profit/risk thresholds
│   ├── strategies/
│   │   ├── triangular.ts   # Triangular arb logic
│   │   ├── cross-dex.ts    # Cross-DEX arb logic
│   │   └── flash-loan.ts   # Aave/Balancer flash loan integration
│   ├── monitors/
│   │   ├── price-feed.ts   # Real-time price monitoring
│   │   └── mempool.ts      # Mempool scanning
│   ├── execution/
│   │   ├── bundler.ts      # Transaction bundling
│   │   ├── simulator.ts    # Profit simulation
│   │   └── submitter.ts    # Flashbots/block submission
│   ├── risk/
│   │   ├── circuit-breaker.ts
│   │   ├── gas-oracle.ts
│   │   └── profit-calc.ts
│   └── utils/
│       ├── math.ts
│       └── contracts.ts
├── abi/
│   ├── uniswap-v3.json
│   ├── aave-pool.json
│   └── erc20.json
└── tests/
    └── simulation.test.ts
```

### Core Implementation

```typescript
// src/index.ts
import { Agent, Bus, FS, Scheduler } from '@moltos/sdk';
import { PriceMonitor } from './monitors/price-feed';
import { ArbitrageEngine } from './strategies/engine';
import { RiskManager } from './risk/manager';
import { ExecutionService } from './execution/service';

interface ArbitrageOpportunity {
  path: string[];           // Token addresses
  pools: string[];          // Pool addresses
  amountIn: bigint;
  expectedProfit: bigint;
  gasCost: bigint;
  netProfit: bigint;
  confidence: number;       // 0-1 simulation confidence
}

const agent = new Agent({
  name: 'crypto-arbitrage',
  version: '1.0.0'
});

// Initialize components
const priceMonitor = new PriceMonitor();
const arbEngine = new ArbitrageEngine();
const riskManager = new RiskManager();
const execution = new ExecutionService();

// Subscribe to price updates from ClawBus
agent.onBus('price.update', async (msg: Bus.Message<PriceUpdate>) => {
  const { tokenPair, price, source, timestamp } = msg.payload;
  
  // Store price in ClawFS for persistence
  await FS.write(`prices/${source}/${tokenPair}.jsonl`, 
    JSON.stringify({ price, timestamp }) + '\n', 
    { append: true }
  );
  
  // Check for opportunities
  const opportunities = await arbEngine.findOpportunities(tokenPair, price);
  
  for (const opp of opportunities) {
    // Validate with risk manager
    const validated = await riskManager.validate(opp);
    
    if (validated.approved) {
      // Emit opportunity event
      agent.emit('arbitrage.detected', {
        opportunity: opp,
        riskScore: validated.score,
        timestamp: Date.now()
      });
    }
  }
});

// Execute arbitrage when opportunity detected
agent.onBus('arbitrage.execute', async (msg: Bus.Message<ExecuteRequest>) => {
  const { opportunity, executionMode } = msg.payload;
  
  // Double-check simulation
  const simulation = await execution.simulate(opportunity);
  
  if (!simulation.success || simulation.profit < MIN_PROFIT_THRESHOLD) {
    agent.emit('arbitrage.rejected', { 
      reason: 'simulation_failed', 
      opportunity 
    });
    return;
  }
  
  // Execute via Flashbots or public mempool
  const result = executionMode === 'flashbots' 
    ? await execution.submitFlashbots(opportunity)
    : await execution.submitPublic(opportunity);
  
  // Log execution
  await FS.write(`executions/${Date.now()}.json`, JSON.stringify({
    opportunity,
    result,
    timestamp: Date.now()
  }));
  
  // Notify via configured channels
  if (result.success) {
    agent.emit('notification.send', {
      channel: 'telegram',
      message: `✅ Arbitrage executed! Profit: ${formatEther(result.profit)} ETH`
    });
  }
});

// Scheduled tasks via ClawScheduler
Scheduler.every('15s', async () => {
  // Update gas price oracle
  const gasPrice = await riskManager.getGasPrice();
  await FS.write('state/gas-price.json', JSON.stringify(gasPrice));
});

Scheduler.every('1h', async () => {
  // Generate performance report
  const dailyStats = await generateDailyReport();
  agent.emit('report.daily', dailyStats);
});

// Circuit breaker monitoring
Scheduler.every('5s', async () => {
  const health = await riskManager.checkSystemHealth();
  if (!health.healthy) {
    agent.emit('circuit.breaker', { 
      reason: health.reason,
      timestamp: Date.now()
    });
    await agent.pause(); // Pause all trading
  }
});

agent.start();
```

```typescript
// src/strategies/flash-loan.ts
import { ethers } from 'ethers';
import { AAVE_POOL_ABI, FLASH_LOAN_ABI } from '../abi';

export class FlashLoanArbitrage {
  private aavePool: ethers.Contract;
  
  constructor(provider: ethers.Provider) {
    this.aavePool = new ethers.Contract(
      AAVE_POOL_ADDRESS,
      AAVE_POOL_ABI,
      provider
    );
  }
  
  async executeFlashLoanArbitrage(
    opportunity: ArbitrageOpportunity
  ): Promise<ExecutionResult> {
    // Encode arbitrage path
    const params = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address[]', 'address[]', 'uint24[]'],
      [opportunity.path, opportunity.pools, opportunity.fees]
    );
    
    // Flash loan callback will execute our trading logic
    const tx = await this.aavePool.flashLoanSimple(
      FLASH_LOAN_RECEIVER_ADDRESS,
      opportunity.path[0],  // Asset to borrow
      opportunity.amountIn,
      params,
      0  // Referral code
    );
    
    return await tx.wait();
  }
  
  // Callback function executed by Aave during flash loan
  async executeArbitrage(
    asset: string,
    amount: bigint,
    premium: bigint,
    initiator: string,
    params: string
  ): Promise<boolean> {
    // Decode arbitrage parameters
    const [path, pools, fees] = ethers.AbiCoder.defaultAbiCoder().decode(
      ['address[]', 'address[]', 'uint24[]'],
      params
    );
    
    // Execute swaps through the path
    for (let i = 0; i < path.length - 1; i++) {
      await this.executeSwap(pools[i], path[i], path[i + 1], fees[i]);
    }
    
    // Approve repayment
    const totalRepayment = amount + premium;
    await this.approveToken(asset, AAVE_POOL_ADDRESS, totalRepayment);
    
    return true;
  }
}
```

### How It Uses MoltOS Primitives

**ClawBus Usage:**
- `price.update` - Real-time price feeds from DEX monitors
- `arbitrage.detected` - Internal signals for validated opportunities
- `arbitrage.execute` - Execution commands with full context
- `circuit.breaker` - Risk-driven pause signals
- `notification.send` - Cross-channel alerting

**ClawFS Usage:**
- `/prices/{source}/{pair}.jsonl` - Time-series price data
- `/state/gas-price.json` - Current gas oracle state
- `/executions/{timestamp}.json` - Audit trail of all trades
- `/config/thresholds.json` - Dynamic risk parameters

**ClawScheduler Usage:**
- `every('15s')` - Gas price updates
- `every('5s')` - Circuit breaker health checks
- `every('1h')` - Performance reports and balance reconciliation
- `at('00:00')` - Daily settlement and profit withdrawal

### Forge Command

```bash
# Basic creation with defaults
moltos forge arb-agent --template crypto-arbitrage

# Production-grade setup with all configurations
moltos forge arb-agent \
  --template crypto-arbitrage \
  --networks ethereum,arbitrum,base \
  --strategies triangular,cross-dex,flash-loan \
  --mev-protection flashbots \
  --risk-profile conservative \
  --min-profit 0.01 \
  --max-slippage 0.005 \
  --circuit-breaker true \
  --notifications telegram,discord \
  --enable-monitoring

# With custom DEX configuration
moltos forge arb-agent \
  --template crypto-arbitrage \
  --dex-config ./custom-pools.yaml \
  --flash-loan-provider aave \
  --simulation-before-execute true
```

---

## 2. Content Moderation Agent

### What It Actually Does

The Content Moderation Agent monitors Discord/Slack communities in real-time, detecting toxic content, spam, and policy violations using AI models. It implements a hybrid approach: AI for scale, humans for nuanced decisions.

**Core Functions:**
- **Real-time Monitoring**: Watches all messages across configured channels
- **Toxicity Detection**: Uses ML models (Perspective API, custom classifiers) to score content
- **Spam Detection**: Identifies repetitive messages, invite spam, scam links
- **Policy Enforcement**: Custom rules for community-specific guidelines
- **Human Escalation**: Routes borderline cases to human moderators
- **Action Execution**: Warns, mutes, kicks, bans based on severity
- **Audit Logging**: Complete moderation trail for transparency

**Detection Categories:**
- Toxicity (toxicity, severe_toxicity, identity_attack, insult, threat)
- Spam (repetitive, phishing, invite spam, scam links)
- Policy Violations (off-topic, self-promotion, NSFW)
- Behavior Patterns (raid detection, ban evasion)

### Tools & Capabilities Needed

```yaml
# agent.yaml
tools:
  # Platform Integration
  - name: discord.js
    type: external
    version: "^14.14.0"
  
  - name: @slack/bolt
    type: external
    version: "^3.17.0"
  
  # AI/ML Models
  - name: @google-cloud/language
    type: external  # Perspective API client
    version: "^6.0.0"
  
  - name: transformers.js
    type: external  # On-device inference
    version: "^2.15.0"
  
  # Data Storage
  - name: sqlite
    type: skill
    provider: moltos
  
  # Human Escalation
  - name: mod-queue
    type: skill
    provider: moltos
  
  # Notifications
  - name: discord-webhook
    type: skill
    provider: moltos

capabilities:
  platforms:
    - discord
    - slack
  
  ai-models:
    - perspective-api
    - local-toxicity-classifier
  
  storage:
    type: sqlite
    path: /data/moderation.db
```

### Code Structure

```
mod-agent/
├── agent.yaml
├── src/
│   ├── index.ts
│   ├── platforms/
│   │   ├── discord.ts      # Discord.js integration
│   │   └── slack.ts        # Slack Bolt integration
│   ├── detectors/
│   │   ├── toxicity.ts     # Perspective API wrapper
│   │   ├── spam.ts         # Spam pattern detection
│   │   ├── phishing.ts     # Link analysis
│   │   └── custom-rules.ts # Community policy engine
│   ├── actions/
│   │   ├── warn.ts
│   │   ├── mute.ts
│   │   ├── kick.ts
│   │   ├── ban.ts
│   │   └── delete.ts
│   ├── escalation/
│   │   ├── human-queue.ts  # Human review system
│   │   └── confidence.ts   # Escalation scoring
│   ├── context/
│   │   ├── user-history.ts # User strike tracking
│   │   └── channel-state.ts
│   └── utils/
│       ├── hash.ts         # Content hashing for dedup
│       └── patterns.ts
├── models/
│   └── toxicity.onnx       # Local model for offline detection
├── rules/
│   ├── default-policy.yaml
│   └── community-rules/
└── tests/
    └── detection.test.ts
```

### Core Implementation

```typescript
// src/index.ts
import { Agent, Bus, FS, Scheduler } from '@moltos/sdk';
import { DiscordPlatform } from './platforms/discord';
import { SlackPlatform } from './platforms/slack';
import { ToxicityDetector } from './detectors/toxicity';
import { SpamDetector } from './detectors/spam';
import { ActionEngine } from './actions/engine';
import { EscalationQueue } from './escalation/human-queue';

interface ModerationDecision {
  messageId: string;
  userId: string;
  channelId: string;
  platform: 'discord' | 'slack';
  content: string;
  scores: {
    toxicity: number;
    spam: number;
    custom: number;
  };
  decision: 'allow' | 'warn' | 'delete' | 'mute' | 'kick' | 'ban' | 'escalate';
  reason: string;
  confidence: number;
}

const agent = new Agent({ name: 'content-moderator' });

// Initialize detectors
const toxicityDetector = new ToxicityDetector({
  perspectiveApiKey: process.env.PERSPECTIVE_API_KEY,
  localModelPath: './models/toxicity.onnx',
  thresholds: {
    toxicity: 0.7,
    severeToxicity: 0.5,
    identityAttack: 0.6,
    threat: 0.6
  }
});

const spamDetector = new SpamDetector({
  maxDuplicates: 3,
  timeWindow: 60000, // 1 minute
  blockedDomains: ['scam-site.com', 'fake-nft.io']
});

const actionEngine = new ActionEngine();
const humanQueue = new EscalationQueue();

// Process incoming messages
async function processMessage(message: PlatformMessage): Promise<void> {
  // Skip moderators and bots
  if (message.author.isMod || message.author.isBot) return;
  
  // Run detection in parallel
  const [toxicity, spam] = await Promise.all([
    toxicityDetector.analyze(message.content),
    spamDetector.analyze(message)
  ]);
  
  // Calculate combined score
  const decision = await makeModerationDecision({
    message,
    toxicity,
    spam,
    userHistory: await getUserHistory(message.author.id)
  });
  
  // Log to ClawFS for audit trail
  await FS.write(`moderation/${message.platform}/${Date.now()}.json`, 
    JSON.stringify(decision)
  );
  
  // Execute decision
  if (decision.decision === 'escalate') {
    await humanQueue.submit({
      decision,
      context: await gatherContext(message),
      priority: calculatePriority(decision)
    });
  } else if (decision.decision !== 'allow') {
    await actionEngine.execute(decision);
  }
  
  // Emit event for real-time dashboards
  agent.emit('moderation.decision', decision);
}

// Decision engine
async function makeModerationDecision(
  input: DecisionInput
): Promise<ModerationDecision> {
  const { message, toxicity, spam, userHistory } = input;
  
  // High confidence toxic content = immediate action
  if (toxicity.severeToxicity > 0.8 || toxicity.threat > 0.9) {
    return {
      ...baseDecision(message),
      decision: 'ban',
      reason: 'Severe toxicity detected',
      confidence: 0.95
    };
  }
  
  // Confirmed spam = delete + warn
  if (spam.confidence > 0.9) {
    const strikes = userHistory.spamStrikes || 0;
    return {
      ...baseDecision(message),
      decision: strikes >= 2 ? 'mute' : 'delete',
      reason: 'Spam detected',
      confidence: spam.confidence
    };
  }
  
  // Borderline cases = escalate to humans
  if (toxicity.toxicity > 0.6 && toxicity.toxicity < 0.8) {
    return {
      ...baseDecision(message),
      decision: 'escalate',
      reason: 'Borderline toxicity - human review needed',
      confidence: toxicity.toxicity
    };
  }
  
  // Check custom community rules
  const customViolation = await checkCustomRules(message);
  if (customViolation) {
    return {
      ...baseDecision(message),
      decision: customViolation.action,
      reason: customViolation.reason,
      confidence: 0.85
    };
  }
  
  return {
    ...baseDecision(message),
    decision: 'allow',
    reason: 'No violations detected',
    confidence: 0.9
  };
}

// Platform adapters
const discord = new DiscordPlatform({
  token: process.env.DISCORD_TOKEN,
  intents: ['GUILDS', 'GUILD_MESSAGES', 'MESSAGE_CONTENT']
});

discord.onMessage(processMessage);

const slack = new SlackPlatform({
  token: process.env.SLACK_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

slack.onMessage(processMessage);

// Scheduled maintenance
Scheduler.every('1h', async () => {
  // Clean old message hashes (spam deduplication)
  await spamDetector.cleanOldHashes(24 * 60 * 60 * 1000); // 24h
});

Scheduler.every('1d', async () => {
  // Generate moderation report
  const report = await generateModerationReport();
  agent.emit('moderation.daily-report', report);
});

// Listen for human moderator decisions
agent.onBus('moderation.human-decision', async (msg) => {
  const { originalDecision, humanDecision, moderatorId } = msg.payload;
  
  // Apply human decision
  await actionEngine.execute({
    ...originalDecision,
    decision: humanDecision.action,
    reason: humanDecision.reason
  });
  
  // Log for model retraining
  await FS.write('training/feedback.jsonl', JSON.stringify({
    content: originalDecision.content,
    aiDecision: originalDecision.decision,
    humanDecision: humanDecision.action,
    timestamp: Date.now()
  }) + '\n', { append: true });
});

agent.start();
```

```typescript
// src/detectors/toxicity.ts
import { PerspectiveAPI } from '@google-cloud/language';
import { pipeline } from '@xenova/transformers';

export class ToxicityDetector {
  private perspective: PerspectiveAPI;
  private localClassifier: any;
  private useLocal: boolean;
  
  constructor(config: ToxicityConfig) {
    this.perspective = new PerspectiveAPI(config.perspectiveApiKey);
    this.useLocal = !config.perspectiveApiKey;
  }
  
  async analyze(content: string): Promise<ToxicityScores> {
    // Use local model if API unavailable (privacy mode)
    if (this.useLocal) {
      return await this.analyzeLocal(content);
    }
    
    // Call Perspective API
    const result = await this.perspective.analyze({
      comment: { text: content },
      languages: ['en'],
      requestedAttributes: {
        TOXICITY: {},
        SEVERE_TOXICITY: {},
        IDENTITY_ATTACK: {},
        INSULT: {},
        THREAT: {},
        PROFANITY: {}
      }
    });
    
    return {
      toxicity: result.attributeScores.TOXICITY.summaryScore.value,
      severeToxicity: result.attributeScores.SEVERE_TOXICITY?.summaryScore.value || 0,
      identityAttack: result.attributeScores.IDENTITY_ATTACK?.summaryScore.value || 0,
      insult: result.attributeScores.INSULT?.summaryScore.value || 0,
      threat: result.attributeScores.THREAT?.summaryScore.value || 0,
      profanity: result.attributeScores.PROFANITY?.summaryScore.value || 0
    };
  }
  
  private async analyzeLocal(content: string): Promise<ToxicityScores> {
    if (!this.localClassifier) {
      this.localClassifier = await pipeline(
        'text-classification',
        'Xenova/toxic-bert'
      );
    }
    
    const result = await this.localClassifier(content);
    return {
      toxicity: result[0].label === 'toxic' ? result[0].score : 0,
      severeToxicity: 0, // Local model doesn't distinguish
      identityAttack: 0,
      insult: 0,
      threat: 0,
      profanity: 0
    };
  }
}
```

```typescript
// src/escalation/human-queue.ts
import { Bus } from '@moltos/sdk';

export class EscalationQueue {
  private queue: EscalationItem[] = [];
  
  async submit(item: EscalationItem): Promise<void> {
    // Store in queue
    this.queue.push({
      ...item,
      id: generateId(),
      submittedAt: Date.now(),
      status: 'pending'
    });
    
    // Sort by priority
    this.queue.sort((a, b) => b.priority - a.priority);
    
    // Notify moderators
    await this.notifyModerators(item);
  }
  
  async notifyModerators(item: EscalationItem): Promise<void> {
    const embed = {
      title: '🚨 Content Requires Review',
      description: item.decision.content.substring(0, 500),
      fields: [
        { name: 'Platform', value: item.decision.platform, inline: true },
        { name: 'User', value: `<@${item.decision.userId}>`, inline: true },
        { name: 'AI Decision', value: item.decision.decision, inline: true },
        { name: 'Toxicity Score', value: `${item.decision.scores.toxicity.toFixed(2)}`, inline: true },
        { name: 'Confidence', value: `${item.decision.confidence.toFixed(2)}`, inline: true },
        { name: 'Reason', value: item.decision.reason }
      ],
      timestamp: new Date().toISOString()
    };
    
    // Send to mod channel
    await Bus.emit('discord.send-embed', {
      channelId: process.env.MOD_CHANNEL_ID,
      embed,
      components: [
        {
          type: 'ACTION_ROW',
          components: [
            { type: 'BUTTON', customId: `approve-${item.id}`, label: '✅ Approve AI', style: 'SUCCESS' },
            { type: 'BUTTON', customId: `reject-${item.id}`, label: '❌ Reject', style: 'DANGER' },
            { type: 'BUTTON', customId: `ban-${item.id}`, label: '🔨 Ban', style: 'DANGER' }
          ]
        }
      ]
    });
  }
}
```

### How It Uses MoltOS Primitives

**ClawBus Usage:**
- `moderation.decision` - Real-time decision events for dashboards
- `moderation.human-decision` - Human moderator override signals
- `discord.send-embed` - Rich notifications to mod channels
- `user.strike-update` - Cross-platform user reputation

**ClawFS Usage:**
- `/moderation/{platform}/{timestamp}.json` - Complete audit log
- `/training/feedback.jsonl` - Human-AI disagreement for retraining
- `/user-history/{userId}.json` - Cross-server strike tracking
- `/rules/{community}.yaml` - Custom policy configurations

**ClawScheduler Usage:**
- `every('1h')` - Spam hash cleanup
- `every('1d')` - Daily moderation reports
- `every('1w')` - User strike decay (forgiveness)

### Forge Command

```bash
# Basic Discord moderation bot
moltos forge mod-agent --template content-moderation --platform discord

# Full multi-platform with human escalation
moltos forge mod-agent \
  --template content-moderation \
  --platforms discord,slack \
  --detectors toxicity,spam,phishing \
  --ai-provider perspective-api \
  --local-fallback true \
  --human-escalation true \
  --escalation-threshold 0.7 \
  --actions warn,delete,mute,kick,ban \
  --strike-system true \
  --appeal-system true

# Privacy-focused (no cloud AI)
moltos forge mod-agent \
  --template content-moderation \
  --ai-provider local-only \
  --models ./custom-models \
  --on-device true
```

---

## 3. Data Pipeline Agent

### What It Actually Does

The Data Pipeline Agent automates ETL (Extract, Transform, Load) workflows, handling data ingestion from multiple sources, transformation, and delivery to destinations. It supports both batch and streaming patterns.

**Core Functions:**
- **Multi-Source Ingestion**: APIs, databases, webhooks, files (S3, SFTP)
- **Schema Validation**: JSON Schema, Protobuf, custom validation
- **Data Transformation**: Map, filter, aggregate, enrich, normalize
- **Error Handling**: Dead letter queues, retries, circuit breakers
- **Destination Delivery**: Warehouses, lakes, APIs, webhooks
- **Observability**: Data lineage, quality metrics, alerts

**Pipeline Patterns:**
1. **Webhook Ingestion**: Real-time event ingestion from SaaS platforms
2. **CDC Streaming**: Database change data capture (Postgres, MySQL)
3. **Batch ETL**: Scheduled bulk data processing
4. **Stream Processing**: Real-time transformation and routing

### Tools & Capabilities Needed

```yaml
# agent.yaml
tools:
  # Database connectors
  - name: pg-client
    type: skill
    provider: moltos
  
  - name: mysql-client
    type: skill
    provider: moltos
  
  - name: mongodb-client
    type: skill
    provider: moltos
  
  # Storage
  - name: s3-client
    type: skill
    provider: moltos
  
  - name: gcs-client
    type: skill
    provider: moltos
  
  # Message queues
  - name: kafka-client
    type: skill
    provider: moltos
  
  - name: redis-client
    type: skill
    provider: moltos
  
  # Data warehouses
  - name: snowflake-client
    type: skill
    provider: moltos
  
  - name: bigquery-client
    type: skill
    provider: moltos
  
  # HTTP/Webhook
  - name: webhook-server
    type: skill
    provider: moltos
  
  - name: http-client
    type: skill
    provider: moltos
  
  # Data processing
  - name: jsonata
    type: external
    version: "^2.0.0"
  
  - name: zod
    type: external  # Schema validation
    version: "^3.22.0"

capabilities:
  storage:
    - type: s3
      bucket: ${DATA_BUCKET}
    - type: local
      path: /data/pipeline
  
  queue:
    type: redis
    url: ${REDIS_URL}
```

### Code Structure

```
pipeline-agent/
├── agent.yaml
├── src/
│   ├── index.ts
│   ├── sources/
│   │   ├── webhook.ts      # HTTP webhook receiver
│   │   ├── database.ts     # CDC and polling
│   │   ├── s3.ts           # S3 event listener
│   │   └── api-poll.ts     # REST API polling
│   ├── transforms/
│   │   ├── map.ts          # Field mapping
│   │   ├── filter.ts       # Conditional filtering
│   │   ├── enrich.ts       # Data enrichment
│   │   ├── aggregate.ts    # Windowed aggregation
│   │   └── normalize.ts    # Schema normalization
│   ├── destinations/
│   │   ├── warehouse.ts    # Snowflake/BigQuery
│   │   ├── webhook-out.ts  # Outgoing webhooks
│   │   ├── s3-out.ts       # File output
│   │   └── api-post.ts     # API POST
│   ├── validation/
│   │   ├── json-schema.ts
│   │   └── custom-rules.ts
│   ├── error-handling/
│   │   ├── dead-letter.ts
│   │   ├── retry.ts
│   │   └── circuit-breaker.ts
│   └── observability/
│       ├── metrics.ts
│       └── lineage.ts
├── pipelines/
│   ├── user-events.yaml
│   ├── orders-etl.yaml
│   └── logs-stream.yaml
└── schemas/
    ├── user-event.json
    └── order.json
```

### Core Implementation

```typescript
// src/index.ts
import { Agent, Bus, FS, Scheduler } from '@moltos/sdk';
import { WebhookSource } from './sources/webhook';
import { DatabaseSource } from './sources/database';
import { TransformEngine } from './transforms/engine';
import { DestinationRouter } from './destinations/router';
import { SchemaValidator } from './validation/schema';
import { ErrorHandler } from './error-handling/manager';
import { MetricsCollector } from './observability/metrics';

interface PipelineConfig {
  id: string;
  source: SourceConfig;
  transforms: TransformConfig[];
  destination: DestinationConfig;
  schema: object;
  errorHandling: ErrorHandlingConfig;
}

interface PipelineMessage {
  id: string;
  pipelineId: string;
  data: any;
  metadata: {
    source: string;
    timestamp: number;
    attempt: number;
  };
}

const agent = new Agent({ name: 'data-pipeline' });

// Initialize components
const validator = new SchemaValidator();
const transforms = new TransformEngine();
const destinations = new DestinationRouter();
const errorHandler = new ErrorHandler();
const metrics = new MetricsCollector();

// Load pipeline configurations
const pipelines: Map<string, PipelineConfig> = new Map();

async function loadPipelines(): Promise<void> {
  const configs = await FS.list('pipelines/');
  for (const config of configs) {
    const pipeline = await FS.read(`pipelines/${config}`);
    pipelines.set(pipeline.id, pipeline);
    
    // Initialize source for each pipeline
    await initializeSource(pipeline);
  }
}

// Webhook source handler
const webhookSource = new WebhookSource({
  port: 8080,
  path: '/webhook/:pipelineId',
  verifySignature: true
});

webhookSource.onRequest(async (req, pipelineId) => {
  const pipeline = pipelines.get(pipelineId);
  if (!pipeline) {
    return { status: 404, body: { error: 'Pipeline not found' } };
  }
  
  const message: PipelineMessage = {
    id: generateUUID(),
    pipelineId,
    data: req.body,
    metadata: {
      source: 'webhook',
      timestamp: Date.now(),
      attempt: 1
    }
  };
  
  // Emit for async processing
  agent.emit('pipeline.message.received', message);
  
  return { status: 202, body: { id: message.id, status: 'accepted' } };
});

// Main processing pipeline
agent.onBus('pipeline.message.received', async (msg: Bus.Message<PipelineMessage>) => {
  const message = msg.payload;
  const pipeline = pipelines.get(message.pipelineId);
  
  await metrics.record('messages.received', 1, { pipeline: message.pipelineId });
  
  try {
    // Step 1: Schema validation
    const validation = await validator.validate(message.data, pipeline.schema);
    if (!validation.valid) {
      await errorHandler.handleValidationError(message, validation.errors);
      await metrics.record('messages.validation_failed', 1);
      return;
    }
    
    // Step 2: Transformations
    let transformedData = message.data;
    for (const transform of pipeline.transforms) {
      transformedData = await transforms.apply(transformedData, transform);
    }
    
    // Step 3: Enrich with metadata
    const enrichedMessage = {
      ...message,
      data: transformedData,
      metadata: {
        ...message.metadata,
        transformedAt: Date.now()
      }
    };
    
    // Step 4: Deliver to destination
    await destinations.deliver(enrichedMessage, pipeline.destination);
    
    // Step 5: Success logging
    await FS.write(`success/${message.pipelineId}/${Date.now()}.json`, 
      JSON.stringify(enrichedMessage)
    );
    
    await metrics.record('messages.delivered', 1, { 
      pipeline: message.pipelineId,
      destination: pipeline.destination.type
    });
    
    agent.emit('pipeline.message.delivered', enrichedMessage);
    
  } catch (error) {
    await errorHandler.handleProcessingError(message, error, pipeline.errorHandling);
  }
});

// CDC Source - Database change capture
const dbSource = new DatabaseSource({
  connections: [
    { name: 'users-db', type: 'postgres', url: process.env.USERS_DB_URL },
    { name: 'orders-db', type: 'mysql', url: process.env.ORDERS_DB_URL }
  ]
});

dbSource.onChange(async (change: CDCChange) => {
  const message: PipelineMessage = {
    id: generateUUID(),
    pipelineId: `cdc-${change.database}`,
    data: change,
    metadata: {
      source: 'cdc',
      timestamp: Date.now(),
      attempt: 1
    }
  };
  
  agent.emit('pipeline.message.received', message);
});

// Batch ETL jobs via Scheduler
Scheduler.every('1h', async () => {
  await runBatchETL('hourly-user-aggregation');
});

Scheduler.every('1d', async () => {
  await runBatchETL('daily-revenue-report');
});

async function runBatchETL(jobId: string): Promise<void> {
  const job = await FS.read(`jobs/${jobId}.yaml`);
  
  agent.emit('pipeline.batch.started', { jobId, timestamp: Date.now() });
  
  // Extract
  const rawData = await extractFromSource(job.source);
  
  // Transform
  const transformedData = await transforms.applyBatch(rawData, job.transforms);
  
  // Load
  await destinations.deliverBatch(transformedData, job.destination);
  
  agent.emit('pipeline.batch.completed', { 
    jobId, 
    records: transformedData.length,
    timestamp: Date.now()
  });
}

// Dead letter queue reprocessing
Scheduler.every('5m', async () => {
  const deadLetters = await FS.list('dead-letter/');
  
  for (const dl of deadLetters.slice(0, 100)) { // Process in batches
    const message = await FS.read(`dead-letter/${dl}`);
    
    if (message.metadata.attempt < MAX_RETRIES) {
      // Re-queue
      message.metadata.attempt++;
      agent.emit('pipeline.message.received', message);
      await FS.delete(`dead-letter/${dl}`);
    }
  }
});

// Initialize
await loadPipelines();
webhookSource.start();
dbSource.start();
agent.start();
```

```typescript
// src/transforms/engine.ts
import jsonata from 'jsonata';

export class TransformEngine {
  
  async apply(data: any, config: TransformConfig): Promise<any> {
    switch (config.type) {
      case 'map':
        return this.applyMap(data, config);
      
      case 'filter':
        return this.applyFilter(data, config);
      
      case 'jsonata':
        return this.applyJsonata(data, config);
      
      case 'enrich':
        return this.applyEnrichment(data, config);
      
      case 'aggregate':
        return this.applyAggregation(data, config);
      
      default:
        throw new Error(`Unknown transform type: ${config.type}`);
    }
  }
  
  private applyMap(data: any, config: MapConfig): any {
    const result: any = {};
    
    for (const [targetField, sourceSpec] of Object.entries(config.mappings)) {
      if (typeof sourceSpec === 'string') {
        // Simple field mapping
        result[targetField] = this.getNestedValue(data, sourceSpec);
      } else if (sourceSpec.transform) {
        // Transform function
        result[targetField] = sourceSpec.transform(data);
      }
    }
    
    return result;
  }
  
  private async applyJsonata(data: any, config: JsonataConfig): Promise<any> {
    const expression = jsonata(config.expression);
    return await expression.evaluate(data);
  }
  
  private async applyEnrichment(data: any, config: EnrichConfig): Promise<any> {
    const enrichments: Record<string, any> = {};
    
    for (const enrichment of config.enrichments) {
      switch (enrichment.source) {
        case 'api':
          enrichments[enrichment.targetField] = await fetch(
            enrichment.url.replace('{{value}}', this.getNestedValue(data, enrichment.sourceField))
          ).then(r => r.json());
          break;
        
        case 'lookup':
          enrichments[enrichment.targetField] = await this.lookup(
            enrichment.table,
            this.getNestedValue(data, enrichment.sourceField)
          );
          break;
        
        case 'geocode':
          enrichments[enrichment.targetField] = await this.geocode(
            this.getNestedValue(data, enrichment.sourceField)
          );
          break;
      }
    }
    
    return { ...data, ...enrichments };
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o?.[p], obj);
  }
}
```

```typescript
// src/destinations/router.ts
import { SnowflakeClient } from '@moltos/snowflake';
import { BigQueryClient } from '@moltos/bigquery';
import { S3Client } from '@moltos/s3';

export class DestinationRouter {
  private clients: Map<string, any> = new Map();
  
  constructor() {
    this.clients.set('snowflake', new SnowflakeClient());
    this.clients.set('bigquery', new BigQueryClient());
    this.clients.set('s3', new S3Client());
    this.clients.set('webhook', new WebhookClient());
  }
  
  async deliver(message: PipelineMessage, config: DestinationConfig): Promise<void> {
    const client = this.clients.get(config.type);
    if (!client) {
      throw new Error(`Unknown destination type: ${config.type}`);
    }
    
    switch (config.type) {
      case 'snowflake':
      case 'bigquery':
        await client.insert(config.table, [message.data]);
        break;
      
      case 's3':
        const key = `${config.prefix}/${message.pipelineId}/${Date.now()}.json`;
        await client.putObject(config.bucket, key, JSON.stringify(message.data));
        break;
      
      case 'webhook':
        await client.post(config.url, message.data, {
          headers: config.headers,
          retry: config.retry
        });
        break;
      
      case 'kafka':
        await client.produce(config.topic, message.data, {
          key: message.data[config.keyField]
        });
        break;
    }
  }
  
  async deliverBatch(messages: PipelineMessage[], config: DestinationConfig): Promise<void> {
    const client = this.clients.get(config.type);
    
    if (config.type === 'snowflake' || config.type === 'bigquery') {
      // Batch insert for warehouses
      await client.insert(config.table, messages.map(m => m.data));
    } else if (config.type === 's3') {
      // Parquet batch for analytics
      const parquetData = await convertToParquet(messages);
      const key = `${config.prefix}/batch-${Date.now()}.parquet`;
      await client.putObject(config.bucket, key, parquetData);
    }
  }
}
```

### How It Uses MoltOS Primitives

**ClawBus Usage:**
- `pipeline.message.received` - New data ingestion events
- `pipeline.message.delivered` - Successful delivery confirmation
- `pipeline.batch.started/completed` - Batch job lifecycle
- `pipeline.error.validation` - Schema validation failures

**ClawFS Usage:**
- `/pipelines/{name}.yaml` - Pipeline configuration storage
- `/success/{pipeline}/{timestamp}.json` - Delivery audit log
- `/dead-letter/{id}.json` - Failed message queue
- `/schemas/{name}.json` - JSON Schema definitions
- `/jobs/{name}.yaml` - Batch job definitions

**ClawScheduler Usage:**
- `every('1h')` - Hourly aggregation jobs
- `every('1d')` - Daily reports
- `every('5m')` - Dead letter reprocessing
- `at('00:00')` - Midnight ETL kickoff

### Forge Command

```bash
# Basic webhook ingestion pipeline
moltos forge pipeline-agent \
  --template data-pipeline \
  --source webhook \
  --destination s3

# Full CDC streaming pipeline
moltos forge pipeline-agent \
  --template data-pipeline \
  --source postgres-cdc \
  --transforms map,filter,enrich \
  --destination snowflake \
  --schema-validation true \
  --dead-letter-queue true \
  --exactly-once true

# Multi-destination fanout
moltos forge pipeline-agent \
  --template data-pipeline \
  --source webhook \
  --destinations s3,webhook,kafka \
  --transforms jsonata \
  --retry-policy exponential \
  --max-retries 5 \
  --circuit-breaker true \
  --observability datadog
```

---

## 4. Customer Support Agent

### What It Actually Does

The Customer Support Agent provides intelligent, 24/7 customer service through multiple channels (chat, email, voice). It uses RAG (Retrieval-Augmented Generation) to answer questions accurately and knows when to escalate to humans.

**Core Functions:**
- **Multi-Channel Support**: Web widget, email, Slack, Discord, WhatsApp
- **Intent Classification**: Understands customer requests and categorizes them
- **RAG-Based Answers**: Retrieves relevant knowledge base articles to ground responses
- **Action Execution**: Looks up orders, creates tickets, processes refunds
- **Smart Escalation**: Detects frustration, complex issues, and policy exceptions
- **Human Handoff**: Seamless transition with full context preservation
- **Continuous Learning**: Feedback loop from resolved conversations

**Resolution Flow:**
1. Customer sends message
2. Intent classified (question, complaint, request)
3. Knowledge base retrieved (RAG)
4. Response generated with citations
5. Confidence checked → auto-reply or human queue
6. Actions executed if needed (order lookup, ticket creation)
7. Satisfaction collected
8. Conversation logged for training

### Tools & Capabilities Needed

```yaml
# agent.yaml
tools:
  # Channel integrations
  - name: intercom-client
    type: skill
    provider: moltos
  
  - name: zendesk-client
    type: skill
    provider: moltos
  
  - name: slack-client
    type: skill
    provider: moltos
  
  - name: email-imap
    type: skill
    provider: moltos
  
  # AI/LLM
  - name: openai
    type: skill
    provider: moltos
  
  - name: anthropic
    type: skill
    provider: moltos
  
  # Vector DB for RAG
  - name: pinecone-client
    type: external
    version: "^2.0.0"
  
  - name: chromadb
    type: external
    version: "^1.5.0"
  
  # Embeddings
  - name: openai-embeddings
    type: skill
    provider: moltos
  
  # CRM integrations
  - name: salesforce-client
    type: skill
    provider: moltos
  
  - name: shopify-client
    type: skill
    provider: moltos
  
  # Analytics
  - name: mixpanel
    type: skill
    provider: moltos

capabilities:
  llm:
    provider: openai
    model: gpt-4-turbo-preview
    fallback: claude-3-opus
  
  vector-db:
    provider: pinecone
    index: support-kb
  
  channels:
    - web
    - email
    - slack
    - whatsapp
```

### Code Structure

```
support-agent/
├── agent.yaml
├── src/
│   ├── index.ts
│   ├── channels/
│   │   ├── web-widget.ts
│   │   ├── email.ts
│   │   ├── slack.ts
│   │   └── intercom.ts
│   ├── nlu/
│   │   ├── intent-classifier.ts
│   │   ├── entity-extractor.ts
│   │   └── sentiment-analyzer.ts
│   ├── rag/
│   │   ├── embedder.ts
│   │   ├── retriever.ts
│   │   └── generator.ts
│   ├── actions/
│   │   ├── order-lookup.ts
│   │   ├── ticket-create.ts
│   │   ├── refund-process.ts
│   │   └── subscription-manage.ts
│   ├── escalation/
│   │   ├── handoff-manager.ts
│   │   ├── confidence-scorer.ts
│   │   └── human-queue.ts
│   ├── memory/
│   │   ├── conversation-store.ts
│   │   └── user-context.ts
│   └── knowledge/
│       ├── indexer.ts
│       └── sync.ts
├── knowledge-base/
│   ├── docs/
│   ├── faqs/
│   └── past-tickets/
└── prompts/
    ├── system.txt
    ├── escalation.txt
    └── handoff-summary.txt
```

### Core Implementation

```typescript
// src/index.ts
import { Agent, Bus, FS, Scheduler } from '@moltos/sdk';
import { WebWidgetChannel } from './channels/web-widget';
import { EmailChannel } from './channels/email';
import { IntentClassifier } from './nlu/intent-classifier';
import { SentimentAnalyzer } from './nlu/sentiment-analyzer';
import { RAGEngine } from './rag/engine';
import { ActionRouter } from './actions/router';
import { EscalationManager } from './escalation/manager';
import { ConversationMemory } from './memory/conversation';

interface SupportConversation {
  id: string;
  channel: string;
  customer: {
    id: string;
    email?: string;
    name?: string;
    tier: 'free' | 'paid' | 'enterprise';
    history: ConversationSummary[];
  };
  messages: Message[];
  context: {
    intent?: string;
    entities?: Record<string, any>;
    sentiment: number;
    escalationRisk: number;
  };
  status: 'active' | 'waiting' | 'escalated' | 'resolved';
  assignedTo?: string; // Human agent ID
}

const agent = new Agent({ name: 'customer-support' });

// Initialize components
const intentClassifier = new IntentClassifier();
const sentimentAnalyzer = new SentimentAnalyzer();
const ragEngine = new RAGEngine({
  vectorStore: 'pinecone',
  embeddingModel: 'text-embedding-3-large',
  topK: 5
});
const actionRouter = new ActionRouter();
const escalationManager = new EscalationManager();
const memory = new ConversationMemory();

// Channel adapters
const webWidget = new WebWidgetChannel({ port: 3000 });
const emailChannel = new EmailChannel({
  imap: process.env.IMAP_CONFIG,
  smtp: process.env.SMTP_CONFIG
});

// Handle incoming messages from any channel
async function handleCustomerMessage(
  message: CustomerMessage,
  channel: string
): Promise<void> {
  // Load or create conversation
  let conversation = await memory.getActive(message.customerId);
  
  if (!conversation) {
    conversation = await createConversation(message, channel);
  }
  
  // Add message to conversation
  conversation.messages.push({
    role: 'customer',
    content: message.content,
    timestamp: Date.now()
  });
  
  // NLU processing
  const [intent, sentiment] = await Promise.all([
    intentClassifier.classify(message.content),
    sentimentAnalyzer.analyze(message.content)
  ]);
  
  conversation.context.intent = intent.name;
  conversation.context.entities = intent.entities;
  conversation.context.sentiment = sentiment.score;
  
  // Check for immediate escalation triggers
  const escalationCheck = await escalationManager.check(conversation);
  
  if (escalationCheck.shouldEscalate) {
    await escalateToHuman(conversation, escalationCheck.reason);
    return;
  }
  
  // RAG: Retrieve relevant knowledge
  const retrievedDocs = await ragEngine.retrieve(
    message.content,
    {
      filters: { category: intent.category },
      userTier: conversation.customer.tier
    }
  );
  
  // Generate response
  const response = await generateResponse({
    conversation,
    retrievedDocs,
    intent,
    sentiment
  });
  
  // Check confidence before sending
  if (response.confidence < CONFIDENCE_THRESHOLD) {
    await escalateToHuman(conversation, 'low_confidence');
    return;
  }
  
  // Execute any required actions
  if (intent.requiresAction) {
    const actionResult = await actionRouter.execute(intent, conversation);
    response.content += formatActionResult(actionResult);
  }
  
  // Send response
  await sendResponse(conversation, response);
  
  // Update conversation
  conversation.messages.push({
    role: 'assistant',
    content: response.content,
    timestamp: Date.now(),
    sources: response.sources
  });
  
  await memory.save(conversation);
  
  // Emit event for analytics
  agent.emit('support.response.sent', {
    conversationId: conversation.id,
    channel,
    intent: intent.name,
    confidence: response.confidence,
    escalated: false
  });
}

async function generateResponse(params: ResponseParams): Promise<Response> {
  const { conversation, retrievedDocs, intent, sentiment } = params;
  
  // Build system prompt
  const systemPrompt = await FS.read('prompts/system.txt');
  
  // Build context from retrieved docs
  const knowledgeContext = retrievedDocs.map(doc => 
    `[Source: ${doc.source}]\n${doc.content}`
  ).join('\n\n---\n\n');
  
  // Build conversation history
  const history = conversation.messages
    .slice(-10) // Last 10 messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
  
  const prompt = `
${systemPrompt}

CUSTOMER TIER: ${conversation.customer.tier}
SENTIMENT: ${sentiment.label} (${sentiment.score})
INTENT: ${intent.name}

KNOWLEDGE BASE:
${knowledgeContext}

CONVERSATION HISTORY:
${history}

Customer: ${conversation.messages[conversation.messages.length - 1].content}

Respond helpfully. If you reference information above, cite the source.
`;
  
  const completion = await agent.llm.complete({
    model: 'gpt-4-turbo-preview',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7
  });
  
  // Extract confidence from model's uncertainty
  const confidence = calculateConfidence(completion, retrievedDocs);
  
  return {
    content: completion.content,
    confidence,
    sources: retrievedDocs.map(d => d.source)
  };
}

async function escalateToHuman(
  conversation: SupportConversation,
  reason: string
): Promise<void> {
  conversation.status = 'escalated';
  
  // Generate handoff summary
  const summary = await generateHandoffSummary(conversation);
  
  // Add to human queue with priority
  const priority = calculatePriority(conversation, reason);
  
  await escalationManager.queue({
    conversation,
    summary,
    reason,
    priority,
    suggestedAgent: findBestAgent(conversation)
  });
  
  // Send holding message to customer
  const holdingMessage = reason === 'low_confidence'
    ? "I'm connecting you with a specialist who can help with this. One moment please..."
    : "I understand this is important. Let me get someone who can help right away.";
  
  await sendResponse(conversation, {
    content: holdingMessage,
    confidence: 1,
    sources: []
  });
  
  // Log escalation
  agent.emit('support.escalated', {
    conversationId: conversation.id,
    reason,
    priority,
    customerTier: conversation.customer.tier
  });
}

// Channel message handlers
webWidget.onMessage(msg => handleCustomerMessage(msg, 'web'));
emailChannel.onMessage(msg => handleCustomerMessage(msg, 'email'));

// Handle human agent actions
agent.onBus('support.agent.takeover', async (msg) => {
  const { conversationId, agentId } = msg.payload;
  const conversation = await memory.get(conversationId);
  
  conversation.assignedTo = agentId;
  conversation.status = 'active';
  await memory.save(conversation);
  
  // Notify customer
  await sendResponse(conversation, {
    content: `Hi, this is ${msg.payload.agentName}. I've reviewed your conversation and I'm here to help.`,
    confidence: 1,
    sources: []
  });
});

agent.onBus('support.agent.handback', async (msg) => {
  const { conversationId, resolution } = msg.payload;
  const conversation = await memory.get(conversationId);
  
  conversation.assignedTo = undefined;
  conversation.status = 'resolved';
  await memory.save(conversation);
  
  // Log for training
  await FS.write('training/resolutions.jsonl', JSON.stringify({
    conversationId,
    resolution,
    timestamp: Date.now()
  }) + '\n', { append: true });
});

// Knowledge base sync
Scheduler.every('1h', async () => {
  await syncKnowledgeBase();
});

// Daily analytics
Scheduler.every('1d', async () => {
  const stats = await generateSupportStats();
  agent.emit('support.daily-stats', stats);
});

agent.start();
```

```typescript
// src/rag/engine.ts
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@moltos/openai';

export class RAGEngine {
  private pinecone: Pinecone;
  private embedder: OpenAIEmbeddings;
  private index: any;
  
  constructor(config: RAGConfig) {
    this.pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    this.index = this.pinecone.index(config.vectorStore);
    this.embedder = new OpenAIEmbeddings({ model: config.embeddingModel });
  }
  
  async retrieve(
    query: string,
    options: RetrieveOptions
  ): Promise<RetrievedDocument[]> {
    // Generate embedding for query
    const embedding = await this.embedder.embed(query);
    
    // Query vector store
    const results = await this.index.query({
      vector: embedding,
      topK: options.topK || 5,
      filter: this.buildFilter(options.filters),
      includeMetadata: true
    });
    
    // Rerank results based on user tier (higher tiers get more detailed docs)
    const reranked = this.rerank(results.matches, options.userTier);
    
    return reranked.map(match => ({
      id: match.id,
      content: match.metadata.content,
      source: match.metadata.source,
      score: match.score,
      category: match.metadata.category
    }));
  }
  
  async indexDocument(doc: Document): Promise<void> {
    // Chunk document if needed
    const chunks = this.chunkDocument(doc.content);
    
    // Generate embeddings for chunks
    const embeddings = await this.embedder.embedBatch(chunks.map(c => c.text));
    
    // Upsert to vector store
    const vectors = chunks.map((chunk, i) => ({
      id: `${doc.id}-${chunk.index}`,
      values: embeddings[i],
      metadata: {
        content: chunk.text,
        source: doc.source,
        category: doc.category,
        tier: doc.minTier || 'free'
      }
    }));
    
    await this.index.upsert(vectors);
  }
  
  private chunkDocument(content: string): Chunk[] {
    // Smart chunking with overlap
    const chunks: Chunk[] = [];
    const maxSize = 1000;
    const overlap = 200;
    
    let start = 0;
    let index = 0;
    
    while (start < content.length) {
      const end = Math.min(start + maxSize, content.length);
      chunks.push({
        index: index++,
        text: content.slice(start, end)
      });
      start = end - overlap;
    }
    
    return chunks;
  }
  
  private rerank(matches: any[], userTier: string): any[] {
    // Boost docs appropriate for user's tier
    return matches.sort((a, b) => {
      let scoreA = a.score;
      let scoreB = b.score;
      
      if (a.metadata.tier === 'enterprise' && userTier !== 'enterprise') {
        scoreA *= 0.8;
      }
      if (b.metadata.tier === 'enterprise' && userTier !== 'enterprise') {
        scoreB *= 0.8;
      }
      
      return scoreB - scoreA;
    });
  }
}
```

```typescript
// src/escalation/manager.ts
export class EscalationManager {
  
  async check(conversation: SupportConversation): Promise<EscalationResult> {
    const checks = await Promise.all([
      this.checkExplicitRequest(conversation),
      this.checkSentiment(conversation),
      this.checkIntentSeverity(conversation),
      this.checkRepeatedFailures(conversation),
      this.checkCustomerTier(conversation)
    ]);
    
    // Aggregate results
    const shouldEscalate = checks.some(c => c.triggered);
    const reasons = checks.filter(c => c.triggered).map(c => c.reason);
    
    return {
      shouldEscalate,
      reason: reasons.join(', '),
      priority: Math.max(...checks.map(c => c.priority || 1))
    };
  }
  
  private async checkExplicitRequest(
    conversation: SupportConversation
  ): Promise<CheckResult> {
    const triggers = [
      'talk to human', 'speak to person', 'real agent',
      'not helpful', 'this is stupid', 'supervisor'
    ];
    
    const lastMessage = conversation.messages[conversation.messages.length - 1].content.toLowerCase();
    const triggered = triggers.some(t => lastMessage.includes(t));
    
    return {
      triggered,
      reason: triggered ? 'explicit_human_request' : undefined,
      priority: 5
    };
  }
  
  private async checkSentiment(
    conversation: SupportConversation
  ): Promise<CheckResult> {
    const sentiment = conversation.context.sentiment;
    const triggered = sentiment < -0.7; // Very negative
    
    return {
      triggered,
      reason: triggered ? 'negative_sentiment' : undefined,
      priority: 4
    };
  }
  
  private async checkIntentSeverity(
    conversation: SupportConversation
  ): Promise<CheckResult> {
    const highSeverityIntents = [
      'billing_dispute', 'account_hacked', 'data_deletion',
      'legal_request', 'refund_large_amount'
    ];
    
    const triggered = highSeverityIntents.includes(conversation.context.intent || '');
    
    return {
      triggered,
      reason: triggered ? 'high_severity_intent' : undefined,
      priority: 5
    };
  }
  
  private async checkRepeatedFailures(
    conversation: SupportConversation
  ): Promise<CheckResult> {
    // Check if customer has asked same thing multiple times
    const recentMessages = conversation.messages.slice(-6);
    const customerMessages = recentMessages.filter(m => m.role === 'customer');
    const triggered = customerMessages.length >= 3 && 
      conversation.context.escalationRisk > 0.5;
    
    return {
      triggered,
      reason: triggered ? 'repeated_unresolved' : undefined,
      priority: 3
    };
  }
  
  private async checkCustomerTier(
    conversation: SupportConversation
  ): Promise<CheckResult> {
    // Auto-escalate enterprise customers
    const triggered = conversation.customer.tier === 'enterprise' &&
      conversation.context.intent !== 'simple_question';
    
    return {
      triggered,
      reason: triggered ? 'enterprise_customer' : undefined,
      priority: 4
    };
  }
}
```

### How It Uses MoltOS Primitives

**ClawBus Usage:**
- `support.message.received` - New customer messages
- `support.response.sent` - AI responses dispatched
- `support.escalated` - Handoff events
- `support.agent.takeover` - Human agent assignment
- `support.agent.handback` - Return to AI/customer
- `support.daily-stats` - Analytics aggregation

**ClawFS Usage:**
- `/conversations/{id}.json` - Conversation history
- `/kb/{doc}.json` - Knowledge base documents
- `/training/resolutions.jsonl` - Human feedback for retraining
- `/prompts/{name}.txt` - LLM prompt templates

**ClawScheduler Usage:**
- `every('1h')` - Knowledge base sync
- `every('1d')` - Daily analytics
- `every('1w')` - Model retraining triggers

### Forge Command

```bash
# Basic support bot with web widget
moltos forge support-agent \
  --template customer-support \
  --channels web \
  --kb-source ./docs

# Full omnichannel support
moltos forge support-agent \
  --template customer-support \
  --channels web,email,slack,whatsapp \
  --crm zendesk \
  --rag-provider pinecone \
  --llm gpt-4-turbo \
  --escalation-rules sentiment,confidence,tier \
  --actions order-lookup,ticket-create,refund-process \
  --sentiment-analysis true \
  --human-handoff true \
  --satisfaction-tracking true

# Enterprise white-glove support
moltos forge support-agent \
  --template customer-support \
  --channels web,email,phone \
  --tier-routing enterprise:instant,paid:5min,free:1h \
  --kb-embedding text-embedding-3-large \
  --confidence-threshold 0.85 \
  --auto-escalate-sentiment -0.5 \
  --integrations salesforce,shopify,stripe
```

---

## Summary Comparison

| Template | Primary Primitives | Event Types | Storage Pattern | Schedule Frequency |
|----------|-------------------|-------------|-----------------|-------------------|
| **Crypto Arbitrage** | ClawBus (price feeds), ClawScheduler (high-freq) | price.update, arbitrage.*, circuit.breaker | Time-series, audit logs | 5-15s (health), 1h (reports) |
| **Content Moderation** | ClawBus (messages, decisions), ClawFS (audit) | moderation.*, user.strike-update | Audit trail, feedback | 1h (cleanup), 1d (reports) |
| **Data Pipeline** | All three equally | pipeline.message.*, pipeline.batch.* | Configs, dead-letter, schemas | 5m (DLQ), 1h (batch) |
| **Customer Support** | ClawBus (conversations), ClawFS (memory) | support.* | Conversations, KB, training | 1h (KB sync), 1d (analytics) |

---

## Cross-Cutting Concerns

### Security

All templates should implement:
- Secret management via `moltos secrets`
- Role-based permissions in `capabilities`
- Audit logging to ClawFS
- Request signing for webhooks

### Observability

```yaml
# Common monitoring config
observability:
  metrics:
    provider: prometheus
    port: 9090
  logs:
    level: info
    format: json
  tracing:
    enabled: true
    sampling: 0.1
```

### Testing

```bash
# Each template supports
moltos test --unit
moltos test --integration
moltos test --e2e  # Full simulation mode
```

### Deployment

```bash
# Local development
moltos dev

# Staging with simulated environment
moltos deploy --env staging --simulation

# Production
moltos deploy --env production --canary 10%
```

---

*Generated for MoltOS Platform - Research Phase B*
