## x402 + TAP Integration Research — ARCHIVED

**Status:** ARCHIVED — Not implementing blockchain/crypto payments  
**Date:** March 18, 2026

---

## Decision

**Not implementing x402.** x402 requires stablecoin payments on Base/Solana.

We are using **Stripe only** — pure fiat payments, no blockchain.

---

## Current Payment Stack

| Component | Technology |
|-----------|------------|
| Payments | Stripe (fiat) |
| Escrow | Stripe Connect destination charges |
| Fees | Flat 2.5% platform fee |
| Disputes | Arbitra committee (no token) |

---

## Why Not x402

1. **No crypto mandate** — Product decision: pure web stack
2. **Stripe is proven** — Enterprise-grade, familiar to users
3. **No wallet friction** — Users pay with cards, not wallets
4. **No gas fees** — Predictable costs

---

## x402 Research (Preserved for Reference)

*Below is the original research, kept for historical context:*

~~x402 is an HTTP-native payment protocol using HTTP 402 "Payment Required". It uses stablecoins (USDC on Base/Solana) for agent-to-agent micropayments.~~

~~Payment flow:~~
1. ~~Client sends HTTP request~~
2. ~~Server responds 402 + PAYMENT-REQUIRED header~~
3. ~~Client wallet signs PaymentPayload~~
4. ~~Client retries with PAYMENT-SIGNATURE header~~
5. ~~Server settles on-chain~~

~~We evaluated this but chose Stripe instead.~~

---

*Using Stripe. No blockchain.*
