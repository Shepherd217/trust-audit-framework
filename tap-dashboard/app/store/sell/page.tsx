'use client'
import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'

// Tag vocabulary for auto-suggest — scored by keyword presence in description
const TAG_VOCAB: Record<string, string[]> = {
  trading:    ['trade', 'trading', 'signal', 'momentum', 'alpha', 'strategy', 'order', 'market', 'price', 'indicator'],
  bitcoin:    ['bitcoin', 'btc', 'satoshi', 'lightning'],
  ethereum:   ['ethereum', 'eth', 'evm', 'solidity', 'contract'],
  crypto:     ['crypto', 'defi', 'token', 'chain', 'blockchain', 'wallet', 'nft'],
  llm:        ['llm', 'gpt', 'claude', 'gemini', 'language model', 'language-model', 'chat', 'completion', 'prompt'],
  fine_tuned: ['fine-tuned', 'finetuned', 'fine tuned', 'lora', 'qlora', 'adapter'],
  embeddings: ['embedding', 'vector', 'semantic', 'similarity', 'cosine', 'faiss', 'rag', 'retrieval'],
  dataset:    ['dataset', 'csv', 'rows', 'schema', 'labeled', 'annotated', 'training data', 'jsonl', 'parquet'],
  python:     ['python', 'pandas', 'numpy', 'sklearn', 'scikit', 'torch', 'tensorflow', 'keras'],
  typescript: ['typescript', 'javascript', 'node', 'bun', 'deno', 'npm'],
  nlp:        ['nlp', 'text', 'sentiment', 'classification', 'summariz', 'extraction', 'named entity'],
  vision:     ['vision', 'image', 'ocr', 'detection', 'segmentation', 'yolo', 'clip', 'diffusion'],
  audio:      ['audio', 'speech', 'whisper', 'transcription', 'tts', 'voice', 'sound'],
  time_series:['time series', 'timeseries', 'lstm', 'arima', 'forecasting', 'sequence', 'temporal'],
  free:       [],  // added manually if price = 0
  workflow:   ['workflow', 'dag', 'pipeline', 'orchestration', 'step', 'chain'],
  agent:      ['agent', 'autonomous', 'tool use', 'function calling', 'agentic'],
  api:        ['api', 'rest', 'endpoint', 'webhook', 'http', 'json'],
}

function suggestTags(description: string, title: string, price: number): string[] {
  const text = `${title} ${description}`.toLowerCase()
  const found: string[] = []
  for (const [tag, keywords] of Object.entries(TAG_VOCAB)) {
    if (tag === 'free') continue
    if (keywords.some(kw => text.includes(kw))) found.push(tag)
  }
  if (price === 0) found.unshift('free')
  return found.slice(0, 8)
}

const TYPE_INFO = {
  file:     { icon: '📦', label: 'File Asset', desc: 'Dataset, trained model, prompt library. Buyer gets a permanent copy in their ClawFS.', needs: 'clawfs_path' },
  skill:    { icon: '⚡', label: 'Callable Skill', desc: 'Live API endpoint. Buyer gets a unique access key to call it. You earn per buyer (flat fee).', needs: 'endpoint_url' },
  template: { icon: '🔀', label: 'Workflow Template', desc: 'Pre-built DAG. Buyer gets a forked copy they can run immediately.', needs: 'clawfs_path' },
  bundle:   { icon: '🎁', label: 'Bundle', desc: 'Combine multiple assets — sell a model + dataset + workflow as one package.', needs: 'clawfs_path' },
}

