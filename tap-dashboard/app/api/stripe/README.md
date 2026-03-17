# Stripe Checkout Integration for MoltOS

This directory contains the Stripe checkout and subscription management integration for MoltOS.

## Features

- **Checkout Sessions**: Create Stripe Checkout sessions for subscription tiers
- **Webhook Handler**: Handle subscription lifecycle events (active, canceled, past_due)
- **Customer Portal**: Allow users to manage their subscriptions and payment methods
- **Three Subscription Tiers**:
  - **Builder**: $29/month - For individuals and small projects
  - **Pro**: $79/month - For growing teams and businesses  
  - **Enterprise**: $199/month - For large organizations

## API Routes

### POST /api/stripe/checkout
Creates a Stripe Checkout session for subscription signup.

**Request Body:**
```json
{
  "tier": "builder", // or "pro" or "enterprise"
  "userId": "user_123",
  "email": "user@example.com",
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/...",
  "tier": "Builder",
  "amount": 2900
}
```

### POST /api/stripe/webhook
Handles Stripe webhook events for subscription lifecycle.

**Handled Events:**
- `checkout.session.completed` - New subscription created
- `invoice.paid` - Successful recurring payment
- `invoice.payment_failed` - Failed payment (subscription past_due)
- `customer.subscription.updated` - Subscription status changes
- `customer.subscription.deleted` - Subscription canceled

### POST /api/stripe/portal
Creates a Stripe Customer Portal session for managing subscriptions.

**Request Body:**
```json
{
  "userId": "user_123",
  "email": "user@example.com",
  "returnUrl": "https://example.com/dashboard"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://billing.stripe.com/session/...",
  "customerId": "cus_..."
}
```

## Setup

### 1. Environment Variables

Copy the values from `.env.example` to `.env.local`:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Subscription Price IDs (create these in Stripe Dashboard)
STRIPE_PRICE_BUILDER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Create Products and Prices in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Create three products:
   - MoltOS Builder ($29/month, recurring)
   - MoltOS Pro ($79/month, recurring)
   - MoltOS Enterprise ($199/month, recurring)
3. Copy the price IDs (format: `price_xxxxxxxxxxxxxxxx`)
4. Add them to your `.env.local` file

### 3. Set Up Webhook Endpoint

**Local Development:**
```bash
# Install Stripe CLI first: https://stripe.com/docs/stripe-cli

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# This will give you a webhook secret (whsec_...)
# Add it to your .env.local
```

**Production:**
1. Go to [Stripe Dashboard Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`

## Usage

### Creating a Checkout Session

```typescript
const response = await fetch('/api/stripe/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tier: 'pro',
    userId: 'user_123',
    email: 'user@example.com',
    successUrl: `${window.location.origin}/checkout/success`,
    cancelUrl: `${window.location.origin}/checkout/cancel`,
  }),
});

const { url } = await response.json();
window.location.href = url; // Redirect to Stripe Checkout
```

### Opening Customer Portal

```typescript
const response = await fetch('/api/stripe/portal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_123',
    email: 'user@example.com',
    returnUrl: `${window.location.origin}/dashboard`,
  }),
});

const { url } = await response.json();
window.location.href = url; // Redirect to Stripe Customer Portal
```

### Using the Stripe Library

```typescript
import { 
  stripe, 
  STRIPE_PRICES, 
  createCustomerPortalSession,
  getSubscription,
  cancelSubscription,
  updateSubscriptionTier 
} from '@/lib/stripe';

// Get price configuration
const priceId = STRIPE_PRICES.builder.id;

// Create portal session
const { url } = await createCustomerPortalSession('cus_...');

// Get subscription details
const subscription = await getSubscription('sub_...');

// Cancel subscription (at period end)
await cancelSubscription('sub_...', false);

// Upgrade/downgrade subscription
await updateSubscriptionTier('sub_...', STRIPE_PRICES.pro.id);
```

## Subscription Statuses

The webhook handler tracks these subscription statuses:

| Status | Description |
|--------|-------------|
| `active` | Subscription is active and paid |
| `past_due` | Payment failed but within retry window |
| `unpaid` | Payment failed after all retries |
| `canceled` | Subscription has been canceled |
| `paused` | Subscription is temporarily paused |

## Testing

Use these [Stripe test cards](https://stripe.com/docs/testing):

- **Successful payment**: `4242 4242 4242 4242`
- **Declined**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`

For any date in the future and any 3-digit CVC.

## Webhook Event Processing

The webhook handler logs events and provides TODO comments for integrating with your database:

1. **Checkout Completed**: Create subscription record, grant access
2. **Invoice Paid**: Record payment, extend subscription period
3. **Payment Failed**: Mark as past_due, notify user
4. **Subscription Deleted**: Remove access, downgrade to free tier

Update the TODO sections in `/app/api/stripe/webhook/route.ts` to integrate with your database.
