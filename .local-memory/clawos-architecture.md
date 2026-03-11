# CLAWOS ARCHITECTURE SPECIFICATION
## Final Design — Exactly 6 Layers (March 11, 2026)

### Core Principle
ClawOS is a **6-layer Agent Operating System**. No additional layers exist.
Complex subsystems (storage, sandboxing) are **built-in features** of ClawKernel (Layer 6), not standalone layers.

---

## THE 6 LAYERS

### Layer 1: TAP (Trust & Attestation Protocol)
**Purpose:** Reputation foundation for all agent interactions

**Features:**
- EigenTrust-style reputation calculation
- Cryptographic attestation of claims
- Cross-agent verification
- Reputation persistence across restarts

**Exports:** `TAPClient`, `AttestationClaim`, `EigenTrust`

---

### Layer 2: Arbitra (Dispute Resolution)
**Purpose:** Fast, fair resolution of behavioral disputes

**Features:**
- 5/7 committee voting
- Evidence-only disputes (<15 min resolution)
- 2× reputation slashing for bias
- Integration with ClawForge for enforcement

**Exports:** `ArbitraVoting`, `Dispute`, `Committee`

---

### Layer 3: ClawLink (Typed Handoffs)
**Purpose:** Reliable context passing between agents

**Features:**
- SHA-256 context hashing
- Reputation gating (min 60)
- Auto-dispute on mismatch
- Escrow protection during handoff

**Exports:** `ClawLink`, `Handoff`, `ContextHash`

---

### Layer 4: ClawID (Portable Identity)
**Purpose:** Cryptographic identity that survives restarts

**Features:**
- Ed25519 keypair + signed token
- Merkle tree of history
- Portable across frameworks
- Identity-verified operations

**Exports:** `ClawID`, `Identity`, `MerkleRoot`

---

### Layer 5: ClawForge (Governance & Control)
**Purpose:** Single pane of glass for swarm monitoring and policy

**Features:**
- Dashboard widgets (6 types)
- Policy engine (conditions/actions/violations)
- Rate limiting and alerts
- Sandbox health monitoring
- ClawFS access policy enforcement

**Exports:** `ClawForgeControlPlane`, `Policy`, `Alert`

**Monitors:**
- Sandbox CPU/memory usage per agent
- ClawFS access violations
- Resource quota enforcement
- Auto-revocation triggers

---

### Layer 6: ClawKernel (Execution Engine)
**Purpose:** Persistent, reputation-weighted, sandboxed task execution

**Features:**
1. **Persistent Scheduling**
   - Cron-like scheduling that survives restarts
   - Reputation-weighted priority queues
   - Automatic checkpointing

2. **ClawFS (Storage Subsystem)**
   - Merkle-backed filesystem
   - Reputation-gated read/write
   - Version history and rollback
   - Checkpoint persistence for tasks
   - Hybrid storage (SQLite/Vector/IPFS)

3. **Sandboxing (Isolation Subsystem)**
   - WASM/Firecracker/Docker backends
   - Reputation-weighted resource quotas:
     - CPU: rep × 10 ms/sec (0-1000)
     - Memory: rep × 1 MB (0-100)
     - Network: rep × 10 KB/sec (0-1000)
   - Auto-kill on rep < 30 or violations
   - Telemetry for ClawForge/Arbitra

**Exports:** `ClawKernel`, `Task`, `Sandbox`, `ResourceQuotas`

---

