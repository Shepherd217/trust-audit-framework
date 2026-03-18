// ClawID - Ed25519 cryptographic identity for MoltOS
// No passwords. No sessions. Just cryptographic proof.

import { randomBytes } from 'crypto'

export interface ClawIDKeypair {
  publicKey: string  // base64 encoded
  privateKey: string // base64 encoded
  agentId: string    // UUID derived from public key
  createdAt: string
}

export interface ClawIDChallenge {
  challenge: string  // base64 random bytes
  timestamp: number
  expiresAt: number
}

export interface SignedChallenge {
  publicKey: string
  signature: string  // base64 signature
  challenge: string  // original challenge
  timestamp: number
}

const CLAWID_STORAGE_KEY = 'clawid_keypair'

/**
 * Generate a new Ed25519 keypair for ClawID
 * In browser, we use the Web Crypto API
 */
export async function generateClawID(): Promise<ClawIDKeypair> {
  if (typeof window === 'undefined') {
    throw new Error('ClawID generation only available in browser')
  }

  // Generate Ed25519 keypair using Web Crypto API
  const keypair = await window.crypto.subtle.generateKey(
    {
      name: 'Ed25519',
    } as AlgorithmIdentifier,
    true, // extractable
    ['sign', 'verify']
  ) as CryptoKeyPair

  // Export keys
  const publicKeyBuffer = await window.crypto.subtle.exportKey('raw', keypair.publicKey)
  const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keypair.privateKey)

  const publicKey = arrayBufferToBase64(publicKeyBuffer)
  const privateKey = arrayBufferToBase64(privateKeyBuffer)
  
  // Derive agent ID from public key (first 16 bytes as UUID)
  const agentId = publicKeyToUUID(publicKeyBuffer)

  return {
    publicKey,
    privateKey,
    agentId,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Load keypair from localStorage
 */
export function loadClawID(): ClawIDKeypair | null {
  if (typeof window === 'undefined') return null
  
  const stored = localStorage.getItem(CLAWID_STORAGE_KEY)
  if (!stored) return null
  
  try {
    return JSON.parse(stored) as ClawIDKeypair
  } catch {
    return null
  }
}

/**
 * Save keypair to localStorage
 */
export function saveClawID(keypair: ClawIDKeypair): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CLAWID_STORAGE_KEY, JSON.stringify(keypair))
}

/**
 * Import keypair from uploaded file
 */
export async function importClawIDFromFile(file: File): Promise<ClawIDKeypair> {
  const text = await file.text()
  const keypair = JSON.parse(text) as ClawIDKeypair
  
  // Validate
  if (!keypair.publicKey || !keypair.privateKey || !keypair.agentId) {
    throw new Error('Invalid ClawID file format')
  }
  
  saveClawID(keypair)
  return keypair
}

/**
 * Export keypair as downloadable file
 */
export function exportClawID(keypair: ClawIDKeypair): void {
  const blob = new Blob([JSON.stringify(keypair, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `clawid-${keypair.agentId.slice(0, 8)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Sign a challenge with the private key
 */
export async function signChallenge(
  keypair: ClawIDKeypair,
  challenge: string
): Promise<SignedChallenge> {
  if (typeof window === 'undefined') {
    throw new Error('Signing only available in browser')
  }

  // Import private key
  const privateKeyBuffer = base64ToArrayBuffer(keypair.privateKey)
  const privateKey = await window.crypto.subtle.importKey(
    'pkcs8',
    privateKeyBuffer,
    { name: 'Ed25519' } as AlgorithmIdentifier,
    false,
    ['sign']
  )

  // Sign
  const challengeBuffer = new TextEncoder().encode(challenge)
  const signatureBuffer = await window.crypto.subtle.sign(
    { name: 'Ed25519' } as AlgorithmIdentifier,
    privateKey,
    challengeBuffer
  )

  return {
    publicKey: keypair.publicKey,
    signature: arrayBufferToBase64(signatureBuffer),
    challenge,
    timestamp: Date.now(),
  }
}

/**
 * Generate a random challenge for authentication
 */
export function generateChallenge(): ClawIDChallenge {
  const array = new Uint8Array(32)
  window.crypto.getRandomValues(array)
  const challenge = arrayBufferToBase64(array.buffer)
  const timestamp = Date.now()
  
  return {
    challenge,
    timestamp,
    expiresAt: timestamp + 5 * 60 * 1000, // 5 minutes
  }
}

// Helper functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function publicKeyToUUID(publicKeyBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(publicKeyBuffer.slice(0, 16))
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  
  // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/**
 * Clear stored ClawID (sign out)
 */
export function clearClawID(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CLAWID_STORAGE_KEY)
}
