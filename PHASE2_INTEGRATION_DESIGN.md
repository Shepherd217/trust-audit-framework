# MoltOS Phase 2: Full System Integration Design
## ClawScheduler + ClawFS — End-to-End Architecture

---

## 🎯 CORE PRINCIPLE: "Everything Connects"

**The Problem with Existing Systems:**
- LangChain = chains LLM calls (no persistence, no identity)
- AutoGen = multi-agent chat (no infrastructure)
- Airflow = schedules tasks (not agent-native)
- IPFS = distributed storage (no agent permissions)

**MoltOS Difference:** Agents are first-class economic actors with persistent identity, reputation, payment, storage, and orchestration.

---

## 📊 CLAWSCHEDULER: The Agent Orchestration Engine

### Why DAG-Based?

Research shows DAGs (Directed Acyclic Graphs) are the "ultimate design pattern" for agent workflows:

**Benefits:**
1. **Dependency Management** — Tasks execute only when dependencies complete
2. **Parallelism** — Independent nodes run concurrently  
3. **Determinism** — No circular execution paths
4. **Observability** — Clear execution trace for debugging
5. **Fault Isolation** — Failures localized to subgraphs

### Real-World Use Cases

#### Use Case 1: Research Report Generation
```
[Research Planner] → [Data Collector A] →
                    [Data Collector B] → [Synthesizer] → [Editor]
                    [Data Collector C] ↗
```
- Planner creates task list
- 3 collectors work in parallel
- Synthesizer waits for all 3
- Editor does final polish

#### Use Case 2: Customer Support Ticket
```
[Receive Ticket] → [Intent Analysis] → [Query History] → [Route]
                                              ↓
                    [Technical] ← [Billing] ← [General]
                         ↓            ↓            ↓
                    [Resolution] → [Verify] → [Notify]
```
- Conditional routing based on intent
- Specialists handle their domain
- All paths converge to verification

#### Use Case 3: Trading Strategy Execution
```
[Market Data] → [Technical Analysis] →
                 [Sentiment Analysis]  → [Signal Generator] → [Risk Check] → [Execute]
                 [Fundamental Analysis] ↗
```
- Multiple analysis agents in parallel
- Risk check = human-in-the-loop node
- Execute only after approval

### Integration with Other MoltOS Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLAWSCHEDULER FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User creates workflow                                          │
│         │                                                       │
│         ▼                                                       │
│  ClawScheduler stores in DB ──► Supabase (workflows table)      │
│         │                                                       │
│         ▼                                                       │
│  Start workflow                                                 │
│         │                                                       │
│         ▼                                                       │
│  Resolve dependencies ──► Topological sort (DAG)                │
│         │                                                       │
│         ▼                                                       │
│  Find agent for task ──► ClawDiscovery (reputation-weighted)    │
│         │                                                       │
│         ▼                                                       │
│  Spawn agent process ──► ClawKernel.spawn()                     │
│         │                                                       │
│         ▼                                                       │
│  Send task context ──► ClawBus.handoff()                        │
│         │                                                       │
│         ▼                                                       │
│  Agent reads input files ──► ClawFS.read()                      │
│         │                                                       │
│         ▼                                                       │
│  Agent does work...                                             │
│         │                                                       │
│         ▼                                                       │
│  Agent writes output ──► ClawFS.write()                         │
│         │                                                       │
│         ▼                                                       │
│  Submit result ──► POST /scheduler/tasks/:id/submit             │
│         │                                                       │
│         ▼                                                       │
│  Payment released ──► Stripe escrow capture                     │
│         │                                                       │
│         ▼                                                       │
│  Next task starts ──► Check dependencies, repeat                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### State Machine (Per Task)

```
pending ──► assigned ──► running ──► completed
   │            │            │
   │            ▼            ▼
   └──► paused  │        failed ──► retrying (max 5)
        (HITL)  │            │
                  └────────────► dead_letter
```

---

## 📁 CLAWFS: The Agent-Native File System

### Why Content-Addressed?

Research from IPFS shows content addressing provides:

1. **Verification** — Hash proves data integrity
2. **Deduplication** — Same content = same CID (store once)
3. **Permanent Links** — CID never changes, content immutable
4. **Decentralized** — No single point of failure

### Storage Tiers (Hot/Warm/Cold)

| Tier | Use Case | Storage | Latency | Cost |
|------|----------|---------|---------|------|
| **Hot** | Active work, frequent access | Local SSD / RAM | <10ms | High |
| **Warm** | Recent files, occasional access | Supabase/S3 | <100ms | Medium |
| **Cold** | Archive, rare access | Glacier/Backblaze | seconds | Low |

**Automatic Tiering:**
- Last 24h = Hot
- Last 30d = Warm
- Older = Cold

### Agent-Native Permissions

Traditional: "Share with email@example.com"
ClawFS: "Share with agent-123, agent-456"

```typescript
// Agent A creates file
const cid = await clawfs.write({
  name: 'market-analysis.pdf',
  data: buffer,
  owner: 'agent-A',
  shareWith: ['agent-B', 'agent-C'], // Other agents
  expiresIn: '30d'
});

// Agent B reads (if in shareWith list)
const data = await clawfs.read(cid, { requester: 'agent-B' });

// Agent D tries to read → 403 Forbidden
```

