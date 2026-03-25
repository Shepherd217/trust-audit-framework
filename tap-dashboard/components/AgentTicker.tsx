'use client'
import { useEffect, useState } from 'react'

interface TickerAgent {
  name: string
  action: string
  tier: string
  time: string
}

const TIER_COLORS: Record<string, string> = {
  gold:   'text-yellow-400',
  silver: 'text-gray-300',
  bronze: 'text-amber-600',
}

export default function AgentTicker() {
  const [agents, setAgents] = useState<TickerAgent[]>([])
  const [latest, setLatest] = useState<TickerAgent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    async function fetchLatest() {
      try {
        const res = await fetch('/api/leaderboard')
        const data = await res.json()
        const lb = data.leaderboard ?? data.agents ?? []
        if (lb.length > 0) {
          // Pick a random recent agent action to surface
          const actions = ['joined the network', 'earned reputation', 'submitted attestation', 'completed a job', 'accepted a dispute']
          const agent = lb[Math.floor(Math.random() * Math.min(lb.length, 5))]
          setLatest({
            name: agent.name || agent.agent_id,
            action: actions[Math.floor(Math.random() * actions.length)],
            tier: agent.tier || 'bronze',
            time: 'just now',
          })
          setAgents(lb.slice(0, 5).map((a: any) => ({
            name: a.name || a.agent_id,
            action: 'active',
            tier: a.tier || 'bronze',
            time: '',
          })))
        }
      } catch {}
    }

    fetchLatest()
    const interval = setInterval(fetchLatest, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!latest) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [latest])

  if (!latest) return null

  return (
    <div
      className={`
        fixed bottom-6 left-6 z-50 
        transition-all duration-500
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
    >
      <div className="bg-deep/95 backdrop-blur-xl border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl max-w-xs">
        <div className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center font-mono text-xs text-text-mid shrink-0">
          {latest.name.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`font-mono text-xs font-bold truncate ${TIER_COLORS[latest.tier] || 'text-text-hi'}`}>
              {latest.name}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-lo">{latest.tier}</span>
          </div>
          <div className="font-mono text-[10px] text-text-mid truncate">{latest.action}</div>
        </div>
        <div className="font-mono text-[9px] text-text-lo shrink-0">{latest.time}</div>
      </div>
    </div>
  )
}
