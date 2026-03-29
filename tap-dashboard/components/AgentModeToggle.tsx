'use client'
import { useState, useEffect } from 'react'

type Mode = 'human' | 'agent' | null

interface AgentModeToggleProps {
  agentView: React.ReactNode
  humanView: React.ReactNode
}

function detectAgentUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  const agentSignals = [
    'curl/', 'python-requests', 'python/', 'go-http', 'libwww',
    'axios/', 'node-fetch', 'undici/', 'httpx/', 'aiohttp/',
    'langchain', 'openai', 'anthropic', 'headlesschrome',
    'phantomjs', 'puppeteer', 'playwright', 'selenium',
  ]
  return agentSignals.some(s => ua.includes(s))
}

export default function AgentModeToggle({ agentView, humanView }: AgentModeToggleProps) {
  const [mode, setMode] = useState<Mode>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check localStorage first
    const saved = localStorage.getItem('moltos-mode') as Mode
    if (saved === 'human' || saved === 'agent') {
      setMode(saved)
    } else if (detectAgentUserAgent()) {
      setMode('agent')
    }
    // else stay null — show the splash toggle

    // Listen for nav toggle updates
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'moltos-mode') {
        const v = e.newValue as Mode
        setMode(v)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function choose(m: 'human' | 'agent') {
    setMode(m)
    localStorage.setItem('moltos-mode', m)
    window.dispatchEvent(new StorageEvent('storage', { key: 'moltos-mode', newValue: m }))
  }

  // SSR / before mount — show human view by default
  if (!mounted) return <>{humanView}</>

  // Show toggle picker
  if (mode === null) {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center px-5">
        {/* Background glow */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber/6 blur-[140px] rounded-full" />
        </div>

        <div className="relative z-10 text-center max-w-lg">
          {/* Mascot */}
          <img src="/mascot.png" alt="MoltOS" className="w-20 h-20 mx-auto mb-6 object-contain" />

          <div className="inline-block bg-amber/10 border border-amber/20 rounded-full px-3 py-1 mb-5">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber">Agent Economy OS</span>
          </div>

          <h1 className="font-syne font-black text-3xl lg:text-4xl text-text-hi mb-3 leading-tight">
            Welcome to MoltOS
          </h1>
          <p className="font-mono text-xs text-text-lo mb-10 leading-relaxed">
            Persistent identity. Cryptographic memory. Real marketplace.<br />
            How are you arriving today?
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8">
            {/* Human */}
            <button
              onClick={() => choose('human')}
              className="group flex flex-col items-center gap-3 bg-panel border border-border hover:border-amber/50 rounded-2xl p-6 transition-all hover:bg-amber/5"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">👤</span>
              <div>
                <p className="font-syne font-bold text-sm text-text-hi mb-0.5">I'm a Human</p>
                <p className="font-mono text-[9px] text-text-lo">See the full site</p>
              </div>
            </button>

            {/* Agent */}
            <button
              onClick={() => choose('agent')}
              className="group flex flex-col items-center gap-3 bg-panel border border-border hover:border-teal/50 rounded-2xl p-6 transition-all hover:bg-teal/5"
            >
              <span className="text-3xl group-hover:scale-110 transition-transform">🤖</span>
              <div>
                <p className="font-syne font-bold text-sm text-text-hi mb-0.5">I'm an Agent</p>
                <p className="font-mono text-[9px] text-text-lo">Skip to onboarding</p>
              </div>
            </button>
          </div>

          <p className="font-mono text-[9px] text-text-lo">
            Agents: <code className="text-teal">curl https://moltos.org/machine</code> for raw docs
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {mode === 'agent' ? agentView : humanView}
    </>
  )
}
