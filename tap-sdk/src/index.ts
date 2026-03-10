import { sign, verify, getPublicKey, etc } from '@noble/ed25519';
import { aggregateSignatures, verify as verifyBLS } from '@noble/bls12-381';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha512 } from '@noble/hashes/sha512';

// Fix sha512Sync for @noble/ed25519 v2.x - provide sync wrapper using noble-hashes
// @ts-ignore
etc.sha512Sync = (...msgs: Uint8Array[]) => sha512(etc.concatBytes(...msgs));

/**
 * TAP Protocol SDK
 * 
 * Official SDK for Trust Audit Protocol integration
 * Enables agents to perform cross-attestation, manage claims,
 * and participate in the verified agent economy.
 * 
 * @example
 * ```typescript
 * import { TAPClient } from '@tap-protocol/sdk';
 * 
 * const client = new TAPClient({
 *   privateKey: process.env.TAP_PRIVATE_KEY,
 *   agentId: 'agent-007'
 * });
 * 
 * // Perform attestation
 * const result = await client.attest({
 *   claimId: 'claim-123',
 *   targetAgent: 'agent-042'
 * });
 * ```
 */

export interface TAPConfig {
  privateKey: string;
  agentId: string;
  apiUrl?: string;
  stakeAmount?: number;
}

export interface AttestationClaim {
  claimId: string;
  statement: string;
  metric: 'response_time_ms' | 'uptime_percent' | 'availability' | 'accuracy_percent' | 'custom';
  threshold: number;
  stakeAmount: number;
}

export interface AttestationResult {
  claimId: string;
  result: 'CONFIRMED' | 'REJECTED' | 'TIMEOUT';
  measuredValue: number;
  threshold: number;
  timestamp: string;
  signature: string;
}

export interface BootAudit {
  agentId: string;
  timestamp: string;
  workspaceHash: string;
  configFiles: Record<string, string>;
  complianceStatus: 'FULL' | 'PARTIAL' | 'FAILED';
  signature: string;
}

export class TAPClient {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  agentId: string;
  apiUrl: string;
  private stakeAmount: number;

  constructor(config: TAPConfig) {
    this.privateKey = hexToBytes(config.privateKey);
    this.agentId = config.agentId;
    this.apiUrl = config.apiUrl || 'https://api.tap.live';
    this.stakeAmount = config.stakeAmount || 750;
    
    // Derive public key
    this.publicKey = getPublicKey(this.privateKey);
  }

  /**
   * Generate a boot audit hash for workspace verification
   */
  async generateBootAudit(configFiles: Record<string, string>): Promise<BootAudit> {
    // Hash each config file
    const fileHashes: Record<string, string> = {};
    let combinedHash = '';

    for (const [filename, content] of Object.entries(configFiles)) {
      const hash = sha256(new TextEncoder().encode(content));
      fileHashes[filename] = 'sha256:' + bytesToHex(hash);
      combinedHash += bytesToHex(hash);
    }

    // Generate workspace hash
    const workspaceHash = sha256(new TextEncoder().encode(combinedHash));
    const timestamp = new Date().toISOString();

    // Sign the audit
    const message = `TAP_BOOT|${this.agentId}|${timestamp}|${bytesToHex(workspaceHash)}`;
    const signature = await sign(new TextEncoder().encode(message), this.privateKey);

    return {
      agentId: this.agentId,
      timestamp,
      workspaceHash: 'sha256:' + bytesToHex(workspaceHash),
      configFiles: fileHashes,
      complianceStatus: 'FULL',
      signature: 'ed25519:' + bytesToHex(signature)
    };
  }

  /**
   * Create a claim for the Trust Ledger
   */
  async createClaim(claim: Omit<AttestationClaim, 'stakeAmount'>): Promise<AttestationClaim> {
    const fullClaim: AttestationClaim = {
      ...claim,
      stakeAmount: this.stakeAmount
    };

    // Sign the claim
    const message = `TAP_CLAIM|${claim.claimId}|${claim.statement}|${claim.threshold}|${this.stakeAmount}`;
    const signature = await sign(new TextEncoder().encode(message), this.privateKey);

    // Submit to TAP network
    const response = await fetch(`${this.apiUrl}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...fullClaim,
        agentId: this.agentId,
        signature: bytesToHex(signature)
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create claim: ${response.statusText}`);
    }

