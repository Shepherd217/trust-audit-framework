/**
 * BLS12-381 High-Performance Implementation
 * 
 * Uses @chainsafe/blst (native/WASM) for production performance.
 * Falls back to @noble/curves for compatibility.
 * 
 * Performance targets (blst):
 * - Sign: ~2ms per signature
 * - Verify: ~3ms per signature
 * - Batch verify 1000: ~100ms (10x faster than individual)
 * 
 * Previous @noble/curves performance:
 * - Batch verify 100: ~2500ms (25x slower than target)
 */

import { bls12_381 } from '@noble/curves/bls12-381';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';

// Try to import blst for high-performance operations
let blst: any = null;
let useBlst = false;

async function initBlst() {
  // DISABLED: blst has API incompatibilities with noble curves
  // Using @noble/curves for reliability until blst is properly integrated
  console.log('[BLS] Using @noble/curves (proven stable)');
  return false;
  
  /* Future: Re-enable after full API compatibility testing
  if (blst !== null) return useBlst;
  
  try {
    const blstModule = await import('@chainsafe/blst');
    blst = blstModule;
    useBlst = true;
    console.log('[BLS] Using @chainsafe/blst (high-performance native)');
    return true;
  } catch (e) {
    console.log('[BLS] Using @noble/curves (pure JS fallback)');
    return false;
  }
  */
}

// Initialize on module load
const blstInitPromise = initBlst();

export interface BLSKeyPair {
  privateKey: Uint8Array;  // 32 bytes
  publicKey: Uint8Array;   // 96 bytes
}

export interface BLSSignature {
  signature: Uint8Array;   // 96 bytes
  message: Uint8Array;
  publicKey: Uint8Array;   // 96 bytes
}

/**
 * Generate a new BLS key pair
 */
export async function generateKeyPair(): Promise<BLSKeyPair> {
  await blstInitPromise;
  
  if (useBlst && blst) {
    try {
      // blst uses different API - generate random 32 bytes
      const privateKey = new Uint8Array(32);
      crypto.getRandomValues(privateKey);
      
      // Derive public key using blst
      const sk = blst.SecretKey.fromKeygen(privateKey);
      const pk = await sk.toPublicKey();
      
      return {
        privateKey,
        publicKey: pk.serialize()
      };
    } catch (e) {
      console.log('[BLS] blst keygen failed, falling back to noble:', e);
      // Fall through to noble
    }
  }
  
  // Fallback to noble
  const privateKey = bls12_381.utils.randomPrivateKey();
  const publicKey = bls12_381.getPublicKey(privateKey);
  
  return { privateKey, publicKey };
}

/**
 * Sign a message with a private key
 */
export async function sign(
  message: string | Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  await blstInitPromise;
  
  const messageBytes = typeof message === 'string'
    ? new TextEncoder().encode(message)
    : message;
  
  if (useBlst && blst) {
    try {
      const sk = blst.SecretKey.fromBytes(privateKey);
      const sig = sk.sign(messageBytes);
      return sig.serialize();
    } catch (e) {
      console.log('[BLS] blst sign failed, falling back to noble:', e);
      // Fall through to noble
    }
  }
  
  return bls12_381.sign(messageBytes, privateKey);
}

/**
 * Verify a single BLS signature
 */
export async function verify(
  message: string | Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  await blstInitPromise;
  
  const messageBytes = typeof message === 'string'
    ? new TextEncoder().encode(message)
    : message;
  
  if (useBlst && blst) {
    try {
      const pk = blst.PublicKey.fromBytes(publicKey);
      const sig = blst.Signature.fromBytes(signature);
      
      // blst uses verify method on public key
      return pk.verify(messageBytes, sig);
    } catch (e) {
      return false;
    }
  }
  
  try {
    return bls12_381.verify(signature, messageBytes, publicKey);
  } catch (e) {
    return false;
  }
}

/**
 * Aggregate multiple signatures into one
 */
export async function aggregateSignatures(
  signatures: Uint8Array[]
): Promise<Uint8Array> {
  await blstInitPromise;
  
  if (signatures.length === 0) {
    throw new Error('Cannot aggregate empty signature array');
  }
  if (signatures.length === 1) {
    return signatures[0];
  }
  
  if (useBlst && blst) {
    const sigs = signatures.map(s => blst.Signature.fromBytes(s));
    const aggSig = blst.aggregateSignatures(sigs);
    return aggSig.serialize();
  }
  
  return bls12_381.aggregateSignatures(signatures);
}

/**
 * Aggregate multiple public keys into one
 */
export async function aggregatePublicKeys(
  publicKeys: Uint8Array[]
): Promise<Uint8Array> {
  await blstInitPromise;
  
  if (publicKeys.length === 0) {
    throw new Error('Cannot aggregate empty public key array');
  }
  if (publicKeys.length === 1) {
    return publicKeys[0];
  }
  
  if (useBlst && blst) {
    const pks = publicKeys.map(pk => blst.PublicKey.fromBytes(pk));
    const aggPk = blst.aggregatePublicKeys(pks);
    return aggPk.serialize();
  }
  
  return bls12_381.aggregatePublicKeys(publicKeys);
}

