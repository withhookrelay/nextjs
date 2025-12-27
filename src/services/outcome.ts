import type { OutcomePayload } from '../types.js';

/**
 * Default Hook Relay API base URL.
 * Can be overridden via HOOKRELAY_API_URL environment variable.
 */
const DEFAULT_API_URL = 'https://api.hookrelay.io';

/**
 * Report the outcome of a webhook handler execution to Hook Relay.
 *
 * @param eventId - The Hook Relay event ID
 * @param outcome - The outcome payload (success/failure with details)
 * @param secret - The HOOKRELAY_SECRET for authentication
 * @param apiUrl - Optional API URL override
 * @returns True if the outcome was reported successfully
 */
export async function reportOutcome(
  eventId: string,
  outcome: OutcomePayload,
  secret: string,
  apiUrl?: string,
): Promise<boolean> {
  const baseUrl = apiUrl ?? process.env['HOOKRELAY_API_URL'] ?? DEFAULT_API_URL;
  const url = `${baseUrl}/v1/events/${eventId}/outcome`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(outcome),
    });

    if (!response.ok) {
      console.error(
        `[HookRelay] Failed to report outcome: ${String(response.status)} ${response.statusText}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('[HookRelay] Failed to report outcome:', error);
    return false;
  }
}
