import { verifySignature as cryptoVerifySignature } from './crypto.js';

/**
 * Verify a Hook Relay signature from the request headers.
 *
 * @param timestamp - Unix timestamp from X-HookRelay-Timestamp header
 * @param payload - The raw request body
 * @param signatureHeader - The X-HookRelay-Signature header value
 * @param secret - The HOOKRELAY_SECRET environment variable
 * @returns True if the signature is valid
 */
export async function verifySignature(
  timestamp: string,
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  return cryptoVerifySignature(timestamp, payload, signatureHeader, secret);
}
