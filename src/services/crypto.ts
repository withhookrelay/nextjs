/**
 * Cryptographic utilities for HMAC signature generation and verification.
 * Uses the Web Crypto API for cross-platform compatibility (Node.js, Cloudflare Workers, browsers).
 */

const SIGNATURE_VERSION = 'v1';
const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

/**
 * Generate an HMAC-SHA256 signature for a payload.
 *
 * @param timestamp - Unix timestamp in seconds
 * @param payload - The payload to sign
 * @param secret - The shared secret
 * @returns The signature in the format 'v1=<hex_digest>'
 */
export async function signPayload(
  timestamp: number,
  payload: string,
  secret: string,
): Promise<string> {
  const signedPayload = `${String(timestamp)}.${payload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const hexDigest = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${SIGNATURE_VERSION}=${hexDigest}`;
}

/**
 * Verify an HMAC-SHA256 signature.
 *
 * @param timestamp - Unix timestamp from the request header
 * @param payload - The raw payload
 * @param signatureHeader - The signature header value (e.g., 'v1=abc123...')
 * @param secret - The shared secret
 * @returns True if the signature is valid and timestamp is within tolerance
 */
export async function verifySignature(
  timestamp: string,
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Check timestamp skew
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);

  if (isNaN(ts) || Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  // Parse signature header
  if (!signatureHeader.startsWith(`${SIGNATURE_VERSION}=`)) {
    return false;
  }

  const expectedSignature = signatureHeader.slice(SIGNATURE_VERSION.length + 1);

  // Compute signature
  const computed = await signPayload(ts, payload, secret);
  const computedSignature = computed.slice(SIGNATURE_VERSION.length + 1);

  // Timing-safe comparison
  return timingSafeEqual(computedSignature, expectedSignature);
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
