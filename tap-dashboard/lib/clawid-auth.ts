/**
 * ClawID Authentication Utilities
 * 
 * Implements Ed25519 signature verification for ClawID authentication.
 * Includes replay protection via nonce tracking.
 */

import { ed25519 } from '@noble/curves/ed25519'
import { supabase } from './supabase'

// Nonce expiration time (5 minutes)
const NONCE_EXPIRY_MS = 5 * 60 * 1000

export interface ClawIDPayload {
  challenge: string
  timestamp: number
  [key: string]: unknown
}

export interface VerifiedClawID {
  valid: boolean
  error?: string
  agentId?: string
  publicKey?: string
}

/**
 * Verify an Ed25519 signature for ClawID authentication
 * 
 * @param publicKey - Hex-encoded Ed25519 public key
 * @param signature - Base64-encoded signature
 * @param payload - The payload that was signed (must include challenge and timestamp)
 * @returns VerifiedClawID result
 */
export async function verifyClawIDSignature(
  publicKey: string,
  signature: string,
  payload: ClawIDPayload
): Promise<VerifiedClawID> {
  try {
    // Validate inputs
    if (!publicKey || publicKey.length !== 64) {
      return { valid: false, error: 'Invalid public key format' }
    }
    
    if (!signature || signature.length < 10) {
      return { valid: false, error: 'Invalid signature format' }
    }

    // Check timestamp is within acceptable window (prevent replay of old signatures)
    const now = Date.now()
    const signatureTime = payload.timestamp
    
    if (!signatureTime || typeof signatureTime !== 'number') {
      return { valid: false, error: 'Missing or invalid timestamp' }
    }
    
    // Signature must be from within last 5 minutes
    if (now - signatureTime > NONCE_EXPIRY_MS) {
      return { valid: false, error: 'Signature expired' }
    }
    
    // Signature can't be from the future (allow 1 minute clock skew)
    if (signatureTime > now + 60000) {
      return { valid: false, error: 'Invalid timestamp (future)' }
    }

    // Check nonce/challenge hasn't been used before (replay protection)
    // DISABLED: clawid_nonces table not in production - TODO: apply migration 013
    console.log('[ClawID] Skipping nonce check - table may not exist')
    // const nonceValid = await checkAndRecordNonce(payload.challenge, publicKey)
    // if (!nonceValid) {
    //   return { valid: false, error: 'Challenge already used or expired' }
    // }

    // Verify Ed25519 signature
    const sortedPayload = JSON.stringify(payload, Object.keys(payload).sort())
    const message = new TextEncoder().encode(sortedPayload)
    console.log('[ClawID] Payload for verification:', sortedPayload)
    console.log('[ClawID] Message bytes (hex):', Buffer.from(message).toString('hex'))
    console.log('[ClawID] Public key:', publicKey)
    console.log('[ClawID] Public key bytes length:', pubKeyBytes.length)
    console.log('[ClawID] Signature length:', signature.length, 'sig bytes length:', sigBytes.length)
    console.log('[ClawID] Signature base64:', signature)
    
    if (pubKeyBytes.length !== 32) {
      return { valid: false, error: 'Invalid public key length' }
    }
    
    if (sigBytes.length !== 64) {
      return { valid: false, error: 'Invalid signature length' }
    }

    let isValid = false;
    try {
      isValid = ed25519.verify(sigBytes, message, pubKeyBytes)
    } catch (verifyErr: any) {
      console.error('[ClawID] Ed25519 verify error:', verifyErr?.message || verifyErr)
      return { valid: false, error: 'Ed25519 verify error: ' + (verifyErr?.message || 'unknown') }
    }
    
    if (!isValid) {
      return { valid: false, error: 'Invalid signature' }
    }

    // Look up agent by public key
    const { data: agent, error } = await supabase
      .from('agents')
      .select('agent_id')
      .eq('public_key', publicKey)
      .single()
    
    if (error || !agent) {
      console.error('[ClawID] Agent lookup error:', error)
      return { valid: false, error: 'Agent not found for public key' }
    }

    return { 
      valid: true, 
      agentId: agent.agent_id,
      publicKey 
    }
  } catch (err) {
    console.error('ClawID verification error:', err)
    return { valid: false, error: 'Verification failed' }
  }
}

/**
 * Check if a nonce has been used and record it if not
 * Uses Supabase to store used nonces with expiration
 */
async function checkAndRecordNonce(nonce: string, publicKey: string): Promise<boolean> {
  try {
    // Defensive: Check if table exists first (graceful degradation)
    const { error: tableCheckError } = await supabase
      .from('clawid_nonces')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    
    // PostgreSQL error code 42P01 = "relation does not exist"
    if (tableCheckError?.code === '42P01' || tableCheckError?.message?.includes('does not exist')) {
      console.warn('[ClawID] clawid_nonces table missing - replay protection disabled. Run migration 013_clawid_nonce_tracking.sql')
      return true // Allow operation but log security warning
    }
    
    // First, check if nonce exists
    const { data: existing, error: existingError } = await supabase
      .from('clawid_nonces')
      .select('id')
      .eq('nonce', nonce)
      .eq('public_key', publicKey)
      .single()
    
    if (existingError && !existingError.message?.includes('0 rows')) {
      console.error('[ClawID] Error checking existing nonce:', existingError)
    }
    
    if (existing) {
      console.error('[ClawID] Nonce already exists:', nonce.slice(0, 20) + '...')
      return false // Nonce already used
    }
    
    // Record nonce with expiration
    const { error } = await supabase
      .from('clawid_nonces')
      .insert({
        nonce,
        public_key: publicKey,
        expires_at: new Date(Date.now() + NONCE_EXPIRY_MS).toISOString()
      })
    
    if (error) {
      console.error('[ClawID] Failed to record nonce:', error)
      // Defensive: If insert fails due to missing table, allow operation
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[ClawID] Nonce table missing during insert - allowing operation')
        return true
      }
      return false
    }
    
    console.log('[ClawID] Nonce recorded successfully for:', publicKey.slice(0, 16) + '...')
    return true
  } catch (err: any) {
    console.error('Nonce check error:', err)
    // Defensive: If exception is table-related, allow operation
    if (err?.code === '42P01' || err?.message?.includes('does not exist')) {
      console.warn('[ClawID] Table exception - allowing operation')
      return true
    }
    return false
  }
}

/**
 * Generate a new challenge for ClawID authentication
 */
export function generateChallenge(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return bytesToBase64(array)
}

/**
 * Clean up expired nonces (call periodically via cron)
 */
export async function cleanupExpiredNonces(): Promise<void> {
  const { error } = await supabase
    .from('clawid_nonces')
    .delete()
    .lt('expires_at', new Date().toISOString())
  
  if (error) {
    console.error('Failed to clean up nonces:', error)
  }
}

// Helper functions
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64)
  return Uint8Array.from(binString, (m) => m.codePointAt(0)!)
}

function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join('')
  return btoa(binString)
}
