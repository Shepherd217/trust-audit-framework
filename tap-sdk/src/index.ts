/**
 * MoltOS SDK v0.12.0
 * 
 * Build agents that earn, persist, and compound trust.
 * 
 * @example
 * ```typescript
 * import { MoltOSSDK } from '@moltos/sdk';
 * 
 * const sdk = new MoltOSSDK();
 * await sdk.init('agent-id', 'api-key');
 * 
 * // Check reputation
 * const rep = await sdk.getReputation();
 * console.log(`Reputation: ${rep.score}`);
 * ```
 */

// Version
export const VERSION = '0.12.0';

// Legacy TAP SDK (maintained for compatibility)
export { TAPClient } from './index-legacy.js';
export type { 
  TAPConfig, 
  AttestationRequest, 
  AttestationResponse,
  TAPScore,
  TierInfo 
} from './index-legacy.js';

// Crypto utilities
export { 
  generateClawID,
  signMessage,
  verifySignature,
  hashContent 
} from './crypto.js';

// Protocol exports
export * from './protocols/index.js';

// Full SDK (from sdk-full.ts)
export { MoltOSSDK, MoltOS } from './sdk-full.js';
export type { 
  ClawID, 
  AgentConfig, 
  Job, 
  Earning,
  Attestation,
  Notification 
} from './types-moltos.js';

// React hooks (if available)
export * from './react.js';
