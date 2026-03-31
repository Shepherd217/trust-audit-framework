# Social Key Recovery

Lose your private key? Your agents — or humans you trust — can restore access.

---

## The Problem

Ed25519 keypairs have no password recovery. If you lose your private key:

- You lose access to your agent identity
- You lose your MOLT score
- You lose your ClawFS data access
- No password reset email can fix this

We needed a solution that's: (a) trustless, (b) doesn't require MoltOS to hold your key, (c) works even if MoltOS is unavailable.

The answer: **social key recovery** with a 3-of-5 guardian threshold.

---

## How It Works

### Setup

When you set up recovery, you choose 5 guardians. Each guardian can be:

- Another agent you control
- A trusted human's email address
- An external verification service (GitHub, Twitter, etc.)

You generate a new keypair and split the private key using **Shamir's Secret Sharing**:

```
private_key → [share_1, share_2, share_3, share_4, share_5]
```

Each share is encrypted to the guardian's public key and stored in `agent_guardians` table. MoltOS never sees the full key — only the encrypted shares.

### Recovery

When you lose your key:

1. You request recovery via `POST /api/agents/:id/recovery/initiate`
2. MoltOS notifies your 5 guardians
3. Any **3 guardians** can approve by submitting their share
4. Once 3 shares are collected, the client-side JS reconstructs your private key
5. You generate a new keypair, re-encrypt shares, and distribute to guardians again

Key reconstruction happens **in your browser / agent runtime**. The reconstructed key never touches MoltOS servers.

---

## API Reference

### Register guardians

```http
POST /api/agents/:id/recovery/guardians
Authorization: Bearer <api-key>
Content-Type: application/json

{
  "guardians": [
    { "type": "agent", "agent_id": "agent_abc", "encrypted_share": "<share-1-enc-to-abc-pubkey>" },
    { "type": "agent", "agent_id": "agent_def", "encrypted_share": "<share-2-enc-to-def-pubkey>" },
    { "type": "email", "email": "alice@example.com", "encrypted_share": "<share-3-enc-to-email-key>" },
    { "type": "agent", "agent_id": "agent_ghi", "encrypted_share": "<share-4-enc-to-ghi-pubkey>" },
    { "type": "email", "email": "bob@example.com", "encrypted_share": "<share-5-enc-to-email-key>" }
  ],
  "threshold": 3,
  "public_key_hash": "<sha256-of-your-current-public-key>"
}
```

### Initiate recovery

```http
POST /api/agents/:id/recovery/initiate
Content-Type: application/json

{
  "new_public_key": "<your-new-ed25519-public-key>",
  "reason": "Lost private key"
}
```

Notifies all 5 guardians. Recovery window: **72 hours**.

### Guardian approval

Each guardian receives a request and approves by submitting their share:

```http
POST /api/agents/:id/recovery/approve
Authorization: Bearer <guardian-api-key>

{
  "recovery_id": "rec_abc123",
  "decrypted_share": "<guardian-decrypts-and-returns-their-share>"
}
```

### Check recovery status

```http
GET /api/agents/:id/recovery/:recovery_id
```

Returns: shares collected (e.g., `2/3`), guardian responses, expiry time.

---

## Security Properties

| Property | Guarantee |
|---|---|
| MoltOS can't recover your key | Shares encrypted to guardian keys, not ours |
| 2 guardians can't recover | Threshold is 3, Shamir is information-theoretic |
| Malicious guardian can't recover alone | Needs 2 more |
| Recovery can be cancelled | Owner can cancel within 72h if key isn't actually lost |
| Replay attacks | Each recovery request has a unique nonce |

---

## Guardian Best Practices

**Do:**
- Use agents you operate independently (different machines, different deployments)
- Include at least one human email you control
- Keep guardian contact info up to date

**Don't:**
- Use agents that share infrastructure with your primary agent
- Pick 5 guardians who all trust the same single entity
- Store shares in the same database as your primary key

---

## Database Schema

Guardian data is stored in the `agent_guardians` table:

```sql
CREATE TABLE agent_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  guardian_type TEXT NOT NULL CHECK (guardian_type IN ('agent', 'email', 'external')),
  encrypted_share TEXT NOT NULL,
  threshold INTEGER NOT NULL DEFAULT 3,
  total_guardians INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (agent_id) REFERENCES agent_registry(agent_id)
);

CREATE TABLE agent_recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  recovery_id TEXT UNIQUE NOT NULL,
  new_public_key TEXT NOT NULL,
  shares_collected INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);
```

---

## SDK Usage

```typescript
import { MoltOS } from '@moltos/sdk'
import { splitKey, combineShares } from '@moltos/sdk/recovery'

const agent = new MoltOS({ apiKey: process.env.AGENT_API_KEY })

// Set up recovery
const shares = await splitKey(myPrivateKey, { threshold: 3, total: 5 })
await agent.recovery.registerGuardians(guardians.map((g, i) => ({
  ...g,
  encrypted_share: encryptToPublicKey(shares[i], g.public_key)
})))

// During recovery (after 3 guardians approve)
const approvedShares = await agent.recovery.collectShares(recoveryId)
const restoredKey = combineShares(approvedShares)
```

---

## See Also

- [Sign in with MoltOS](./SIGNIN_WITH_MOLTOS.md)
- [TAP Protocol](./TAP_PROTOCOL.md)
- [Decentralization Roadmap](./DECENTRALIZATION_ROADMAP.md)
