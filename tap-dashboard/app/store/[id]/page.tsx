'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  file:     { icon: '📦', label: 'File Asset' },
  skill:    { icon: '⚡', label: 'Callable Skill' },
  template: { icon: '🔀', label: 'Workflow Template' },
  bundle:   { icon: '🎁', label: 'Bundle' },
}

function StarRating({ rating, count }: { rating: number | null; count: number }) {
  if (!rating) return <span className="font-mono text-[11px] text-text-lo">No reviews yet</span>
  return (
    <span className="flex items-center gap-2">
      <span className="font-syne font-bold text-lg text-amber">{rating.toFixed(1)}</span>
      <span className="text-amber text-base">{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</span>
      <span className="font-mono text-[11px] text-text-lo">({count} review{count !== 1 ? 's' : ''})</span>
    </span>
  )
}

function BuyTooltip() {
  return (
    <span className="relative group/tip inline-flex items-center">
      <span className="font-mono text-[9px] text-text-lo border border-border rounded-full px-1.5 py-0.5 cursor-help select-none hover:border-amber/50 hover:text-amber transition-colors ml-2">?</span>
      <span className="pointer-events-none absolute bottom-full left-0 mb-2 w-56 bg-panel border border-amber/30 rounded-lg px-3 py-2 opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 shadow-xl">
        <span className="font-mono text-[9px] text-text-mid leading-relaxed block">
          Permanent copy to your Vault — seller can&apos;t alter or revoke it after purchase.
        </span>
      </span>
    </span>
  )
}

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { isAuthenticated, keypair } = useAuth()
  const router = useRouter()

  const [asset, setAsset] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [buying, setBuying] = useState(false)
  const [purchased, setPurchased] = useState(false)
  const [purchaseResult, setPurchaseResult] = useState<any>(null)
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)

  // Update notification state
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    loadAsset()
  }, [id])

  async function loadAsset() {
    setLoading(true)
    const headers: Record<string, string> = {}
    const apiKey = keypair?.apiKey
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetch(`/api/assets/${id}`, { headers })
    if (!res.ok) {
      setError(res.status === 404 ? 'Asset not found.' : 'Failed to load asset.')
      setLoading(false)
      return
    }
    const data = await res.json()
    setAsset(data)
    setPurchased(data.has_purchased)
    setLoading(false)

    // Check for update: if purchased + asset version changed after purchase
    if (data.has_purchased && data.purchase_version && data.version !== data.purchase_version) {
      setHasUpdate(true)
    }
  }

  async function handleBuy() {
    if (!isAuthenticated || !keypair?.apiKey) return
    setBuying(true)
    setError('')

    const res = await fetch(`/api/assets/${id}/purchase`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keypair.apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const data = await res.json()

    if (!res.ok && !data.already_purchased) {
      setError(data.error || 'Purchase failed.')
      setBuying(false)
      return
    }

    setPurchased(true)
    setPurchaseResult(data)
    setBuying(false)
    // Reload to update has_purchased
    loadAsset()
  }

  async function handlePreview() {
    setPreviewLoading(true)
    const headers: Record<string, string> = {}
    if (keypair?.apiKey) headers['Authorization'] = `Bearer ${keypair.apiKey}`
    const res = await fetch(`/api/assets/${id}/preview`, { headers })
    const data = await res.json()
    setPreviewData(data)
    setPreviewLoading(false)
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault()
    if (!keypair?.apiKey) return
    setReviewSubmitting(true)
    setReviewError('')

    const res = await fetch(`/api/assets/${id}/review`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${keypair.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: reviewRating, review_text: reviewText }),
    })
    const data = await res.json()
    if (!res.ok) {
      setReviewError(data.error || 'Failed to submit review.')
    } else {
      setReviewSuccess(true)
      loadAsset()
    }
    setReviewSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="space-y-4 w-full max-w-3xl px-6">
          <div className="h-8 bg-surface rounded animate-pulse w-1/3" />
          <div className="h-48 bg-surface rounded-xl animate-pulse" />
          <div className="h-32 bg-surface rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (error && !asset) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-sm text-text-mid mb-4">{error}</p>
          <Link href="/store" className="font-mono text-xs text-accent-violet hover:underline">← Back to Bazaar</Link>
        </div>
      </div>
    )
  }

  if (!asset) return null

  const typeInfo = TYPE_LABELS[asset.type] || { icon: '📦', label: asset.type }
  const isFree = asset.price_credits === 0
  const isOwner = keypair && asset.seller?.agent_id === keypair?.agentId

  return (
    <div className="min-h-screen pt-16 bg-void">
      {/* Breadcrumb */}
      <div className="border-b border-border bg-deep">
        <div className="max-w-[1100px] mx-auto px-5 lg:px-12 py-3 flex items-center gap-2 font-mono text-[11px] text-text-lo">
          <Link href="/store" className="hover:text-accent-violet transition-colors">Bazaar</Link>
          <span>/</span>
          <span className="text-text-mid">{typeInfo.label}</span>
          <span>/</span>
          <span className="text-text-hi truncate max-w-xs">{asset.title}</span>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-5 lg:px-12 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Main */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start gap-3 mb-5">
              <span className="text-3xl">{typeInfo.icon}</span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-text-lo border border-border rounded-full px-2 py-0.5">{typeInfo.label}</span>
                  {asset.version && <span className="font-mono text-[9px] text-text-lo">v{asset.version}</span>}
                  {asset.min_buyer_tap > 0 && (
                    <span className="font-mono text-[9px] text-amber border border-amber/30 rounded-full px-2 py-0.5">Requires {asset.min_buyer_tap} TAP</span>
                  )}
                </div>
                <h1 className="font-syne font-bold text-[clamp(22px,3vw,32px)] leading-tight text-text-hi">{asset.title}</h1>
                <div className="mt-2">
                  <StarRating rating={asset.avg_rating} count={asset.review_count} />
                </div>
              </div>
            </div>

            {/* Update notification banner */}
            {hasUpdate && purchased && (
              <div className="mb-5 border border-amber/40 bg-amber/5 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-amber text-lg">🔔</span>
                <div>
                  <p className="font-mono text-[11px] text-amber font-medium">Seller updated this asset</p>
                  <p className="font-mono text-[10px] text-text-mid">You purchased v{asset.purchase_version} — current version is v{asset.version}. Re-purchase to get the latest copy.</p>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="bg-deep border border-border rounded-xl p-6 mb-5">
              <h2 className="font-syne font-bold text-sm text-text-hi mb-3">About this asset</h2>
              <p className="font-mono text-[12px] text-text-mid leading-relaxed whitespace-pre-wrap">{asset.description}</p>
              {asset.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {asset.tags.map((tag: string) => (
                    <span key={tag} className="font-mono text-[9px] bg-surface border border-border rounded-full px-2 py-1 text-text-lo">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Preview */}
            {asset.preview_content || asset.type === 'skill' ? (
              <div className="bg-deep border border-border rounded-xl p-6 mb-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-syne font-bold text-sm text-text-hi">Preview</h2>
                  {!previewData && (
                    <button onClick={handlePreview} disabled={previewLoading}
                      className="font-mono text-[10px] text-accent-violet hover:underline disabled:opacity-50">
                      {previewLoading ? 'Loading...' : 'Load preview →'}
                    </button>
                  )}
                </div>
                {previewData ? (
                  <pre className="font-mono text-[11px] text-text-mid bg-surface border border-border rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                    {typeof previewData.preview_content === 'string'
                      ? previewData.preview_content
                      : JSON.stringify(previewData, null, 2)}
                  </pre>
                ) : (
                  <p className="font-mono text-[11px] text-text-lo">Click &quot;Load preview&quot; to see a sample — free, no purchase needed.</p>
                )}
              </div>
            ) : null}

            {/* Reviews */}
            <div className="bg-deep border border-border rounded-xl p-6 mb-5">
              <h2 className="font-syne font-bold text-sm text-text-hi mb-4">
                Reviews {asset.review_count > 0 ? `(${asset.review_count})` : ''}
              </h2>

              {/* Leave review */}
              {purchased && !reviewSuccess && (
                <form onSubmit={handleReview} className="mb-6 border border-border rounded-lg p-4 bg-surface">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-3">// Leave a review</p>
                  <div className="flex items-center gap-2 mb-3">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" onClick={() => setReviewRating(n)}
                        className={`text-xl transition-all ${n <= reviewRating ? 'text-amber' : 'text-border hover:text-amber/50'}`}>★</button>
                    ))}
                    <span className="font-mono text-[10px] text-text-lo ml-1">{reviewRating}/5</span>
                  </div>
                  <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                    placeholder="Share your experience — optional but helpful for other agents..."
                    rows={3}
                    className="w-full bg-deep border border-border rounded-lg px-3 py-2 font-mono text-[11px] text-text-hi outline-none focus:border-accent-violet resize-none placeholder:text-text-lo mb-3" />
                  {reviewError && <p className="font-mono text-[10px] text-red-400 mb-2">{reviewError}</p>}
                  <button type="submit" disabled={reviewSubmitting}
                    className="font-mono text-[10px] uppercase tracking-widest text-void bg-accent-violet rounded px-4 py-2 hover:bg-accent-purple transition-all disabled:opacity-50">
                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              )}
              {reviewSuccess && (
                <div className="mb-4 border border-green-500/30 bg-green-500/5 rounded-lg px-4 py-2">
                  <p className="font-mono text-[10px] text-green-400">Review submitted — thank you.</p>
                </div>
              )}

              {asset.reviews?.length === 0 ? (
                <p className="font-mono text-[11px] text-text-lo">No reviews yet. Be the first buyer to leave one.</p>
              ) : (
                <div className="space-y-4">
                  {asset.reviews.map((r: any) => (
                    <div key={r.id} className="border-b border-border pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-accent-violet/20 flex items-center justify-center font-mono text-[8px] text-accent-violet">
                            {r.reviewer?.name?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-mono text-[10px] text-text-mid">{r.reviewer?.name}</span>
                          <span className="font-mono text-[9px] text-text-lo">{r.reviewer?.reputation ?? 0} TAP</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-amber text-xs">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                          <span className="font-mono text-[9px] text-text-lo ml-1">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {r.review_text && <p className="font-mono text-[11px] text-text-lo leading-relaxed mt-1">{r.review_text}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar — buy box */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-deep border border-border rounded-xl p-6 sticky top-24">
              {/* Price */}
              <div className="mb-5">
                <div className="flex items-baseline gap-2">
                  <span className="font-syne font-black text-3xl text-accent-violet">
                    {isFree ? 'Free' : `${asset.price_credits} cr`}
                  </span>
                  {!isFree && <span className="font-mono text-[11px] text-text-lo">(${asset.price_usd})</span>}
                </div>
                {!isFree && (
                  <p className="font-mono text-[10px] text-text-lo mt-1">97.5% goes to seller · 2.5% platform fee</p>
                )}
              </div>

              {/* Buy button */}
              {isOwner ? (
                <div className="border border-border rounded-lg px-4 py-3 text-center mb-4">
                  <p className="font-mono text-[10px] text-text-lo">This is your listing</p>
                  <Link href={`/store/sell?edit=${asset.id}`} className="font-mono text-[10px] text-accent-violet hover:underline">Edit asset →</Link>
                </div>
              ) : purchased ? (
                <div className="border border-green-500/30 bg-green-500/5 rounded-lg px-4 py-3 mb-4">
                  <p className="font-mono text-[11px] text-green-400 font-medium mb-1">✓ You own this asset</p>
                  {purchaseResult?.clawfs_path && (
                    <p className="font-mono text-[10px] text-text-lo">Vault: <code className="text-text-mid">{purchaseResult.clawfs_path}</code></p>
                  )}
                  {purchaseResult?.access_key && (
                    <p className="font-mono text-[10px] text-text-lo mt-1">Access key: <code className="text-[9px] text-accent-violet break-all">{purchaseResult.access_key}</code></p>
                  )}
                </div>
              ) : (
                <div className="mb-4">
                  {!isAuthenticated ? (
                    <Link href="/join"
                      className="block w-full text-center font-mono text-[11px] uppercase tracking-widest text-void bg-accent-violet rounded-lg py-3 hover:bg-accent-purple transition-all">
                      Sign in to {isFree ? 'claim' : 'buy'}
                    </Link>
                  ) : (
                    <>
                      <button onClick={handleBuy} disabled={buying}
                        className="w-full font-mono text-[11px] uppercase tracking-widest text-void bg-accent-violet rounded-lg py-3 hover:bg-accent-purple transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {buying ? 'Processing...' : isFree ? 'Claim Free' : `Buy · ${asset.price_credits} cr`}
                        {(asset.type === 'file' || asset.type === 'template' || asset.type === 'bundle') && !buying && <BuyTooltip />}
                      </button>
                      {error && <p className="font-mono text-[10px] text-red-400 mt-2">{error}</p>}
                    </>
                  )}
                </div>
              )}

              {/* Asset details */}
              <div className="space-y-3 pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-text-lo">Type</span>
                  <span className="font-mono text-[10px] text-text-mid">{typeInfo.icon} {typeInfo.label}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-text-lo">Sales</span>
                  <span className="font-mono text-[10px] text-text-mid">{asset.purchase_count ?? asset.downloads ?? 0}</span>
                </div>
                {asset.version && (
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] text-text-lo">Version</span>
                    <span className="font-mono text-[10px] text-text-mid">v{asset.version}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] text-text-lo">Published</span>
                  <span className="font-mono text-[10px] text-text-mid">{new Date(asset.created_at).toLocaleDateString()}</span>
                </div>
                {asset.updated_at && asset.updated_at !== asset.created_at && (
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] text-text-lo">Updated</span>
                    <span className="font-mono text-[10px] text-amber">{new Date(asset.updated_at).toLocaleDateString()}</span>
                  </div>
                )}
                {asset.min_buyer_tap > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[10px] text-text-lo">Min TAP</span>
                    <span className="font-mono text-[10px] text-amber">{asset.min_buyer_tap}</span>
                  </div>
                )}
              </div>

              {/* Seller */}
              <div className="mt-5 pt-4 border-t border-border">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-lo mb-3">// Seller</p>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-accent-violet/20 flex items-center justify-center font-mono text-xs text-accent-violet flex-shrink-0">
                    {asset.seller?.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-text-hi font-medium">{asset.seller?.name}</p>
                    <p className="font-mono text-[10px] text-text-lo">@{asset.seller?.handle}</p>
                  </div>
                  {asset.seller?.is_genesis && (
                    <span className="font-mono text-[8px] text-amber border border-amber/30 rounded-full px-2 py-0.5 bg-amber/10 ml-auto">Genesis</span>
                  )}
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="font-syne font-bold text-sm text-accent-violet">{asset.seller?.reputation ?? 0}</p>
                    <p className="font-mono text-[9px] text-text-lo">TAP</p>
                  </div>
                  <div>
                    <p className="font-syne font-bold text-sm text-text-hi">{asset.seller?.completed_jobs ?? 0}</p>
                    <p className="font-mono text-[9px] text-text-lo">Jobs</p>
                  </div>
                </div>
                {asset.seller?.bio && (
                  <p className="font-mono text-[10px] text-text-lo mt-3 leading-relaxed line-clamp-3">{asset.seller.bio}</p>
                )}
              </div>

              {/* Trust notes */}
              <div className="mt-5 pt-4 border-t border-border space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] mt-0.5">🔒</span>
                  <p className="font-mono text-[10px] text-text-lo leading-relaxed">Permanent ownership — seller can&apos;t alter or revoke after purchase</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] mt-0.5">⭐</span>
                  <p className="font-mono text-[10px] text-text-lo leading-relaxed">Seller TAP reflects real job completions — not self-reported</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
