/**
 * Provider identifier. Can be any string representing a webhook source.
 * Known providers (stripe, github, shopify) have built-in signature verification.
 */
export type Provider = string;

/**
 * Outcome reported by the SDK after handler execution.
 */
export interface OutcomePayload {
  status: 'success' | 'failure';
  durationMs: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Maps provider names to their event payload types.
 * Consumers can augment this interface to add strong typing for their payloads.
 *
 * @example
 * // For full Stripe types, install 'stripe' package and use:
 * declare module '@hookrelay/next' {
 *   interface HookRelayEventMap {
 *     stripe: import('stripe').Stripe.Event;
 *   }
 * }
 */
export interface HookRelayEventMap {
  stripe: StripeEvent;
  github: GitHubEvent;
  shopify: ShopifyEvent;
}

/**
 * Basic Stripe event structure.
 * For full types, install the 'stripe' package and augment HookRelayEventMap.
 */
export interface StripeEvent {
  id: string;
  object: 'event';
  type: StripeEventType;
  api_version: string | null;
  created: number;
  data: {
    object: Record<string, unknown>;
    previous_attributes?: Record<string, unknown>;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  } | null;
}

/**
 * Common Stripe event types.
 * This is not exhaustive - Stripe has many more event types.
 */
export type StripeEventType =
  // Checkout
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'checkout.session.async_payment_succeeded'
  | 'checkout.session.async_payment_failed'
  // Payment Intent
  | 'payment_intent.created'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'
  | 'payment_intent.processing'
  | 'payment_intent.requires_action'
  // Charge
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.refunded'
  | 'charge.dispute.created'
  | 'charge.dispute.closed'
  // Customer
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end'
  // Invoice
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.payment_succeeded'
  | 'invoice.upcoming'
  | 'invoice.finalized'
  // Product & Price
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'price.created'
  | 'price.updated'
  | 'price.deleted'
  // Other common types (allow any string for extensibility)
  | (string & {});

/**
 * Basic GitHub webhook event structure.
 */
export interface GitHubEvent {
  action?: string;
  sender: {
    login: string;
    id: number;
    type: string;
  };
  repository?: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    owner: {
      login: string;
      id: number;
    };
  };
  organization?: {
    login: string;
    id: number;
  };
  [key: string]: unknown;
}

/**
 * Basic Shopify webhook event structure.
 */
export interface ShopifyEvent {
  id?: number;
  admin_graphql_api_id?: string;
  [key: string]: unknown;
}

/**
 * A webhook event received by the SDK.
 */
export interface HookRelayEvent<T extends Provider = Provider> {
  /** Hook Relay event ID */
  id: string;

  /** Provider name (e.g., 'stripe') */
  provider: T;

  /** Original provider event ID (e.g., Stripe event ID) */
  providerEventId: string;

  /** The webhook payload, typed based on provider */
  payload: T extends keyof HookRelayEventMap ? HookRelayEventMap[T] : unknown;

  /** ISO timestamp when the event was received by Hook Relay */
  receivedAt: string;

  /** Delivery attempt number (1-based) */
  attempt: number;

  /** Whether this is a replayed event */
  replayed: boolean;

  /**
   * Acknowledge the event.
   * This is a no-op in the SDK as acknowledgment is handled automatically.
   * @deprecated Acknowledgment is automatic
   */
  acknowledge: () => void;
}

/**
 * Options for the withHookRelay wrapper.
 */
export interface HookRelayOptions<T extends Provider = Provider> {
  /** The webhook provider (e.g., 'stripe') */
  provider: T;

  /**
   * Timeout in milliseconds for the handler.
   * @default 8000
   */
  timeoutMs?: number;

  /**
   * Whether to enforce idempotency.
   * When true, duplicate events will be rejected.
   * @default true
   */
  enforceIdempotency?: boolean;

  /**
   * Whether to allow replayed events.
   * @default true
   */
  allowReplay?: boolean;
}

/**
 * Handler function signature for webhook processing.
 * Can be sync or async.
 */
export type HookRelayHandler<T extends Provider> = (
  event: HookRelayEvent<T>,
) => void | Promise<void>;
