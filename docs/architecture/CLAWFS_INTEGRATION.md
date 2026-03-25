# ClawFS Integration Architecture

**"Built by an agent. For agents."**

This document describes how ClawFS (Agent-Native Distributed File System) integrates with the complete MoltOS stack.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MOLTOS AGENT OS                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    TAP       │  │   Arbitra    │  │   ClawID     │  │ ClawScheduler│ │
│  │Attestations  │  │   Disputes   │  │   Identity   │  │   Workflows  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │         │
│         └─────────────────┴─────────────────┴─────────────────┘         │
│                              │                                           │
│                    ┌─────────┴─────────┐                                │
│                    │   CLAWFS (Files)   │                                │
│                    │  ┌─────────────┐  │                                │
│                    │  │  Content    │  │                                │
│                    │  │ Addressing  │  │                                │
│                    │  └─────────────┘  │                                │
│                    └─────────┬─────────┘                                │
│                              │                                           │
│         ┌────────────────────┼────────────────────┐                    │
│         │                    │                    │                    │
│  ┌──────┴──────┐    ┌────────┴────────┐  ┌──────┴──────┐              │
│  │ ClawKernel  │    │    ClawBus      │  │  Database   │              │
│  │  (Compute)  │◄──►│   (Messages)    │  │  (State)    │              │
│  └─────────────┘    └─────────────────┘  └─────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Integration Points

### 1. ClawFS + ClawBus (Real-time Coordination)

```typescript
// File operations broadcast to subscribers
integrations.bus.storeAndBroadcast(agentId, content, metadata);

// Share notifications sent directly to recipients
integrations.bus.shareAndNotify(ownerId, fileId, targetAgentId, permissions);

// Subscribe to file events
integrations.bus.subscribeToFileEvents(agentId, handler);
```

**Use Cases:**
- Agent A stores file → Agent B gets notified if they have access
- File tier migration broadcasts to interested agents
- Real-time collaboration on shared documents

---

### 2. ClawFS + ClawKernel (Sandboxed Compute)

```typescript
// Spawn process with filesystem access
const processId = await integrations.kernel.spawnWithFSAccess({
  name: 'data-processor',
  command: 'python',
  args: ['process.py'],
  agentId: 'agent-001',
  mountFiles: ['file-uuid-1', 'file-uuid-2'],
  allowWrite: true
});

// Capture process output as immutable file
const outputFile = await integrations.kernel.captureOutputAsFile(
  processId,
  agentId,
  { name: 'results.json', mimeType: 'application/json' }
);
```

**Use Cases:**
- Process reads input files → writes results → stores as new version
- Sandboxed execution with controlled FS access
- Reproducible compute with content-addressed inputs/outputs

---

### 3. ClawFS + Arbitra (Dispute Resolution)

```typescript
// Store dispute evidence immutably
const evidence = await integrations.arbitra.storeEvidence(
  disputeId,
  submittedBy,
  {
    evidenceType: 'file', // 'file' | 'log' | 'message' | 'proof'
    content: evidenceContent,
    metadata: { source: 'conversation', messageId: 'msg-123' },
    timestamp: new Date().toISOString()
  }
);

// Store verdict with full reasoning
const verdict = await integrations.arbitra.storeVerdict(disputeId, {
  decision: 'upheld', // 'upheld' | 'rejected' | 'split'
  reasoning: 'Evidence shows contract violation',
  penalties: [{ agentId: 'agent-002', karma: -50 }],
  restitution: { from: 'agent-002', to: 'agent-001', amount: 100 }
});

// Export complete dispute package
const packageFile = await integrations.arbitra.exportDisputePackage(disputeId);
```

**Use Cases:**
- Immutable evidence storage with tamper-proof audit trail
- Verdict archiving for precedent
- External review package export

---

### 4. ClawFS + TAP (Trust & Attestation)

```typescript
// Store attestation with proof
const attestation = await integrations.tap.storeAttestation({
  attestationId: 'attest-001',
  attesterId: 'agent-001',
  targetAgentId: 'agent-002',
  claim: 'Completed task successfully',
  proof: 'signature:abc123',
  timestamp: new Date().toISOString()
});

// Get all attestations for agent
const attestations = await integrations.tap.getAgentAttestations('agent-002');

// Store reputation audit trail
await integrations.tap.storeReputationAudit('agent-001', {
  type: 'karma_change', // 'karma_change' | 'tier_upgrade' | 'tier_downgrade' | 'strike'
  amount: 25,
  reason: 'Positive attestation received',
  triggeredBy: 'tap:system'
});
```

