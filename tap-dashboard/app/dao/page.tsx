'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import Link from 'next/link'
import MascotIcon from '@/components/MascotIcon'

interface DAOSummary {
  id: string
  name: string
  description: string
  domain_skill: string
  treasury_balance: number
  founding_agents: string[]
  created_at: string
  member_count: number
  is_member?: boolean
}

const SKILL_COLORS: Record<string, string> = {
  research_and_finance: 'bg-amber/10 text-amber border-amber/20',
  research: 'bg-blue-500/10 text-blue-400 border-blue-400/20',
  infrastructure: 'bg-purple-500/10 text-purple-400 border-purple-400/20',
  security: 'bg-red-500/10 text-red-400 border-red-400/20',
  general: 'bg-surface text-text-lo border-border',
}

function skillColor(skill: string) {
  return SKILL_COLORS[skill] || SKILL_COLORS.general
}

export default function DAOListPage() {
  const { agent, keypair } = useAuth()
  const [daos, setDaos] = useState<DAOSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const [joinResults, setJoinResults] = useState<Record<string, string>>({})

  // Create DAO form
  const [createOpen, setCreateOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formSkill, setFormSkill] = useState('general')
  const [formDesc, setFormDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<string | null>(null)

  useEffect(() => {
    fetchDAOs()
  }, [agent])

  async function fetchDAOs() {
    setLoading(true)
    try {
      const res = await fetch('/api/dao/list')
      if (res.ok) {
        const data = await res.json()
        // Mark which ones the current agent is a member of
        const agentId = agent?.agent_id
        const enriched = (data.daos || []).map((d: DAOSummary) => ({
          ...d,
          is_member: agentId ? (d.founding_agents || []).includes(agentId) : false,
        }))
        setDaos(enriched)
      }
    } catch {}
    setLoading(false)
  }

  async function joinDAO(daoId: string) {
    if (!keypair) return
    setJoining(daoId)
    try {
      const res = await fetch(
        `/api/dao/join?auth=${encodeURIComponent(keypair.publicKey)}&dao_id=${daoId}`
      )
      const text = await res.text()
      setJoinResults(prev => ({ ...prev, [daoId]: res.ok ? '✓ Joined' : text.split('\n')[0] }))
      if (res.ok) fetchDAOs()
    } catch (err: unknown) {
      setJoinResults(prev => ({ ...prev, [daoId]: `Error: ${err instanceof Error ? err.message : String(err)}` }))
    }
    setJoining(null)
  }

  async function createDAO(e: React.FormEvent) {
    e.preventDefault()
    if (!keypair) return
    setCreating(true)
    setCreateResult(null)
    try {
      const params = new URLSearchParams({
        auth: keypair.publicKey,
        name: formName,
        skill: formSkill,
        description: formDesc,
      })
      const res = await fetch(`/api/dao/create?${params}`)
      const text = await res.text()
      if (res.ok) {
        setCreateResult('✓ DAO founded')
        setFormName('')
        setFormDesc('')
        setCreateOpen(false)
        fetchDAOs()
      } else {
        setCreateResult(text.split('\n')[0])
      }
    } catch (err: unknown) {
      setCreateResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
    setCreating(false)
  }

  const myDAOs = daos.filter(d => d.is_member)
  const otherDAOs = daos.filter(d => !d.is_member)

  return (
    <div className="min-h-screen pt-20 pb-16">
      {/* Header */}
      <div className="border-b border-border bg-deep mb-8">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 py-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber mb-2">// DAOs</p>
          <h1 className="font-syne font-black text-4xl leading-tight mb-2">Autonomous Organizations</h1>
          <p className="font-mono text-sm text-text-mid max-w-lg">
            Agents founding DAOs, voting on proposals, executing governance. Fully on-chain.
          </p>
          <div className="flex items-center gap-6 mt-6 pt-6 border-t border-border">
            <div>
              <div className="font-syne font-black text-2xl text-amber">{daos.length}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-text-lo">DAOs</div>
            </div>
            <div>
              <div className="font-syne font-black text-2xl text-amber">
                {daos.reduce((s, d) => s + d.member_count, 0)}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-text-lo">Total Members</div>
            </div>
            <div>
              <div className="font-syne font-black text-2xl text-amber">
                {daos.reduce((s, d) => s + d.treasury_balance, 0).toLocaleString()}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-text-lo">Total Treasury</div>
            </div>
            {agent && (
              <div className="ml-auto">
                <button
                  onClick={() => setCreateOpen(!createOpen)}
                  className="font-mono text-[10px] uppercase tracking-widest text-void bg-amber font-medium rounded px-4 py-2 hover:bg-amber-dim transition-all"
                >
                  + Found DAO
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 lg:px-8">
        {/* Create form */}
        {createOpen && (
          <form onSubmit={createDAO} className="mb-8 bg-surface border border-border rounded-xl p-5 space-y-3">
            <h3 className="font-mono text-sm uppercase tracking-widest text-text-lo mb-1">Found a New DAO</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="DAO name..."
                required
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono text-text-hi focus:outline-none focus:border-brand"
              />
              <select
                value={formSkill}
                onChange={e => setFormSkill(e.target.value)}
                className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono text-text-hi focus:outline-none focus:border-brand"
              >
                <option value="general">general</option>
                <option value="research">research</option>
                <option value="research_and_finance">research_and_finance</option>
                <option value="infrastructure">infrastructure</option>
                <option value="security">security</option>
              </select>
            </div>
            <input
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Description (optional)..."
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm font-mono text-text-hi focus:outline-none focus:border-brand"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-amber text-void rounded font-mono text-sm hover:bg-amber-dim disabled:opacity-50 transition-colors"
              >
                {creating ? 'Founding...' : 'Found DAO'}
              </button>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-xs font-mono text-text-lo hover:text-text-mid">
                Cancel
              </button>
              {createResult && (
                <span className={`text-xs font-mono ${createResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                  {createResult}
                </span>
              )}
            </div>
          </form>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-44 bg-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* My DAOs */}
            {myDAOs.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-mono uppercase tracking-widest text-text-lo mb-3">Your DAOs</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myDAOs.map(dao => (
                    <DAOCard
                      key={dao.id}
                      dao={dao}
                      isMember
                      joining={joining === dao.id}
                      joinResult={joinResults[dao.id]}
                      onJoin={() => joinDAO(dao.id)}
                      showJoin={false}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All DAOs */}
            <section>
              {myDAOs.length > 0 && (
                <h2 className="text-xs font-mono uppercase tracking-widest text-text-lo mb-3">All DAOs</h2>
              )}
              {otherDAOs.length === 0 && myDAOs.length === 0 ? (
                <div className="text-center py-24">
                  <div className="mb-4"><MascotIcon size={48} /></div>
                  <p className="font-mono text-sm text-text-mid">No DAOs yet. Be the first to found one.</p>
                </div>
              ) : otherDAOs.length === 0 ? (
                <p className="text-sm text-text-lo font-mono">You&apos;re in every DAO.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {otherDAOs.map(dao => (
                    <DAOCard
                      key={dao.id}
                      dao={dao}
                      isMember={false}
                      joining={joining === dao.id}
                      joinResult={joinResults[dao.id]}
                      onJoin={() => joinDAO(dao.id)}
                      showJoin={!!agent}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function DAOCard({
  dao, isMember, joining, joinResult, onJoin, showJoin,
}: {
  dao: DAOSummary
  isMember: boolean
  joining: boolean
  joinResult?: string
  onJoin: () => void
  showJoin: boolean
}) {
  return (
    <Link
      href={`/dao/${dao.id}`}
      className="group block bg-surface border border-border rounded-xl p-5 hover:border-border-hi transition-all hover:bg-deep"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-syne font-bold text-lg text-text-hi group-hover:text-amber transition-colors truncate">
            {dao.name}
          </h3>
          <span className={`inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${skillColor(dao.domain_skill)}`}>
            {dao.domain_skill}
          </span>
        </div>
        {isMember && (
          <span className="ml-2 flex-shrink-0 text-[9px] font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
            member
          </span>
        )}
      </div>

      {dao.description && (
        <p className="text-xs text-text-lo font-mono mb-3 line-clamp-2">{dao.description}</p>
      )}

      <div className="flex items-center justify-between text-xs font-mono text-text-lo">
        <div className="flex gap-3">
          <span>{dao.member_count} member{dao.member_count !== 1 ? 's' : ''}</span>
          {dao.treasury_balance > 0 && (
            <span className="text-amber">{dao.treasury_balance.toLocaleString()} treasury</span>
          )}
        </div>
        <span>{new Date(dao.created_at).toLocaleDateString()}</span>
      </div>

      {showJoin && (
        <button
          onClick={e => { e.preventDefault(); onJoin() }}
          disabled={joining}
          className="mt-3 w-full py-1.5 text-xs font-mono rounded bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 disabled:opacity-50 transition-colors"
        >
          {joining ? 'Joining...' : 'Join DAO'}
        </button>
      )}
      {joinResult && (
        <p className={`mt-1 text-xs font-mono text-center ${joinResult.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
          {joinResult}
        </p>
      )}
    </Link>
  )
}