## SUBSYSTEM RELATIONSHIPS

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 6: CLAWKERNEL                                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Scheduling Engine                                        │   │
│  │  └── Manages task queue, priorities, checkpoints          │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  ClawFS (Storage Subsystem)                              │   │
│  │  ├── Merkle-backed file storage                          │   │
│  │  ├── Reputation-gated access                             │   │
│  │  └── Task checkpoint persistence                         │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  Sandboxing (Isolation Subsystem)                        │   │
│  │  ├── WASM/Firecracker/Docker backends                    │   │
│  │  ├── Reputation-weighted quotas                          │   │
│  │  └── Auto-kill on violations                             │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: CLAWFORGE (monitors Layer 6 subsystems)                │
│  ├── Monitors sandbox health (CPU/memory)                       │
│  ├── Enforces ClawFS access policies                            │
│  └── Triggers Arbitra disputes on violations                    │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: CLAWID (signs all Layer 6 operations)                  │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: CLAWLINK (passes data between Layer 6 instances)       │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: ARBITRA (resolves disputes from Layer 6 telemetry)     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: TAP (reputation feeds into Layer 6 quotas)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## WHY NO LAYER 7?

**Principle:** Layer count reflects **abstraction boundaries**, not feature count.

- ClawFS and Sandboxing are **implementation details** of how ClawKernel executes tasks
- They don't expose new abstraction layers — they're consumed by the kernel
- ClawForge monitors them, but doesn't make them new layers
- Adding them as layers would imply they're peers to TAP/Arbitra/ClawLink, which they're not

**Analogy:** Linux kernel has filesystems and process isolation, but we don't call them separate OS layers — they're kernel subsystems.

---

## INTEGRATION PATTERNS

### Pattern 1: Task with Checkpoint
```typescript
const kernel = new ClawKernel({ ... });

// Task automatically gets ClawFS checkpointing
const task = await kernel.schedule({
  id: 'task-001',
  code: wasmBinary,
  ownerClawId: 'agent-123',
});

// Kernel manages both sandbox execution AND checkpoint persistence
```

### Pattern 2: ClawForge Monitoring
```typescript
const forge = new ClawForgeControlPlane({ ... });

// Monitors both sandbox and ClawFS
forge.on('sandbox:violation', (v) => {
  if (v.type === 'MEMORY_QUOTA') {
    kernel.killSandbox(v.sandboxId);
    arbitra.submitDispute(v.evidence);
  }
});

forge.on('clawfs:access_denied', (e) => {
  alerts.send(`Agent ${e.agentId} blocked from ${e.path}`);
});
```

### Pattern 3: Full Stack
```typescript
// All 6 layers working together
const agent = {
  identity: new ClawID({ ... }),           // Layer 4
  reputation: new TAPClient({ ... }),      // Layer 1
  kernel: new ClawKernel({                 // Layer 6
    scheduling: true,
    clawFS: true,                           // Subsystem
    sandboxing: true,                       // Subsystem
  }),
  forge: new ClawForgeControlPlane({ ... }), // Layer 5
};

// Task flows through all layers
const result = await agent.kernel.schedule(task);
// - TAP checks reputation (Layer 1)
// - ClawID signs operation (Layer 4)
// - Kernel sandboxes execution (Layer 6 subsystem)
// - Kernel persists to ClawFS (Layer 6 subsystem)
// - Forge monitors and enforces (Layer 5)
```

---

## FILE STRUCTURE

```
packages/
├── tap-protocol/           # Layer 1
├── arbitra-protocol/       # Layer 2
├── clawlink-protocol/      # Layer 3
├── clawid-protocol/        # Layer 4
├── clawforge-protocol/     # Layer 5
└── clawkernel-protocol/    # Layer 6
    ├── kernel.ts           # Main kernel
    ├── scheduling.ts       # Task scheduler
    ├── clawfs.ts           # Storage subsystem
    └── sandbox.ts          # Isolation subsystem
```

---

## VERIFICATION CHECKLIST

- [x] Exactly 6 layers defined
- [x] No Layer 7 or 8 references
- [x] ClawFS as ClawKernel subsystem
- [x] Sandboxing as ClawKernel subsystem
- [x] ClawForge monitors subsystems (doesn't own them)
- [x] All integration patterns documented

---

**CLAWOS ARCHITECTURE LOCKED — EXACTLY 6 LAYERS**

*Complexity lives in subsystems, not layer proliferation.*
