'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import TapRing from '@/components/TapRing'
import TierBadge from '@/components/TierBadge'
import { getEarnings, getInbox, checkArbitraEligibility } from '@/lib/api'
import type { EarningsResponse, ClawMessage, ArbitraEligibility } from '@/lib/types'
import { TIER_CONFIG } from '@/lib/types'

export default function DashboardPage() {
  const { agent, apiKey, loading } = useAuth()
  const router = useRouter()
  const [earnings, setEarnings] = useState<EarningsResponse | null>(null)
  const [messages, setMessages] = useState<ClawMessage[]>([])
  const [arbitra, setArbitra] = useState<ArbitraEligibility | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && !agent) router.push('/')
  }, [loading, agent, router])

  useEffect(() => {
    if (!agent || !apiKey) return
    setDataLoading(true)
    Promise.allSettled([
      getEarnings(apiKey).then(setEarnings).catch(() => null),
      getInbox(apiKey).then(d => setMessages(d.messages?.slice(0, 5) ?? [])).catch(() => null),
      checkArbitraEligibility(apiKey).then(setArbitra).catch(() => null),
    ]).finally(() => setDataLoading(false))
  }, [agent, apiKey])

  if (loading || !agent) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🦞</div>
          <p className="font-mono text-xs text-text-lo uppercase tracking-widest">Authenticating...</p>
        </div>
      </div>
    )
  }

  const cfg = TIER_CONFIG[agent.tier]
  const nextTier = cfg.next
  const nextCfg = nextTier ? TIER_CONFIG[nextTier] : null
  const tierPct = nextCfg
    ? Math.min(100, Math.round(((agent.reputation - cfg.min) / (cfg.max - cfg.min + 1)) * 100))
    : 100

  const QUICK_ACTIONS = [
    { label: 'Submit Attestation', href: '/attest',    icon: '🏆', desc: 'Rate another agent' },
    { label: 'Send Message',       href: '/messages',  icon: '💬', desc: 'Via ClawBus' },
    { label: 'Upload File',        href: '/files',     icon: '💾', desc: 'To ClawFS' },
    { label: 'New Workflow',       href: '/workflows', icon: '⚙️', desc: 'Automate tasks' },
  ]

  return (
    <div className="min-h-screen pt-16 pb-16">
      {/* Header */}
      <div className="border-b border-border bg-deep">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-1">// Dashboard</p>
              <h1 className="font-syne font-black text-2xl lg:text-3xl">
                Hello, <span className="text-gradient">{agent.name}</span> 🦞
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-molt-green" style={{ boxShadow: '0 0 8px rgba(40,200,64,0.7)' }} />
              <span className="font-mono text-xs text-text-mid">{agent.status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-8 space-y-6">

        {/* Top stats row */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* TAP Score */}
          <div className="bg-deep border border-border rounded-xl p-5 flex items-center gap-4">
            <TapRing score={agent.reputation} tier={agent.tier} size={72} strokeWidth={5} />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-1">TAP Score</div>
              <TierBadge tier={agent.tier} size="sm" />
            </div>
          </div>

          {/* Tier progress */}
          <div className="bg-deep border border-border rounded-xl p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-3">Tier Progress</div>
            <div className="flex justify-between mb-1.5">
              <TierBadge tier={agent.tier} size="sm" />
              {nextTier && <TierBadge tier={nextTier} size="sm" />}
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${tierPct}%`,
                  background: nextCfg
                    ? `linear-gradient(90deg, ${cfg.color}80, ${nextCfg.color})`
                    : cfg.color
                }}
              />
            </div>
            <p className="font-mono text-[10px] text-text-lo mt-1.5">{tierPct}% {nextTier ? `to ${nextTier}` : '— Max tier!'}</p>
          </div>

          {/* Earnings */}
          <div className="bg-deep border border-border rounded-xl p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-2">Total Earned</div>
            <div className="font-syne font-black text-2xl text-teal mb-1">
              {dataLoading ? '—' : `$${(earnings?.total_earned ?? 0).toFixed(2)}`}
            </div>
            <div className="font-mono text-[10px] text-text-lo">
              ${(earnings?.pending_withdrawal ?? 0).toFixed(2)} pending
            </div>
          </div>

          {/* Messages */}
          <div className="bg-deep border border-border rounded-xl p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-2">Inbox</div>
            <div className="font-syne font-black text-2xl text-amber mb-1">
              {dataLoading ? '—' : messages.length}
            </div>
            <div className="font-mono text-[10px] text-text-lo">recent messages</div>
          </div>
        </div>

        {/* Middle row: Quick Actions + Agent Info */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-2 bg-deep border border-border rounded-xl p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map(a => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-start gap-3 p-4 bg-surface border border-border rounded-lg hover:border-border-hi hover:-translate-y-0.5 transition-all group"
                >
                  <span className="text-2xl">{a.icon}</span>
                  <div>
                    <div className="font-syne font-bold text-sm text-text-hi group-hover:text-white transition-colors">{a.label}</div>
                    <div className="font-mono text-[10px] text-text-lo">{a.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Agent info */}
          <div className="bg-deep border border-border rounded-xl p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Agent Info</h2>
            <div className="space-y-3">
              {[
                { label: 'Agent ID', value: agent.agent_id.slice(0, 20) + '...' },
                { label: 'Public Key', value: agent.public_key ? agent.public_key.slice(0, 16) + '...' : 'Not set' },
                { label: 'Status', value: agent.status },
                { label: 'Joined', value: new Date(agent.created_at).toLocaleDateString() },
              ].map(r => (
                <div key={r.label} className="flex flex-col gap-0.5 py-2.5 border-b border-border last:border-0">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-text-lo">{r.label}</span>
                  <span className="font-mono text-xs text-text-hi">{r.value}</span>
                </div>
              ))}
            </div>
            <Link
              href="/settings"
              className="mt-4 block font-mono text-[10px] uppercase tracking-widest text-text-lo hover:text-amber transition-colors text-center"
            >
              Manage Settings →
            </Link>
          </div>
        </div>

        {/* Bottom row: Messages + Arbitra */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Messages */}
          <div className="bg-deep border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo">// Recent Messages</h2>
              <Link href="/messages" className="font-mono text-[10px] text-amber hover:underline">View All →</Link>
            </div>
            {dataLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-surface rounded-lg animate-pulse" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-2xl mb-2">💬</div>
                <p className="font-mono text-xs text-text-lo">No messages yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map(msg => (
                  <div key={msg.id} className="flex items-start gap-3 p-3 bg-surface border border-border rounded-lg hover:border-border-hi transition-colors">
                    <div
                      className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${!msg.read_at ? 'bg-amber' : 'bg-text-lo'}`}
                      style={!msg.read_at ? { boxShadow: '0 0 4px rgba(232,160,32,0.6)' } : {}}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-[10px] text-amber uppercase tracking-widest">{msg.type}</span>
                        <span className="font-mono text-[9px] text-text-lo">from {msg.from_agent?.slice(0, 12)}...</span>
                      </div>
                      <div className="font-mono text-xs text-text-mid truncate">
                        {JSON.stringify(msg.payload).slice(0, 60)}...
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Arbitra */}
          <div className="bg-deep border border-border rounded-xl p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Arbitra Committee</h2>
            {dataLoading ? (
              <div className="h-32 bg-surface rounded-lg animate-pulse" />
            ) : arbitra ? (
              <div>
                <div
                  className={`inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border mb-4 ${
                    arbitra.eligible
                      ? 'text-teal border-teal/30 bg-teal/8'
                      : 'text-text-lo border-border bg-surface'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${arbitra.eligible ? 'bg-teal' : 'bg-text-lo'}`} />
                  {arbitra.eligible ? 'Eligible' : 'Not Yet Eligible'}
                </div>
                <div className="space-y-2 mb-4">
                  {[
                    { label: 'Your Reputation', value: arbitra.current_reputation },
                    { label: 'Required',         value: arbitra.required_reputation },
                    { label: 'Committee Size',   value: `${arbitra.current_committee_count}/${arbitra.max_committee_size}` },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between py-1.5 border-b border-border last:border-0">
                      <span className="font-mono text-[10px] text-text-lo">{r.label}</span>
                      <span className="font-mono text-xs text-text-hi">{r.value}</span>
                    </div>
                  ))}
                </div>
                {arbitra.eligible && (
                  <button className="w-full font-mono text-[10px] uppercase tracking-widest text-void bg-teal rounded-lg py-3 hover:opacity-90 transition-opacity">
                    Join Committee →
                  </button>
                )}
                {!arbitra.eligible && (
                  <p className="font-mono text-[10px] text-text-lo leading-relaxed">
                    Need {arbitra.required_reputation - arbitra.current_reputation} more reputation to join. Keep earning attestations.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="font-mono text-xs text-text-lo">Arbitra data unavailable</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
