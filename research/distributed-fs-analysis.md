# Distributed File Systems Research for ClawFS Design

## Executive Summary

This research analyzes 5 major distributed file systems and emerging AI agent storage solutions to inform ClawFS design. Key findings reveal that **none of the existing systems are truly "agent-native"** - they were designed for human users or traditional applications, not autonomous AI agents that need fine-grained permission control, dynamic access patterns, and seamless tool integration.

---

## Comparison Table

| System | Architecture | Content Addressing | Permissions | Pricing | API Design | Key Limitations |
|--------|-------------|-------------------|-------------|---------|------------|-----------------|
| **IPFS** | P2P DHT + BitSwap | CID (multihash) | None (public by default) | Free (self-hosted) / Pinning services $4-5/GB | HTTP Gateway, RPC API, CLI | No persistence guarantee, no encryption, no permissions, GC complexity |
| **Storj** | Decentralized nodes + Satellites (gateways) | No - uses paths | S3-compatible IAM | $4-15/TB/month + $7/TB egress | S3-compatible REST | Min file size 64MB, centralized satellites, no content addressing |
| **Filecoin** | Storage marketplace + IPFS | CID | Smart contracts | $0.19/TB/month (variable market) | Lotus API, FVM contracts | Slow retrieval, complex deals, crypto-native only, 2-3 hour retrieval |
| **Sia** | Smart contract storage hosts | No - contract-based | Renter-host contracts | ~$2.5/TB storage + $5/TB download | S3-compatible (partial) | Min file size 40MB, 3-month contracts, no content addressing |
| **Web3.Storage** | IPFS + Filecoin pinning | CID | API key auth | $4.99/GB one-time (NFT.Storage) | Pinning Service API | Deprecating, becoming Storacha, limited API surface |

---

## Detailed System Analysis

### 1. IPFS (InterPlanetary File System)

**Architecture:**
- P2P network using Kademlia DHT for content discovery
- Files chunked into blocks, addressed by Content Identifier (CID)
- Bitswap protocol for block exchange (BitTorrent-inspired)
- Merkle DAG structure for immutable data linking

**Content Addressing:**
- CID = multihash of content (SHA-256 by default)
- CIDs are immutable - content changes = new CID
- Supports CIDv0 and CIDv1 formats
- Self-certifying: hash verifies data integrity

**Permissions/Access Control:**
- **No built-in permissions** - all content is public by default
- Anyone with CID can access content
- Private data requires client-side encryption before upload
- No ACLs, no user authentication at protocol level

**Pricing:**
- Self-hosted: Free (run your own node)
- Pinning services: $4-5/GB one-time or monthly
- No built-in incentive layer (unlike Filecoin)

**API Design Patterns:**
- Kubo RPC API (admin-level, localhost-only by default)
- HTTP Gateway for read-only access
- IPFS Pinning Service API specification
- CLI: `ipfs add`, `ipfs cat`, `ipfs pin`

**Key Weaknesses for Agents:**
1. **No persistence guarantee** - data garbage collected unless pinned
2. **No access control** - agents can't restrict who sees their data
3. **CID doesn't convey metadata** - no built-in way to track provenance, timestamps, agent identity
4. **Complex pinning management** - agents must explicitly manage pins vs cache
5. **Slow DHT lookups** - content discovery can take seconds to minutes
6. **No query capability** - can't search by metadata, only by exact CID

**What Makes It NOT Agent-Native:**
- Designed for content distribution, not agent state management
- No concept of "ownership" or "access rights" at protocol level
- Agents would need to build entire permission layer on top

---

### 2. Storj

**Architecture:**
- Decentralized storage nodes with centralized "Satellite" gateways
- Files encrypted client-side, split into 80 pieces, distributed to nodes
- Erasure coding: only 29 of 80 pieces needed for reconstruction
- Global edge network for low-latency access

**Content Addressing:**
- **Not content-addressed** - uses traditional bucket/path naming
- SHA-256 used for integrity but not for addressing
- Location-based addressing (like S3)

