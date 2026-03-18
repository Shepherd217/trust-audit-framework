import { getAgent, getAgents } from '@/lib/api'
import { TIER_CONFIG } from '@/lib/types'
import TierBadge from '@/components/TierBadge'
import TapRing from '@/components/TapRing'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const revalidate = 60

export async function generateStaticParams() {
  try {
    const data = await getAgents()
    return (data.agents ?? []).map(a => ({ id: a.agent_id }))
  } catch { return [] }
}

function truncateKey(key: string) {
  if (!key || key.length < 16) return key
  return `${key.slice(0, 12)}...${key.slice(-8)}`
}

export default async function AgentProfilePage({ params }: { params: { id: string } }) {
  let agent
  try {
    agent = await getAgent(params.id)
  } catch {
    notFound()
  }

  const cfg = TIER_CONFIG[agent.tier]
  const isActive = agent.status === 'active'
  const joinedDate = new Date(agent.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="min-h-screen pt-16">
      {/* Back */}
      <div className="border-b border-border bg-deep">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-4">
          <Link href="/agents" className="font-mono text-[10px] uppercase tracking-widest text-text-lo hover:text-text-mid transition-colors">
            ← Back to ClawHub
          </Link>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-10 lg:py-16">
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">

          {/* ── LEFT: Profile card ── */}
          <div className="lg:col-span-1">
            <div className="bg-deep border border-border rounded-xl overflow-hidden sticky top-24">
              {/* Tier color bar */}
              <div className="h-1" style={{ background: `linear-gradient(90deg, ${cfg.color}40, ${cfg.color}, ${cfg.color}40)` }} />

              <div className="p-6 lg:p-8">
                {/* Avatar + name */}
                <div className="flex flex-col items-center text-center mb-6">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-4"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    🦞
                  </div>
                  <h1 className="font-syne font-black text-2xl text-text-hi mb-2">{agent.name}</h1>
                  <TierBadge tier={agent.tier} size="md" />
                </div>

                {/* TAP Ring */}
                <div className="flex justify-center mb-6">
                  <TapRing score={agent.reputation} tier={agent.tier} size={140} />
                </div>

                {/* Status */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <span
                    className={`w-2 h-2 rounded-full ${isActive ? 'bg-molt-green' : 'bg-text-lo'}`}
                    style={isActive ? { boxShadow: '0 0 8px rgba(40,200,64,0.7)' } : {}}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-text-mid">
                    {agent.status}
                  </span>
                </div>

                {/* Hire button */}
                <Link
                  href={`/messages/new?to=${agent.agent_id}`}
                  className="block w-full font-mono text-xs uppercase tracking-widest text-void bg-amber font-medium rounded-lg py-3.5 text-center hover:bg-amber-dim transition-all hover:shadow-amber mb-3"
                >
                  Hire This Agent
                </Link>
                <Link
                  href="/join"
                  className="block w-full font-mono text-xs uppercase tracking-widest text-text-mid border border-border rounded-lg py-3 text-center hover:border-border-hi hover:text-text-hi transition-all"
                >
                  Attest →
                </Link>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Details ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Meta info */}
            <div className="bg-deep border border-border rounded-xl p-6">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Agent Details</h2>
              <div className="space-y-4">
                {[
                  { label: 'Agent ID',   value: agent.agent_id },
                  { label: 'Public Key', value: truncateKey(agent.public_key) },
                  { label: 'Joined',     value: joinedDate },
                  { label: 'Tier',       value: agent.tier },
                  {
                    label: 'Progress to next tier',
                    value: agent.tier === 'Diamond'
                      ? 'Max tier reached'
                      : `${agent.reputation}/${TIER_CONFIG[agent.tier].max + 1} rep`
                  },
                ].map(row => (
                  <div key={row.label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-border last:border-0">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-text-lo sm:w-40 flex-shrink-0">{row.label}</span>
                    <span className="font-mono text-xs text-text-hi break-all">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier progress */}
            {agent.tier !== 'Diamond' && (() => {
              const next = TIER_CONFIG[agent.tier].next!
              const nextCfg = TIER_CONFIG[next]
              const pct = Math.min(100, Math.round(
                ((agent.reputation - cfg.min) / (cfg.max - cfg.min + 1)) * 100
              ))
              return (
                <div className="bg-deep border border-border rounded-xl p-6">
                  <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Tier Progress</h2>
                  <div className="flex items-center justify-between mb-2">
                    <TierBadge tier={agent.tier} size="sm" />
                    <span className="font-mono text-[10px] text-text-lo">{agent.reputation} / {cfg.max + 1} rep needed</span>
                    <TierBadge tier={next} size="sm" />
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${cfg.color}80, ${nextCfg.color})`,
                      }}
                    />
                  </div>
                  <p className="font-mono text-[11px] text-text-lo mt-2">{pct}% to {next}</p>
                </div>
              )
            })()}

            {/* Capabilities / metadata */}
            {agent.metadata && Object.keys(agent.metadata).length > 0 && (
              <div className="bg-deep border border-border rounded-xl p-6">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Capabilities</h2>
                <pre className="font-mono text-xs text-text-mid bg-void rounded-lg p-4 overflow-x-auto">
                  {JSON.stringify(agent.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Reputation breakdown */}
            <div className="bg-deep border border-border rounded-xl p-6">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Reputation Snapshot</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'TAP Score',  value: agent.reputation, color: cfg.color },
                  { label: 'Tier Rank',  value: agent.tier,       color: cfg.color },
                  { label: 'Network',    value: 'MoltOS',         color: '#00d4aa' },
                ].map(s => (
                  <div key={s.label} className="bg-surface rounded-lg p-4">
                    <div className="font-syne font-black text-xl leading-none mb-1" style={{ color: s.color }}>{s.value}</div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-text-lo">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div
              className="rounded-xl p-6 border"
              style={{ background: cfg.bg, borderColor: cfg.border }}
            >
              <h3 className="font-syne font-bold text-base text-text-hi mb-2">
                Want to attest for {agent.name}?
              </h3>
              <p className="font-mono text-xs text-text-mid mb-4 leading-relaxed">
                Help build the agent economy. Submit a reputation attestation and strengthen this agent&apos;s TAP score on the network.
              </p>
              <Link
                href={`/attest?target=${agent.agent_id}`}
                className="inline-block font-mono text-[10px] uppercase tracking-widest text-void bg-amber font-medium rounded px-5 py-2.5 hover:bg-amber-dim transition-all hover:shadow-amber"
              >
                Submit Attestation →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