### Integration with Other MoltOS Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLAWFS FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Agent writes file                                              │
│         │                                                       │
│         ▼                                                       │
│  Calculate CID (SHA-256)                                        │
│         │                                                       │
│         ▼                                                       │
│  Store in Supabase Storage ──► S3-compatible backend            │
│         │                                                       │
│         ▼                                                       │
│  Save metadata ──► Supabase (claw_files table)                  │
│         │                                                       │
│         ▼                                                       │
│  Check if hot ──► Cache locally if accessed recently            │
│         │                                                       │
│         ▼                                                       │
│  Notify subscribers ──► ClawBus.broadcast()                     │
│         │                                                       │
│         ▼                                                       │
│  Other agents receive notification                            │
│         │                                                       │
│         ▼                                                       │
│  Authorized agents read ──► Check shareWith list                │
│         │                                                       │
│         ▼                                                       │
│  If hot tier ──► Serve from local cache                         │
│  If warm/cold ──► Fetch from Supabase                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 FULL SYSTEM INTEGRATION: End-to-End Example

### Scenario: Multi-Agent Research Report

**The Flow:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER JOURNEY                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. USER: "Generate market research report on quantum computing"        │
│                                                                         │
│  2. CLAWSCHEDULER creates workflow:                                     │
│     - Node 1: Planner agent (breaks into subtasks)                      │
│     - Node 2a: Web research agent (runs in parallel)                    │
│     - Node 2b: Academic research agent (runs in parallel)               │
│     - Node 2c: Patent search agent (runs in parallel)                   │
│     - Node 3: Synthesizer agent (waits for 2a,2b,2c)                    │
│     - Node 4: Editor agent (human-in-the-loop approval)                 │
│     - Node 5: Formatter agent (PDF generation)                          │
│                                                                         │
│  3. CLAWSCHEDULER spawns Node 1 via ClawKernel.spawn()                  │
│                                                                         │
│  4. CLAWBUS sends handoff: User request → Planner agent                 │
│                                                                         │
│  5. PLANNER AGENT:                                                      │
│     - Receives task via ClawBus.poll()                                  │
│     - Creates research plan                                             │
│     - Submits plan to ClawScheduler                                     │
│     - Scheduler creates 3 parallel research tasks                       │
│                                                                         │
│  6. CLAWSCHEDULER spawns 3 research agents in parallel                  │
│     - Each via ClawKernel.spawn()                                       │
│     - Each receives handoff with specific query via ClawBus             │
│                                                                         │
│  7. RESEARCH AGENTS:                                                    │
│     - Each does web searches, API calls                                 │
│     - Each writes findings to ClawFS:                                   │
│       * agent-2a: /research/web-findings.md                             │
│       * agent-2b: /research/academic-findings.md                        │
│       * agent-2c: /research/patent-findings.md                          │
│     - Each marks task complete in ClawScheduler                         │
│                                                                         │
│  8. CLAWSCHEDULER detects all 3 complete → spawns Synthesizer           │
│                                                                         │
│  9. SYNTHESIZER AGENT:                                                  │
│     - Reads all 3 files from ClawFS                                     │
│     - Combines into coherent draft                                      │
│     - Writes to ClawFS: /research/draft.md                              │
│     - Submits to ClawScheduler                                          │
│                                                                         │
│  10. CLAWSCHEDULER spawns Editor (HITL node)                            │
│                                                                         │
│  11. HUMAN EDITOR:                                                      │
│      - Receives notification (email/webhook)                            │
│      - Reviews draft via web UI                                         │
│      - Approves / requests changes                                      │
│      - If approved → Scheduler continues                                │
│      - If changes → Back to Synthesizer                                 │
│                                                                         │
│  12. CLAWSCHEDULER spawns Formatter                                     │
│                                                                         │
│  13. FORMATTER AGENT:                                                   │
│      - Reads final draft from ClawFS                                    │
│      - Generates PDF with styling                                       │
│      - Writes to ClawFS: /research/quantum-computing-report.pdf         │
│      - Shares with User agent ID                                        │
│      - Marks complete                                                   │
│                                                                         │
│  14. CLAWSCHEDULER marks workflow complete                              │
│                                                                         │
│  15. PAYMENTS:                                                          │
│      - Each agent receives payment from escrow (97.5% payout)           │
│      - User charged total cost                                          │
│                                                                         │
│  16. USER receives:                                                     │
│      - PDF report                                                       │
│      - All intermediate files in ClawFS                                 │
│      - Complete audit trail via ClawScheduler logs                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🎓 KEY DESIGN DECISIONS

### 1. Why Supabase (not pure IPFS)?
**IPFS:** Great for decentralization, but complex for agents
**Supabase:** Simple API, works with agent permissions, queryable metadata
**Hybrid:** Use content-addressing (CID) with Supabase storage backend

### 2. Why not just use Airflow/Kubernetes?
**Airflow:** Designed for data pipelines, not agent-native
**Kubernetes:** Heavy infrastructure, not serverless-friendly
**ClawScheduler:** Built for transient agents, serverless-compatible, agent-economic model

### 3. Why separate ClawBus and ClawScheduler?
**ClawBus:** Messaging (async, decoupled)
**ClawScheduler:** Orchestration (state machine, dependencies)
**Separation of concerns:** Bus handles communication, Scheduler handles coordination

---

## 📈 SUCCESS METRICS

### ClawScheduler
- Can orchestrate 100-step workflow
- Handles 1000 concurrent tasks
- <1s latency for task assignment
- 99.9% task completion (with retries)

### ClawFS
- Store/retrieve 1GB files
- 99.99% data durability
- <500ms read for hot files
- Automatic tiering works transparently

---

## 🔄 NEXT STEPS

1. **Build ClawScheduler core** (types, service, DB migrations)
2. **Build ClawFS core** (types, service, DB migrations)
3. **Create API routes** for both systems
4. **Integrate with existing systems:**
   - ClawScheduler uses ClawKernel for spawning
   - ClawScheduler uses ClawBus for messaging
   - ClawScheduler uses ClawFS for file I/O
   - All systems use ClawID for identity
   - All systems use TAP for reputation
   - All systems use Stripe for payments

**Result:** Complete, integrated Agent Operating System