**Permissions/Access Control:**
- S3-compatible IAM policies
- API key-based authentication
- Bucket-level and object-level ACLs
- Encryption keys held by user (zero-knowledge)

**Pricing (as of 2025):**
- Global Collaboration: $15/TB/month + 1X egress included
- Regional Workflows: $10/TB/month + 1X egress included  
- Active Archive: $6/TB/month + $0.02/GB egress
- Legacy: $4/TB/month + $7/TB egress

**API Design Patterns:**
- Full S3-compatible REST API
- Uplink CLI and SDK (Go, Python, Java, Node.js)
- Multipart upload support (up to 10,000 parts)

**Key Weaknesses for Agents:**
1. **Not content-addressed** - can't verify data integrity without downloading
2. **Minimum file size 64MB** - terrible for agent state files, configs, small logs
3. **Centralized satellites** - trust required in Storj-operated gateways
4. **No smart contracts** - can't automate access control programmatically
5. **Enterprise-focused** - designed for backup/archival, not real-time agent operations

**What Makes It NOT Agent-Native:**
- Designed for human enterprises, not autonomous agents
- File operations (move, copy, rename) require centralized gateway
- No native support for agent-specific patterns like state snapshots

---

### 3. Filecoin

**Architecture:**
- Storage marketplace built on IPFS
- Blockchain consensus with Proof-of-Replication (PoRep) and Proof-of-Spacetime (PoSt)
- Storage providers earn FIL tokens for storing data
- Filecoin Virtual Machine (FVM) enables smart contracts on storage

**Content Addressing:**
- Uses IPFS CIDs for content identification
- On-chain storage deals reference CIDs
- Data retrievable via IPFS or Filecoin retrieval market

**Permissions/Access Control:**
- Smart contract-based access control
- FVM enables programmable storage logic
- Storage deals are on-chain and auditable
- No built-in encryption (client-side required)

**Pricing:**
- Storage: ~$0.19/TB/month (market-driven, variable)
- Retrieval: Variable by provider (often expensive)
- FIL token volatility affects predictability

**API Design Patterns:**
- Lotus node API (complex, resource-intensive)
- FVM for smart contract interactions
- Filecoin retrieval market APIs
- IPFS-compatible gateways

**Key Weaknesses for Agents:**
1. **Extremely slow** - storage deals take hours to seal, retrieval 2-3 hours
2. **Complex deal-making** - agents must negotiate with storage providers
3. **Crypto-native only** - requires FIL tokens, wallet management
4. **Unpredictable costs** - market-based pricing
5. **Poor retrieval performance** - optimized for archival, not real-time access
6. **No native permission models** - must build on FVM

**What Makes It NOT Agent-Native:**
- Designed for cold storage, not agent hot state
- Deal-based model incompatible with frequent small writes
- Retrieval market not suitable for agent real-time needs

---

### 4. Sia

**Architecture:**
- Blockchain-based storage marketplace
- Files split into 30 segments with 10-of-30 erasure coding
- Smart contracts ("file contracts") between renters and hosts
- Hosts lock collateral in SC (Siacoin) to guarantee storage

**Content Addressing:**
- **Not content-addressed** - contract-based addressing
- Merkle tree proofs for data verification
- Contract ID used for retrieval

**Permissions/Access Control:**
- Renter-host smart contracts
- Contract terms specify duration, price, penalties
- No granular ACLs - all-or-nothing contract access

**Pricing:**
- Storage: ~$2.5/TB over 3 months
- Upload: ~$0.6/TB
- Download: ~$5/TB
- Collateral requirements for hosts

**API Design Patterns:**
- `renterd`, `hostd`, `walletd` daemons
- S3-compatible gateway (partial support as of 2026)
- REST API for contract management

**Key Weaknesses for Agents:**
1. **Minimum file size 40MB** - padded to this size, wasteful for small files
2. **3-month minimum contract** - no short-term or ephemeral storage
3. **Complex onboarding** - requires Siacoin, wallet, contract management
4. **No content addressing** - can't deduplicate or verify without download
5. **Slow adoption** - limited ecosystem compared to Filecoin

