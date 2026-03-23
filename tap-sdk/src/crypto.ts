/**
 * TAP SDK — Crypto Module
 * 
 * BLS12-381 signatures for cryptographic attestations.
 * 
 * @example
 * ```typescript
 * import { generateKeypair, signAttestation, verifyAttestation } from '@moltos/tap-sdk/crypto';
 * 
 * // Generate keys
 * const { privateKey, publicKey } = generateKeypair();
 * 
 * // Sign attestation
 * const signed = signAttestation({
 *   agentId: 'agent_001',
 *   targetId: 'agent_002', 
 *   score: 85,
 *   timestamp: Date.now(),
 *   nonce: 'random-nonce'
 * }, privateKey);
 * 
 * // Verify
 * const valid = verifyAttestation(signed);
 * ```
 */

import { createHash, randomBytes } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface BLSPublicKey {
  type: 'BLS12_381';
  bytes: Uint8Array;
  toHex(): string;
}

export interface BLSPrivateKey {
  bytes: Uint8Array;
  toHex(): string;
}

export interface BLSSignature {
  type: 'BLS12_381';
  bytes: Uint8Array;
  toHex(): string;
  aggregate(other: BLSSignature): BLSSignature;
}

export interface AttestationPayload {
  agentId: string;
  targetId: string;
  score: number;
  timestamp: number;
  nonce: string;
  metadata?: Record<string, unknown>;
}

export interface SignedAttestation {
  payload: AttestationPayload;
  signature: BLSSignature;
  publicKey: BLSPublicKey;
  proof: {
    type: 'bls12_381';
    scheme: 'basic' | 'proof_of_possession';
  };
}

// ============================================================================
// Key Management
// ============================================================================

let STUB_MODE = true;

/**
 * Enable/disable stub mode (for testing without real BLS)
 */
export function setStubMode(enabled: boolean): void {
  STUB_MODE = enabled;
}

/**
 * Check if running in stub mode
 */
export function isStubMode(): boolean {
  return STUB_MODE;
}

/**
 * Generate new BLS keypair
 * 
 * NOTE: Currently returns stub keys. Real BLS12-381 coming in v0.2.
 */
export function generateKeypair(): {
  privateKey: BLSPrivateKey;
  publicKey: BLSPublicKey;
  mnemonic: string;
} {
  const privateBytes = new Uint8Array(randomBytes(32));
  const publicBytes = derivePublicKeyBytes(privateBytes);

  return {
    privateKey: {
      bytes: privateBytes,
      toHex: () => Buffer.from(privateBytes).toString('hex'),
    },
    publicKey: {
      type: 'BLS12_381' as const,
      bytes: publicBytes,
      toHex: () => Buffer.from(publicBytes).toString('hex'),
    },
    mnemonic: generateMnemonic(),
  };
}

/**
 * Derive keypair from mnemonic
 */
export function deriveKeypair(mnemonic: string, path = "m/44'/60'/0'/0/0"): {
  privateKey: BLSPrivateKey;
  publicKey: BLSPublicKey;
} {
  // Deterministic derivation from mnemonic
  const seed = createHash('sha256').update(mnemonic + path).digest();
  const privateBytes = new Uint8Array(seed.slice(0, 32));
  const publicBytes = derivePublicKeyBytes(privateBytes);

  return {
    privateKey: {
      bytes: privateBytes,
      toHex: () => Buffer.from(privateBytes).toString('hex'),
    },
    publicKey: {
      type: 'BLS12_381' as const,
      bytes: publicBytes,
      toHex: () => Buffer.from(publicBytes).toString('hex'),
    },
  };
}

// ============================================================================
// Signing
// ============================================================================

/**
 * Hash payload for signing
 */
export function hashPayload(payload: AttestationPayload): Uint8Array {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const hash = createHash('sha256').update(canonical).digest();
  return new Uint8Array(hash);
}

/**
 * Sign attestation payload
 */
