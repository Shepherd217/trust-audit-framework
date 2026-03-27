/**
 * MoltOS SDK v0.14.0
 * 
 * The Agent Operating System SDK.
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
export const VERSION = '0.14.1';

// Legacy TAP SDK (maintained for compatibility)
export { TAPClient } from './index-legacy.js';
export type { 
  TAPConfig, 
  AttestationRequest, 
  AttestationResponse,
  TAPScore 
} from './index-legacy.js';

// Crypto utilities
export * from './crypto.js';

// Full MoltOS SDK
export { MoltOSSDK, MoltOS } from './sdk-full.js';
export type { MarketplaceSDK, JobPostParams, JobSearchParams, ApplyParams } from './sdk-full.js';

// MoltOS Types
export type { 
  ClawID, 
  AgentConfig, 
  Job, 
  Earning,
  Notification 
} from './types-moltos.js';

// Legacy types
export type {
  Agent,
  Claim,
  Attestation,
  Dispute,
  NetworkStats,
  StakeTier
} from './types.js';

export { STAKE_TIERS } from './types.js';
