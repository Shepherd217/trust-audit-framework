# CLAWSANDBOX INTEGRATION SPECIFICATION
## 8-Layer ClawOS Integration

### Overview
ClawSandbox is the **isolation layer** of ClawOS. It provides reputation-weighted sandboxing with hard isolation (WASM/Firecracker/Docker).

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAWOS STACK                              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 8: ClawSandbox ←── YOU ARE HERE                           │
│         (Reputation-weighted sandboxing with hard isolation)     │
├─────────────────────────────────────────────────────────────────┤
│  Layer 7: ClawFS      → Filesystem access within sandbox        │
│  Layer 6: ClawKernel  → Task execution within sandbox quotas    │
│  Layer 5: ClawForge   → Policy enforcement + kill switch        │
│  Layer 4: ClawID      → Identity binds to sandbox instance      │
│  Layer 3: ClawLink    → Inter-sandbox communication             │
│  Layer 2: Arbitra     → Disputes from sandbox telemetry         │
│  Layer 1: TAP         → Reputation → resource quotas            │
└─────────────────────────────────────────────────────────────────┘
```

---

## QUOTA FORMULA

```typescript
const quotas = {
  cpuMsPerSecond: reputation * 10,        // 0-1000ms/sec
  memoryMB: reputation * 1,               // 0-100MB
  networkKBps: reputation * 10,           // 0-1000KB/sec
  maxSyscallsPerSec: reputation * 50,     // 0-5000/sec
  maxFileDescriptors: reputation * 2,     // 0-200
  maxProcesses: Math.floor(reputation / 20), // 0-5
  diskIOKBps: reputation * 100,           // 0-10000KB/sec
};

// Dispute penalty
if (activeDispute) {
  quotas.cpuMsPerSecond *= 0.1;  // Throttle to 10%
  quotas.networkKBps = 0;        // Full network isolation
}

// Kill thresholds
if (reputation < 30 || disputeSlashing > 50) {
  await sandbox.kill('REPUTATION_TOO_LOW');
}
```

---

## INTEGRATION SPECIFICATIONS

### 1. TAP Integration (Reputation → Resources)

**Purpose:** Convert reputation score to resource quotas

```typescript
// Before sandbox start
const { quotas, mode } = await quotaCalc.calculateQuotas(agentId);
// quotas scales with reputation
// mode: trusted/standard/restricted/quarantine/kill
```

**Events:**
- `reputation:changed` → Recalculate quotas dynamically
- `reputation:below_threshold` → Trigger kill

---

### 2. Arbitra Integration (Dispute Evidence)

**Purpose:** Submit sandbox telemetry as dispute evidence

```typescript
// On violation, auto-submit to Arbitra
const evidence = sandbox.getEvidenceForDispute();
await arbitra.submit({
  type: 'resource_violation',
  evidence,
  claimant: 'clawsystem',
  respondent: agentId,
});
```

**Evidence includes:**
- Syscall logs (allowed/blocked)
- Resource usage over time
- Reputation history
- Violation timestamps

---

### 3. ClawLink Integration (Inter-Sandbox Communication)

**Purpose:** Allow sandboxes to communicate with reputation gating

```typescript
// Sandbox A sends message to Sandbox B
const message = {
  from: sandboxA.id,
  to: sandboxB.id,
  data: encryptedPayload,
  merkleProof: proof,
};

// Only deliver if both agents have rep > 60
if (await verifyReputation(message.from) > 60 &&
    await verifyReputation(message.to) > 60) {
  await deliver(message);
}
```

---

### 4. ClawID Integration (Identity Binding)

**Purpose:** All sandbox operations signed by agent identity

```typescript
// Sandbox startup
const sandbox = new ClawSandbox({
  agentId: clawId.getId(),
  clawId,  // Signs all ops
  // ...
});

// Every resource request signed
const request = {
  sandboxId,
  operation: 'allocate_memory',
  amount: '10MB',
  timestamp: Date.now(),
};
const signature = await clawId.sign(JSON.stringify(request));
```

---

### 5. ClawForge Integration (Policy Enforcement)

**Purpose:** ClawForge controls all sandboxes

```typescript
// ClawForge can kill any sandbox instantly
await clawForge.killSandbox(sandboxId, 'POLICY_VIOLATION');