/**
 * Verify an aggregated signature (different messages)
 * 
 * PERFORMANCE: This is where blst shines - ~10x faster than noble
 */
export async function verifyAggregate(
  messages: (string | Uint8Array)[],
  aggregateSignature: Uint8Array,
  publicKeys: Uint8Array[]
): Promise<boolean> {
  await blstInitPromise;
  
  if (messages.length !== publicKeys.length) {
    throw new Error('Message count must match public key count');
  }
  
  const messageBytes = messages.map(m =>
    typeof m === 'string' ? new TextEncoder().encode(m) : m
  );
  
  if (useBlst && blst) {
    try {
      const sig = blst.Signature.fromBytes(aggregateSignature);
      const pks = publicKeys.map(pk => blst.PublicKey.fromBytes(pk));
      
      // blst batch verification
      return blst.verifyMultipleAggregateSignatures([
        { messages: messageBytes, publicKeys: pks, signature: sig }
      ]);
    } catch (e) {
      return false;
    }
  }
  
  try {
    return bls12_381.verifyBatch(aggregateSignature, messageBytes, publicKeys);
  } catch (e) {
    return false;
  }
}

/**
 * Verify multiple signatures on the same message (batch verification)
 * 
 * This is the key optimization for attestations.
 */
export async function verifyMultiple(
  message: string | Uint8Array,
  aggregateSignature: Uint8Array,
  publicKeys: Uint8Array[]
): Promise<boolean> {
  await blstInitPromise;
  
  const messageBytes = typeof message === 'string'
    ? new TextEncoder().encode(message)
    : message;
  
  const messages = Array(publicKeys.length).fill(messageBytes);
  return verifyAggregate(messages, aggregateSignature, publicKeys);
}

// Hex convenience functions
export async function signHex(message: string, privateKeyHex: string): Promise<string> {
  const privateKey = hexToBytes(privateKeyHex);
  const signature = await sign(message, privateKey);
  return bytesToHex(signature);
}

export async function verifyHex(
  message: string,
  signatureHex: string,
  publicKeyHex: string
): Promise<boolean> {
  const signature = hexToBytes(signatureHex);
  const publicKey = hexToBytes(publicKeyHex);
  return verify(message, signature, publicKey);
}

export async function aggregateSignaturesHex(signaturesHex: string[]): Promise<string> {
  const signatures = signaturesHex.map(hexToBytes);
  const aggregate = await aggregateSignatures(signatures);
  return bytesToHex(aggregate);
}

export async function verifyAggregateHex(
  messages: string[],
  aggregateSignatureHex: string,
  publicKeysHex: string[]
): Promise<boolean> {
  const aggregateSignature = hexToBytes(aggregateSignatureHex);
  const publicKeys = publicKeysHex.map(hexToBytes);
  return verifyAggregate(messages, aggregateSignature, publicKeys);
}

/**
 * Benchmark BLS operations
 */
export async function benchmark(batchSize: number = 100): Promise<{
  keygenTime: number;
  signTime: number;
  verifyTime: number;
  aggregateTime: number;
  batchVerifyTime: number;
  batchSize: number;
  impl: string;
}> {
  await blstInitPromise;
  
  const impl = useBlst ? '@chainsafe/blst' : '@noble/curves';
  
  // Key generation
  const keygenStart = performance.now();
  const keypairs = await Promise.all(
    Array.from({ length: batchSize }, () => generateKeyPair())
  );
  const keygenTime = performance.now() - keygenStart;
  
  // Signing
  const message = 'benchmark message';
  const signStart = performance.now();
  const signatures = await Promise.all(
    keypairs.map(kp => sign(message, kp.privateKey))
  );
  const signTime = performance.now() - signStart;
  
  // Individual verification (sample 10 for speed)
  const sampleSize = Math.min(10, batchSize);
  const verifyStart = performance.now();
  for (let i = 0; i < sampleSize; i++) {
    await verify(message, signatures[i], keypairs[i].publicKey);
  }
  const verifyTime = ((performance.now() - verifyStart) / sampleSize) * batchSize;
  
  // Aggregation
  const aggregateStart = performance.now();
  const aggregateSig = await aggregateSignatures(signatures);
  const aggregateTime = performance.now() - aggregateStart;
  
  // Batch verification (the key optimization)
  const publicKeys = keypairs.map(kp => kp.publicKey);
  const batchStart = performance.now();
  await verifyMultiple(message, aggregateSig, publicKeys);
  const batchVerifyTime = performance.now() - batchStart;
  
  return {
    keygenTime,
    signTime,
    verifyTime,
    aggregateTime,
    batchVerifyTime,
    batchSize,
    impl
  };
}

// Export for API compatibility with old sync functions
export { bytesToHex, hexToBytes };
export { bls12_381 }; // Keep noble export for compatibility
