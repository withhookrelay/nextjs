import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reportOutcome } from '../src/services/outcome.js';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('reportOutcome', () => {
  const eventId = 'evt_test123';
  const secret = 'hr_sec_test_secret';
  const apiUrl = 'https://api.hookrelay.io';

  beforeEach(() => {
    mockFetch.mockReset();
    delete process.env['HOOKRELAY_API_URL'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should report success outcome', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await reportOutcome(
      eventId,
      { status: 'success', durationMs: 150 },
      secret,
      apiUrl,
    );

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${apiUrl}/v1/events/${eventId}/outcome`);
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    });

    const body = JSON.parse(options.body as string);
    expect(body.status).toBe('success');
    expect(body.durationMs).toBe(150);
  });

  it('should report failure outcome with error details', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await reportOutcome(
      eventId,
      {
        status: 'failure',
        durationMs: 50,
        error: { name: 'DatabaseError', message: 'Connection timeout' },
      },
      secret,
      apiUrl,
    );

    expect(result).toBe(true);

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.status).toBe('failure');
    expect(body.error.name).toBe('DatabaseError');
    expect(body.error.message).toBe('Connection timeout');
  });

  it('should return false on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const result = await reportOutcome(
      eventId,
      { status: 'success', durationMs: 100 },
      secret,
      apiUrl,
    );

    expect(result).toBe(false);
  });

  it('should return false on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await reportOutcome(
      eventId,
      { status: 'success', durationMs: 100 },
      secret,
      apiUrl,
    );

    expect(result).toBe(false);
  });

  it('should use HOOKRELAY_API_URL environment variable', async () => {
    process.env['HOOKRELAY_API_URL'] = 'https://custom.api.com';
    mockFetch.mockResolvedValueOnce({ ok: true });

    await reportOutcome(eventId, { status: 'success', durationMs: 100 }, secret);

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe(`https://custom.api.com/v1/events/${eventId}/outcome`);
  });

  it('should use default API URL when not specified', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await reportOutcome(eventId, { status: 'success', durationMs: 100 }, secret);

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe(`https://api.hookrelay.io/v1/events/${eventId}/outcome`);
  });

  it('should prefer explicit apiUrl parameter over environment variable', async () => {
    process.env['HOOKRELAY_API_URL'] = 'https://env.api.com';
    mockFetch.mockResolvedValueOnce({ ok: true });

    await reportOutcome(
      eventId,
      { status: 'success', durationMs: 100 },
      secret,
      'https://explicit.api.com',
    );

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe(`https://explicit.api.com/v1/events/${eventId}/outcome`);
  });
});
