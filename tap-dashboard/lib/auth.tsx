'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Agent } from './types'
import { 
  ClawIDKeypair, 
  loadClawID, 
  saveClawID, 
  clearClawID, 
  importClawIDFromFile,
  exportClawID as exportClawIDFile,
  generateClawID,
  signChallenge,
  generateChallenge,
} from './claw/id'

interface AuthCtx {
  keypair: ClawIDKeypair | null
  agent: Agent | null
  loading: boolean
  isAuthenticated: boolean
  // Actions
  loginWithFile: (file: File) => Promise<{ success: boolean; error?: string }>
  loginWithKeypair: (keypair: ClawIDKeypair) => Promise<{ success: boolean; error?: string }>
  createNewClawID: () => Promise<ClawIDKeypair>
  exportClawID: () => void
  logout: () => void
}

const Ctx = createContext<AuthCtx>({
  keypair: null, agent: null, loading: false, isAuthenticated: false,
  loginWithFile: async () => ({ success: false }),
  loginWithKeypair: async () => ({ success: false }),
  createNewClawID: async () => { throw new Error('Not implemented') },
  exportClawID: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [keypair, setKeypair] = useState<ClawIDKeypair | null>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  // Load stored keypair on mount
  useEffect(() => {
    const stored = loadClawID()
    if (stored) {
      authenticateWithKeypair(stored)
    } else {
      setLoading(false)
    }
  }, [])

  async function authenticateWithKeypair(kp: ClawIDKeypair): Promise<{ success: boolean; error?: string }> {
    try {
      setLoading(true)
      
      // 1. Get challenge from server
      const challengeRes = await fetch('/api/clawid/challenge')
      if (!challengeRes.ok) throw new Error('Failed to get challenge')
      const { challenge } = await challengeRes.json()
      
      // 2. Sign challenge with private key
      const signed = await signChallenge(kp, challenge)
      
      // 3. Verify with server
      const verifyRes = await fetch('/api/clawid/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signed),
      })
      
      if (!verifyRes.ok) {
        const err = await verifyRes.text()
        throw new Error(err || 'Authentication failed')
      }
      
      const data = await verifyRes.json()
      
      // 4. Store and set state
      saveClawID(kp)
      setKeypair(kp)
      setAgent(data.agent)
      
      return { success: true }
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Authentication failed' 
      }
    } finally {
      setLoading(false)
    }
  }

  async function loginWithFile(file: File): Promise<{ success: boolean; error?: string }> {
    try {
      const kp = await importClawIDFromFile(file)
      return authenticateWithKeypair(kp)
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Invalid ClawID file' 
      }
    }
  }

  async function loginWithKeypair(kp: ClawIDKeypair): Promise<{ success: boolean; error?: string }> {
    return authenticateWithKeypair(kp)
  }

  async function createNewClawID(): Promise<ClawIDKeypair> {
    const kp = await generateClawID()
    
    // Register with server
    const res = await fetch('/api/clawid/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: kp.publicKey, agentId: kp.agentId }),
    })
    
    if (!res.ok) {
      throw new Error('Failed to register ClawID')
    }
    
    const data = await res.json()
    
    saveClawID(kp)
    setKeypair(kp)
    setAgent(data.agent)
    
    return kp
  }

  function exportClawID() {
    if (keypair) {
      exportClawIDFile(keypair)
    }
  }

  function logout() {
    clearClawID()
    setKeypair(null)
    setAgent(null)
  }

  return (
    <Ctx.Provider value={{
      keypair,
      agent,
      loading,
      isAuthenticated: !!keypair && !!agent,
      loginWithFile,
      loginWithKeypair,
      createNewClawID,
      exportClawID,
      logout,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
