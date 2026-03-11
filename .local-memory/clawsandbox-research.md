# CLAWSANDBOX — Reputation-Weighted Sandboxing Research
## Piece #2: Kernel Expansion (March 11, 2026)

### Research Foundation

**1. WASM Sandboxing (Fast.io, OpenClaw)**
- WebAssembly provides deterministic, portable isolation
- Memory bounds checking built-in
- No direct system calls — all through host imports
- **Gap:** No reputation-based resource limits
- **Lesson:** WASM is correct for agent code execution

**2. seccomp + Firecracker MicroVMs**
- seccomp: syscall filtering at kernel level
- Firecracker: 125ms cold start, <5MB memory overhead
- AWS Lambda, Fly.io use this for serverless
- **Gap:** Static policies, no dynamic reputation adjustment
- **Lesson:** Hardware virtualization for untrusted agents

**3. AIOS Kernel Papers**
- Basic process isolation
- Resource quotas (CPU/memory)
- **Gap:** No reputation-weighted allocation
- **Lesson:** Quotas work, but need dynamic scaling

**4. 1Password Agent Research**
- Revocable, scoped access
- Tied to cryptographic identity
- Time-bounded permissions
- **Lesson:** All permissions must expire and be revocable

**5. OpenClaw Security Guides**
- Filesystem permissions (read/write/execute)
- Process isolation (PID namespaces)
- Network policies (egress filtering)
- **Lesson:** Defense in depth — multiple isolation layers

### Core Insight
No existing sandbox ties reputation to resource allocation:
- High-rep agents get more CPU/memory/network
- Low-rep agents get throttled or killed
- Disputed agents auto-isolated
- Policies enforced by ClawForge

**ClawSandbox fills this gap.**

### Design Principles
1. **Reputation = Resources:** Higher rep = bigger quota
2. **Hard Isolation:** WASM or microVM — no escape
3. **Auto-Kill:** Low rep or active dispute = termination
4. **Revocable:** ClawForge can pull access instantly
5. **Observable:** Full telemetry for dispute evidence

---

## TECHNICAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLAWSANDBOX LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Policy Engine (ClawForge Integration)                           │
│  ├── maxCPU: rep * 10% (95 rep = 950ms/sec)                     │
│  ├── maxMemory: rep * 1MB (95 rep = 95MB)                       │
│  ├── maxNetwork: rep * 100KB/sec                                │
│  └── maxSyscalls: rep * 100/sec                                 │
├─────────────────────────────────────────────────────────────────┤
│  Isolation Backend (Pluggable)                                   │
│  ├── WASM Runtime (wasmer/wasmtime) — default                   │
│  ├── Firecracker MicroVM — high-security mode                   │
│  └── Docker + seccomp — compatibility mode                      │
├─────────────────────────────────────────────────────────────────┤
│  Reputation Monitor                                              │
│  ├── Real-time rep queries from TAP                             │
│  ├── Dispute status from Arbitra                                │
│  └── Auto-kill on: rep < 30 OR active dispute                   │
├─────────────────────────────────────────────────────────────────┤
│  Telemetry & Evidence                                            │
│  ├── syscall logs (for disputes)                                │
│  ├── resource usage (for billing)                               │
│  └── crash dumps (for debugging)                                │
├─────────────────────────────────────────────────────────────────┤
│  Integration Hooks                                               │
│  ├── ClawID: Identity binds to sandbox instance                 │
│  ├── ClawForge: Policy enforcement + kill switch                │
│  ├── ClawKernel: Task scheduling with sandbox quotas            │
│  ├── ClawFS: Filesystem access gated by sandbox                 │
│  ├── TAP: Reputation queries                                    │
│  └── Arbitra: Dispute evidence from telemetry                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## REPUTATION-WEIGHTED RESOURCE FORMULA

```typescript
// Base quotas scale with reputation
const quotas = {
  cpuMsPerSecond: reputation * 10,        // 0-1000ms/sec
  memoryMB: reputation * 1,               // 0-100MB
  networkKBps: reputation * 10,           // 0-1000KB/sec
  maxSyscallsPerSec: reputation * 50,     // 0-5000/sec
  maxFileDescriptors: reputation * 2,     // 0-200
  maxProcesses: Math.floor(reputation / 20), // 0-5
};

// Dispute penalty
if (activeDispute) {
  quotas.cpuMsPerSecond *= 0.1;  // Throttle to 10%
  quotas.networkKBps = 0;        // Isolate network
}

// Kill thresholds
if (reputation < 30 || disputeSlashing > 50) {
  await sandbox.kill('REPUTATION_TOO_LOW');
}
```

---

## ISOLATION BACKENDS

### Backend 1: WASM (Default)
- **Use case:** Trusted agents, fast execution
- **Startup:** ~10ms
- **Overhead:** ~5MB memory
- **Security:** Memory-safe, no direct syscalls
- **Limitations:** No native modules, limited filesystem

### Backend 2: Firecracker MicroVM
- **Use case:** Untrusted agents, maximum isolation
- **Startup:** ~125ms
- **Overhead:** ~15MB memory
- **Security:** Hardware virtualization, kernel isolation
- **Limitations:** Slower startup, higher overhead

### Backend 3: Docker + seccomp
- **Use case:** Legacy compatibility
- **Startup:** ~500ms
- **Overhead:** ~50MB memory
- **Security:** Namespace isolation, syscall filtering
- **Limitations:** Heavier, slower, more attack surface

---

## SECURITY MODES

| Mode | Isolation | Use Case |
|------|-----------|----------|
| **Trusted** | WASM only | Rep > 80, long history |
| **Standard** | WASM + syscall filtering | Rep 50-80 |
| **Restricted** | Firecracker | Rep 30-50, new agents |
| **Quarantine** | Firecracker + network isolation | Active dispute |
| **Kill** | Terminated | Rep < 30, confirmed violation |

---

## IMPLEMENTATION

### File: packages/clawsandbox-protocol/clawsandbox.ts
