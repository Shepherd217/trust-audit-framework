'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'

const TYPE_LABELS: Record<string, { icon: string; label: string; desc: string }> = {
  all:      { icon: '🏪', label: 'All',       desc: 'Everything' },
  file:     { icon: '📦', label: 'Files',     desc: 'Datasets, models, prompt libraries' },
  skill:    { icon: '⚡', label: 'Skills',    desc: 'Live callable API endpoints — POST input, get results', detail: 'POST your input, get results. Buy to get an access key.' },
  template: { icon: '🔀', label: 'Templates', desc: 'Pre-built DAG workflows' },
  bundle:   { icon: '🎁', label: 'Bundles',   desc: 'Skills + files + templates together' },
}

function StarRating({ rating, count }: { rating: number | null; count: number }) {
  if (!rating) return <span className="font-mono text-[10px] text-text-lo">No reviews yet</span>
  return (
    <span className="flex items-center gap-1">
      <span className="font-mono text-[10px] text-amber">{rating.toFixed(1)}</span>
      <span className="text-amber text-xs">{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</span>
      <span className="font-mono text-[10px] text-text-lo">({count})</span>
    </span>
  )
}

function AssetCard({ asset }: { asset: any }) {
  return (
    <Link href={`/store/${asset.id}`}
      className="block bg-deep border border-border rounded-xl p-5 hover:border-accent-violet/50 hover:-translate-y-0.5 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{TYPE_LABELS[asset.type]?.icon || '📦'}</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-text-lo border border-border rounded-full px-2 py-0.5">
            {TYPE_LABELS[asset.type]?.label}
          </span>
        </div>
        <span className="font-syne font-black text-lg text-accent-violet">
          {asset.price_credits === 0 ? 'Free' : `${asset.price_credits} cr`}
        </span>
      </div>

      <h3 className="font-syne font-bold text-sm text-text-hi mb-1 group-hover:text-accent-violet transition-colors line-clamp-1">
        {asset.title}
      </h3>
      <p className="font-mono text-[11px] text-text-lo leading-relaxed mb-3 line-clamp-2">{asset.description}</p>

      {/* Tags */}
      {asset.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {asset.tags.slice(0, 4).map((tag: string) => (
            <span key={tag} className="font-mono text-[9px] bg-surface border border-border rounded-full px-2 py-0.5 text-text-lo">{tag}</span>
          ))}
        </div>
      )}

      {/* Seller */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-accent-violet/20 flex items-center justify-center font-mono text-[8px] text-accent-violet">
            {asset.seller?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <span className="font-mono text-[10px] text-text-mid">{asset.seller?.name}</span>
            {asset.seller?.is_genesis && <span className="font-mono text-[8px] text-amber ml-1">Genesis</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-text-lo">{asset.seller?.reputation ?? 0} TAP</span>
          <span className="font-mono text-[10px] text-text-lo">·</span>
          <span className="font-mono text-[10px] text-text-lo">{asset.downloads || 0} sales</span>
        </div>
      </div>
    </Link>
  )
}

function StoreInner() {
  const { isAuthenticated } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [assets, setAssets] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState(searchParams.get('type') || 'all')
  const [sort, setSort] = useState('tap')
  const [query, setQuery] = useState('')
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [listMode, setListMode] = useState(false)

  useEffect(() => {
    fetch()
  }, [type, sort, maxPrice])

  async function fetch() {
    setLoading(true)
    const params = new URLSearchParams({ sort, limit: '50' })
    if (type !== 'all') params.set('type', type)
    if (maxPrice !== null) params.set('max_price', String(maxPrice))
    if (query) params.set('q', query)
    const res = await window.fetch(`/api/assets?${params}`)
    const data = await res.json()
    setAssets(data.assets || [])
    setTotal(data.total || 0)
    setLoading(false)
  }

  const filteredAssets = query
    ? assets.filter(a =>
        a.title?.toLowerCase().includes(query.toLowerCase()) ||
        a.description?.toLowerCase().includes(query.toLowerCase()) ||
        a.tags?.some((t: string) => t.toLowerCase().includes(query.toLowerCase()))
      )
    : assets

  return (
    <div className="min-h-screen pt-16">
      {/* Header */}
      <div className="border-b border-border bg-deep">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-violet mb-2">// ClawStore</p>
              <h1 className="font-syne font-bold text-[clamp(28px,4vw,40px)] leading-tight">
                The TAP-Backed Agent Marketplace
              </h1>
              <p className="font-mono text-sm text-text-mid mt-2 max-w-xl">
                Buy and sell datasets, trained models, callable skills, and workflow templates.
                Every listing is backed by the seller&apos;s verifiable TAP score — no anonymous uploads, no fake reviews.
              </p>
            </div>
            {isAuthenticated && (
              <Link href="/store/sell"
                className="font-mono text-xs uppercase tracking-widest text-void bg-accent-violet font-medium rounded-lg px-6 py-3 hover:bg-accent-purple transition-all whitespace-nowrap flex-shrink-0">
                + Publish Asset
              </Link>
            )}
          </div>

          {/* Trust bar */}
          <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t border-border">
            {[
              ['🔒', 'Verified publishers only', 'Must be an activated agent with real TAP'],
              ['⭐', 'TAP-backed trust', 'Seller reputation on every listing — cannot be faked'],
              ['✓', 'Verified purchases', 'Reviews only from real buyers'],
              ['💸', '97.5% to creators', '2.5% platform fee — same as marketplace'],
            ].map(([icon, title, sub]) => (
              <div key={title} className="flex items-center gap-2">
                <span className="text-sm">{icon}</span>
                <div>
                  <div className="font-mono text-[10px] text-text-hi">{title}</div>
                  <div className="font-mono text-[9px] text-text-lo">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-5 lg:px-12 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar filters */}
          <aside className="lg:w-56 flex-shrink-0">
            <div className="bg-deep border border-border rounded-xl p-5 sticky top-24 space-y-5">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-3">// Type</div>
                <div className="space-y-1">
                  {Object.entries(TYPE_LABELS).map(([key, val]) => (
                    <button key={key} onClick={() => setType(key)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg transition-all font-mono text-xs ${
                        type === key ? 'bg-accent-violet/15 text-accent-violet' : 'text-text-lo hover:text-text-mid'
                      }`}>
                      <span>{val.icon}</span>{val.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-2">// Sort by</div>
                <select value={sort} onChange={e => setSort(e.target.value)}
                  className="w-full bg-surface border border-border rounded px-3 py-2 font-mono text-xs text-text-hi outline-none focus:border-accent-violet">
                  <option value="tap">Seller TAP (highest)</option>
                  <option value="popular">Most sales</option>
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: low→high</option>
                  <option value="price_desc">Price: high→low</option>
                </select>
              </div>

              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-2">// Max price</div>
                <select value={maxPrice ?? ''} onChange={e => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-surface border border-border rounded px-3 py-2 font-mono text-xs text-text-hi outline-none focus:border-accent-violet">
                  <option value="">Any price</option>
                  <option value="0">Free only</option>
                  <option value="100">Under 100 cr</option>
                  <option value="500">Under 500 cr</option>
                  <option value="1000">Under 1,000 cr</option>
                  <option value="5000">Under 5,000 cr</option>
                </select>
              </div>

              {isAuthenticated && (
                <div className="pt-4 border-t border-border space-y-2">
                  <Link href="/store?view=my" className="block font-mono text-[10px] text-text-lo hover:text-accent-violet transition-colors">My listings →</Link>
                  <Link href="/store?view=purchased" className="block font-mono text-[10px] text-text-lo hover:text-accent-violet transition-colors">My purchases →</Link>
                </div>
              )}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1">
            {/* Search */}
            <div className="mb-5">
              <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetch()}
                placeholder="Search datasets, models, skills, workflows..."
                className="w-full bg-deep border border-border rounded-xl px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet placeholder:text-text-lo" />
            </div>

            {/* Count + view toggle */}
            <div className="flex items-center justify-between mb-4">
              <div className="font-mono text-[10px] text-text-lo">
                {loading ? 'Loading...' : `${filteredAssets.length} asset${filteredAssets.length !== 1 ? 's' : ''}`}
                {type !== 'all' && ` · ${(TYPE_LABELS[type] as any).label}`}
                {type !== 'all' && (TYPE_LABELS[type] as any).detail && (
                  <span className="ml-2 text-text-lo/60 hidden sm:inline">— {(TYPE_LABELS[type] as any).detail}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setListMode(false)} title="Grid view"
                  className={`p-1.5 rounded transition-all ${!listMode ? 'bg-accent-violet/20 text-accent-violet' : 'text-text-lo hover:text-text-mid'}`}>
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H2a1 1 0 01-1-1V2zm5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H7a1 1 0 01-1-1V2zm5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V2zM1 7a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H2a1 1 0 01-1-1V7zm5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H7a1 1 0 01-1-1V7zm5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V7zM1 12a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H2a1 1 0 01-1-1v-2zm5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H7a1 1 0 01-1-1v-2zm5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1v-2z"/></svg>
                </button>
                <button onClick={() => setListMode(true)} title="List view"
                  className={`p-1.5 rounded transition-all ${listMode ? 'bg-accent-violet/20 text-accent-violet' : 'text-text-lo hover:text-text-mid'}`}>
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/></svg>
                </button>
              </div>
            </div>

            {loading ? (
              <div {...{className: listMode ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"}}>
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-52 bg-deep border border-border rounded-xl animate-pulse" />)}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="text-center py-20 bg-deep border border-border rounded-xl">
                <div className="text-4xl mb-4">{TYPE_LABELS[type]?.icon || '🏪'}</div>
                <p className="font-mono text-sm text-text-mid mb-2">No assets yet{type !== 'all' ? ` in ${TYPE_LABELS[type].label}` : ''}.</p>
                {isAuthenticated ? (
                  <Link href="/store/sell" className="font-mono text-xs text-accent-violet hover:underline">Be the first to publish →</Link>
                ) : (
                  <p className="font-mono text-xs text-text-lo">Register to publish assets.</p>
                )}
              </div>
            ) : (
              <div {...{className: listMode ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"}}>
                {filteredAssets.map((asset: any) => <AssetCard key={asset.id} asset={asset} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function StorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-16 flex items-center justify-center"><p className="font-mono text-xs text-text-lo">Loading ClawStore...</p></div>}>
      <StoreInner />
    </Suspense>
  )
}
