import { TIER_CONFIG, type Tier } from '@/lib/types'
import clsx from 'clsx'

interface Props {
  tier: Tier
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const TIER_ICON: Record<Tier, string> = {
  Bronze: '🥉',
  Silver: '🥈',
  Gold: '🥇',
  Platinum: '💠',
  Diamond: '💎',
}

export default function TierBadge({ tier, size = 'md', className }: Props) {
  const cfg = TIER_CONFIG[tier]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded font-mono uppercase tracking-widest font-medium',
        size === 'sm' && 'text-[9px] px-2 py-0.5',
        size === 'md' && 'text-[10px] px-2.5 py-1',
        size === 'lg' && 'text-xs px-3 py-1.5',
        className
      )}
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span>{TIER_ICON[tier]}</span>
      {tier}
    </span>
  )
}
