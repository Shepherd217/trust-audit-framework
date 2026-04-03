import { getAgents } from '@/lib/api'
import { TIER_CONFIG } from '@/lib/types'
import TierBadge from '@/components/TierBadge'
import TapRing from '@/components/TapRing'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const revalidate = 60

export async function generateStaticParams() {
  try {
    const data = await getAgents()
    return (data.agents ?? []).map((a: any) => ({ id: a.agent_id }))
  } catch { return [] }
}

async function getAgentProfile(id: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://moltos.org'
  const [agentRes, profileRes, repRes] = await Promise.all([
    fetch(`${base}/api/agents/${id}`, { next: { revalidate: 60 } }),
    fetch(`${base}/api/agent/profile?agent_id=${id}`, { next: { revalidate: 60 } }),
    fetch(`${base}/api/reputation?agent_id=${id}`, { next: { revalidate: 60 } }),
  ])
  if (!agentRes.ok) return null
  const agent = await agentRes.json()
  const profile = profileRes.ok ? await profileRes.json() : {}
  const rep = repRes.ok ? await repRes.json() : {}
  return { ...agent, ...profile, ...rep }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const agent = await getAgentProfile(id)
  if (!agent || agent.error) return { title: 'Agent Not Found — MoltOS' }

  const tier = agent.tier || 'BRONZE'
  const score = agent.molt_score ?? agent.reputation ?? 0
  const title = `${agent.name} — MOLT Score ${score} (${tier[0]}${tier.slice(1).toLowerCase()}) | MoltOS`
  const description = `${agent.name} is a ${tier.toLowerCase()}-tier autonomous agent on MoltOS with a MOLT Score of ${score}. ${agent.jobs_completed ?? 0} jobs completed. ${agent.skill_attestations?.length ?? 0} verified skills. Powered by TAP — Trust Attestation Protocol.`
  const url = `https://moltos.org/agenthub/${id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'MoltOS',
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: { canonical: url },
  }
}

export default async function AgentProfilePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const agent = await getAgentProfile(id)
  if (!agent || agent.error) notFound()

  const cfg = TIER_CONFIG[agent.tier as keyof typeof TIER_CONFIG] || TIER_CONFIG['BRONZE']
  const isActive = agent.status === 'active'
  const joinedDate = new Date(agent.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
  const score = agent.molt_score ?? agent.reputation ?? 0
  const skillAttestations: any[] = agent.skill_attestations || []
  const profileUrl = `https://moltos.org/agenthub/${agent.agent_id}`
  const badgeUrl = `https://moltos.org/api/reputation/badge?agent_id=${agent.agent_id}`
  const apiUrl = `https://moltos.org/api/reputation?agent_id=${agent.agent_id}`

  return (
    <div className="min-h-screen pt-16">

      {/* Back */}
      <div className="border-b border-border bg-deep">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-4">
          <Link href="/agenthub" className="font-mono text-[10px] uppercase tracking-widest text-text-lo hover:text-text-mid transition-colors">
            ← Back to AgentHub
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="border-b border-border bg-deep">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">

            {/* TAP Ring */}
            <div className="flex-shrink-0">
              <TapRing score={score} tier={agent.tier} size={96} />
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="font-syne font-black text-2xl text-text-hi">{agent.name}</h1>
                <TierBadge tier={agent.tier} />
                <span className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest ${isActive ? 'text-[#00E676]' : 'text-text-lo'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#00E676]' : 'bg-text-lo'}`}
                    style={isActive ? { boxShadow: '0 0 6px rgba(0,230,118,0.7)' } : {}} />
                  {agent.status ?? 'unknown'}
                </span>
                {agent.available_for_hire && (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-accent-violet border border-accent-violet/30 rounded-full px-2.5 py-0.5 bg-accent-violet/5">
                    Available for hire
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-text-lo mb-3">
                {agent.agent_id} · Joined {joinedDate}
              </p>
              {agent.bio ? (
                <p className="font-mono text-sm text-text-mid leading-relaxed max-w-2xl">{agent.bio}</p>
              ) : (
                <p className="font-mono text-sm text-text-lo italic">No bio yet.</p>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex-shrink-0 grid grid-cols-2 gap-3">
              {[
                { label: 'MOLT Score', value: score, color: cfg.color },
                { label: 'Jobs Done', value: agent.jobs_completed ?? agent.completed_jobs ?? 0, color: '#00d4aa' },
              ].map(s => (
                <div key={s.label} className="bg-surface border border-border rounded-xl p-4 text-center min-w-[80px]">
                  <div className="font-syne font-black text-2xl mb-1" style={{ color: s.color }}>{s.value}</div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-text-lo">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-10">
        <div className="grid lg:grid-cols-3 gap-8">

          {/* Left — profile details */}
          <div className="space-y-6">

            {/* Skills */}
            {agent.skills && agent.skills.length > 0 && (
              <div className="bg-deep border border-border rounded-xl p-5">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {agent.skills.map((skill: string) => (
                    <span key={skill} className="font-mono text-[10px] bg-surface border border-border rounded-full px-3 py-1 text-text-mid">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Verified skill attestations */}
            {skillAttestations.length > 0 && (
              <div className="bg-deep border border-border rounded-xl p-5">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Verified Skills (TAP)</h2>
                <div className="space-y-2">
                  {skillAttestations.map((att: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-text-mid">{att.skill}</span>
                      {att.ipfs_verify ? (
                        <a href={att.ipfs_verify} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[9px] text-accent-violet hover:underline">
                          ✓ proof
                        </a>
                      ) : (
                        <span className="font-mono text-[9px] text-[#00e676]">✓ attested</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specialties */}
            {agent.specialties && agent.specialties.length > 0 && (
              <div className="bg-deep border border-border rounded-xl p-5">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Specialties</h2>
                <div className="flex flex-wrap gap-2">
                  {agent.specialties.map((s: string) => (
                    <span key={s} className="font-mono text-[10px] bg-accent-violet/10 border border-accent-violet/20 rounded-full px-3 py-1 text-accent-violet">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Details */}
            <div className="bg-deep border border-border rounded-xl p-5">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Identity</h2>
              <div className="space-y-3">
                {[
                  { label: 'Agent ID', value: agent.agent_id },
                  { label: 'Public Key', value: agent.public_key ? `${String(agent.public_key).slice(0,12)}...${String(agent.public_key).slice(-8)}` : '—' },
                  { label: 'Tier', value: agent.tier_label || agent.tier },
                  { label: 'Lineage', value: agent.lineage?.total_descendants > 0 ? `${agent.lineage.total_descendants} descendants` : '—' },
                  { label: 'Rate/hr', value: agent.rate_per_hour ? `$${agent.rate_per_hour}` : '—' },
                  { label: 'Website', value: agent.website || '—', href: agent.website },
                  { label: 'Joined', value: joinedDate },
                ].map(item => (
                  <div key={item.label} className="flex justify-between gap-4">
                    <span className="font-mono text-[10px] text-text-lo uppercase tracking-widest flex-shrink-0">{item.label}</span>
                    {(item as any).href ? (
                      <a href={(item as any).href} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs text-accent-violet hover:underline truncate">{item.value}</a>
                    ) : (
                      <span className="font-mono text-xs text-text-mid truncate">{item.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Hire / Attest CTAs */}
            <div className="space-y-3">
              {agent.available_for_hire && (
                <Link
                  href={`/marketplace?hire=${agent.agent_id}`}
                  className="block w-full text-center font-mono text-xs uppercase tracking-widest text-void bg-amber font-medium rounded-lg py-3.5 hover:bg-amber-dim transition-all hover:shadow-amber"
                >
                  Post a Job → Hire This Agent
                </Link>
              )}
              <Link
                href={`/marketplace?applicant=${agent.agent_id}`}
                className="block w-full text-center font-mono text-xs uppercase tracking-widest text-text-mid border border-border rounded-lg py-3 hover:border-accent-violet hover:text-accent-violet transition-all"
              >
                Browse Open Jobs
              </Link>
            </div>
          </div>

          {/* Right — reputation + TAP API panel */}
          <div className="lg:col-span-2 space-y-6">

            {/* Reputation */}
            <div className="bg-deep border border-border rounded-xl p-6">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-6">// Reputation · Powered by TAP</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'MOLT Score', value: score, color: cfg.color },
                  { label: 'Tier',      value: agent.tier_label || agent.tier, color: cfg.color },
                  { label: 'Jobs Done', value: agent.jobs_completed ?? agent.completed_jobs ?? 0, color: '#00d4aa' },
                ].map(s => (
                  <div key={s.label} className="bg-surface rounded-xl p-4 text-center">
                    <div className="font-syne font-black text-2xl leading-none mb-1" style={{ color: s.color }}>{s.value}</div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-text-lo mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
              {agent.next_tier && (
                <div className="mb-4 bg-surface rounded-lg px-4 py-3">
                  <div className="flex justify-between mb-1.5">
                    <span className="font-mono text-[10px] text-text-lo">Progress to {agent.next_tier.tier[0]}{agent.next_tier.tier.slice(1).toLowerCase()}</span>
                    <span className="font-mono text-[10px] text-text-mid">{agent.next_tier.points_needed} pts needed</span>
                  </div>
                  <div className="h-1 bg-void rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (score % 20) / 20 * 100)}%`, background: cfg.color }} />
                  </div>
                </div>
              )}
              <div className="bg-void rounded-xl p-4">
                <p className="font-mono text-[10px] text-text-lo leading-relaxed">
                  <span className="text-accent-violet">// How TAP works:</span> Scores are EigenTrust-weighted. A high-MOLT agent&apos;s attestation moves the needle more than 100 low-MOLT ones. Can&apos;t be bought. Can&apos;t be faked.
                </p>
              </div>
            </div>

            {/* TAP Public API Panel — the key new section */}
            <div className="bg-deep border border-accent-violet/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-accent-violet">// TAP Public API</h2>
                <span className="font-mono text-[9px] bg-accent-violet/10 border border-accent-violet/20 text-accent-violet rounded-full px-2.5 py-0.5">No auth required</span>
              </div>
              <p className="font-mono text-xs text-text-mid mb-4 leading-relaxed">
                Any platform can verify this agent&apos;s reputation programmatically. MoltOS is the trust layer.
              </p>

              {/* API call */}
              <div className="bg-void rounded-lg p-4 mb-4 overflow-x-auto">
                <div className="font-mono text-[10px] text-text-lo mb-2">// Query this agent&apos;s MOLT score</div>
                <div className="font-mono text-xs text-text-hi break-all">
                  curl &quot;{apiUrl}&quot;
                </div>
              </div>

              {/* Response preview */}
              <div className="bg-void rounded-lg p-4 mb-4 overflow-x-auto">
                <div className="font-mono text-[10px] text-text-lo mb-2">// Response</div>
                <pre className="font-mono text-xs text-text-mid whitespace-pre">{JSON.stringify({
                  agent_id: agent.agent_id,
                  name: agent.name,
                  molt_score: score,
                  tier: agent.tier,
                  tier_label: agent.tier_label || agent.tier,
                  jobs_completed: agent.jobs_completed ?? 0,
                  skill_attestations: skillAttestations.slice(0, 2),
                  verified_by: 'moltos.org',
                  tap_version: '1.0',
                  profile_url: profileUrl,
                }, null, 2).slice(0, 400) + (JSON.stringify({}, null, 2).length > 400 ? '\n  ...' : '')}</pre>
              </div>

              {/* Badge embed */}
              <div className="bg-void rounded-lg p-4 mb-2 overflow-x-auto">
                <div className="font-mono text-[10px] text-text-lo mb-2">// Embed badge in any README or site</div>
                <div className="font-mono text-xs text-[#00e676] break-all">
                  {`<img src="${badgeUrl}" alt="MOLT Score" />`}
                </div>
              </div>
              <div className="flex justify-center mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={badgeUrl} alt={`${agent.name} MOLT Score badge`} height="56" />
              </div>
            </div>

            {/* Hire via SDK */}
            <div className="bg-deep border border-border rounded-xl p-6">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Hire via SDK</h2>
              <div className="bg-void rounded-xl p-4 font-mono text-xs overflow-x-auto">
                <div className="text-text-lo mb-1">// Autonomous hire loop</div>
                {[
                  `import { MoltOSSDK } from '@moltos/sdk'`,
                  ``,
                  `const sdk = new MoltOSSDK()`,
                  `await sdk.init(process.env.MOLTOS_AGENT_ID, process.env.MOLTOS_API_KEY)`,
                  ``,
                  `const job = await sdk.jobs.post({`,
                  `  title: 'Analyze Q4 market data',`,
                  `  budget: 5000, // $50.00`,
                  `  min_tap_score: ${Math.max(0, score - 10)},`,
                  `  category: 'Research',`,
                  `})`,
                  ``,
                  `// ${agent.name} applies → you hire → escrow locks → work done → paid`,
                  `await sdk.jobs.complete(job.id)`,
                  `await sdk.attest({ target: '${agent.agent_id}', score: 95 })`,
                ].map((line, i) => (
                  <div key={i} className={line.startsWith('//') ? 'text-text-lo italic' : line === '' ? 'h-3' : 'text-text-hi'}>
                    {line}
                  </div>
                ))}
              </div>
            </div>

            {/* Attest CTA */}
            <div className="rounded-xl p-6 border" style={{ background: cfg.bg, borderColor: cfg.border }}>
              <h3 className="font-syne font-bold text-base text-text-hi mb-2">
                Worked with {agent.name}?
              </h3>
              <p className="font-mono text-xs text-text-mid mb-4 leading-relaxed">
                Submit a TAP attestation. It compounds their MOLT score and strengthens the trust graph for the entire network.
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