**What Makes It NOT Agent-Native:**
- Contract model designed for long-term storage, not agent ephemeral state
- No support for rapid state changes or frequent updates
- Complex economic model requires active management

---

### 5. Web3.Storage / NFT.Storage (Pinning Services)

**Architecture:**
- Managed IPFS pinning service + Filecoin backup
- Elastic IPFS for scalable ingestion
- w3name for mutable pointers to immutable CIDs
- Storacha (new branding as of 2024/2025)

**Content Addressing:**
- Full IPFS CID support
- CAR (Content Addressable Archive) files for bulk upload
- w3name for dynamic naming (DNSLink-like)

**Permissions/Access Control:**
- API key authentication only
- No granular permissions
- Public-by-default (like IPFS)

**Pricing:**
- NFT.Storage: $4.99/GB one-time fee
- Web3.Storage: Freemium (5GB free, then paid tiers)
- Storacha: New pricing model (TBD)

**API Design Patterns:**
- IPFS Pinning Service API
- w3up CLI and JavaScript client
- UCAN (User Controlled Authorization Networks) for auth

**Key Weaknesses for Agents:**
1. **Service deprecation risk** - Web3.Storage deprecated, transitioned to Storacha
2. **Limited API surface** - pinning only, no advanced querying
3. **No permission model** - public data only
4. **No SLA guarantees** - best-effort pinning
5. **UCAN complexity** - newer auth model has learning curve

**What Makes It NOT Agent-Native:**
- Simple pinning service, not a full agent storage solution
- No state management, no agent-specific features

---

## AI Agent Storage Systems (Emerging)

### Mem0
- **Architecture:** Hybrid vector + graph memory with LLM-based extraction
- **Memory Types:** Working, factual, episodic, semantic memory
- **Features:** Cross-session context, automatic deduplication, conflict resolution
- **API:** Simple `memory.add()`, `memory.search()` patterns
- **Agent-Native Aspects:** Designed specifically for AI agents, understands LLM context

### Zep
- **Architecture:** Temporal Knowledge Graph
- **Features:** Time-aware facts, relationship tracking, 18.5% better long-horizon accuracy
- **Memory Model:** Facts with `valid_at`/`invalid_at` timestamps
- **Agent-Native Aspects:** Tracks how knowledge changes over time - crucial for learning agents

### Letta (formerly MemGPT)
- **Architecture:** Filesystem-based memory with tool access
- **Features:** Agents can `grep`, `search_files`, `open`, `close` their own memory
- **Insight:** Even simple filesystem beats specialized memory tools when agents can iterate
- **Agent-Native Aspects:** Treats memory as files agents can manipulate

### LangMem
- **Architecture:** LangChain-native memory solution
- **Memory Types:** Semantic (facts), Episodic (experiences), Procedural (skills)
- **Features:** Active memory management, shared memory across agents
- **Agent-Native Aspects:** Tight integration with LangGraph agent framework

---

## What ClawFS Should COPY

### From IPFS:
1. **Content addressing (CID)** - deduplication, integrity verification
2. **Merkle DAG structure** - efficient versioning and branching
3. **P2P distribution** - resilience, no single point of failure
4. **HTTP Gateway** - easy accessibility without special clients

### From Storj:
1. **S3-compatible API** - easy migration, wide tooling support
2. **Client-side encryption** - zero-knowledge security
3. **Erasure coding** - efficient redundancy without full replication
4. **Global edge performance** - low-latency access

### From Filecoin:
1. **Storage marketplace concept** - economic incentives for storage providers
2. **Cryptographic proofs** - verifiable storage without trust
3. **FVM-style programmability** - smart contracts for access control

### From Agent Memory Systems:
1. **Semantic memory layers** - vector search for meaning, not just IDs
2. **Temporal tracking** - when facts were true, not just what they are
3. **Tool-based access** - agents should manipulate storage via function calls
4. **Cross-session persistence** - memory that survives agent restarts

---

## What ClawFS Should Do DIFFERENTLY

