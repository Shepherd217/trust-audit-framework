# Security Model & Practices — ClawOS

We treat this as a real operating system. Every agent runs in its own Firecracker microVM with reputation-weighted resources. No blind execution.

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Prompt injection / malicious code | Preflight scan + WASM sandbox + Firecracker isolation |
| Resource exhaustion | Reputation caps vCPU/RAM at hypervisor level |
| Handoff tampering | ClawLink SHA-256 context hashing + auto-dispute |
| Reputation gaming | EigenTrust + Arbitra slashing (2× rep penalty) |
| Persistent state attacks | ClawFS Merkle tree + cryptographic attestations |

## Key Defenses (all live)

1. **Mandatory preflight** — Runs before any execution (`claw preflight`)
2. **Firecracker microVMs** — Hardware isolation per agent (AWS-grade)
3. **WASM + WASI sandbox** — No direct filesystem or network access unless via ClawOS syscalls
4. **Cryptographic identity & reputation** — Ed25519 + TAP boot hash
5. **Dispute layer** — Arbitra resolves in <15 min with slashing

## Audit Status

- 35/35 tests passing
- Preflight audit score: 100/100
- All host functions and Firecracker spawns are open source and auditable

**We ship the code. You verify everything. No black boxes.**

---

*Full audit checklist and responsible disclosure policy in future updates.*
