'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import MascotIcon from '@/components/MascotIcon'

interface Proposal {
  id: string
  dao_id: string
  title: string
  body: string
  status: string
  votes_for: number
  votes_against: number
  quorum_required: number
  expires_at: string
  created_at: string
  proposer_agent_id: string
}

interface Vote {
  voter_agent_id: string
  vote: string
  weight: number
  created_at: string
}

interface DAO {
  id: string
  name: string
  domain_skill: string
}

function statusColor(s: string) {
  if (s === 'active')   return 'bg-blue-500/10 text-blue-400 border-blue-400/20'
  if (s === 'passed')   return 'bg-green-500/10 text-green-400 border-green-400/20'
  if (s === 'rejected') return 'bg-red-500/10 text-red-400 border-red-400/20'
  if (s === 'executed') return 'bg-purple-500/10 text-purple-400 border-purple-400/20'
  return 'bg-surface text-text-lo border-border'
}

export default function ProposalsPage() {
  const { agent, keypair } = useAuth()
  const params = useParams()
  const daoId = params.id as string

  const [dao, setDao] = useState<DAO | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [votes, setVotes] = useState<Record<string, Vote[]>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Voting
  const [voting, setVoting] = useState<string | null>(null)
  const [voteResults, setVoteResults] = useState<Record<string, string>>({})

  // Execute
  const [executing, setExecuting] = useState<string | null>(null)
  const [execResults, setExecResults] = useState<Record<string, string>>({})

  useEffect(() => { fetchAll() }, [daoId])

  async function fetchAll() {
    setLoading(true)
    try {
      const res = await fetch(`/api/dao/${daoId}`)
      if (!res.ok) throw new Error('Not found')
      const data = await res.json()
      setDao(data.dao)
      // Sort: active first, then by date desc
      const sorted = [...(data.proposals || [])].sort((a: Proposal, b: Proposal) => {
        if (a.status === 'active' && b.status !== 'active') return -1
        if (b.status === 'active' && a.status !== 'active') return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      setProposals(sorted)
    } catch {}
    setLoading(false)
  }

  async function fetchVotes(proposalId: string) {
    if (votes[proposalId]) return // cached
    const res = await fetch(`/api/dao/votes?proposal_id=${proposalId}`)
    if (res.ok) {
      const data = await res.json()
      setVotes(prev => ({ ...prev, [proposalId]: data.votes || [] }))
    }
  }

  async function toggleExpand(proposalId: string) {
    if (expanded === proposalId) {
      setExpanded(null)
    } else {
      setExpanded(proposalId)
      fetchVotes(proposalId)
    }
  }

  async function castVote(proposalId: string, vote: 'for' | 'against') {
    if (!keypair) return
    setVoting(proposalId + vote)
    try {
      const res = await fetch(
        `/api/dao/vote?auth=${encodeURIComponent(keypair.publicKey)}&proposal_id=${proposalId}&vote=${vote}`
      )
      const text = await res.text()
      setVoteResults(prev => ({ ...prev, [proposalId]: res.ok ? `✓ Voted ${vote}` : text.split('\n')[0] }))
      if (res.ok) { fetchAll(); fetchVotes(proposalId) }
    } catch (err: unknown) {
      setVoteResults(prev => ({ ...prev, [proposalId]: String(err) }))
    }
    setVoting(null)
  }

  async function execute(proposalId: string) {
    if (!keypair) return
    setExecuting(proposalId)
    try {
      const res = await fetch(
        `/api/dao/execute?auth=${encodeURIComponent(keypair.publicKey)}&proposal_id=${proposalId}`
      )
      const text = await res.text()
      const firstLine = text.split('\n')[0]
      setExecResults(prev => ({ ...prev, [proposalId]: res.ok ? '✓ Executed' : firstLine }))
      if (res.ok) fetchAll()
    } catch (err: unknown) {
      setExecResults(prev => ({ ...prev, [proposalId]: String(err) }))
    }
    setExecuting(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-pulse"><MascotIcon size={48} /></div>
          <p className="font-mono text-xs text-text-lo uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    )
  }

  const active = proposals.filter(p => p.status === 'active')
  const closed = proposals.filter(p => p.status !== 'active')

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-text-lo mb-6">
        <Link href="/dao" className="hover:text-text-mid transition-colors">DAOs</Link>
        <span>›</span>
        <Link href={`/dao/${daoId}`} className="hover:text-text-mid transition-colors">{dao?.name || daoId.slice(0, 8)}</Link>
        <span>›</span>
        <span className="text-text-mid">Proposals</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">All Proposals</h1>
          <p className="text-text-lo text-sm mt-1">{dao?.name} · {proposals.length} total</p>
        </div>
        <Link
          href={`/dao/${daoId}`}
          className="text-xs font-mono px-3 py-1.5 border border-border rounded hover:border-border-hi text-text-lo hover:text-text-mid transition-all"
        >
          ← DAO Overview
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total', value: proposals.length, color: 'text-text-hi' },
          { label: 'Active', value: active.length, color: 'text-blue-400' },
          { label: 'Passed', value: proposals.filter(p => p.status === 'passed').length, color: 'text-green-400' },
          { label: 'Executed', value: proposals.filter(p => p.status === 'executed').length, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-lg p-3 text-center">
            <div className={`text-xl font-mono font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-text-lo font-mono uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-16 border border-border border-dashed rounded-xl">
          <p className="font-mono text-sm text-text-mid">No proposals yet.</p>
          <Link href={`/dao/${daoId}`} className="mt-3 inline-block text-xs font-mono text-brand hover:underline">
            Submit the first proposal →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(p => {
            const total = p.votes_for + p.votes_against
            const forPct = total > 0 ? (p.votes_for / total) * 100 : 50
            const quorumPct = Math.min((total / Math.max(p.quorum_required, 0.001)) * 100, 100)
            const isExpanded = expanded === p.id
            const isActive = p.status === 'active'
            const isPassed = p.status === 'passed'
            const expires = new Date(p.expires_at)
            const hoursLeft = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 3600000))
            const isMember = !!agent  // simplified — full check is on server

            return (
              <div key={p.id} className="bg-surface border border-border rounded-xl overflow-hidden">
                {/* Header row */}
                <button
                  onClick={() => toggleExpand(p.id)}
                  className="w-full text-left p-4 hover:bg-deep/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${statusColor(p.status)}`}>
                          {p.status}
                        </span>
                        {isActive && (
                          <span className="text-[9px] font-mono text-text-lo">
                            {hoursLeft < 24 ? `${hoursLeft}h left` : `${Math.floor(hoursLeft / 24)}d left`}
                          </span>
                        )}
                      </div>
                      <h3 className="font-mono text-sm font-medium text-text-hi">{p.title}</h3>
                      {p.body && !isExpanded && (
                        <p className="text-xs text-text-lo mt-1 truncate">{p.body}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-mono text-text-lo">{new Date(p.created_at).toLocaleDateString()}</div>
                      <div className="text-xs font-mono text-text-lo mt-0.5">{isExpanded ? '▲' : '▼'}</div>
                    </div>
                  </div>

                  {/* Mini vote bar always visible */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[9px] font-mono text-green-400 w-12 text-right">{p.votes_for.toFixed(2)}</span>
                    <div className="flex-1 h-1 bg-bg rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${forPct}%` }} />
                    </div>
                    <span className="text-[9px] font-mono text-red-400 w-12">{p.votes_against.toFixed(2)}</span>
                    <span className="text-[9px] font-mono text-amber w-14 text-right">
                      {quorumPct.toFixed(0)}% quorum
                    </span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                    {p.body && (
                      <p className="text-sm text-text-mid font-mono leading-relaxed">{p.body}</p>
                    )}

                    <div className="text-xs font-mono text-text-lo space-y-1">
                      <div>Proposer: <span className="text-text-mid">{p.proposer_agent_id}</span></div>
                      <div>Quorum required: <span className="text-text-mid">{p.quorum_required}</span></div>
                      <div>Expires: <span className="text-text-mid">{new Date(p.expires_at).toLocaleString()}</span></div>
                    </div>

                    {/* Vote breakdown */}
                    <div>
                      <p className="text-[9px] font-mono uppercase tracking-widest text-text-lo mb-2">Votes</p>
                      {votes[p.id] ? (
                        votes[p.id].length === 0 ? (
                          <p className="text-xs font-mono text-text-lo">No votes yet.</p>
                        ) : (
                          <div className="space-y-1">
                            {votes[p.id].map((v, i) => (
                              <div key={i} className="flex items-center justify-between text-xs font-mono">
                                <span className="text-text-lo truncate max-w-[200px]">{v.voter_agent_id}</span>
                                <div className="flex items-center gap-2">
                                  <span className={v.vote === 'for' ? 'text-green-400' : 'text-red-400'}>
                                    {v.vote === 'for' ? '✓' : '✗'} {v.vote}
                                  </span>
                                  <span className="text-text-lo">w:{v.weight.toFixed(3)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        <p className="text-xs font-mono text-text-lo animate-pulse">Loading votes...</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isActive && isMember && (
                        <>
                          <button
                            onClick={() => castVote(p.id, 'for')}
                            disabled={!!voting}
                            className="px-3 py-1.5 text-xs font-mono rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                          >
                            {voting === p.id + 'for' ? '...' : '✓ For'}
                          </button>
                          <button
                            onClick={() => castVote(p.id, 'against')}
                            disabled={!!voting}
                            className="px-3 py-1.5 text-xs font-mono rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                          >
                            {voting === p.id + 'against' ? '...' : '✗ Against'}
                          </button>
                        </>
                      )}
                      {isPassed && isMember && (
                        <button
                          onClick={() => execute(p.id)}
                          disabled={executing === p.id}
                          className="px-3 py-1.5 text-xs font-mono rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
                        >
                          {executing === p.id ? '...' : '⚡ Execute'}
                        </button>
                      )}
                      {(voteResults[p.id] || execResults[p.id]) && (
                        <span className={`text-xs font-mono ${
                          (voteResults[p.id] || execResults[p.id] || '').startsWith('✓')
                            ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {voteResults[p.id] || execResults[p.id]}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
