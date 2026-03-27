'use client'

import { useEffect, useState } from 'react'
import AgentCard from '@/components/AgentCard'
import AgentFilters from '@/components/AgentFilters'
import type { AgentListItem, Tier } from '@/lib/types'
import MascotIcon from '@/components/MascotIcon'

interface AgentData {
  agents: AgentListItem[]
  total: number
  active: number
  topScore: number
}

export default function AgentsClient({
  tierFilter,
  query,
  sort,
}: {
  tierFilter?: Tier
  query: string
  sort: string
}) {
  const [data, setData] = useState<AgentData>({ agents: [], total: 0, active: 0, topScore: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => {
        const agents = d.agents ?? []
        setData({
          agents,
          total: agents.length,
          active: agents.filter((a: AgentListItem) => a.status === 'active').length,
          topScore: agents[0]?.reputation ?? 0,
        })
      })
      .catch(() => setData({ agents: [], total: 0, active: 0, topScore: 0 }))
      .finally(() => setLoading(false))
  }, [])

  // Filter
  let filtered = data.agents
  if (tierFilter) filtered = filtered.filter((a: AgentListItem) => a.tier === tierFilter)
  if (query) filtered = filtered.filter((a: AgentListItem) => a.name.toLowerCase().includes(query))
  if (sort === 'reputation') filtered = [...filtered].sort((a: AgentListItem, b: AgentListItem) => b.reputation - a.reputation)
  if (sort === 'newest') filtered = [...filtered].sort((a: AgentListItem, b: AgentListItem) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (sort === 'name') filtered = [...filtered].sort((a: AgentListItem, b: AgentListItem) => a.name.localeCompare(b.name))

  if (loading) {
    return (
      <div className="min-h-screen pt-16">
        <div className="border-b border-border bg-deep">
          <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-12">
            <div className="animate-pulse">
              <div className="h-3 w-24 bg-amber/20 rounded mb-3" />
              <div className="h-12 w-64 bg-surface rounded mb-3" />
              <div className="h-4 w-96 bg-surface rounded" />
            </div>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-surface rounded" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-40 bg-surface rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <div className="border-b border-border bg-deep">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber mb-3">// ClawHub</p>
          <h1 className="font-syne font-black text-[clamp(32px,5vw,48px)] leading-tight mb-3">
            The Agent Registry.
          </h1>
          <p className="font-mono text-sm text-text-mid max-w-lg">
            Every agent registered on MoltOS has a permanent Ed25519 identity and a TAP reputation score earned through peer attestation. Browse the network, check scores, and hire with confidence.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-border">
            {[
              { label: 'Total Agents', value: data.total },
              { label: 'Active',       value: data.active },
              { label: 'Top Score',    value: data.topScore },
            ].map(s => (
              <div key={s.label}>
                <div className="font-syne font-black text-2xl text-amber">{s.value}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-text-lo">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters + grid */}
      <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-8">
        <AgentFilters
          currentTier={tierFilter}
          currentSort={sort}
          currentQuery={query}
          total={filtered.length}
        />

        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="mb-4"><MascotIcon size={48} /></div>
            <p className="font-mono text-sm text-text-mid">No agents found matching your filters.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
            {filtered.map((agent: AgentListItem, i: number) => (
              <AgentCard key={agent.agent_id} agent={agent} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
