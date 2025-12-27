import { HEADERS } from './constants/headers.js';
import { reportOutcome } from './services/outcome.js';
import { verifySignature } from './services/signature.js';
import type {
  HookRelayEvent,
  HookRelayHandler,
  HookRelayOptions,
  Provider,
  StripeEvent,
} from './types.js';

/**
 * Error thrown when Hook Relay configuration is missing.
 */
export class HookRelayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HookRelayConfigError';
  }
}

/**
 * Error thrown when signature verification fails.
 */
export class HookRelaySignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HookRelaySignatureError';
  }
}

/**
 * Wrap a Next.js App Router route handler with Hook Relay.
 *
 * This wrapper provides:
 * - Automatic signature verification
 * - Exactly-once execution semantics
 * - Automatic outcome reporting
 * - Safe error handling
 *
 * @example
 * ```ts
 * // app/api/webhooks/stripe/route.ts
 * import { withHookRelay } from '@hookrelay/next';
 *
 * export const POST = withHookRelay(
 *   async (event) => {
 *     const stripeEvent = event.payload;
 *     if (stripeEvent.type === 'checkout.session.completed') {
 *       await fulfillOrder(stripeEvent.data.object);
 *     }
 *   },
 *   { provider: 'stripe' }
 * );
 * ```
 */
export function withHookRelay<T extends Provider>(
  handler: HookRelayHandler<T>,
  options: HookRelayOptions<T>,
): (request: Request) => Promise<Response> {
  return async function hookRelayHandler(request: Request): Promise<Response> {
    const secret = process.env['HOOKRELAY_SECRET'];

    if (!secret) {
      throw new HookRelayConfigError('HOOKRELAY_SECRET environment variable is not configured');
    }

    // Extract Hook Relay headers
    const eventId = request.headers.get(HEADERS.EVENT_ID);
    const provider = request.headers.get(HEADERS.PROVIDER);
    const timestamp = request.headers.get(HEADERS.TIMESTAMP);
    const signature = request.headers.get(HEADERS.SIGNATURE);
    const attemptStr = request.headers.get(HEADERS.ATTEMPT);
    const replayedStr = request.headers.get(HEADERS.REPLAYED);

    // Validate required headers
    if (!eventId || !signature || !timestamp) {
      return Response.json({ error: 'Missing required Hook Relay headers' }, { status: 400 });
    }

    // Verify this is from the expected provider
    if (provider !== options.provider) {
      return Response.json(
        { error: `Expected provider '${options.provider}', got '${provider ?? 'unknown'}'` },
        { status: 400 },
      );
    }

    // Read raw body for signature verification
    const rawBody = await request.text();

    // Verify signature
    const isValid = await verifySignature(timestamp, rawBody, signature, secret);
    if (!isValid) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Parse attempt and replayed
    const attempt = attemptStr ? parseInt(attemptStr, 10) : 1;
    const replayed = replayedStr === 'true';

    // Check replay policy
    if (replayed && options.allowReplay === false) {
      return Response.json({ error: 'Replayed events are not allowed' }, { status: 400 });
    }

    // Extract provider event ID
    const providerEventId = extractProviderEventId(options.provider, payload);

    // Build event object
    const event: HookRelayEvent<T> = {
      id: eventId,
      provider: options.provider,
      providerEventId: providerEventId ?? eventId,
      payload: payload as HookRelayEvent<T>['payload'],
      receivedAt: new Date().toISOString(),
      attempt,
      replayed,
      acknowledge: () => {
        // No-op - acknowledgment is automatic
      },
    };

    const startTime = Date.now();

    // Execute handler and report outcome
    try {
      await handler(event);

      const durationMs = Date.now() - startTime;

      // Report success outcome (awaited for reliability)
      const reported = await reportOutcome(eventId, { status: 'success', durationMs }, secret);

      if (!reported) {
        console.error(`[HookRelay] Failed to report success outcome for event ${eventId}`);
      }

      return Response.json({ accepted: true, eventId }, { status: 202 });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorInfo =
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { name: 'Error', message: String(error) };

      // Report failure outcome (awaited for reliability)
      const reported = await reportOutcome(
        eventId,
        { status: 'failure', durationMs, error: errorInfo },
        secret,
      );

      if (!reported) {
        console.error(`[HookRelay] Failed to report failure outcome for event ${eventId}`);
      }

      // Return 500 so the queue knows to retry
      return Response.json({ error: errorInfo.message, eventId }, { status: 500 });
    }
  };
}

/**
 * Extract the provider-specific event ID from the payload.
 */
function extractProviderEventId(provider: Provider, payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  switch (provider) {
    case 'stripe': {
      const stripePayload = payload as Partial<StripeEvent>;
      return stripePayload.id;
    }
    case 'github':
    case 'shopify':
    default:
      return undefined;
  }
}
