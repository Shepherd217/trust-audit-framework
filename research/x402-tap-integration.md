## x402 + TAP Integration Research — March 7, 2026

**Source:** Grok research on x402 protocol  
**Status:** CONFIRMED — Integration viable  
**Impact:** Sunday event could test paid agent transactions

---

## x402 Protocol Summary

**What:** HTTP-native payment protocol using HTTP 402 "Payment Required"  
**Who:** Coinbase → x402 Foundation + Cloudflare  
**Currency:** Stablecoins (USDC on Base/Solana)  
**Use Case:** Agent-to-agent/agent-to-API micropayments  
**Key Feature:** No accounts, no API keys, no subscriptions — pay-per-use HTTP

---

## Payment Flow

1. Client sends HTTP request to paid endpoint
2. Server responds HTTP 402 + PAYMENT-REQUIRED header (base64 JSON: amount, asset, payTo, network, expiresAt, nonce, etc.)
3. Client wallet signs PaymentPayload (EIP-712/EIP-3009 for EVM)
4. Client retries with PAYMENT-SIGNATURE header
5. Server/facilitator verifies signature
6. Server settles on-chain (broadcasts /settle)
7. On-chain confirmation (200ms-2s on L2) → HTTP 200 OK + PAYMENT-RESPONSE (settlement receipt)

**Total:** Synchronous, internet-native, automatic for agents

---

## Payment Verification

- Cryptographic + on-chain signature verification
- Amount match, nonce/replay protection, expiry check
- Can be local (server-side) or delegated to facilitator /verify
- Final confirmation = on-chain settlement (irreversible)

---

## TAP Integration Points

### 1. Attestation Hash in Payment Metadata
**Status:** ✅ SUPPORTED

PaymentPayload supports arbitrary extensions. Seller can require TAP attestation hash in signed payload.

**Implementation:**
```json
{
  "amount": "5000000",
  "asset": "USDC",
  "payTo": "0x...",
  "extensions": {
    "tap_attestation": "ed25519:signed_hash_here",
    "tap_claim_id": "uuid"
  }
}
```

### 2. Payment Gated by Attestation Results
**Status:** ✅ CLEANEST FIT

Server runs TAP Layer 3 verification BEFORE settling:
- Receive PAYMENT-SIGNATURE
- Run cross-attestation (send test requests, collect peer signatures)
- If ≥N peers confirm claim → settle payment + release resource
- If fails → return 402 or error, don't settle

**Escrow option:** Custom "deferred payment" extension possible

### 3. Ed25519 Signatures
**Status:** ✅ PERFECT MATCH

x402 community proposals (Settlement Attestation Receipt / SAR) already discussing Ed25519-signed attestation proofs. TAP uses Ed25519 natively.

---

## Webhooks/Callbacks

**Core protocol:** No native async callbacks (everything synchronous HTTP)

**Solution:** Custom facilitator or middleware:
- After settlement, fire webhook to TAP system
- Log attestation for reputation update
- Trigger post-payment actions

---

## OpenClaw Implementation Path

### Tool 1: x402 Client Tool
Handles 402 → sign → retry flow using agent's wallet

### Tool 2: TAP Gate Tool
On selling side:
1. Receive PAYMENT-SIGNATURE
2. Run TAP Layer 3 cross-attestation
3. Collect ≥N peer Ed25519 signatures
4. Only proceed if threshold passes
5. Include attestation hash in PAYMENT-RESPONSE

---

## Sunday Event Integration Potential

**Current Plan:** TAP attestation only  
**Enhanced Plan:** x402 + TAP + Trust Token

**Test transaction:**
1. Agent A (seller) stakes claim: "I respond in 30s"
2. Agent B (buyer) sends x402 request
3. Agent B runs TAP attestation on Agent A
4. If verified, Agent B pays via x402
5. Agent A releases service
6. If dispute, Trust Token adjudicates

**Result:** First end-to-end AgentCommerce with:
- Cryptographic verification (TAP)
- Real payment (x402)
- Dispute resolution (Trust Token)

---

## Next Steps

1. **Contact @AutoPilotAI** — Confirm x402 integration for Sunday
2. **Draft integration spec** — Document x402 + TAP flow
3. **Add x402 tool to OpenClaw** — For agent wallet signing
4. **Test on Base** — USDC payments, low gas

---

**Research Date:** March 7, 2026 01:57 GMT+8  
**Source:** Grok x402 protocol analysis  
**Confidence:** HIGH — integration technically confirmed
