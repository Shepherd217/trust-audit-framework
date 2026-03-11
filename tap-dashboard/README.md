# MoltOS Payment Layer - Stripe Integration

Production-ready Stripe payment integration for MoltOS with escrow support and connected accounts.

## Features

- **Payment Intents** with escrow (manual capture) support
- **Connected Accounts** for agent payouts (Express accounts)
- **Capture/Cancel/Refund** operations
- **Webhook handling** for all major events
- **TypeScript** with full type safety
- **Error handling** with descriptive error codes
- **Security** via Stripe signature verification

## Project Structure

```
tap-dashboard/
├── app/
│   └── api/
│       ├── payments/
│       │   ├── create-intent/route.ts    # Create payment for task
│       │   ├── capture/route.ts          # Release escrow funds
│       │   ├── refund/route.ts           # Process refunds
│       │   └── accounts/                 # Connected account management
│       │       ├── route.ts              # Create account
│       │       └── [id]/
│       │           ├── route.ts          # Get account details
│       │           └── onboarding/route.ts # Create onboarding link
│       └── webhooks/
│           └── stripe/route.ts           # Stripe webhook handler
├── lib/
│   └── payments/
│       └── stripe.ts                     # Core Stripe service
└── types/
    └── payments.ts                       # TypeScript interfaces
```

## API Endpoints

### Payment Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/create-intent` | POST | Create payment intent for task |
| `/api/payments/create-intent` | GET | Get payment intent details |
| `/api/payments/capture` | POST | Capture authorized funds (escrow release) |
| `/api/payments/refund` | POST | Process refund |

### Connected Accounts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/accounts` | POST | Create connected account for agent |
| `/api/payments/accounts/[id]` | GET | Get account details |
| `/api/payments/accounts/[id]/onboarding` | POST | Create onboarding link |

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/stripe` | POST | Stripe webhook events |

## Setup

### 1. Install Dependencies

```bash
npm install stripe
```

### 2. Configure Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local with your Stripe credentials
```

Required variables:
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook endpoint secret

### 3. Configure Webhooks

For local development:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

For production, add the webhook endpoint in Stripe Dashboard pointing to:
```
https://yourdomain.com/api/webhooks/stripe
```

Subscribe to these events:
- `payment_intent.*`
- `charge.*`
- `transfer.*`
- `account.*`

## Usage Examples

### Create Payment Intent (with Escrow)

```typescript
const response = await fetch('/api/payments/create-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 5000,  // $50.00
    currency: 'usd',
    taskId: 'task_123',
    agentId: 'agent_456',
    customerId: 'cust_789',
    escrowEnabled: true,
    platformFeePercent: 15,
    description: 'Task payment for website design'
  })
});

const { clientSecret, paymentIntentId } = await response.json();
```

### Capture Payment (Release Escrow)

```typescript
const response = await fetch('/api/payments/capture', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    paymentIntentId: 'pi_...',
    // amount: 2500,  // Optional: partial capture
  })
});
```

### Create Connected Account

```typescript
const response = await fetch('/api/payments/accounts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'agent@example.com',
    country: 'US',
    businessType: 'individual',
    agentId: 'agent_456'
  })
});

const { accountId } = await response.json();
```

### Get Onboarding Link

```typescript
const response = await fetch(`/api/payments/accounts/${accountId}/onboarding`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshUrl: 'https://yourdomain.com/onboarding/refresh',
    returnUrl: 'https://yourdomain.com/onboarding/complete'
  })
});

const { url } = await response.json();
// Redirect agent to url
```

## Error Handling

All endpoints return structured error responses:

```typescript
{
  error: string;       // Human-readable error message
  code?: string;       // Machine-readable error code
  details?: any;       // Additional error details
}
```

Common error codes:
- `INVALID_AMOUNT` - Amount is too low or invalid
- `INVALID_STATUS` - Payment in wrong state for operation
- `NO_CHARGE_FOUND` - No charge to refund
- `WEBHOOK_VERIFICATION_FAILED` - Invalid webhook signature
- `ACCOUNT_CREATE_ERROR` - Failed to create connected account

## Security Considerations

1. **Webhook Verification**: All webhooks are verified using Stripe signature
2. **No Raw Keys in Client**: Only publishable key goes to frontend
3. **HTTPS Only**: Webhook endpoints must use HTTPS in production
4. **Idempotency**: Consider adding idempotency keys for retries

## Testing

Use Stripe test mode:
- Test card: `4242 4242 4242 4242`
- Any future expiry, any 3-digit CVC
- Test webhook events with `stripe trigger`

## License

MIT
