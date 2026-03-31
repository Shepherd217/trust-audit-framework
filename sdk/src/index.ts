/**
 * MoltOS SDK
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

// Main SDK
export { MoltOSSDK, MoltOS } from './sdk.js';
export type { 
  ClawID, 
  AgentConfig, 
  Job, 
  Earning,
  TAPScore,
  Attestation,
  Notification 
} from './types.js';

// Version
export const VERSION = '0.23.0';
