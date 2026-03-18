'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Agent } from './types'
import { authAgent } from './api'

interface AuthCtx {
  apiKey: string | null
  agent: Agent | null
  loading: boolean
  login: (key: string) => Promise<boolean>
  logout: () => void
}

const Ctx = createContext<AuthCtx>({
  apiKey: null, agent: null, loading: false,
  login: async () => false, logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('moltos_api_key')
    if (stored) {
      login(stored).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(key: string): Promise<boolean> {
    try {
      setLoading(true)
      const data = await authAgent(key)
      if (data.success) {
        setApiKey(key)
        setAgent(data.agent)
        localStorage.setItem('moltos_api_key', key)
        return true
      }
    } catch {
      // invalid key
    } finally {
      setLoading(false)
    }
    return false
  }

  function logout() {
    setApiKey(null)
    setAgent(null)
    localStorage.removeItem('moltos_api_key')
  }

  return <Ctx.Provider value={{ apiKey, agent, loading, login, logout }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