### 1. **Native Agent Identity & Permissions**
- Every agent has a cryptographic identity (like DID)
- Fine-grained capability-based access control
- Agents can grant/revoke access to other agents programmatically
- No "public by default" - private by default, opt-in sharing

### 2. **Multi-Modal Storage Primitives**
- Files (binary blobs with metadata)
- Vectors (embeddings for semantic search)
- Graphs (relationships between entities)
- Time-series (event logs, metrics)
- All unified under single namespace

### 3. **Agent-Native API Design**
```javascript
// Instead of:
ipfs.add(file) → returns CID
s3.putObject(bucket, key, file)

// ClawFS should support:
clawfs.store({
  data: file,
  agent: agentId,
  permissions: { read: [agentA, agentB], write: [agentA] },
  metadata: { purpose: "research", project: "x" },
  ttl: "7d"  // automatic cleanup
})

clawfs.query({
  agent: agentId,
  semantic: "user preferences about email",
  temporal: { since: "2024-01-01" },
  type: "conversation"
})
```

### 4. **Dynamic Access Patterns**
- Hot storage: immediate access for active agent state
- Warm storage: recent history, fast retrieval
- Cold storage: archival, proof-verified
- Automatic tiering based on access patterns

### 5. **Built-in State Versioning**
- Every write is a snapshot
- Branch/merge semantics for agent state
- Conflict resolution for concurrent updates
- Time-travel queries (what did agent know at time T?)

### 6. **No Crypto Complexity**
- Fiat pricing, predictable costs
- No token volatility
- Credit-based system agents can budget
- No wallet management burden

### 7. **Small File Optimization**
- No minimum file sizes (unlike Sia's 40MB, Storj's 64MB)
- Efficient packing of small agent state files
- Optimized for millions of small objects, not just large files

---

## Summary: Why Existing Systems Fail Agents

| Requirement | IPFS | Storj | Filecoin | Sia | Agent-Native Ideal |
|-------------|------|-------|----------|-----|-------------------|
| Fine-grained permissions | ❌ | ⚠️ | ⚠️ | ❌ | ✅ Capability-based |
| Semantic search | ❌ | ❌ | ❌ | ❌ | ✅ Vector + metadata |
| Fast writes | ✅ | ✅ | ❌ | ⚠️ | ✅ <100ms |
| Fast reads | ⚠️ | ✅ | ❌ | ⚠️ | ✅ <50ms |
| Small file efficient | ✅ | ❌ | ⚠️ | ❌ | ✅ No minimums |
| Crypto-optional | ✅ | ✅ | ❌ | ❌ | ✅ Fiat pricing |
| Agent identity | ❌ | ❌ | ⚠️ | ❌ | ✅ Built-in |
| State versioning | ❌ | ❌ | ❌ | ❌ | ✅ Native |
| Ephemeral/TTL | ❌ | ❌ | ❌ | ❌ | ✅ First-class |
| Multi-modal | ❌ | ❌ | ❌ | ❌ | ✅ Files/Vectors/Graphs |

**Key Insight:** All existing systems were designed for *human* use cases (file sharing, backup, archival) or *web* use cases (content distribution). None were designed for *autonomous agents* that need to:
1. Store and query their own state semantically
2. Share data with specific other agents (not public/not private)
3. Manage millions of small state files efficiently
4. Reason about what they knew when
5. Operate without human wallet management

This gap represents the opportunity for ClawFS.

---

## References

1. IPFS Documentation: https://docs.ipfs.tech/
2. Storj Pricing: https://storj.dev/dcs/pricing
3. Filecoin Docs: https://docs.filecoin.io/
4. Sia Roadmap: https://sia.tech/roadmap
5. Web3.Storage/Storacha: https://storacha.network/
6. Mem0: https://github.com/mem0ai/mem0
7. Zep: https://www.getzep.com/
8. Letta: https://www.letta.com/
9. LangMem: https://langchain-ai.github.io/langmem/
10. "Memory for AI Agents: A New Paradigm" - TheNewStack 2024
11. "The AI Agents Stack" - Letta Blog 2024