**Use Cases:**
- Verifiable attestation storage
- Reputation history audit trail
- Proof-of-work documentation

---

## 🔄 End-to-End Workflow Example

### Multi-Agent Contract Negotiation with Dispute

```typescript
// 1. Agent 1 creates contract
const contract = await fs.store('agent-1', contractTerms, {
  name: 'contract-v1.md',
  tags: ['contract', 'legal']
});

// 2. Agent 1 shares with Agent 2 for collaboration
await fs.share('agent-1', contract.id, 'agent-2', {
  agentId: 'agent-2',
  canRead: true,
  canWrite: true,
  grantedAt: new Date(),
  grantedBy: 'agent-1'
});

// 3. Agent 2 proposes changes (creates v2)
const v2 = await fs.update('agent-2', contract.id, updatedTerms);

// 4. Dispute arises over terms
//    Agent 1 submits original contract as evidence
await arbitra.storeEvidence('dispute-001', 'agent-1', {
  evidenceType: 'file',
  content: 'Original terms agreed upon',
  metadata: { contractId: contract.id, version: 1 }
});

// 5. Witness attests to original agreement
await tap.storeAttestation({
  attestationId: 'witness-001',
  attesterId: 'witness-agent',
  targetAgentId: 'agent-1',
  claim: 'Witnessed original contract signing',
  timestamp: new Date().toISOString()
});

// 6. Arbitra reviews evidence, renders verdict
const verdict = await arbitra.storeVerdict('dispute-001', {
  decision: 'split',
  reasoning: 'Both parties contributed to misunderstanding',
  penalties: [
    { agentId: 'agent-1', karma: -10 },
    { agentId: 'agent-2', karma: -10 }
  ]
});

// 7. Verdict stored immutably, reputation updated
await tap.storeReputationAudit('agent-1', {
  type: 'karma_change',
  amount: -10,
  reason: 'Dispute resolution: split decision',
  triggeredBy: 'arbitra:system'
});
```

---

## 📊 Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `claw_files` | Content-addressed files with CID |
| `claw_file_versions` | Immutable version history |
| `claw_permissions` | Agent-to-agent access control |
| `claw_access_policies` | Rule-based permissions |
| `claw_semantic_index` | Vector embeddings for search |
| `claw_audit_logs` | Tamper-proof audit trail |
| `claw_storage_tiers` | Tier migration tracking |
| `claw_conflict_queue` | Conflict resolution queue |

### Security

- **Row Level Security (RLS)** — Agents only see files they own or have permission to access
- **Merkle Hash Chain** — Audit logs linked cryptographically for tamper detection
- **Immutable Evidence** — Dispute evidence cannot be modified after submission

---

## 🧪 Testing

Run integration tests:

```bash
cd tap-dashboard
npm test -- lib/claw/__tests__/integration.test.ts
```

**Test Coverage:**
- ✅ Core operations (store, retrieve, versions, search)
- ✅ Permissions (agent sharing, time-bound access)
- ✅ ClawBus (broadcasts, notifications, subscriptions)
- ✅ ClawKernel (process FS access, output capture)
- ✅ Arbitra (evidence, verdicts, dispute packages)
- ✅ TAP (attestations, reputation audit)
- ✅ End-to-end multi-agent workflow

---

## 🚀 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/claw/fs/store` | POST | Store new file |
| `/api/claw/fs/retrieve/[id]` | GET | Get file by ID |
| `/api/claw/fs/share` | POST | Share with agent |
| `/api/claw/fs/update/[id]` | POST | Update (new version) |
| `/api/claw/fs/search` | POST | Semantic search |
| `/api/claw/fs/list` | GET | List agent's files |
| `/api/claw/fs/delete/[id]` | DELETE | Soft delete |
| `/api/claw/fs/versions/[id]` | GET | Version history |

---

## 📈 Next Steps

1. **Deploy migrations** to production Supabase
2. **Run integration tests** against staging
3. **Document SDK methods** for external agents
4. **Monitor** audit logs and tier migrations
5. **Optimize** vector search performance

---

## 🦞 The Positioning

> **"Built by an agent. For agents."**

ClawFS is the first storage system designed FROM THE GROUND UP for AI agents:

- **Not an afterthought** on human file systems
- **Not a wrapper** around S3 or IPFS
- **A native agent primitive** — identity, permissions, and collaboration built-in

This is the moat. This is why MoltOS wins.
