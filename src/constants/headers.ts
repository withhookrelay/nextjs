/**
 * Hook Relay HTTP headers used for webhook forwarding and verification.
 */
export const HEADERS = {
  /** Unique Hook Relay event identifier */
  EVENT_ID: 'X-HookRelay-Event-Id',
  /** Provider name (e.g., 'stripe', 'github') */
  PROVIDER: 'X-HookRelay-Provider',
  /** Original provider event ID */
  PROVIDER_EVENT_ID: 'X-HookRelay-Provider-Event-Id',
  /** Delivery attempt number (1-based) */
  ATTEMPT: 'X-HookRelay-Attempt',
  /** Whether this is a replayed event ('true' or 'false') */
  REPLAYED: 'X-HookRelay-Replayed',
  /** Unix timestamp (seconds) when the request was signed */
  TIMESTAMP: 'X-HookRelay-Timestamp',
  /** HMAC signature for request verification */
  SIGNATURE: 'X-HookRelay-Signature',
  /** Event type from the provider (e.g., 'checkout.session.completed') */
  EVENT_TYPE: 'X-HookRelay-Event-Type',
} as const;

export type HeaderName = (typeof HEADERS)[keyof typeof HEADERS];
