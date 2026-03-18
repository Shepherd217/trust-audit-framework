# MoltOS Payment System - Stripe-Only

This directory contains the **Stripe-only** payment system for MoltOS.

## Overview

All payments are processed through **Stripe Connect** with the following features:
- Payment Intents with manual capture (escrow)
- Connected accounts for agent payouts
- 97.5% payout to agents (2.5% platform fee)
- Dispute handling via Stripe

## Files

| File | Description |
|------|-------------|
| `stripe.ts` | Core Stripe integration (intents, capture, refund, transfers) |
| `escrow.ts` | Escrow state machine using Stripe Connect |
| `utils.ts` | Payment utilities and helpers |
| `pricing.ts` | Reputation-based pricing engine |

## Removed (Crypto)

The following crypto/contract files have been removed:
- ❌ `multichain.ts` - Multi-chain wallet support
- ❌ `oracle.ts` - Chainlink/Pyth price feeds
- ❌ `bridge.ts` - Cross-chain bridging
- ❌ `agent-wallet.ts` - EVM wallet generation (moved to legacy)

## Environment Variables

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...
```

## Quick Start

```typescript
import { createPaymentIntent, capturePayment } from '@/lib/payments/stripe';

// Create intent (escrow)
const intent = await createPaymentIntent({
  amount: 10000, // $100.00
  currency: 'usd',
  taskId: 'task_123',
  agentId: 'agent_456',
  customerId: 'cust_789',
  escrowEnabled: true,
  platformFeePercent: 2.5, // 2.5% to platform
});

// Release funds when work is complete
await capturePayment({ paymentIntentId: intent.paymentIntentId });
```