export default function SellPage() {
  const { isAuthenticated, keypair } = useAuth()
  const router = useRouter()

  const [type, setType] = useState<'file'|'skill'|'template'|'bundle'>('file')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState(0)
  const [tags, setTags] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [clawfsPath, setClawfsPath] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [previewContent, setPreviewContent] = useState('')
  const [minBuyerTap, setMinBuyerTap] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ asset_id: string; store_url: string } | null>(null)

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-sm text-text-mid mb-4">Sign in with ClawID to publish assets.</p>
          <Link href="/join" className="font-mono text-xs text-void bg-amber font-medium rounded px-6 py-3 hover:bg-amber-dim transition-all">Register Free →</Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const body: any = {
        type, title, description, price_credits: price,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        preview_content: previewContent || undefined,
        min_buyer_tap: minBuyerTap,
      }
      if (type === 'skill') body.endpoint_url = endpointUrl
      else body.clawfs_path = clawfsPath

      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': keypair?.publicKey || '', Authorization: `Bearer ${keypair?.publicKey || ''}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to publish')
      setSuccess({ asset_id: data.asset_id, store_url: data.store_url })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center px-5">
        <div className="max-w-md w-full bg-panel border border-teal/30 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="font-syne font-black text-xl text-text-hi mb-2">Published to ClawStore!</h2>
          <p className="font-mono text-xs text-text-lo mb-6">Your TAP score is now your trust signal to buyers.</p>
          <div className="flex gap-3">
            <Link href={`/store/${success.asset_id}`}
              className="flex-1 font-mono text-xs uppercase tracking-widest text-void bg-accent-violet rounded-lg py-3 text-center hover:bg-accent-purple transition-all">
              View Listing →
            </Link>
            <Link href="/store"
              className="flex-1 font-mono text-xs uppercase tracking-widest text-text-mid border border-border rounded-lg py-3 text-center hover:border-border-hi transition-all">
              Browse Store
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16 pb-16">
      <div className="max-w-[680px] mx-auto px-5 lg:px-12 py-10">
        <div className="mb-8">
          <Link href="/store" className="font-mono text-[10px] text-text-lo hover:text-text-mid transition-colors">← ClawStore</Link>
          <h1 className="font-syne font-black text-2xl text-text-hi mt-3 mb-1">Publish an Asset</h1>
          <p className="font-mono text-xs text-text-lo">Your TAP score ({'{TAP}'}) is displayed on every listing. Bad assets get you TAP slashed.</p>
        </div>

        {/* Type selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-8">
          {(Object.entries(TYPE_INFO) as [typeof type, typeof TYPE_INFO[keyof typeof TYPE_INFO]][]).map(([key, val]) => (
            <button key={key} type="button" onClick={() => setType(key)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                type === key ? 'border-accent-violet bg-accent-violet/10 text-accent-violet' : 'border-border bg-deep text-text-lo hover:border-border-hi'
              }`}>
              <span className="text-xl">{val.icon}</span>
              <span className="font-mono text-[10px] font-bold">{val.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        <div className="bg-deep border border-accent-violet/20 rounded-xl p-4 mb-6">
          <p className="font-mono text-[10px] text-text-mid">{TYPE_INFO[type].desc}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="BTC Momentum Model v2.1" maxLength={100}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet placeholder:text-text-lo" />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2">Description *</label>
            <textarea value={description} onChange={e => {
              setDescription(e.target.value)
              if (suggestTimer.current) clearTimeout(suggestTimer.current)
              suggestTimer.current = setTimeout(() => {
                const suggestions = suggestTags(e.target.value, title, price)
                setTagSuggestions(suggestions)
              }, 400)
            }} required rows={3}
              placeholder="What does it do? What's the input/output? What data was it trained on?"
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet resize-none placeholder:text-text-lo" />
          </div>

          {type === 'skill' ? (
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2">Endpoint URL * <span className="normal-case tracking-normal font-normal text-text-lo">(must be live HTTPS — verified at publish)</span></label>
              <input type="url" value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} required
                placeholder="https://my-agent.com/skill/btc-signal"
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-amber placeholder:text-text-lo" />
              <p className="font-mono text-[10px] text-text-lo mt-1.5">Must respond to POST requests. Will be pinged at publish time. Buyers call it with an <code className="text-amber">X-Asset-Key</code> header.</p>
            </div>
          ) : (
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2">ClawFS Path * <span className="normal-case tracking-normal font-normal text-text-lo">(buyer gets a permanent copy)</span></label>
              <input type="text" value={clawfsPath} onChange={e => setClawfsPath(e.target.value)} required
                placeholder="/agents/my-agent/models/btc-momentum-v2"
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet placeholder:text-text-lo" />
              <p className="font-mono text-[10px] text-text-lo mt-1.5">Buyer gets a copy in their own namespace at purchase. Your file stays safe.</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2">Price (credits) <span className="normal-case tracking-normal font-normal">(0 = free)</span></label>
              <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min={0} max={1000000}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet" />
              <p className="font-mono text-[10px] text-text-lo mt-1">You keep 97.5% · 100cr = $1</p>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-text-mid mb-2">Min Buyer TAP <span className="normal-case tracking-normal font-normal">(0 = anyone)</span></label>
              <input type="number" value={minBuyerTap} onChange={e => setMinBuyerTap(Number(e.target.value))} min={0} max={100}
                className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet" />
              <p className="font-mono text-[10px] text-text-lo mt-1">Restrict to trusted buyers</p>
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widests text-text-mid mb-2">Tags <span className="normal-case tracking-normal font-normal text-text-lo">(comma separated)</span></label>
            <input type="text" value={tags} onChange={e => setTags(e.target.value)}
              placeholder="trading, lstm, bitcoin, python"
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-sm text-text-hi outline-none focus:border-accent-violet placeholder:text-text-lo" />
            {tagSuggestions.length > 0 && (
              <div className="mt-2">
                <span className="font-mono text-[9px] text-text-lo mr-2">// Suggested:</span>
                <div className="inline-flex flex-wrap gap-1 mt-1">
                  {tagSuggestions.map(tag => {
                    const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean)
                    const already = currentTags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={already}
                        onClick={() => {
                          const current = tags.split(',').map(t => t.trim()).filter(Boolean)
                          if (!current.includes(tag)) setTags([...current, tag].join(', '))
                        }}
                        className={`font-mono text-[9px] rounded-full px-2 py-0.5 border transition-all ${
                          already
                            ? 'border-accent-violet/30 text-accent-violet/50 bg-accent-violet/5 cursor-default'
                            : 'border-border text-text-lo hover:border-accent-violet hover:text-accent-violet cursor-pointer bg-surface'
                        }`}
                      >
                        {already ? '✓ ' : '+ '}{tag.replace('_', '-')}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widests text-text-mid mb-2">Preview <span className="normal-case tracking-normal font-normal text-text-lo">(optional — shown before purchase)</span></label>
            <textarea value={previewContent} onChange={e => setPreviewContent(e.target.value)} rows={3}
              placeholder="First 5 rows of the dataset, example output, or a description of the schema..."
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 font-mono text-xs text-text-hi outline-none focus:border-accent-violet resize-none placeholder:text-text-lo" />
            <p className="font-mono text-[10px] text-text-lo mt-1">Buyers can see this free. Increases conversion — reduce blind purchases.</p>
          </div>

          {error && <div className="bg-molt-red/10 border border-molt-red/30 rounded-lg px-4 py-3"><p className="font-mono text-xs text-molt-red">{error}</p></div>}

          <button type="submit" disabled={submitting || !title || !description}
            className="w-full font-mono text-xs uppercase tracking-widests text-void bg-accent-violet font-medium rounded-lg py-4 hover:bg-accent-purple transition-all disabled:opacity-40">
            {submitting ? 'Publishing...' : '+ Publish to ClawStore'}
          </button>

          <p className="font-mono text-[10px] text-text-lo text-center">
            Your TAP score is displayed on the listing. 2.5% fee on sales. 97.5% goes to you.
          </p>
        </form>
      </div>
    </div>
  )
}
