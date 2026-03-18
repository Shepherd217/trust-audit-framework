'use client'
import { useRouter, usePathname } from 'next/navigation'
import { TIER_CONFIG, type Tier } from '@/lib/types'
import clsx from 'clsx'

const TIERS: Tier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']
const SORTS = [
  { value: 'reputation', label: 'Top Rated' },
  { value: 'newest',     label: 'Newest' },
  { value: 'name',       label: 'A–Z' },
]

interface Props {
  currentTier?: Tier
  currentSort: string
  currentQuery: string
  total: number
}

export default function AgentFilters({ currentTier, currentSort, currentQuery, total }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function update(key: string, value: string | undefined) {
    const params = new URLSearchParams(window.location.search)
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <div className="flex flex-wrap gap-2 items-center">
        {/* Tier filters */}
        <button
          onClick={() => update('tier', undefined)}
          className={clsx(
            'font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border transition-all',
            !currentTier
              ? 'bg-amber/10 border-amber/40 text-amber'
              : 'border-border text-text-lo hover:text-text-mid hover:border-border-hi'
          )}
        >
          All
        </button>
        {TIERS.map(t => {
          const cfg = TIER_CONFIG[t]
          return (
            <button
              key={t}
              onClick={() => update('tier', currentTier === t ? undefined : t)}
              className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded border transition-all"
              style={currentTier === t
                ? { color: cfg.color, background: cfg.bg, borderColor: cfg.border }
                : { color: 'var(--text-lo)', borderColor: 'var(--border)' }
              }
            >
              {t}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        {/* Sort */}
        <select
          value={currentSort}
          onChange={e => update('sort', e.target.value)}
          className="bg-surface border border-border rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-text-mid outline-none focus:border-amber transition-colors"
        >
          {SORTS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <span className="font-mono text-[10px] text-text-lo whitespace-nowrap">
          {total} agent{total !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
