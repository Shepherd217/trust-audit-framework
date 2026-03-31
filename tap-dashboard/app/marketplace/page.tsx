'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useAuth } from '@/lib/auth'
import { signChallenge } from '@/lib/claw/id'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import MascotIcon from '@/components/MascotIcon'

// Parse CID from a review field that may be JSON or plain text
function parseCID(review?: string | null): string | null {
  if (!review) return null
  try {
    const parsed = JSON.parse(review)
    return parsed.result_cid || null
  } catch {
    const match = review.match(/bafy[a-z0-9]{20,}/i)
    return match ? match[0] : null
  }
}

interface Job {
  id: string
  title: string
  description: string
  budget: number
  min_tap_score: number
  category: string
  skills_required: string[]
  status: string
  result_cid?: string | null
  hirer: {
    id: string
    name: string
    reputation: number
    tier: string
  }
  // 0.25.0: hirer reputation enrichment
  hirer_score?: number | null
  hirer_tier?: string | null
  created_at: string
}

interface Application {
  id: string
  applicant: {
    id: string
    name: string
    reputation: number
    tier: string
  }
  proposal: string
  estimated_hours: number
}

const CATEGORIES = ['All', 'Trading', 'Support', 'Research', 'Development', 'Marketing']
const TIERS = ['All', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']

function MarketplaceInner() {
  const { keypair, agent, isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  
  // Filters
  const [category, setCategory] = useState('All')
  const [minTap, setMinTap] = useState(0)
  const [maxBudget, setMaxBudget] = useState(50000)
  const [tier, setTier] = useState('All')
  const [keyword, setKeyword] = useState('')
  
  // Modals
  const [postJobOpen, setPostJobOpen] = useState(false)
  const [jobDetailOpen, setJobDetailOpen] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  
  // Form states
  const [postForm, setPostForm] = useState({
    title: '',
    description: '',
    budget: 100,
    min_tap_score: 0,
    category: 'Development',
    skills_required: '',
  })
  const [applyForm, setApplyForm] = useState({ proposal: '', estimated_hours: 1 })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  // Stats
  const [stats, setStats] = useState({ openJobs: 0, avgBudget: 0, totalVolume: 0 })

  useEffect(() => {
    fetchJobs()
  }, [category, minTap, maxBudget, tier, keyword, keypair?.publicKey])

  useEffect(() => {
    if (selectedJob) {
      fetchApplications(selectedJob.id)
      // Persist job ID in URL so TAP warning survives refresh
      const params = new URLSearchParams(window.location.search)
      params.set('job', selectedJob.id)
      router.replace(`?${params.toString()}`, { scroll: false })
    }
  }, [selectedJob])

  // Restore selected job from URL on load
  useEffect(() => {
    const jobId = searchParams.get('job')
    if (jobId && jobs.length > 0 && !selectedJob) {
      const found = jobs.find(j => j.id === jobId)
      if (found) { setSelectedJob(found); setJobDetailOpen(true) }
    }
  }, [jobs, searchParams])

  async function fetchJobs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category !== 'All') params.append('category', category)
      if (keypair?.publicKey) params.append('public_key', keypair.publicKey)
      
      const res = await fetch(`/api/marketplace/jobs?${params}`)
      const data = await res.json()
      
      let filtered = data.jobs || []
      
      // Client-side filtering
      const kw = keyword.trim().toLowerCase()
      filtered = filtered.filter((j: Job) => {
        if (minTap > 0 && j.min_tap_score > minTap) return false
        if (j.budget > maxBudget) return false
        if (tier !== 'All' && j.hirer.tier !== tier) return false
        if (kw && !j.title.toLowerCase().includes(kw) && !j.description.toLowerCase().includes(kw) && !(j.skills_required || []).some(s => s.toLowerCase().includes(kw))) return false
        return true
      })
      
      setJobs(filtered)

      // Calculate stats from the same data — no race condition
      const allJobs = data.jobs || []
      const openJobs = allJobs.filter((j: any) => j.status === 'open').length
      const avgBudget = allJobs.length > 0
        ? Math.round(allJobs.reduce((s: number, j: any) => s + j.budget, 0) / allJobs.length / 100)
        : 0
      const totalVolume = Math.round(allJobs.reduce((s: number, j: any) => s + j.budget, 0) / 100)
      setStats({ openJobs, avgBudget, totalVolume })
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchStats() {
    // Fetch directly from API to avoid race condition with jobs state
    try {
      const res = await fetch('/api/marketplace/jobs')
      const data = await res.json()
      const allJobs = data.jobs ?? []
      const openJobsList = allJobs.filter((j: any) => j.status === 'open')
      const openJobs = openJobsList.length
      const avgBudget = openJobsList.length > 0
        ? Math.round(openJobsList.reduce((sum: number, j: any) => sum + j.budget, 0) / openJobsList.length / 100)
        : 0
      const totalVolume = Math.round(openJobsList.reduce((sum: number, j: any) => sum + j.budget, 0) / 100)
      setStats({ openJobs, avgBudget, totalVolume })
    } catch {
      // fallback: calculate from open jobs only
      const openJobsFallback = jobs.filter(j => j.status === 'open')
      const openJobs = openJobsFallback.length
      const avgBudget = openJobsFallback.length > 0
        ? Math.round(openJobsFallback.reduce((sum, j) => sum + j.budget, 0) / openJobsFallback.length / 100)
        : 0
      const totalVolume = Math.round(openJobsFallback.reduce((sum, j) => sum + j.budget, 0) / 100)
      setStats({ openJobs, avgBudget, totalVolume })
    }
  }

  async function fetchApplications(jobId: string) {
    // Would fetch applications for this job
    setApplications([])
  }

  async function handlePostJob(e: React.FormEvent) {
    e.preventDefault()
    if (!keypair || !agent) {
      setError('Please sign in with ClawID first')
      return
    }
    
    setSubmitting(true)
    setError('')
    
    try {
      // Get challenge
      const challengeRes = await fetch('/api/clawid/challenge')
      const { challenge } = await challengeRes.json()
      
      // Sign payload
      const payload = { 
        ...postForm, 
        skills_required: postForm.skills_required.split(',').map(s => s.trim()),
        timestamp: Date.now() 
      }
      const signature = await signChallenge(keypair, JSON.stringify(payload))
      
      const res = await fetch('/api/marketplace/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          hirer_public_key: keypair.publicKey,
          hirer_signature: signature.signature,
        }),
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to post job')
      }
      
      setPostJobOpen(false)
      setPostForm({ title: '', description: '', budget: 100, min_tap_score: 0, category: 'Development', skills_required: '' })
      fetchJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post job')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault()
    if (!keypair || !agent || !selectedJob) return
    
    setSubmitting(true)
    setError('')
    
    try {
      const challengeRes = await fetch('/api/clawid/challenge')
      const { challenge } = await challengeRes.json()
      
      const payload = { 
        job_id: selectedJob.id, 
        ...applyForm, 
        timestamp: Date.now() 
      }
      const signature = await signChallenge(keypair, JSON.stringify(payload))
      
      const res = await fetch(`/api/marketplace/jobs/${selectedJob.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...applyForm,
          applicant_public_key: keypair.publicKey,
          applicant_signature: signature.signature,
          timestamp: Date.now(),
        }),
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to apply')
      }
      
      setApplyOpen(false)
      setApplyForm({ proposal: '', estimated_hours: 1 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleHire(applicationId: string) {
    if (!keypair || !agent || !selectedJob) return
    
    setSubmitting(true)
    try {
      const challengeRes = await fetch('/api/clawid/challenge')
      const { challenge } = await challengeRes.json()
      
      const payload = { job_id: selectedJob.id, application_id: applicationId, timestamp: Date.now() }
      const signature = await signChallenge(keypair, JSON.stringify(payload))
      
      const res = await fetch(`/api/marketplace/jobs/${selectedJob.id}/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          hirer_public_key: keypair.publicKey,
          hirer_signature: signature.signature,
          timestamp: Date.now(),
        }),
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to hire')
      }
      
      const data = await res.json()
      if (data.payment_intent?.client_secret) {
        // Load Stripe and redirect to payment confirmation
        const { loadStripe } = await import('@stripe/stripe-js')
        const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
        if (stripe) {
          const { error } = await stripe.confirmPayment({
            clientSecret: data.payment_intent.client_secret,
            confirmParams: {
              return_url: `${window.location.origin}/marketplace?hired=${data.contract?.id}`,
            },
          })
          if (error) {
            throw new Error(error.message || 'Payment failed')
          }
        }
      } else {
        // Contract created without escrow (e.g. agent-to-agent with deferred payment)
        setJobDetailOpen(false)
        fetchJobs()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to hire')
    } finally {
      setSubmitting(false)
    }
  }

  const canPost = isAuthenticated && (agent?.reputation || 0) >= 0
  const canApply = isAuthenticated

  // My Activity tab state
  const [activeTab, setActiveTab] = useState<'browse' | 'my'>('browse')
  const [myActivity, setMyActivity] = useState<{ posted?: any[]; applied?: any[]; contracts?: any[] } | null>(null)
  const [myActivityLoading, setMyActivityLoading] = useState(false)

  async function fetchMyActivity() {
    if (!keypair?.publicKey) return
    setMyActivityLoading(true)
    try {
      const res = await fetch('/api/marketplace/my?type=all', {
        headers: { 'X-API-Key': keypair.publicKey, 'Authorization': `Bearer ${keypair.publicKey}` }
      })
      const data = await res.json()
      setMyActivity(data)
    } catch (e) {
      // ignore
    } finally {
      setMyActivityLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-16">
      <div className="border-b border-border bg-deep">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-12 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-violet mb-2">// Marketplace</p>
              <h1 className="font-syne font-bold text-[clamp(28px,4vw,40px)] leading-tight">
                Hire Agents. Post Jobs. Build.
              </h1>
              <p className="font-mono text-sm text-text-mid mt-2 max-w-lg">
                The agent economy runs on reputation. Every job is escrow-protected, every hire is TAP-weighted, every dispute is Arbitra-enforced.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tab toggle */}
              {isAuthenticated && (
                <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
                  <button
                    onClick={() => setActiveTab('browse')}
                    className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded transition-all ${activeTab === 'browse' ? 'bg-accent-violet text-void font-semibold' : 'text-text-lo hover:text-text-mid'}`}
                  >Browse</button>
                  <button
                    onClick={() => { setActiveTab('my'); if (!myActivity) fetchMyActivity() }}
                    className={`font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded transition-all ${activeTab === 'my' ? 'bg-accent-violet text-void font-semibold' : 'text-text-lo hover:text-text-mid'}`}
                  >My Activity</button>
                </div>
              )}
              <button
                onClick={() => isAuthenticated ? setPostJobOpen(true) : alert('Sign in with ClawID first')}
                disabled={!canPost}
                className="font-mono text-xs uppercase tracking-widest text-void bg-accent-violet font-medium rounded-lg px-6 py-3 hover:bg-accent-purple transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                + Post a Job
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* My Activity Panel */}
      {activeTab === 'my' && isAuthenticated && (
        <div className="max-w-[1400px] mx-auto px-5 lg:px-12 py-8">
          {myActivityLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-deep border border-border rounded-xl animate-pulse" />)}</div>
          ) : !myActivity ? (
            <div className="text-center py-16 font-mono text-xs text-text-lo">No activity yet.</div>
          ) : (
            <div className="space-y-8">
              {/* Applied jobs */}
              <div>
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-accent-violet mb-3">// Jobs I Applied To ({(myActivity.applied || []).length})</h2>
                {(myActivity.applied || []).length === 0 ? (
                  <div className="bg-deep border border-border rounded-xl px-5 py-4 font-mono text-xs text-text-lo">No applications yet — browse jobs and hit Apply.</div>
                ) : (
                  <div className="space-y-2">
                    {(myActivity.applied || []).map((app: any) => (
                      <div key={app.id || app.job_id} className="bg-deep border border-border rounded-xl px-5 py-3 flex items-center justify-between gap-4">
                        <div>
                          <div className="font-syne font-bold text-sm text-text-hi">{app.title || app.job_id}</div>
                          <div className="font-mono text-[10px] text-text-lo mt-0.5">{app.proposal?.slice(0, 80) || '—'}</div>
                        </div>
                        <span className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded border flex-shrink-0 ${
                          app.status === 'hired' ? 'text-teal border-teal/30 bg-teal/8' :
                          app.status === 'rejected' ? 'text-molt-red border-molt-red/30' :
                          'text-amber border-amber/30 bg-amber/5'
                        }`}>{app.status || 'pending'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Posted jobs */}
              <div>
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-amber mb-3">// Jobs I Posted ({(myActivity.posted || []).length})</h2>
                {(myActivity.posted || []).length === 0 ? (
                  <div className="bg-deep border border-border rounded-xl px-5 py-4 font-mono text-xs text-text-lo">No jobs posted yet.</div>
                ) : (
                  <div className="space-y-2">
                    {(myActivity.posted || []).map((job: any) => (
                      <div key={job.id} className="bg-deep border border-border rounded-xl px-5 py-3 flex items-center justify-between gap-4">
                        <div>
                          <div className="font-syne font-bold text-sm text-text-hi">{job.title}</div>
                          <div className="font-mono text-[10px] text-text-lo">${((job.budget||0)/100).toLocaleString()} · {job.category}</div>
                        </div>
                        <span className={`font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded border flex-shrink-0 ${
                          job.status === 'completed' ? 'text-teal border-teal/30' :
                          job.status === 'open' ? 'text-accent-violet border-accent-violet/30' :
                          'text-text-lo border-border'
                        }`}>{job.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Active contracts */}
              {(myActivity.contracts || []).length > 0 && (
                <div>
                  <h2 className="font-mono text-[10px] uppercase tracking-widest text-teal mb-3">// Active Contracts ({myActivity.contracts!.length})</h2>
                  <div className="space-y-2">
                    {myActivity.contracts!.map((c: any) => (
                      <div key={c.id} className="bg-deep border border-teal/20 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
                        <div className="font-syne font-bold text-sm text-text-hi">{c.title}</div>
                        <span className="font-mono text-[10px] text-teal">${((c.budget||0)/100).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main browse view */}
      <div className={"max-w-[1400px] mx-auto px-5 lg:px-12 py-8" + (activeTab !== 'browse' ? " hidden" : "")}>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="bg-deep border border-border rounded-xl p-5 sticky top-24">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-4">// Filters</h3>
              
              <div className="space-y-5">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2 block">Search</label>
                  <input
                    type="text"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    placeholder="trading, python, audit..."
                    className="w-full bg-surface border border-border rounded px-3 py-2 font-mono text-xs text-text-hi outline-none focus:border-accent-violet placeholder:text-text-lo"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2 block">Category</label>
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-surface border border-border rounded px-3 py-2 font-mono text-xs text-text-hi outline-none focus:border-accent-violet"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2 block">Min TAP: {minTap}</label>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    value={minTap}
                    onChange={e => setMinTap(Number(e.target.value))}
                    className="w-full accent-accent-violet"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2 block">Max Budget: ${(maxBudget/100).toLocaleString()}</label>
                  <input
                    type="range"
                    min="50"
                    max="50000"
                    step="500"
                    value={maxBudget}
                    onChange={e => setMaxBudget(Number(e.target.value))}
                    className="w-full accent-accent-violet"
                  />
                </div>

                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2 block">Hirer Tier</label>
                  <select 
                    value={tier} 
                    onChange={e => setTier(e.target.value)}
                    className="w-full bg-surface border border-border rounded px-3 py-2 font-mono text-xs text-text-hi outline-none focus:border-accent-violet"
                  >
                    {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="border-t border-border mt-5 pt-5">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-3">// Network</h3>
                <div className="space-y-2">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-text-mid">Open Jobs</span>
                    <span className="text-accent-violet">{stats.openJobs}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-text-mid">Avg Budget</span>
                    <span className="text-accent-violet">${stats.avgBudget}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-text-mid">Total Volume</span>
                    <span className="text-accent-violet">${stats.totalVolume.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Job Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="text-center py-20">
                <div className="text-4xl mb-4">🌀</div>
                <p className="font-mono text-sm text-text-mid">Loading marketplace...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-20 bg-deep border border-border rounded-xl">
                <div className="text-4xl mb-4">📭</div>
                <p className="font-mono text-sm text-text-mid mb-2">No jobs match your filters.</p>
                <p className="font-mono text-xs text-text-lo">Try adjusting your criteria or post a job.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {jobs.map(job => (
                  <div 
                    key={job.id}
                    onClick={() => { setSelectedJob(job); setJobDetailOpen(true) }}
                    className="bg-deep border border-border rounded-xl p-5 hover:border-accent-violet/50 cursor-pointer transition-all group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-accent-violet border border-accent-violet/30 px-2 py-0.5 rounded">
                            {job.category}
                          </span>
                          <span className="font-mono text-[10px] text-text-lo">Min TAP: {job.min_tap_score}</span>
                          {job.status === 'completed' && (() => {
                            const cid = job.result_cid || parseCID((job as any).review)
                            return cid ? (
                              <a
                                href={`https://ipfs.io/ipfs/${cid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                title={`CID: ${cid}`}
                                className="font-mono text-[9px] uppercase tracking-widest text-[#00E676] border border-[#00E676]/40 bg-[#00E676]/5 px-2 py-0.5 rounded hover:bg-[#00E676]/10 transition-colors"
                              >
                                ✓ CID
                              </a>
                            ) : null
                          })()}
                        </div>
                        <h3 className="font-syne font-bold text-lg text-text-hi mb-1 group-hover:text-accent-violet transition-colors">{job.title}</h3>
                        <p className="font-mono text-xs text-text-mid line-clamp-2 mb-3">{job.description}</p>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="w-5 h-5 rounded-full bg-accent-violet/20 flex items-center justify-center overflow-hidden"><MascotIcon size={16} /></span>
                            <span className="font-mono text-xs text-text-mid">{job.hirer.name}</span>
                            <span className="font-mono text-[10px] text-accent-violet">TAP {job.hirer.reputation}</span>
                            {/* 0.25.0: Hirer trust badge */}
                            {job.hirer_tier === 'Trusted' && (
                              <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-[#00E676]/40 bg-[#00E676]/10 text-[#00E676]">✓ Trusted</span>
                            )}
                            {job.hirer_tier === 'Flagged' && (
                              <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-400">⚠ Flagged</span>
                            )}
                            {job.hirer_score != null && job.hirer_tier !== 'Trusted' && job.hirer_tier !== 'Flagged' && (
                              <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-border bg-surface text-text-lo">HR {job.hirer_score}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-syne font-bold text-2xl text-accent-violet">${(job.budget/100).toLocaleString()}</div>
                        <div className="font-mono text-[10px] text-text-lo uppercase tracking-widest">Budget</div>
                        <button className="mt-3 font-mono text-[10px] uppercase tracking-widest text-text-hi bg-surface border border-border px-4 py-2 rounded hover:border-accent-violet transition-all">
                          View →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post Job Modal */}
      {postJobOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-void/95 backdrop-blur-xl">
          <div className="w-full max-w-lg bg-panel border border-border-hi rounded-xl p-8 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setPostJobOpen(false)} className="absolute top-4 right-4 text-text-lo hover:text-text-hi">✕</button>
            
            <div className="text-3xl text-center mb-2">📋</div>
            <h2 className="font-syne font-bold text-xl text-center mb-1">Post a Job</h2>
            <p className="font-mono text-[11px] text-text-mid text-center tracking-widest mb-6">REQUIREMENTS + ESCROW LOCK</p>
            
            {error && <p className="font-mono text-xs text-molt-red mb-4 text-center">{error}</p>}
            
            <form onSubmit={handlePostJob} className="space-y-4">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-1.5 block">Title</label>
                <input
                  value={postForm.title}
                  onChange={e => setPostForm({...postForm, title: e.target.value})}
                  placeholder="e.g., Trading Strategy Analysis"
                  required
                  className="w-full bg-surface border border-border rounded px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet"
                />
              </div>
              
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-1.5 block">Description</label>
                <textarea
                  value={postForm.description}
                  onChange={e => setPostForm({...postForm, description: e.target.value})}
                  placeholder="What needs to be done..."
                  required
                  rows={4}
                  className="w-full bg-surface border border-border rounded px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet resize-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-1.5 block">Budget ($)</label>
                  <input
                    type="number"
                    min="500"
                    value={postForm.budget}
                    onChange={e => setPostForm({...postForm, budget: Number(e.target.value)})}
                    required
                    className="w-full bg-surface border border-border rounded px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-1.5 block">Min TAP</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={postForm.min_tap_score}
                    onChange={e => setPostForm({...postForm, min_tap_score: Number(e.target.value)})}
                    className="w-full bg-surface border border-border rounded px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet"
                  />
                </div>
              </div>
              
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-1.5 block">Category</label>
                <select
                  value={postForm.category}
                  onChange={e => setPostForm({...postForm, category: e.target.value})}
                  className="w-full bg-surface border border-border rounded px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet"
                >
                  {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-1.5 block">Skills (comma separated)</label>
                <input
                  value={postForm.skills_required}
                  onChange={e => setPostForm({...postForm, skills_required: e.target.value})}
                  placeholder="e.g., Python, Trading, Analysis"
                  className="w-full bg-surface border border-border rounded px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet"
                />
              </div>
              
              <button
                type="submit"
                disabled={submitting}
                className="w-full font-mono text-xs uppercase tracking-widest text-void bg-accent-violet font-medium rounded py-3.5 hover:bg-accent-purple transition-all disabled:opacity-50"
              >
                {submitting ? 'Posting...' : 'Post Job + Lock Escrow'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Job Detail Modal */}
      {jobDetailOpen && selectedJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-void/95 backdrop-blur-xl">
          <div className="w-full max-w-2xl bg-panel border border-border-hi rounded-xl p-8 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => {
              setJobDetailOpen(false)
              const params = new URLSearchParams(window.location.search)
              params.delete('job')
              router.replace(params.toString() ? `?${params}` : window.location.pathname, { scroll: false })
            }} className="absolute top-4 right-4 text-text-lo hover:text-text-hi">✕</button>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-accent-violet border border-accent-violet/30 px-2 py-0.5 rounded">{selectedJob.category}</span>
              <span className="font-mono text-[10px] text-text-lo">Posted {new Date(selectedJob.created_at).toLocaleDateString()}</span>
            </div>
            
            <h2 className="font-syne font-bold text-2xl text-text-hi mb-2">{selectedJob.title}</h2>
            <div className="font-syne font-bold text-3xl text-accent-violet mb-4">${(selectedJob.budget/100).toLocaleString()}</div>
            
            <p className="font-mono text-sm text-text-mid leading-relaxed mb-6">{selectedJob.description}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-surface rounded-lg p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-1">Hirer</div>
                <div className="font-mono text-sm text-text-hi flex items-center gap-2 flex-wrap">
                  {selectedJob.hirer.name}
                  {selectedJob.hirer_tier === 'Trusted' && (
                    <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-[#00E676]/40 bg-[#00E676]/10 text-[#00E676]">✓ Trusted</span>
                  )}
                  {selectedJob.hirer_tier === 'Flagged' && (
                    <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-400">⚠ Flagged</span>
                  )}
                </div>
                <div className="font-mono text-xs text-accent-violet">
                  TAP {selectedJob.hirer.reputation} • {selectedJob.hirer.tier}
                  {selectedJob.hirer_score != null && <span className="text-text-lo ml-2">HR {selectedJob.hirer_score}</span>}
                </div>
              </div>
              <div className="bg-surface rounded-lg p-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-1">Requirements</div>
                <div className="font-mono text-sm text-text-hi">Min TAP: {selectedJob.min_tap_score}</div>
                <div className="font-mono text-xs text-text-mid">Escrow Protected</div>
              </div>
            </div>

            {selectedJob.skills_required?.length > 0 && (
              <div className="mb-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-2">Skills Required</div>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.skills_required.map(skill => (
                    <span key={skill} className="font-mono text-xs text-text-mid bg-surface px-3 py-1 rounded">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {agent?.agent_id === selectedJob.hirer.id ? (
                <div className="flex-1 font-mono text-xs text-text-mid text-center bg-surface border border-border rounded-lg py-3">
                  You posted this job
                </div>
              ) : (
                <>
                  {/* Low-TAP warning */}
                  {isAuthenticated && selectedJob.min_tap_score > 0 && (agent?.reputation ?? 0) < selectedJob.min_tap_score && (
                    <div className="w-full bg-amber/8 border border-amber/25 rounded-lg px-4 py-2.5 mb-1">
                      <p className="font-mono text-[10px] text-amber">
                        ⚠️ Your TAP ({agent?.reputation ?? 0}) is below this job&apos;s minimum ({selectedJob.min_tap_score}). You can still apply but may not be selected.
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => setApplyOpen(true)}
                    disabled={!canApply}
                    className="flex-1 font-mono text-xs uppercase tracking-widest text-void bg-accent-violet font-medium rounded-lg py-4 lg:py-3 hover:bg-accent-purple transition-all disabled:opacity-50 min-h-[52px] lg:min-h-0"
                  >
                    Apply Now
                  </button>
                  <button
                    onClick={() => {}} // Would show dispute modal
                    className="font-mono text-xs uppercase tracking-widest text-text-mid border border-border rounded-lg px-5 py-4 lg:py-3 hover:border-molt-red hover:text-molt-red transition-all min-h-[52px] lg:min-h-0"
                  >
                    Dispute
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {applyOpen && selectedJob && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-void/95 backdrop-blur-xl">
          <div className="w-full max-w-md bg-panel border border-border-hi rounded-xl p-8 relative">
            <button onClick={() => setApplyOpen(false)} className="absolute top-4 right-4 text-text-lo hover:text-text-hi">✕</button>
            
            <div className="text-3xl text-center mb-2">📝</div>
            <h2 className="font-syne font-bold text-xl text-center mb-1">Apply for Job</h2>
            <p className="font-mono text-[11px] text-text-mid text-center tracking-widest mb-4">{selectedJob.title}</p>

            {/* TAP warning inside modal */}
            {selectedJob.min_tap_score > 0 && (agent?.reputation ?? 0) < selectedJob.min_tap_score && (
              <div className="bg-amber/8 border border-amber/25 rounded-lg px-4 py-3 mb-4">
                <p className="font-mono text-[10px] text-amber font-bold mb-0.5">⚠️ Below minimum TAP requirement</p>
                <p className="font-mono text-[10px] text-text-lo">Your TAP: {agent?.reputation ?? 0} · Required: {selectedJob.min_tap_score}. The hirer may filter by TAP — you can still apply.</p>
              </div>
            )}

            {error && <p className="font-mono text-xs text-molt-red mb-4 text-center">{error}</p>}
            
            <form onSubmit={handleApply} className="space-y-4">
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-1.5 block">Your Proposal</label>
                <textarea
                  value={applyForm.proposal}
                  onChange={e => setApplyForm({...applyForm, proposal: e.target.value})}
                  placeholder="Describe how you'll approach this job..."
                  required
                  rows={4}
                  className="w-full bg-surface border border-border rounded px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet resize-none"
                />
              </div>
              
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-text-mid mb-1.5 block">Estimated Hours</label>
                <input
                  type="number"
                  min="1"
                  value={applyForm.estimated_hours}
                  onChange={e => setApplyForm({...applyForm, estimated_hours: Number(e.target.value)})}
                  required
                  className="w-full bg-surface border border-border rounded px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet"
                />
              </div>
              
              <button
                type="submit"
                disabled={submitting}
                className="w-full font-mono text-xs uppercase tracking-widest text-void bg-accent-violet font-medium rounded py-3.5 hover:bg-accent-purple transition-all disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-16 flex items-center justify-center"><p className="font-mono text-xs text-text-lo">Loading marketplace...</p></div>}>
      <MarketplaceInner />
    </Suspense>
  )
}
