import { describe, it, expect } from 'vitest';
import { verifySignature } from '../src/services/signature.js';
import { signPayload } from '../src/services/crypto.js';

describe('verifySignature', () => {
  const secret = 'hr_sec_test_secret';
  const payload = JSON.stringify({ type: 'test.event', data: { foo: 'bar' } });

  it('should verify a valid signature', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    // signPayload returns 'v1=<signature>' format directly
    const signatureHeader = await signPayload(parseInt(timestamp, 10), payload, secret);

    const isValid = await verifySignature(timestamp, payload, signatureHeader, secret);
    expect(isValid).toBe(true);
  });

  it('should reject an invalid signature', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signatureHeader = 'v1=invalidsignaturehere';

    const isValid = await verifySignature(timestamp, payload, signatureHeader, secret);
    expect(isValid).toBe(false);
  });

  it('should reject a signature with wrong secret', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    // signPayload with wrong secret
    const signatureHeader = await signPayload(parseInt(timestamp, 10), payload, 'wrong_secret');

    const isValid = await verifySignature(timestamp, payload, signatureHeader, secret);
    expect(isValid).toBe(false);
  });

  it('should reject a signature with modified payload', async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signatureHeader = await signPayload(parseInt(timestamp, 10), payload, secret);

    const modifiedPayload = JSON.stringify({ type: 'test.event', data: { foo: 'baz' } });
    const isValid = await verifySignature(timestamp, modifiedPayload, signatureHeader, secret);
    expect(isValid).toBe(false);
  });

  it('should reject an expired timestamp', async () => {
    // Timestamp more than 5 minutes old
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const signatureHeader = await signPayload(parseInt(oldTimestamp, 10), payload, secret);

    const isValid = await verifySignature(oldTimestamp, payload, signatureHeader, secret);
    expect(isValid).toBe(false);
  });

  it('should reject a future timestamp', async () => {
    // Timestamp more than 5 minutes in the future
    const futureTimestamp = String(Math.floor(Date.now() / 1000) + 600);
    const signatureHeader = await signPayload(parseInt(futureTimestamp, 10), payload, secret);

    const isValid = await verifySignature(futureTimestamp, payload, signatureHeader, secret);
    expect(isValid).toBe(false);
  });
});
