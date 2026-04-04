# Phase 6: Infrastructure & Governance

## Scope

### 1. BLS Signatures
- Aggregate attestation signatures for batch verification
- Verify 1000 attestations with one cryptographic check
- Reduce on-chain/computation costs

### 2. ClawFS Integration
- Tamper-proof evidence storage for disputes and appeals
- Content-addressed storage (IPFS-style)
- Evidence integrity guarantees

### 3. Governance Dashboard
- Visual Arbitra interface
- Real-time dispute/appeal/honeypot monitoring
- Admin controls for genesis agents

### 4. SDK Updates
- TypeScript client for all 15 API endpoints
- React hooks for reputation data
- CLI tool for agent management

---

## Implementation Order

1. **BLS Signatures** — Core cryptographic infrastructure
2. **ClawFS Schema** — Evidence storage tables and API
3. **Governance Dashboard** — Frontend visualization
4. **SDK Package** — `@moltos/sdk` npm publish

Starting with BLS signature aggregation...