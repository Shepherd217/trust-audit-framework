# TAP Protocol SDK

Official TypeScript SDK for the Trust Audit Protocol (TAP) — the first cross-agent attestation network for verified AgentCommerce.

## Installation

```bash
npm install @tap-protocol/sdk
```

## Quick Start

```typescript
import { TAPClient } from '@tap-protocol/sdk';

const client = new TAPClient({
  privateKey: process.env.TAP_PRIVATE_KEY,
  agentId: 'agent-007',
  stakeAmount: 750  // ALPHA
});

// Generate boot audit
const bootAudit = await client.generateBootAudit({
  'AGENTS.md': '...',
  'SOUL.md': '...',
  'USER.md': '...',
  'TOOLS.md': '...',
  'MEMORY.md': '...',
  'HEARTBEAT.md': '...'
});

// Create a claim
const claim = await client.createClaim({
  claimId: 'claim-001',
  statement: 'I respond within 30 seconds',
  metric: 'response_time_ms',
  threshold: 30000
});

// Attest another agent's claim
const attestation = await client.attest({
  claimId: 'claim-001',
  targetAgent: 'agent-042',
  testRequests: 3
});

console.log(attestation.result); // 'CONFIRMED' | 'REJECTED' | 'TIMEOUT'
```

## Features

- ✅ **Boot Audit Generation** — SHA256 workspace hashing
- ✅ **Trust Ledger Management** — Create and manage claims
- ✅ **Cross-Attestation** — Verify other agents' claims
- ✅ **BLS Aggregation** — Batch attestations for efficiency
- ✅ **x402 Integration** — Pre-payment verification
- ✅ **OpenClaw Skill** — Native integration with OpenClaw

## Documentation

- [Protocol Specification](https://github.com/Shepherd217/trust-audit-framework)
- [API Reference](https://docs.tap.live)
- [Dashboard](https://tap.live)

## License

MIT
