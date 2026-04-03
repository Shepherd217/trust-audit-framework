import Link from 'next/link'
import TierBadge from './TierBadge'
import { TIER_CONFIG, type AgentListItem } from '@/lib/types'
import MascotIcon from '@/components/MascotIcon'

interface Props {
  agent: AgentListItem
  rank?: number
}

export default function AgentCard({ agent, rank }: Props) {
  const cfg = TIER_CONFIG[agent.tier]
  const isOnline = agent.status === 'active'

  return (
    <Link href={`/agenthub/${agent.agent_id}`} className="block group">
      <div
        className="relative overflow-hidden rounded-lg border border-border bg-surface p-5 transition-all duration-200 hover:border-border-hi hover:-translate-y-0.5 hover:shadow-card"
        style={{ ['--accent' as string]: cfg.color }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`
          }}
        />

        {/* Rank badge */}
        {rank && (
          <div className="absolute top-3 right-3 font-mono text-[10px] text-text-lo">
            #{rank}
          </div>
        )}

        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center text-xl mb-4"
          style={{ background: cfg.bg }}
        >
          <MascotIcon size={20} />
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="font-syne font-bold text-sm text-text-hi group-hover:text-white transition-colors">
              {agent.name}
            </h3>
            {(agent as any).is_genesis && (
              <span className="font-mono text-[9px] text-accent-violet border border-accent-violet/40 bg-accent-violet/10 rounded-full px-1.5 py-0.5 leading-none flex-shrink-0">Genesis</span>
            )}
          </div>
          <TierBadge tier={agent.tier} size="sm" />
        </div>

        {/* Reputation bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">TAP Score</span>
            <span className="font-mono text-xs font-medium" style={{ color: cfg.color }}>
              {agent.reputation}
            </span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${agent.reputation}%`,
                background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color})`,
              }}
            />
          </div>
        </div>

        {/* DAO badges */}
        {agent.dao_names && agent.dao_names.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {agent.dao_names.slice(0, 3).map((name, i) => (
              <span
                key={agent.dao_ids?.[i] ?? i}
                className="font-mono text-[9px] px-1.5 py-0.5 rounded-full border border-teal/30 bg-teal/10 text-teal leading-none"
                title={name}
              >
                {name.length > 12 ? name.slice(0, 12) + '…' : name}
              </span>
            ))}
            {agent.dao_names.length > 3 && (
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full border border-border bg-surface text-text-lo leading-none">
                +{agent.dao_names.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-molt-green' : 'bg-text-lo'}`}
            style={isOnline ? { boxShadow: '0 0 6px rgba(40,200,64,0.6)' } : {}}
          />
          <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest">
            {agent.status}
          </span>
        </div>
      </div>
    </Link>
  )
}
