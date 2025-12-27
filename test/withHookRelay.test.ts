import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withHookRelay, HookRelayConfigError } from '../src/withHookRelay.js';
import { signPayload } from '../src/services/crypto.js';
import { HEADERS } from '../src/constants/headers.js';

// Mock fetch for outcome reporting
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('withHookRelay', () => {
  const secret = 'hr_sec_test_secret';
  const eventId = 'evt_test123';
  const stripePayload = {
    id: 'evt_stripe_123',
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_123' } },
  };

  beforeEach(() => {
    process.env['HOOKRELAY_SECRET'] = secret;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  });

  afterEach(() => {
    delete process.env['HOOKRELAY_SECRET'];
    vi.restoreAllMocks();
  });

  async function createRequest(
    payload: unknown,
    options: { timestamp?: number; signature?: string; eventId?: string } = {},
  ): Promise<Request> {
    const body = JSON.stringify(payload);
    const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
    // signPayload returns 'v1=<hex>' format, so use it directly
    // For invalid signature tests, options.signature is just the raw value without v1=
    const signatureHeader = options.signature
      ? `v1=${options.signature}`
      : await signPayload(timestamp, body, secret);

    return new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [HEADERS.EVENT_ID]: options.eventId ?? eventId,
        [HEADERS.PROVIDER]: 'stripe',
        [HEADERS.TIMESTAMP]: String(timestamp),
        [HEADERS.SIGNATURE]: signatureHeader,
        [HEADERS.ATTEMPT]: '1',
        [HEADERS.REPLAYED]: 'false',
      },
      body,
    });
  }

  it('should throw if HOOKRELAY_SECRET is not configured', async () => {
    delete process.env['HOOKRELAY_SECRET'];

    const handler = withHookRelay(async () => {}, { provider: 'stripe' });
    const request = await createRequest(stripePayload);

    await expect(handler(request)).rejects.toThrow(HookRelayConfigError);
  });

  it('should return 400 if required headers are missing', async () => {
    const handler = withHookRelay(async () => {}, { provider: 'stripe' });

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stripePayload),
    });

    const response = await handler(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Missing required');
  });

  it('should return 400 if provider does not match', async () => {
    const handler = withHookRelay(async () => {}, { provider: 'github' });
    const request = await createRequest(stripePayload);

    const response = await handler(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("Expected provider 'github'");
  });

  it('should return 401 if signature is invalid', async () => {
    const handler = withHookRelay(async () => {}, { provider: 'stripe' });
    const request = await createRequest(stripePayload, { signature: 'invalidsig' });

    const response = await handler(request);
    expect(response.status).toBe(401);
  });

  it('should call handler with correct event object', async () => {
    const handlerFn = vi.fn();
    const handler = withHookRelay(handlerFn, { provider: 'stripe' });
    const request = await createRequest(stripePayload);

    await handler(request);

    expect(handlerFn).toHaveBeenCalledOnce();
    const event = handlerFn.mock.calls[0][0];
    expect(event.id).toBe(eventId);
    expect(event.provider).toBe('stripe');
    expect(event.providerEventId).toBe('evt_stripe_123');
    expect(event.payload).toEqual(stripePayload);
    expect(event.attempt).toBe(1);
    expect(event.replayed).toBe(false);
    expect(typeof event.receivedAt).toBe('string');
  });

  it('should return 202 on success and report outcome', async () => {
    const handler = withHookRelay(async () => {}, { provider: 'stripe' });
    const request = await createRequest(stripePayload);

    const response = await handler(request);

    expect(response.status).toBe(202);
    const data = (await response.json()) as { accepted: boolean; eventId: string };
    expect(data.accepted).toBe(true);
    expect(data.eventId).toBe(eventId);

    // Verify outcome was reported
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/v1/events/${eventId}/outcome`);
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body as string);
    expect(body.status).toBe('success');
    expect(typeof body.durationMs).toBe('number');
  });

  it('should return 500 on handler error and report failure', async () => {
    const handler = withHookRelay(
      async () => {
        throw new Error('Database connection failed');
      },
      { provider: 'stripe' },
    );
    const request = await createRequest(stripePayload);

    const response = await handler(request);

    expect(response.status).toBe(500);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe('Database connection failed');

    // Verify failure outcome was reported
    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.status).toBe('failure');
    expect(body.error.name).toBe('Error');
    expect(body.error.message).toBe('Database connection failed');
  });

  it('should reject replayed events when allowReplay is false', async () => {
    const handler = withHookRelay(async () => {}, {
      provider: 'stripe',
      allowReplay: false,
    });

    const body = JSON.stringify(stripePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    // signPayload returns 'v1=<hex>' format directly
    const signatureHeader = await signPayload(timestamp, body, secret);

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [HEADERS.EVENT_ID]: eventId,
        [HEADERS.PROVIDER]: 'stripe',
        [HEADERS.TIMESTAMP]: String(timestamp),
        [HEADERS.SIGNATURE]: signatureHeader,
        [HEADERS.ATTEMPT]: '1',
        [HEADERS.REPLAYED]: 'true',
      },
      body,
    });

    const response = await handler(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Replayed events are not allowed');
  });

  it('should allow replayed events by default', async () => {
    const handler = withHookRelay(async () => {}, { provider: 'stripe' });

    const body = JSON.stringify(stripePayload);
    const timestamp = Math.floor(Date.now() / 1000);
    // signPayload returns 'v1=<hex>' format directly
    const signatureHeader = await signPayload(timestamp, body, secret);

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [HEADERS.EVENT_ID]: eventId,
        [HEADERS.PROVIDER]: 'stripe',
        [HEADERS.TIMESTAMP]: String(timestamp),
        [HEADERS.SIGNATURE]: signatureHeader,
        [HEADERS.ATTEMPT]: '2',
        [HEADERS.REPLAYED]: 'true',
      },
      body,
    });

    const response = await handler(request);
    expect(response.status).toBe(202);
  });

  it('should handle sync handlers', async () => {
    const handler = withHookRelay(
      () => {
        // Sync handler - no await needed
      },
      { provider: 'stripe' },
    );
    const request = await createRequest(stripePayload);

    const response = await handler(request);
    expect(response.status).toBe(202);
  });

  it('should return 400 for invalid JSON payload', async () => {
    const handler = withHookRelay(async () => {}, { provider: 'stripe' });

    const invalidBody = 'not valid json';
    const timestamp = Math.floor(Date.now() / 1000);
    // signPayload returns 'v1=<hex>' format directly
    const signatureHeader = await signPayload(timestamp, invalidBody, secret);

    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [HEADERS.EVENT_ID]: eventId,
        [HEADERS.PROVIDER]: 'stripe',
        [HEADERS.TIMESTAMP]: String(timestamp),
        [HEADERS.SIGNATURE]: signatureHeader,
        [HEADERS.ATTEMPT]: '1',
        [HEADERS.REPLAYED]: 'false',
      },
      body: invalidBody,
    });

    const response = await handler(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid JSON');
  });
});
