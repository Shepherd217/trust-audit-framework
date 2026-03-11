# CLAWFS INTEGRATION HOOKS
## 6-Layer ClawOS Integration Specification

### Overview
ClawFS is the **persistence layer** of ClawOS. It integrates with all 6 existing layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAWOS STACK                              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 7: ClawFS ←── YOU ARE HERE                               │
│         (Persistent, reputation-gated, Merkle-backed storage)    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 6: ClawKernel  → Task checkpointing via ClawFS           │
│  Layer 5: ClawForge   → Policy enforcement on file ops          │
│  Layer 4: ClawID      → Signs all ops, identity binding         │
│  Layer 3: ClawLink    → Passes file handles between agents      │
│  Layer 2: Arbitra     → Disputes over file access/modification  │
│  Layer 1: TAP         → Reputation queries for gate             │
└─────────────────────────────────────────────────────────────────┘
```

---

## INTEGRATION SPECIFICATIONS

### 1. TAP Integration (Reputation Layer)

**Purpose:** Reputation gate all file operations

**Interface:**
```typescript
// TAP queries reputation before any operation
const reputation = await tapClient.getReputation(clawId);
if (reputation < minReputation) throw new ReputationError();
```

**Cost Model:**
| Operation | Reputation Cost |
|-----------|-----------------|
| read      | 1               |
| create    | 5               |
| write     | 5               |
| share     | 2               |
| delete    | 10              |

**Events:**
- `reputation:deducted` — Emitted after each operation
- `reputation:insufficient` — Emitted when gate blocks

---

### 2. Arbitra Integration (Dispute Layer)

**Purpose:** Resolve conflicts over file access/modification

**Dispute Types:**
1. **Unauthorized Access** — Agent read file without permission
2. **Data Corruption** — File hash doesn't match Merkle proof
3. **Ownership Conflict** — Two agents claim ownership
4. **Rollback Attack** — Malicious version rollback

**Arbitra Flow:**
```
1. Victim submits dispute with:
   - File path
   - Expected Merkle root
   - Actual Merkle root
   - Signed proof of access attempt

2. Arbitra committee (5/7) reviews:
   - Verify Merkle proofs
   - Check permission logs
   - Validate signatures

3. Resolution:
   - If guilty: Slash reputation, restore file, ban agent
   - If innocent: Dismiss, penalize accuser
```

**Integration Code:**
```typescript
// Submit dispute to Arbitra
async function disputeFileAccess(path: string, violatorClawId: string) {
  const proof = clawfs.getMerkleProof(path);
  const dispute = {
    type: 'file_access_violation',
    evidence: proof,
    claimant: myClawId,
    respondent: violatorClawId,
  };
  return arbitra.submit(dispute);
}
```

---

### 3. ClawLink Integration (Transport Layer)

**Purpose:** Pass file handles between agents with verification

**FileHandle Structure:**
```typescript
interface ClawLinkFileHandle {
  path: string;
  merkleRoot: string;
  proof: MerkleProof;
  permissions: {
    read: boolean;
    write: boolean;
  };
  expiresAt: number;
  signedBy: string; // ClawID of owner
}
```

**Handoff Flow:**
```
Agent A (Owner)          ClawLink Handoff          Agent B (Recipient)
     │                           │                            │
     │  createFileHandle()       │                            │
     │ ────────────────────────>│                            │
     │                           │  Encrypted + Signed        │
     │                           │ ─────────────────────────>│
     │                           │                            │  verifyHandle()
     │                           │                            │  read(path, handle)
```

**Integration Code:**
```typescript
// ClawLink passes file handle
const handle = await clawfs.createFileHandle(
  '/shared/data.txt',
  recipientClawId,
  { read: true, write: false }
);
await clawlink.send(recipientClawId, { type: 'file_handle', handle });

// Recipient verifies and uses
const verified = clawfs.verifyFileHandle(handle);
if (verified) {
  const data = await clawfs.read(handle.path, handle);
}
```

---

### 4. ClawID Integration (Identity Layer)

**Purpose:** All operations signed by agent identity, Merkle root published to identity tree

**Signing Flow:**
```typescript
// Every operation is signed
const operation = {
  op: 'write',
  path: '/data.txt',
  timestamp: Date.now(),
  contentHash: sha256(content),
};
const signature = await clawId.sign(JSON.stringify(operation));
```

**Merkle Root Publication:**
```typescript
// After each batch of operations
const root = clawfs.getMerkleRoot();
await clawId.publishMerkleRoot(root);

// This binds file system state to agent identity
// Enables cross-device sync, audit trails, dispute resolution
```

**Identity Verification:**
```typescript
// Verify file was created by claimed agent
const isValid = await clawId.verifySignature(
  operation,
  signature,
  claimedAgentId
);
```

---

### 5. ClawForge Integration (Governance Layer)

**Purpose:** Policy enforcement, rate limiting, access control

**Policy Types:**
```typescript
interface ClawForgePolicy {
  // Rate limiting
  maxOpsPerMinute: number;
  maxFileSize: number;
  maxStoragePerAgent: number;

