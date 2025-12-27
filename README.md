# @hookrelay/next

**Reliable webhook handling for Next.js** — Stop losing webhooks to serverless timeouts and cold starts.

[![npm version](https://img.shields.io/npm/v/@hookrelay/next.svg)](https://www.npmjs.com/package/@hookrelay/next)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Hook Relay receives webhooks from providers like Stripe, GitHub, and Shopify, then reliably delivers them to your Next.js application with automatic retries, signature verification, and exactly-once processing.

## Why Hook Relay?

Serverless functions have a problem with webhooks:

- **Timeouts** — Vercel functions timeout after 10-60s, but webhook handlers often need more time
- **Cold starts** — First requests are slow, causing providers to retry unnecessarily
- **No retries** — If your handler fails, the webhook is lost forever
- **Duplicate events** — Provider retries can cause double-processing

Hook Relay solves all of this:

- **Reliable delivery** — We receive webhooks instantly and retry delivery to your app with exponential backoff
- **Exactly-once processing** — Built-in idempotency prevents duplicate handling
- **Signature verification** — We verify provider signatures and re-sign with your secret
- **Event replay** — Replay any event from the dashboard for debugging
- **Real-time monitoring** — See every webhook, attempt, and failure in one place

## Quick Start

### 1. Install the SDK

```bash
npm install @hookrelay/next
# or
pnpm add @hookrelay/next
# or
yarn add @hookrelay/next
```

### 2. Create your webhook endpoint

```typescript
// app/api/webhooks/stripe/route.ts
import { withHookRelay } from '@hookrelay/next';

export const POST = withHookRelay(
  async (event) => {
    const stripeEvent = event.payload;

    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await fulfillOrder(stripeEvent.data.object);
        break;
      case 'customer.subscription.deleted':
        await cancelSubscription(stripeEvent.data.object);
        break;
    }
  },
  { provider: 'stripe' },
);
```

### 3. Add your secret

```bash
# .env.local
HOOKRELAY_SECRET=hr_sec_xxxxx  # From your Hook Relay dashboard
```

### 4. Configure your endpoint in Hook Relay

1. Sign up at [hookrelay.io](https://hookrelay.io)
2. Create an endpoint pointing to your webhook URL
3. Copy the webhook URL and add it to your provider (Stripe, GitHub, etc.)

That's it! Hook Relay now receives your webhooks and reliably delivers them to your app.

## Features

### Typed Events

Get full TypeScript support for your webhook payloads:

```typescript
export const POST = withHookRelay(
  async (event) => {
    // event.payload is typed as StripeEvent
    if (event.payload.type === 'invoice.paid') {
      const invoice = event.payload.data.object;
      // invoice is typed
    }
  },
  { provider: 'stripe' },
);
```

For full Stripe types, augment the event map:

```typescript
declare module '@hookrelay/next' {
  interface HookRelayEventMap {
    stripe: import('stripe').Stripe.Event;
  }
}
```

### Event Metadata

Access useful metadata about each delivery:

```typescript
export const POST = withHookRelay(
  async (event) => {
    console.log(event.id); // Hook Relay event ID
    console.log(event.providerEventId); // Original Stripe/GitHub event ID
    console.log(event.attempt); // Delivery attempt number (1, 2, 3...)
    console.log(event.replayed); // true if manually replayed from dashboard
    console.log(event.receivedAt); // ISO timestamp
  },
  { provider: 'stripe' },
);
```

### Replay Control

Optionally reject replayed events:

```typescript
export const POST = withHookRelay(
  async (event) => {
    // Handler code
  },
  {
    provider: 'stripe',
    allowReplay: false, // Reject events replayed from dashboard
  },
);
```

## Supported Providers

| Provider | Signature Verification | Event Types                                        |
| -------- | ---------------------- | -------------------------------------------------- |
| Stripe   | ✅                     | `checkout.session.completed`, `invoice.paid`, etc. |
| GitHub   | ✅                     | `push`, `pull_request`, `issues`, etc.             |
| Shopify  | ✅                     | `orders/create`, `customers/update`, etc.          |
| Custom   | —                      | Any JSON payload                                   |

## How It Works

```
┌──────────┐     ┌─────────────┐     ┌──────────────┐
│  Stripe  │────▶│  Hook Relay │────▶│  Your App    │
│  GitHub  │     │             │     │  (Next.js)   │
│  Shopify │     │  • Verify   │     │              │
└──────────┘     │  • Queue    │     │  • Process   │
                 │  • Retry    │     │  • Respond   │
                 │  • Monitor  │     └──────────────┘
                 └─────────────┘
```

1. **Receive** — Hook Relay receives webhooks from providers instantly
2. **Verify** — Provider signatures are verified immediately
3. **Queue** — Events are queued for reliable delivery
4. **Deliver** — Your app receives events with Hook Relay signatures
5. **Retry** — Failed deliveries are retried with exponential backoff
6. **Monitor** — View all events, attempts, and errors in the dashboard

## Example App

See a complete working example in the [`examples/nextjs-stripe`](./examples/nextjs-stripe) directory:

```bash
cd examples/nextjs-stripe
cp .env.example .env.local
# Add your HOOKRELAY_SECRET
npm install
npm run dev
```

## API Reference

### `withHookRelay(handler, options)`

Wraps a Next.js App Router route handler with Hook Relay functionality.

**Parameters:**

| Name                  | Type                                               | Description                             |
| --------------------- | -------------------------------------------------- | --------------------------------------- |
| `handler`             | `(event: HookRelayEvent) => void \| Promise<void>` | Your webhook handler function           |
| `options.provider`    | `'stripe' \| 'github' \| 'shopify' \| string`      | The webhook provider                    |
| `options.allowReplay` | `boolean`                                          | Allow replayed events (default: `true`) |

**Returns:** `(request: Request) => Promise<Response>`

### `HookRelayEvent<T>`

The event object passed to your handler.

| Property          | Type      | Description                              |
| ----------------- | --------- | ---------------------------------------- |
| `id`              | `string`  | Hook Relay event ID                      |
| `provider`        | `string`  | Provider name                            |
| `providerEventId` | `string`  | Original provider event ID               |
| `payload`         | `T`       | The webhook payload (typed per provider) |
| `attempt`         | `number`  | Delivery attempt number                  |
| `replayed`        | `boolean` | Whether this is a replayed event         |
| `receivedAt`      | `string`  | ISO timestamp when received              |

### Environment Variables

| Variable            | Required | Description                             |
| ------------------- | -------- | --------------------------------------- |
| `HOOKRELAY_SECRET`  | Yes      | Your endpoint secret from the dashboard |
| `HOOKRELAY_API_URL` | No       | API URL override (for self-hosted)      |

## Pricing

Hook Relay offers plans for every scale:

| Plan     | Events/month | Retention | Price  |
| -------- | ------------ | --------- | ------ |
| **Free** | 1,000        | 7 days    | $0     |
| **Pro**  | 100,000      | 30 days   | $29/mo |
| **Team** | 1,000,000    | 90 days   | $99/mo |

[View full pricing →](https://hookrelay.io/#pricing)

## Resources

- [Documentation](https://hookrelay.io/docs) — Full setup guides and API reference
- [Dashboard](https://app.hookrelay.io) — Monitor your webhooks in real-time
- [Discord](https://discord.gg/hookrelay) — Get help from the community
- [GitHub Issues](https://github.com/hookrelay/sdk/issues) — Report bugs and request features

## License

MIT © [Hook Relay](https://hookrelay.io)