    return fullClaim;
  }

  /**
   * Perform attestation on another agent's claim
   */
  async attest(options: {
    claimId: string;
    targetAgent: string;
    testRequests?: number;
  }): Promise<AttestationResult> {
    const { claimId, targetAgent, testRequests = 3 } = options;

    // Fetch claim details
    const claimResponse = await fetch(`${this.apiUrl}/claims/${claimId}`);
    if (!claimResponse.ok) {
      throw new Error('Claim not found');
    }
    const claim = await claimResponse.json() as { threshold: number };

    // Perform verification tests
    const measurements: number[] = [];
    for (let i = 0; i < testRequests; i++) {
      const start = Date.now();
      
      // Call target agent's endpoint
      const testResponse = await fetch(`${this.apiUrl}/agents/${targetAgent}/test`, {
        method: 'POST',
        body: JSON.stringify({ claimId })
      });
      
      const elapsed = Date.now() - start;
      measurements.push(elapsed);
    }

    // Calculate result
    const average = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const result: AttestationResult['result'] = average <= claim.threshold ? 'CONFIRMED' : 'REJECTED';

    // Sign attestation
    const timestamp = new Date().toISOString();
    const message = `TAP_ATTEST|${claimId}|${result}|${average}|${timestamp}|${this.agentId}`;
    const signature = await sign(new TextEncoder().encode(message), this.privateKey);

    const attestationResult: AttestationResult = {
      claimId,
      result,
      measuredValue: average,
      threshold: claim.threshold,
      timestamp,
      signature: bytesToHex(signature)
    };

    // Submit attestation
    await fetch(`${this.apiUrl}/attestations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...attestationResult,
        attestorId: this.agentId,
        targetAgent
      })
    });

    return attestationResult;
  }

  /**
   * Batch attest multiple claims with BLS aggregation
   */
  async attestBatch(claims: Array<{ claimId: string; targetAgent: string }>): Promise<{
    aggregatedSignature: string;
    results: AttestationResult[];
  }> {
    const results: AttestationResult[] = [];
    const signatures: Uint8Array[] = [];

    for (const claim of claims) {
      const result = await this.attest(claim);
      results.push(result);
      signatures.push(hexToBytes(result.signature));
    }

    // Aggregate signatures
    const aggregated = aggregateSignatures(signatures);

    return {
      aggregatedSignature: bytesToHex(aggregated),
      results
    };
  }

  /**
   * Verify another agent's attestation
   */
  async verifyAttestation(attestation: AttestationResult, attestorPublicKey: string): Promise<boolean> {
    const message = `TAP_ATTEST|${attestation.claimId}|${attestation.result}|${attestation.measuredValue}|${attestation.timestamp}|${attestorPublicKey}`;
    
    return verify(
      hexToBytes(attestation.signature),
      new TextEncoder().encode(message),
      hexToBytes(attestorPublicKey)
    );
  }

  /**
   * Get agent's attestation history
   */
  async getAttestationHistory(agentId?: string): Promise<AttestationResult[]> {
    const targetAgent = agentId || this.agentId;
    const response = await fetch(`${this.apiUrl}/agents/${targetAgent}/attestations`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch attestation history');
    }

    return response.json() as Promise<AttestationResult[]>;
  }

  /**
   * Get live network stats
   */
  async getNetworkStats(): Promise<{
    agents: number;
    pairs: number;
    alphaDistributed: number;
    claimsToday: number;
  }> {
    const response = await fetch(`${this.apiUrl}/stats`);
    return response.json() as Promise<{ agents: number; pairs: number; alphaDistributed: number; claimsToday: number; }>;
  }
}

/**
 * OpenClaw Skill Integration
 * 
 * Usage: Drop this into ~/.openclaw/skills/tap/skill.js
 */
export const tapSkill = {
  name: 'tap_verify',
  description: 'Run TAP cross-attestation before x402 payment',
  
  async execute(input: {
    privateKey: string;
    agentId: string;
    claimId: string;
    targetAgent: string;
  }) {
    const client = new TAPClient({
      privateKey: input.privateKey,
      agentId: input.agentId
    });

    return client.attest({
      claimId: input.claimId,
      targetAgent: input.targetAgent
    });
  }
};

/**
 * x402 + TAP Integration
 * 
 * Combines payment settlement with pre-payment verification
 */
export class TAPx402Client extends TAPClient {
  /**
   * Pay for verified service (TAP attestation + x402 payment)
   */
  async payForVerifiedService(options: {
    endpoint: string;
    amount: string;
    claimId: string;
    x402Config: {
      token: string;
      network: string;
    };
  }): Promise<{
    attestationHash: string;
    paymentReceipt: any;
  }> {
    const { endpoint, amount, claimId, x402Config } = options;

    // Step 1: Extract target agent from endpoint
    const targetAgent = await this.resolveAgentFromEndpoint(endpoint);

    // Step 2: Run TAP attestation
    const attestation = await this.attest({
      claimId,
      targetAgent
    });

    if (attestation.result !== 'CONFIRMED') {
      throw new Error(`Attestation failed: ${attestation.result}`);
    }

    // Step 3: Include attestation in x402 payment
    const attestationHash = sha256(new TextEncoder().encode(JSON.stringify(attestation)));

    // Step 4: Execute x402 payment (placeholder - integrate with actual x402 SDK)
    const paymentReceipt = await this.executeX402Payment({
      endpoint,
      amount,
      extensions: {
        tapAttestation: bytesToHex(attestationHash),
        attestorId: this.agentId
      }
    });

    return {
      attestationHash: bytesToHex(attestationHash),
      paymentReceipt
    };
  }

  private async resolveAgentFromEndpoint(endpoint: string): Promise<string> {
    // Resolve agent ID from service endpoint
    const response = await fetch(`${this.apiUrl}/resolve?endpoint=${encodeURIComponent(endpoint)}`);
    const data = await response.json() as { agentId: string };
    return data.agentId;
  }

  private async executeX402Payment(options: any): Promise<any> {
    // Integrate with x402 SDK
    // This is a placeholder - actual implementation uses @x402/core
    return { status: 'completed', txHash: '0x...' };
  }
}

// Export types
export * from './types';

// Export full 6-layer OS
export * from './protocols/arbitra/voting';
export * from './protocols/clawlink/handoff';
export * from './protocols/clawid/clawid-token';
export * from './protocols/clawforge/control-plane';
export * from './protocols/clawkernel/kernel';
