# CLAWFS — Deep Research & Implementation
## GOD MODE RESEARCH LOCKED (March 11, 2026)

### Research Foundation

**1. AIOS Storage Manager (arXiv 2403.16971v5)**
- Traditional files + vector DB hybrid
- Semantic search capabilities
- **Gap:** No reputation gating, no Merkle provenance
- **Lesson:** Hybrid storage is correct, but need trust layer

**2. Fast.io Agent FS**
- Persistent MCP filesystem
- Terabyte scale, API-first
- **Gap:** No Merkle verification, no reputation controls
- **Lesson:** API design patterns, scale considerations

**3. AgentFS (2026)**
- SQLite backend for state/files/tool history
- Good relationship tracking
- **Gap:** Single-node, not distributed
- **Lesson:** SQLite is fast, but need distributed Merkle

**4. FirmHive PKH (arXiv 2511.18438)**
- Immutable logs + reconciliation
- Cross-agent state consistency
- **Gap:** Heavy compute overhead
- **Lesson:** Merkle is correct, but optimize for agent workloads

**5. Mimir Neo4j**
- Graph memory with auto-relationships
- **Lesson:** Relationships matter, integrate as metadata layer

**6. Temporal/Dapr**
- Durable workflows with state persistence
- **Lesson:** Event-sourcing pattern, integrate with ClawKernel

**7. 1Password Research**
- Scoped/revocable access
- Ed25519 + Merkle for production
- **Lesson:** Cryptographic identity binding is essential

### Core Insight
No existing system combines:
- Merkle provenance (FirmHive)
- Reputation gating (missing everywhere)
- Hybrid storage (AIOS approach)
- Agent-native API (Fast.io patterns)
- Production security (1Password model)

**ClawFS fills this gap.**

### Design Principles
1. **Trust-first:** Reputation gate EVERY operation
2. **Verifiable:** Merkle proof for all state changes
3. **Hybrid:** Hot data in SQLite, provenance in Merkle DAG, semantic in vector index
4. **Portable:** ClawID-signed operations work across any host
5. **Policy-driven:** ClawForge enforces fine-grained access

---

## TECHNICAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAWFS LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  API Surface                                                     │
│  ├── create(path, data, options) → MerkleRoot                   │
│  ├── read(path, clawId) → Data + Proof                          │
│  ├── write(path, data, clawId) → NewMerkleRoot                  │
│  ├── delete(path, clawId) → TombstoneProof                      │
│  ├── share(path, targetClawId, permissions)                     │
│  ├── version(path) → History[]                                  │
│  └── rollback(path, merkleRoot) → RestoredData                  │
├─────────────────────────────────────────────────────────────────┤
│  Reputation Gate                                                │
│  ├── minRep: 60 (configurable per path)                         │
│  ├── operationCost: Read=1, Write=5, Delete=10, Share=2         │
│  └── verify(clawId) → RepScore (from TAP EigenTrust)            │
├─────────────────────────────────────────────────────────────────┤
│  Merkle DAG (Provenance Layer)                                  │
│  ├── Leaf: SHA-256(content + timestamp + clawId)                │
│  ├── Node: SHA-256(left + right + op_metadata)                  │
│  └── Root: Published to ClawID Merkle tree                      │
├─────────────────────────────────────────────────────────────────┤
│  Hybrid Storage Engine                                          │
│  ├── Hot Cache: SQLite (fast lookups, recent ops)               │
│  ├── Warm Store: Vector DB (semantic search, relationships)     │
│  └── Cold Archive: IPFS/Filecoin (immutable history)            │
├─────────────────────────────────────────────────────────────────┤
│  Integration Hooks                                              │
│  ├── ClawID: Signs all ops, persists root in identity tree      │
│  ├── ClawLink: Passes file handles with Merkle proofs           │
│  ├── ClawForge: Enforces policy (ACL, rate limits, quotas)      │
│  ├── ClawKernel: Persists task state via checkpoint API         │
│  └── TAP: Reputation queries + attestation of file integrity    │
└─────────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION

### File: packages/clawfs-protocol/clawfs.ts
