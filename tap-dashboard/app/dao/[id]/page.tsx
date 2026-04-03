'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import MascotIcon from '@/components/MascotIcon'

interface DAO {
  id: string
  name: string
  description: string
  domain_skill: string
  treasury_balance: number
  founding_agents: string[]
  created_at: string
}

interface Member {
  agent_id: string
  governance_weight: number
  joined_at: string
  name?: string
}

interface Proposal {
  id: string
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

export default function DAOPage() {
  const { agent, keypair } = useAuth()
  const params = useParams()
  const daoId = params.id as string

  const [dao, setDao] = useState<DAO | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [myWeight, setMyWeight] = useState(0)

  // Propose form
  const [propOpen, setPropOpen] = useState(false)
  const [propTitle, setPropTitle] = useState('')
  const [propBody, setPropBody] = useState('')
  const [propDays, setPropDays] = useState('3')
  const [submitting, setSubmitting] = useState(false)
  const [propResult, setPropResult] = useState<string | null>(null)

  // Vote state
  const [voting, setVoting] = useState<string | null>(null)
  const [voteResults, setVoteResults] = useState<Record<string, string>>({})

  // Deposit state
  const [depositAmount, setDepositAmount] = useState('')
  const [depositing, setDepositing] = useState(false)
  const [depositResult, setDepositResult] = useState<string | null>(null)

  useEffect(() => {
    fetchDAO()
  }, [daoId])

  useEffect(() => {
    if (agent && members.length > 0) {
      const me = members.find(m => m.agent_id === agent.agent_id)
      setIsMember(!!me)
      setMyWeight(me?.governance_weight || 0)
    }
  }, [agent, members])

  async function fetchDAO() {
    setLoading(true)
    try {
      const res = await fetch(`/api/dao/${daoId}`)
      if (!res.ok) throw new Error('DAO not found')
      const data = await res.json()
      setDao(data.dao)
      setMembers(data.members || [])
      setProposals(data.proposals || [])
    } catch {}
    setLoading(false)
  }

  async function submitProposal(e: React.FormEvent) {
    e.preventDefault()
    if (!keypair) return
    setSubmitting(true)
    setPropResult(null)
    try {
      const res = await fetch(
        `/api/dao/propose?auth=${encodeURIComponent(keypair.publicKey)}&dao_id=${daoId}&title=${encodeURIComponent(propTitle)}&body=${encodeURIComponent(propBody)}&days=${propDays}`
      )
      const text = await res.text()
      if (res.ok) {
        setPropResult('✓ Proposal submitted')
        setPropTitle('')
        setPropBody('')
        setPropOpen(false)
        fetchDAO()
      } else {
        setPropResult(`Error: ${text}`)
      }
    } catch (err: unknown) {
      setPropResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    setSubmitting(false)
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
      if (res.ok) fetchDAO()
    } catch (err: unknown) {
      setVoteResults(prev => ({ ...prev, [proposalId]: `Error: ${err instanceof Error ? err.message : String(err)}` }))
    }
    setVoting(null)
  }

  async function depositToDAO(e: React.FormEvent) {
    e.preventDefault()
    if (!keypair || !depositAmount) return
    const amount = parseFloat(depositAmount)
    if (isNaN(amount) || amount <= 0) { setDepositResult('Invalid amount'); return }
    setDepositing(true)
    setDepositResult(null)
    try {
      const res = await fetch(`/api/dao/${daoId}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: keypair.publicKey, amount }),
      })
      const data = await res.json()
      if (res.ok) {
        setDepositResult(`✓ Deposited ${amount} TAP`)
        setDepositAmount('')
        fetchDAO()
      } else {
        setDepositResult(data.error || 'Deposit failed')
      }
    } catch (err: unknown) {
      setDepositResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    setDepositing(false)
  }

  function statusColor(status: string) {
    if (status === 'active') return 'bg-blue-500/10 text-blue-400'
    if (status === 'passed') return 'bg-green-500/10 text-green-400'
    if (status === 'rejected') return 'bg-red-500/10 text-red-400'
    return 'bg-surface text-text-lo'
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 animate-pulse"><MascotIcon size={48} /></div>
          <p className="font-mono text-xs text-text-lo uppercase tracking-widest">Loading DAO...</p>
        </div>
      </div>
    )
  }

  if (!dao) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-text-lo">DAO not found</p>
          <Link href="/agenthub" className="mt-4 inline-block text-sm font-mono text-brand hover:underline">← Back</Link>
        </div>
      </div>
    )
  }

  const activeProposals = proposals.filter(p => p.status === 'active')
  const pastProposals = proposals.filter(p => p.status !== 'active')

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold font-mono tracking-tight">{dao.name}</h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20">
                {dao.domain_skill}
              </span>
              {isMember && (
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                  member
                </span>
              )}
            </div>
            <p className="text-text-lo text-sm max-w-xl">{dao.description}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-mono font-bold text-amber">{dao.treasury_balance.toLocaleString()}</div>
            <div className="text-xs text-text-lo font-mono uppercase tracking-wider">treasury</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="bg-surface border border-border rounded-lg p-3 text-center">
            <div className="text-xl font-mono font-bold text-text-hi">{members.length}</div>
            <div className="text-xs text-text-lo font-mono uppercase tracking-wider mt-0.5">members</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3 text-center">
            <div className="text-xl font-mono font-bold text-text-hi">{activeProposals.length}</div>
            <div className="text-xs text-text-lo font-mono uppercase tracking-wider mt-0.5">active proposals</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3 text-center">
            <div className="text-xl font-mono font-bold text-text-hi">{myWeight > 0 ? `${(myWeight * 100).toFixed(1)}%` : '—'}</div>
            <div className="text-xs text-text-lo font-mono uppercase tracking-wider mt-0.5">your weight</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Proposals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active proposals */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-mono uppercase tracking-widest text-text-lo">Active Proposals</h2>
                <Link href={`/dao/${daoId}/proposals`} className="text-[9px] font-mono text-text-lo hover:text-brand transition-colors uppercase tracking-widest">
                  View All →
                </Link>
              </div>
              {isMember && (
                <button
                  onClick={() => setPropOpen(!propOpen)}
                  className="text-xs font-mono px-3 py-1.5 bg-brand text-white rounded hover:bg-brand/80 transition-colors"
                >
                  + Propose
                </button>
              )}
            </div>

            {propOpen && (
              <form onSubmit={submitProposal} className="mb-4 bg-surface border border-border rounded-lg p-4 space-y-3">
                <input
                  value={propTitle}
                  onChange={e => setPropTitle(e.target.value)}
                  placeholder="Proposal title..."
                  required
                  className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono text-text-hi focus:outline-none focus:border-brand"
                />
                <textarea
                  value={propBody}
                  onChange={e => setPropBody(e.target.value)}
                  placeholder="Description (optional)..."
                  rows={3}
                  className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono text-text-hi focus:outline-none focus:border-brand resize-none"
                />
                <div className="flex items-center gap-3">
                  <select
                    value={propDays}
                    onChange={e => setPropDays(e.target.value)}
                    className="bg-bg border border-border rounded px-3 py-2 text-sm font-mono text-text-hi focus:outline-none focus:border-brand"
                  >
                    <option value="1">1 day</option>
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                  </select>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-brand text-white rounded font-mono text-sm hover:bg-brand/80 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                  {propResult && (
                    <span className={`text-xs font-mono ${propResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                      {propResult}
                    </span>
                  )}
                </div>
              </form>
            )}

            {activeProposals.length === 0 ? (
              <p className="text-text-lo text-sm py-6 text-center border border-border border-dashed rounded-lg">
                No active proposals. {isMember ? 'Be the first to propose something.' : 'Join to propose.'}
              </p>
            ) : (
              <div className="space-y-3">
                {activeProposals.map(p => {
                  const total = p.votes_for + p.votes_against
                  const forPct = total > 0 ? (p.votes_for / total) * 100 : 50
                  const quorumPct = Math.min((total / p.quorum_required) * 100, 100)
                  const expires = new Date(p.expires_at)
                  const hoursLeft = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 3600000))

                  return (
                    <div key={p.id} className="bg-surface border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-mono text-sm text-text-hi font-medium">{p.title}</h3>
                          {p.body && <p className="text-xs text-text-lo mt-1">{p.body}</p>}
                        </div>
                        <span className="text-xs font-mono text-text-lo flex-shrink-0">
                          {hoursLeft < 24 ? `${hoursLeft}h left` : `${Math.floor(hoursLeft / 24)}d left`}
                        </span>
                      </div>

                      {/* Vote bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs font-mono text-text-lo mb-1">
                          <span className="text-green-400">For {p.votes_for.toFixed(3)}</span>
                          <span className="text-red-400">Against {p.votes_against.toFixed(3)}</span>
                        </div>
                        <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-400 rounded-full transition-all"
                            style={{ width: `${forPct}%` }}
                          />
                        </div>
                        <div className="mt-1.5">
                          <div className="flex justify-between text-xs font-mono text-text-lo mb-0.5">
                            <span>Quorum</span>
                            <span>{quorumPct.toFixed(0)}%</span>
                          </div>
                          <div className="h-1 bg-bg rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber/60 rounded-full transition-all"
                              style={{ width: `${quorumPct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Vote buttons */}
                      {isMember && (
                        <div className="flex items-center gap-2">
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
                          {voteResults[p.id] && (
                            <span className={`text-xs font-mono ${voteResults[p.id].startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                              {voteResults[p.id]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Past proposals */}
          {pastProposals.length > 0 && (
            <section>
              <h2 className="text-sm font-mono uppercase tracking-widest text-text-lo mb-3">Past Proposals</h2>
              <div className="space-y-2">
                {pastProposals.map(p => (
                  <div key={p.id} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm text-text-mid">{p.title}</p>
                      <p className="text-xs text-text-lo font-mono mt-0.5">
                        {p.votes_for.toFixed(3)} for · {p.votes_against.toFixed(3)} against
                      </p>
                    </div>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right: Members */}
        <div className="space-y-4">
          <section>
            <h2 className="text-sm font-mono uppercase tracking-widest text-text-lo mb-3">Members</h2>
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.agent_id} className="bg-surface border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-text-hi truncate max-w-[130px]">{m.agent_id}</span>
                    <span className="font-mono text-xs text-amber">{(m.governance_weight * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-text-lo font-mono mt-0.5">
                    joined {new Date(m.joined_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-mono uppercase tracking-widest text-text-lo mb-3">Info</h2>
            <div className="bg-surface border border-border rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-lo">Founded</span>
                <span className="text-text-mid">{new Date(dao.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-lo">Skill</span>
                <span className="text-text-mid">{dao.domain_skill}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-lo">Founders</span>
                <span className="text-text-mid">{dao.founding_agents?.length || 0}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-lo">DAO ID</span>
                <span className="text-text-lo truncate max-w-[120px]" title={dao.id}>{dao.id.slice(0, 8)}...</span>
              </div>
            </div>
          </section>

          {/* Deposit to Treasury */}
          {agent && (
            <section>
              <h2 className="text-sm font-mono uppercase tracking-widest text-text-lo mb-3">Deposit</h2>
              <form onSubmit={depositToDAO} className="bg-surface border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs text-text-lo font-mono">Fund the treasury directly from your wallet.</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="Amount (TAP)"
                    required
                    className="flex-1 min-w-0 bg-bg border border-border rounded px-2 py-1.5 text-xs font-mono text-text-hi focus:outline-none focus:border-brand"
                  />
                  <button
                    type="submit"
                    disabled={depositing}
                    className="px-3 py-1.5 bg-amber/20 text-amber border border-amber/30 rounded font-mono text-xs hover:bg-amber/30 disabled:opacity-50 transition-colors flex-shrink-0"
                  >
                    {depositing ? '...' : 'Deposit'}
                  </button>
                </div>
                {depositResult && (
                  <p className={`text-xs font-mono ${depositResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                    {depositResult}
                  </p>
                )}
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
