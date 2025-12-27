// Main wrapper
export { withHookRelay, HookRelayConfigError, HookRelaySignatureError } from './withHookRelay.js';

// Types
export type {
  Provider,
  OutcomePayload,
  HookRelayEvent,
  HookRelayEventMap,
  HookRelayOptions,
  HookRelayHandler,
  StripeEvent,
  StripeEventType,
  GitHubEvent,
  ShopifyEvent,
} from './types.js';

// Constants
export { HEADERS } from './constants/headers.js';

// Crypto utilities (for advanced usage)
export { signPayload, verifySignature as verifyCryptoSignature } from './services/crypto.js';

// Services (for advanced usage)
export { verifySignature } from './services/signature.js';
export { reportOutcome } from './services/outcome.js';
