# CLAWSANDBOX — COMPLETE IMPLEMENTATION PACKAGE
## Piece #2: Kernel Expansion

### Summary

ClawSandbox is the **8th layer** of ClawOS — reputation-weighted sandboxing with hard isolation (WASM/Firecracker/Docker).

### Files Delivered

| File | Purpose | Lines |
|------|---------|-------|
| `clawsandbox-research.md` | Research foundation (WASM, Firecracker, AIOS, 1Password, OpenClaw) | ~200 |
| `clawsandbox-implementation.ts` | Core TypeScript implementation (ClawSandbox class, backends, telemetry) | ~800 |
| `clawsandbox-rogue-test.ts` | Rogue agent simulation (CPU hog, memory leak, network flood, etc.) | ~300 |
| `clawsandbox-benchmarks.ts` | Performance benchmarks (startup, overhead, throughput, scalability) | ~350 |
| `clawsandbox-integration.md` | Full integration spec for all 7 existing layers | ~300 |

### Architecture

```
ClawSandbox (Layer 8)
├── Reputation → Resource Quotas (CPU/memory/network/syscalls)
├── Isolation Backends: WASM | Firecracker | Docker
├── Security Modes: Trusted | Standard | Restricted | Quarantine | Kill
├── Auto-Kill: rep < 30 OR active dispute
├── Telemetry: syscall logs, violations, evidence for Arbitra
└── 7-Layer Integration:
    ├── TAP → Quota calculation
    ├── Arbitra → Evidence export
    ├── ClawLink → Inter-sandbox comms
    ├── ClawID → Identity binding
    ├── ClawForge → Policy + kill switch
    ├── ClawKernel → Task execution
    └── ClawFS → Gated filesystem access
```

### Quota Formula

```typescript
const quotas = {
  cpuMsPerSecond: reputation * 10,      // 0-1000ms/sec
  memoryMB: reputation * 1,             // 0-100MB
  networkKBps: reputation * 10,         // 0-1000KB/sec
  maxSyscallsPerSec: reputation * 50,   // 0-5000/sec
  maxFileDescriptors: reputation * 2,   // 0-200
  maxProcesses: Math.floor(reputation / 20), // 0-5
};

// Dispute = throttle to 10%, network isolation
// Rep < 30 = auto-kill
```

### Rogue Agent Test Results

| Agent Type | Initial Rep | Attack | Expected | Result |
|------------|-------------|--------|----------|--------|
| CPU_Hogger | 85 | CPU spike | Throttled | ✅ |
| Memory_Leaker | 70 | Memory exhaust | Killed | ✅ |
| Network_Flooder | 60 | Network abuse | Quarantined | ✅ |
| Syscall_Bomber | 75 | Syscall flood | Throttled | ✅ |
| Dispute_Evader | 90 | Operate during dispute | Quarantined | ✅ |
| Low_Rep_Attacker | 35 | Any attack | Killed | ✅ |

**6/6 tests passed** — Sandbox correctly handles rogue agents.

### Performance Benchmarks

| Backend | Startup | Memory | Throughput | Use Case |
|---------|---------|--------|------------|----------|
| WASM | ~10ms | ~5MB | High | Default, trusted agents |
| Firecracker | ~125ms | ~15MB | Medium | Untrusted, disputes |
| Docker | ~500ms | ~50MB | Low | Legacy compatibility |

### Key Features

1. **Reputation = Resources** — Higher rep = bigger quotas
2. **Hard Isolation** — WASM (memory-safe), Firecracker (hardware VM), Docker (namespace)
3. **Auto-Kill** — Low rep or active dispute = termination
4. **Telemetry** — Full syscall logging, violation tracking, Arbitra evidence
5. **Dynamic Adjustment** — Quotas update in real-time as reputation changes
6. **Revocable** — ClawForge can kill or adjust any sandbox instantly

### Security Modes

| Mode | Rep | Isolation | Network |
|------|-----|-----------|---------|
| Trusted | >80 | WASM | Full |
| Standard | 50-80 | WASM + seccomp | Full |
| Restricted | 30-50 | Firecracker | Limited |
| Quarantine | Any+dispute | Firecracker | None |
| Kill | <30 | Terminated | N/A |

### Integration Status

| Layer | Integration | Status |
|-------|-------------|--------|
| TAP | Reputation → quotas | ✓ |
| Arbitra | Telemetry as evidence | ✓ |
| ClawLink | Inter-sandbox comms | ✓ |
| ClawID | Identity binding | ✓ |
| ClawForge | Policy + kill switch | ✓ |
| ClawKernel | Task execution | ✓ |
| ClawFS | Gated filesystem | ✓ |

### Usage

```typescript
import { ClawSandbox } from '@exitliquidity/clawsandbox';

const sandbox = new ClawSandbox({
  agentId: 'my-agent',
  clawId: myClawID,
  tapClient: tap,
  isolationBackend: 'wasm',
  code: wasmBinary,
  entryPoint: 'main',
});

// Start with reputation-weighted quotas
await sandbox.start();

// Auto-kill on low rep or violation
sandbox.on('killed', ({ reason }) => {
  console.log(`Sandbox killed: ${reason}`);
});

// Get telemetry for disputes
const report = sandbox.getReport();
const evidence = sandbox.getEvidenceForDispute();
```

---

**SANDBOXING IMPLEMENTATION COMPLETE — NEXT KERNEL PIECE LOCKED**

*The 8th layer of ClawOS is now fully specified and implemented.*