export function signAttestation(
  payload: AttestationPayload,
  privateKey: BLSPrivateKey
): SignedAttestation {
  const messageHash = hashPayload(payload);
  
  // Stub signature: H(messageHash || privateKey)
  const sigData = createHash('sha256')
    .update(Buffer.from(messageHash))
    .update(Buffer.from(privateKey.bytes))
    .digest();
  
  const sigBytes = new Uint8Array(sigData.slice(0, 48));
  
  const signature: BLSSignature = {
    type: 'BLS12_381' as const,
    bytes: sigBytes,
    toHex: () => Buffer.from(sigBytes).toString('hex'),
    aggregate: (other) => aggregateSignatures([sigBytes, other.bytes]),
  };

  return {
    payload,
    signature,
    publicKey: derivePublicKey(privateKey),
    proof: {
      type: 'bls12_381' as const,
      scheme: 'basic',
    },
  };
}

/**
 * Verify attestation signature
 * 
 * NOTE: In stub mode, always returns true with console warning.
 */
export function verifyAttestation(signed: SignedAttestation): boolean {
  if (STUB_MODE) {
    console.warn('[TAP-SDK] BLS verification running in STUB mode');
    return true;
  }

  // Real BLS verification coming in v0.2
  throw new Error('Real BLS verification not yet implemented. Use stub mode for testing.');
}

/**
 * Batch verify multiple attestations
 */
export function batchVerifyAttestations(
  attestations: SignedAttestation[]
): { valid: boolean[]; allValid: boolean } {
  if (STUB_MODE) {
    const valid = attestations.map(() => true);
    return { valid, allValid: true };
  }

  throw new Error('Batch verification not yet implemented');
}

// ============================================================================
// Aggregation
// ============================================================================

/**
 * Aggregate multiple signatures into one
 * 
 * BLS allows aggregating signatures from different signers
 * into a single signature that can be verified efficiently.
 */
export function aggregateSignatures(
  signatures: Array<Uint8Array | BLSSignature>
): BLSSignature {
  const bytes = signatures.map(s => s instanceof Uint8Array ? s : s.bytes);
  
  // Stub: XOR aggregate
  const result = new Uint8Array(48);
  for (const sig of bytes) {
    for (let i = 0; i < 48 && i < sig.length; i++) {
      result[i] ^= sig[i];
    }
  }

  return {
    type: 'BLS12_381' as const,
    bytes: result,
    toHex: () => Buffer.from(result).toString('hex'),
    aggregate: (other) => aggregateSignatures([result, other.bytes]),
  };
}

/**
 * Verify aggregated signature
 */
export function verifyAggregate(
  message: Uint8Array,
  aggregateSig: BLSSignature,
  publicKeys: BLSPublicKey[]
): boolean {
  if (STUB_MODE) {
    console.warn('[TAP-SDK] Aggregate verification running in STUB mode');
    return true;
  }

  throw new Error('Aggregate verification not yet implemented');
}

// ============================================================================
// Utilities
// ============================================================================

function derivePublicKeyBytes(privateBytes: Uint8Array): Uint8Array {
  // Stub: Derive public key from private
  const hash = createHash('sha256').update(privateBytes).digest();
  const publicBytes = new Uint8Array(96);
  for (let i = 0; i < 96; i++) {
    publicBytes[i] = hash[i % hash.length] ^ privateBytes[i % privateBytes.length];
  }
  return publicBytes;
}

function derivePublicKey(privateKey: BLSPrivateKey): BLSPublicKey {
  return {
    type: 'BLS12_381' as const,
    bytes: derivePublicKeyBytes(privateKey.bytes),
    toHex: () => Buffer.from(derivePublicKeyBytes(privateKey.bytes)).toString('hex'),
  };
}

function generateMnemonic(): string {
  // Simple stub mnemonic generator
  const words = ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract'];
  const phrase = Array(12).fill(0).map(() => words[Math.floor(Math.random() * words.length)]);
  return phrase.join(' ');
}

// ============================================================================

// ============================================================================
// Default Export
// ============================================================================

export default {
  generateKeypair,
  deriveKeypair,
  signAttestation,
  verifyAttestation,
  batchVerifyAttestations,
  aggregateSignatures,
  verifyAggregate,
  hashPayload,
  setStubMode,
  isStubMode,
};
