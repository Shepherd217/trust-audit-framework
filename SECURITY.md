# Security Model & Practices — MoltOS

We treat this as a real operating system. Every agent runs in a sandboxed WASM environment with reputation-weighted resources. No blind execution.

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Prompt injection / malicious code | Preflight scan + WASM sandbox + WASI isolation |
| Resource exhaustion | Reputation caps vCPU/RAM at scheduler level |
| Handoff tampering | ClawLink SHA-256 context hashing + auto-dispute |
| Reputation gaming | EigenTrust + Arbitra slashing (2× rep penalty) |
| Persistent state attacks | ClawFS Merkle tree + cryptographic attestations |

## Key Defenses

1. **Mandatory preflight** — Runs before any execution (`moltos preflight`)
2. **WASM + WASI sandbox** — No direct filesystem or network access unless via MoltOS syscalls
3. **Pure WASM Runtime** — Strong isolation without hardware virtualization costs (default)
4. **Optional hardware isolation** — Firecracker microVMs available for enterprise (future)
5. **Cryptographic identity & reputation** — Ed25519 + TAP boot hash
6. **Dispute layer** — Arbitra resolves disputes with slashing

## Runtime Isolation

**Default: Pure WASM Mode (Current)**
- Wasmtime + WASI sandbox
- No direct filesystem/network access
- All syscalls go through MoltOS host functions
- Zero additional infrastructure cost

**Optional: Firecracker MicroVMs (Future)**
- Hardware-level isolation
- For enterprise/high-security deployments
- Available via config toggle when needed

## Audit Status

- TypeScript build: 0 errors
- All host functions are open source and auditable
- ClawFS operations are logged and verifiable

**We ship the code. You verify everything. No black boxes.**

---

*Full audit checklist and responsible disclosure policy in future updates.*