  // Access control
  allowedPaths: string[];
  bannedTags: string[];
  requiredReputation: number;

  // Sharing restrictions
  maxSharesPerFile: number;
  allowedShareTargets: string[];
}
```

**Enforcement Points:**
```typescript
// Before every operation
await clawforge.checkPolicy(operation, agentId);

// Policies can:
// - Block operations exceeding rate limits
// - Enforce path restrictions
// - Require additional attestations
// - Trigger alerts on suspicious activity
```

**Dashboard Integration:**
```typescript
// ClawForge dashboard widget
const widget = {
  type: 'clawfs_metrics',
  data: {
    totalFiles: await clawfs.count(),
    totalStorage: await clawfs.storageUsed(),
    blockedOperations: metrics.blocked,
    averageReputation: metrics.avgRep,
  },
};
```

---

### 6. ClawKernel Integration (Scheduling Layer)

**Purpose:** Persistent task state, checkpoint/resume

**Checkpoint API:**
```typescript
// ClawKernel checkpoints task state to ClawFS
async function checkpoint(taskId: string) {
  const state = {
    taskId,
    status: 'running',
    step: currentStep,
    data: processedData,
    timestamp: Date.now(),
  };
  
  const result = await clawfs.checkpoint(taskId, state);
  
  // Also persist to ClawID for cross-device resume
  await clawId.publishTaskState(taskId, result.merkleRoot);
}
```

**Resume Flow:**
```typescript
// On restart, ClawKernel resumes from ClawFS
async function resume(taskId: string) {
  const checkpoint = await clawfs.read(
    `.clawkernel/checkpoints/${taskId}/latest.json`
  );
  
  if (checkpoint) {
    const state = JSON.parse(checkpoint.data.toString());
    return resumeFromState(state);
  }
}
```

**Cron Integration:**
```typescript
// ClawKernel scheduled backups to ClawFS
clawkernel.schedule({
  name: 'clawfs_backup',
  interval: '5m',
  task: async () => {
    const snapshot = await clawfs.createSnapshot();
    await coldStorage.archive(snapshot);
  },
});
```

---

## COMPLETE INTEGRATION EXAMPLE

```typescript
// Full ClawOS stack with ClawFS
import { ClawFS } from '@exitliquidity/clawfs';
import { ClawID } from '@exitliquidity/clawid';
import { ClawKernel } from '@exitliquidity/clawkernel';
import { TAPClient } from '@exitliquidity/sdk';

async function fullStackExample() {
  // 1. Initialize identity
  const clawId = new ClawID({ agentId: 'my-agent', ... });
  
  // 2. Connect to TAP for reputation
  const tap = new TAPClient({ ... });
  
  // 3. Initialize ClawFS (Layer 7)
  const clawfs = new ClawFS({
    agentId: 'my-agent',
    clawId,
    tapClient: tap,
    minReputation: 60,
  });
  
  // 4. Initialize ClawKernel (Layer 6)
  const kernel = new ClawKernel({
    agentId: 'my-agent',
    checkpointTo: clawfs,
  });
  
  // 5. Schedule persistent task
  kernel.schedule({
    name: 'data_processor',
    interval: '1m',
    task: async (ctx) => {
      // Checkpoints automatically saved to ClawFS
      const data = await fetchData();
      
      // Write processed data (reputation-gated)
      await clawfs.create('/output/result.json', data);
      
      // Share with team (ClawLink integration)
      const handle = await clawfs.createFileHandle(
        '/output/result.json',
        'teammate-agent',
        { read: true }
      );
      
      return ctx.checkpoint(); // Persisted to ClawFS
    },
  });
}
```

---

## DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRODUCTION DEPLOYMENT                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ Agent Node 1│◄──►│ Agent Node 2│◄──►│ Agent Node N│         │
│  │  + ClawFS   │    │  + ClawFS   │    │  + ClawFS   │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                │
│         └──────────────────┼──────────────────┘                │
│                            ▼                                    │
│                  ┌──────────────────┐                          │
│                  │  Shared Merkle   │                          │
│                  │  DAG (IPFS/      │                          │
│                  │   Redis Cluster) │                          │
│                  └────────┬─────────┘                          │
│                           ▼                                     │
│                  ┌──────────────────┐                          │
│                  │  TAP Reputation  │                          │
│                  │  Network         │                          │
│                  └──────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## SECURITY CONSIDERATIONS

1. **Never store private keys in ClawFS** — only ClawID holds keys
2. **Encrypt sensitive data before write** — use ClawID encryption
3. **Verify all Merkle proofs on read** — prevents tampering
4. **Rate limit checkpoint operations** — prevent DoS
5. **Audit all policy violations** — feed to Arbitra if needed

---

**INTEGRATION SPECIFICATION LOCKED**  
*ClawFS is now the persistence foundation for full ClawOS*
