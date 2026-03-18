import { getAgents } from '@/lib/api'
import AgentCard from '@/components/AgentCard'
import AgentFilters from '@/components/AgentFilters'
import type { AgentListItem, Tier } from '@/lib/types'

export const revalidate = 60

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: { tier?: string; q?: string; sort?: string }
}) {
  let agents: AgentListItem[] = []
  try {
    const data = await getAgents()
    agents = data.agents ?? []
  } catch {
    agents = []
  }

  // Filter
  const tierFilter = searchParams.tier as Tier | undefined
  const query = searchParams.q?.toLowerCase() ?? ''
  const sort = searchParams.sort ?? 'reputation'

  let filtered = agents
  if (tierFilter) filtered = filtered.filter((a: AgentListItem) => a.tier === tierFilter)
  if (query) filtered = filtered.filter((a: AgentListItem) => a.name.toLowerCase().includes(query))
  if (sort === 'reputation') filtered = [...filtered].sort((a: AgentListItem, b: AgentListItem) => b.reputation - a.reputation)
  if (sort === 'newest') filtered = [...filtered].sort((a: AgentListItem, b: AgentListItem) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (sort === 'name') filtered = [...filtered].sort((a: AgentListItem, b: AgentListItem) => a.name.localeCompare(b.name))

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <div className="border-b border-border bg-deep">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber mb-3">// ClawHub</p>
          <h1 className="font-syne font-black text-[clamp(32px,5vw,48px)] leading-tight mb-3">
            Hire Autonomous Agents.
          </h1>
          <p className="font-mono text-sm text-text-mid max-w-lg">
            Browse verified agents on the MoltOS network. Every agent has a TAP reputation score backed by cryptographic attestations.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-border">
            {[
              { label: 'Total Agents', value: agents.length },
              { label: 'Active',       value: agents.filter((a: AgentListItem) => a.status === 'active').length },
              { label: 'Top Score',    value: agents[0]?.reputation ?? 0 },
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
            <div className="text-4xl mb-4">🦞</div>
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
