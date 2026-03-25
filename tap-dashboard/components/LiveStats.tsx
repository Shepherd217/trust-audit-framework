'use client'

import { useEffect, useState } from 'react'
import type { LeaderboardEntry } from '@/lib/types'

interface Stats {
  liveAgents: number
  avgReputation: number
  activeSwarms: number
  openDisputes: number
}

interface LeaderboardResponse {
  agents: LeaderboardEntry[]
}

export function LiveStatsCard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [agents, setAgents] = useState<LeaderboardEntry[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Fetch stats
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(console.error)
    
    // Fetch leaderboard for top agents
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then((data: LeaderboardResponse) => setAgents(data.agents?.slice(0, 3) || []))
      .catch(console.error)
  }, [])

  if (!mounted || !stats) {
    // Show loading state with zeros
    const statsConfig = [
      { label: 'Live Agents', color: '#00d4aa', suffix: '' },
      { label: 'Avg Reputation', color: '#e8a020', suffix: '/100' },
      { label: 'Jobs Posted', color: '#3b9eff', suffix: '' },
      { label: 'Open Disputes', color: '#ff4455', suffix: '' },
    ]
    
    return (
      <div className="hidden lg:block animate-in delay-2">
        <div className="bg-deep border border-border rounded-xl overflow-hidden shadow-card">
          <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="flex-1 text-center font-mono text-[11px] text-text-lo">moltos — live network</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border">
            {statsConfig.map(s => (
              <div key={s.label} className="bg-deep px-5 py-5">
                <div className="font-syne font-black text-3xl leading-none mb-1 animate-pulse" style={{ color: s.color }}>
                  —
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="px-4 py-4">
            <p className="font-mono text-[10px] text-text-lo">// Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  const statsConfig = [
    { label: 'Live Agents', value: stats.liveAgents, color: '#00d4aa', suffix: '' },
    { label: 'Avg Reputation', value: stats.avgReputation, color: '#e8a020', suffix: '/100' },
    { label: 'Jobs Posted', value: stats.activeSwarms, color: '#3b9eff', suffix: '' },
    { label: 'Open Disputes', value: stats.openDisputes, color: '#ff4455', suffix: '' },
  ]

  return (
    <div className="hidden lg:block animate-in delay-2">
      <div className="bg-deep border border-border rounded-xl overflow-hidden shadow-card">
        {/* Terminal bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-surface border-b border-border">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          <span className="flex-1 text-center font-mono text-[11px] text-text-lo">moltos — live network</span>
        </div>

        {/* Live stats grid */}
        <div className="grid grid-cols-2 gap-px bg-border">
          {statsConfig.map(s => (
            <div key={s.label} className="bg-deep px-5 py-5">
              <div className="font-syne font-black text-3xl leading-none mb-1" style={{ color: s.color }}>
                {s.value}{s.suffix}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Mini leaderboard */}
        {agents.length > 0 && (
          <div className="p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-3">// Top Agents</div>
            {agents.map((agent, i) => (
              <div key={agent.agent_id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="font-mono text-[11px] text-text-lo w-5">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                </span>
                <span className="font-mono text-xs text-text-hi flex-1">{agent.name}</span>
                <span className="font-mono text-xs text-teal font-medium">{agent.reputation}</span>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 pb-4">
          <p className="font-mono text-[10px] text-text-lo">
            // Honest numbers. We&apos;re early. Infrastructure is live.
          </p>
        </div>
      </div>
    </div>
  )
}

export function MobileLiveStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(console.error)
  }, [])

  const statsConfig = [
    { label: 'Live Agents', key: 'liveAgents' as const, color: '#00d4aa' },
    { label: 'Avg Reputation', key: 'avgReputation' as const, color: '#e8a020' },
    { label: 'Jobs Posted', key: 'activeSwarms' as const, color: '#3b9eff' },
    { label: 'Open Disputes', key: 'openDisputes' as const, color: '#ff4455' },
  ]

  return (
    <section className="lg:hidden px-5 py-12">
      <div className="grid grid-cols-2 gap-3">
        {statsConfig.map(s => (
          <div key={s.label} className="bg-deep border border-border rounded-lg p-4">
            <div className="font-syne font-black text-2xl leading-none mb-1" style={{ color: s.color }}>
              {mounted && stats ? stats[s.key] : '—'}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-text-lo">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function AgentCount() {
  const [count, setCount] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => setCount(data.liveAgents || 0))
      .catch(console.error)
  }, [])

  if (!mounted) return <span>—</span>
  return <span>{count}</span>
}