// ClawForge can adjust quotas
await clawForge.adjustQuota(sandboxId, {
  cpuMsPerSecond: 500,  // Reduce CPU
});

// ClawForge dashboard shows all sandboxes
const dashboard = {
  activeSandboxes: await clawsandbox.list(),
  totalCpuUsage: await clawsandbox.totalCpu(),
  violations: await clawsandbox.violations(),
  killCount: await clawsandbox.killCount(),
};
```

---

### 6. ClawKernel Integration (Task Scheduling)

**Purpose:** Run tasks within sandbox boundaries

```typescript
// ClawKernel schedules task in sandbox
const task = {
  id: 'task-001',
  code: wasmBinary,
  quotas: await calculateQuotas(agentId),
};

const sandbox = await clawsandbox.create(task);

// Task runs within quotas
// If task exceeds quota → auto-throttle or kill

// Checkpoint within sandbox
await sandbox.checkpoint(); // Persists to ClawFS
```

---

### 7. ClawFS Integration (Filesystem Access)

**Purpose:** Sandbox accesses files through gated interface

```typescript
// Sandbox requests file access
const request = {
  sandboxId,
  operation: 'read',
  path: '/data.txt',
};

// Check sandbox quota + file permissions
if (sandbox.hasQuota('diskIO', size) &&
    clawfs.hasPermission(path, agentId, 'read')) {
  return clawfs.read(path);
}
```

---

## SECURITY MODES

| Mode | Reputation | Isolation | Network | Use Case |
|------|------------|-----------|---------|----------|
| **Trusted** | > 80 | WASM only | Full | Established agents |
| **Standard** | 50-80 | WASM + seccomp | Full | Normal operation |
| **Restricted** | 30-50 | Firecracker | Limited | New/untested agents |
| **Quarantine** | Any + dispute | Firecracker | None | Under investigation |
| **Kill** | < 30 | N/A | N/A | Terminated |

---

## BACKEND COMPARISON

| Backend | Startup | Memory | Security | Use Case |
|---------|---------|--------|----------|----------|
| **WASM** | ~10ms | ~5MB | Memory-safe | Default, trusted agents |
| **Firecracker** | ~125ms | ~15MB | Hardware VM | Untrusted, disputes |
| **Docker** | ~500ms | ~50MB | Namespace | Legacy compatibility |

---

## PRODUCTION DEPLOYMENT

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLAWSANDBOX DEPLOYMENT                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   WASM      │    │ Firecracker │    │   Docker    │         │
│  │  Runtime    │    │ MicroVMs    │    │ Containers  │         │
│  │  (x100)     │    │  (x20)      │    │   (x5)      │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                │
│         └──────────────────┼──────────────────┘                │
│                            ▼                                    │
│                  ┌──────────────────┐                          │
│                  │ ClawSandbox      │                          │
│                  │ Controller       │                          │
│                  │ - Quota mgmt     │                          │
│                  │ - Telemetry      │                          │
│                  │ - Auto-kill      │                          │
│                  └────────┬─────────┘                          │
│                           ▼                                     │
│                  ┌──────────────────┐                          │
│                  │  TAP + Arbitra   │                          │
│                  │  (Reputation +   │                          │
│                  │   Disputes)      │                          │
│                  └──────────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## FILES DELIVERED

| File | Purpose | Lines |
|------|---------|-------|
| `clawsandbox-research.md` | Research foundation | ~200 |
| `clawsandbox-implementation.ts` | Core TypeScript implementation | ~800 |
| `clawsandbox-rogue-test.ts` | Rogue agent simulation | ~300 |
| `clawsandbox-benchmarks.ts` | Performance benchmarks | ~350 |
| `clawsandbox-integration.md` | This file — 8-layer integration | ~300 |

---

**INTEGRATION SPECIFICATION LOCKED**

*ClawSandbox is now the isolation foundation for 8-layer ClawOS.*
